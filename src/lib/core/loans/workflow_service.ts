/**
 * Loan workflow service
 * Handles loan lifecycle operations with email notifications and activity logging
 */

import { logActivity } from '$lib/core/activity/activity_service';
import {
	getCustomerById,
	incrementCustomerLoans,
	markCustomerLoanRepaid
} from '$lib/core/customers/customer_service';
import { pb } from '$lib/infra/db/pb';
import { sendEmailWithAttachments } from '$lib/services/email/client';
import {
	compileEmailTemplate,
	sendTemplateEmail,
	TEMPLATE_KEYS,
} from '$lib/services/email/email_template_service';
import { notifyLoanClosed, notifyLoanDisbursed, notifyPaymentRecorded } from '$lib/services/email/notification_service';
import { assertPermission, type UserPermissions } from '$lib/services/roles/permission_checker';
import { Permission } from '$lib/services/roles/permissions';
import { formatKES } from '$lib/shared/currency';
import { formatDate, nowISO, todayISO } from '$lib/shared/date_time';
import { ForbiddenError, NotFoundError, ValidationError } from '$lib/shared/errors';
import { generateLoanApplicationPDF, type CompanyInfo, type LoanApplicationData } from '$lib/shared/pdfGenerator';
import {
	ActivitiesActivityTypeOptions, ActivitiesEntityTypeOptions,
	Collections,
	LoansStatusOptions,
	type CustomersResponse,
	type LoanSettingsResponse,
	type LoansResponse,
	type OrganizationResponse
} from '$lib/types';
import {
	calculateLoan,
	DEFAULT_LOAN_SETTINGS,
	type LoanCalculationSettings
} from './loan_calculations';
import { getLoanById, type LoanWithRelations } from './loan_service';

// Email templates (will be loaded dynamically in production)
const EMAIL_TEMPLATES: Record<string, string> = {};

/**
 * Helper function to safely extract customer from loan expand or fetch from DB
 * This handles the case where PocketBase expand might not be accessible
 */
async function getCustomerFromLoan(
	loan: LoanWithRelations,
	context: string
): Promise<CustomersResponse> {
	let customer: CustomersResponse | undefined;
	
	// Try to get customer from expand
	if (loan.expand && typeof loan.expand === 'object') {
		const expandObj = loan.expand as Record<string, unknown>;
		if (expandObj.customer && typeof expandObj.customer === 'object') {
			customer = expandObj.customer as CustomersResponse;
		}
	}
	
	// Fallback: fetch customer directly if expand is missing
	if (!customer && loan.customer) {
		try {
			customer = await getCustomerById(loan.customer);
		} catch (e) {
			// console.error(`[${context}] Failed to fetch customer ${loan.customer}:`, e);
		}
	}
	
	if (!customer) {
		throw new NotFoundError('Customer', loan.customer);
	}
	
	return customer;
}

/**
 * Approve loan input
 */
export interface ApproveLoanInput {
	loanId: string;
	approvedAmount?: number; // Optional: if different from requested
	notes?: string;
}

/**
 * Reject loan input
 */
export interface RejectLoanInput {
	loanId: string;
	reason: string;
	notes?: string;
}

/**
 * Disburse loan input
 */
export interface DisburseLoanInput {
	loanId: string;
	transactionReference?: string;
	disbursementMethod?: string;
	notes?: string;
}

/**
 * Record payment input
 */
export interface RecordPaymentInput {
	loanId: string;
	amount: number;
	paymentMethod: string;
	transactionReference?: string;
	notes?: string;
}

/**
 * Waive penalty input
 */
export interface WaivePenaltyInput {
	loanId: string;
	waiveAmount: number;
	reason: string;
}

/**
 * Get organization settings for emails
 */
async function getOrganization(): Promise<OrganizationResponse> {
	const orgs = await pb.collection(Collections.Organization).getFullList<OrganizationResponse>();
	if (orgs.length === 0) {
		throw new NotFoundError('Organization', 'default');
	}
	return orgs[0];
}

/**
 * Get loan settings
 */
async function getLoanSettings(): Promise<LoanSettingsResponse | null> {
	try {
		const settings = await pb
			.collection(Collections.LoanSettings)
			.getFirstListItem<LoanSettingsResponse>('');
		return settings;
	} catch {
		return null;
	}
}

/**
 * Approve a loan (with optional amount adjustment)
 */
export async function approveWithAmount(
	input: ApproveLoanInput,
	userId: string,
	userPermissions: UserPermissions
): Promise<LoansResponse> {
	assertPermission(userPermissions, Permission.LOANS_APPROVE);

	const loan = await getLoanById(input.loanId);


	if (loan.status !== LoansStatusOptions.pending) {
		throw new ForbiddenError(`Cannot approve loan with status '${loan.status}'`);
	}

	// Get customer using helper function
	const customer = await getCustomerFromLoan(loan, 'approveWithAmount');


	// Get current loan settings to snapshot
	const dbSettings = await getLoanSettings();

	// Create settings snapshot - these terms will apply for the life of this loan
	const settingsSnapshot = {
		interest_rate_15_days: dbSettings?.interest_rate_15_days ?? DEFAULT_LOAN_SETTINGS.interestRate15Days,
		interest_rate_30_days: dbSettings?.interest_rate_30_days ?? DEFAULT_LOAN_SETTINGS.interestRate30Days,
		processing_fee_rate: dbSettings?.processing_fee_rate ?? DEFAULT_LOAN_SETTINGS.processingFeeRate,
		penalty_rate: dbSettings?.penalty_rate ?? dbSettings?.late_payment_penalty_rate ?? DEFAULT_LOAN_SETTINGS.penaltyRate,
		grace_period_days: dbSettings?.grace_period_days ?? DEFAULT_LOAN_SETTINGS.gracePeriodDays,
		penalty_period_days: dbSettings?.penalty_period_days ?? DEFAULT_LOAN_SETTINGS.penaltyPeriodDays,
		max_loan_percentage: dbSettings?.max_loan_percentage ?? DEFAULT_LOAN_SETTINGS.maxLoanPercentage,
		min_loan_amount: dbSettings?.min_loan_amount ?? DEFAULT_LOAN_SETTINGS.minLoanAmount,
		max_loan_amount: dbSettings?.max_loan_amount ?? DEFAULT_LOAN_SETTINGS.maxLoanAmount
	};

	// Calculate new loan details if amount changed
	let updateData: Partial<LoansResponse> = {
		status: LoansStatusOptions.approved,
		approved_by: userId,
		approved_at: nowISO() as unknown as import('$lib/types').IsoAutoDateString,
		settings_snapshot: settingsSnapshot
	};

	if (input.approvedAmount && input.approvedAmount !== loan.loan_amount) {
		// Recalculate loan with new amount using snapshotted settings
		const settings: LoanCalculationSettings = {
			interestRate15Days: settingsSnapshot.interest_rate_15_days,
			interestRate30Days: settingsSnapshot.interest_rate_30_days,
			processingFeeRate: settingsSnapshot.processing_fee_rate,
			penaltyRate: settingsSnapshot.penalty_rate,
			gracePeriodDays: settingsSnapshot.grace_period_days,
			penaltyPeriodDays: settingsSnapshot.penalty_period_days,
			maxLoanPercentage: settingsSnapshot.max_loan_percentage,
			minLoanAmount: settingsSnapshot.min_loan_amount,
			maxLoanAmount: settingsSnapshot.max_loan_amount
		};

		const calculation = calculateLoan(
			input.approvedAmount,
			loan.due_date,
			settings
		);

		updateData = {
			...updateData,
			loan_amount: input.approvedAmount,
			interest_amount: calculation.interestAmount,
			processing_fee: calculation.processingFee,
			disbursement_amount: calculation.disbursementAmount,
			total_repayment: calculation.totalRepayment,
			balance: calculation.totalRepayment
		};
	}

	if (input.notes) {
		const timestamp = new Date().toLocaleString();
		updateData.notes = loan.notes
			? `${loan.notes}\n\n[${timestamp}] Approved: ${input.notes}`
			: `[${timestamp}] Approved: ${input.notes}`;
	}

	const updatedLoan = await pb
		.collection(Collections.Loans)
		.update<LoansResponse>(input.loanId, updateData);

	// Log activity
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.loan_approved,
		description: `Loan ${loan.loan_number} approved for ${formatKES(input.approvedAmount || loan.loan_amount)}`,
		entityType: ActivitiesEntityTypeOptions.loan,
		entityId: input.loanId,
		userId,
		metadata: {
			loanNumber: loan.loan_number,
			originalAmount: loan.loan_amount,
			approvedAmount: input.approvedAmount || loan.loan_amount,
			amountChanged: input.approvedAmount && input.approvedAmount !== loan.loan_amount,
			settingsSnapshotted: true
		}
	});

	// Note: No approval email - only send emails on rejection and disbursement

	return updatedLoan;
}

/**
 * Reject a loan with reason
 */
export async function rejectWithReason(
	input: RejectLoanInput,
	userId: string,
	userPermissions: UserPermissions
): Promise<LoansResponse> {
	assertPermission(userPermissions, Permission.LOANS_REJECT);

	const loan = await getLoanById(input.loanId);

	if (loan.status !== LoansStatusOptions.pending) {
		throw new ForbiddenError(`Cannot reject loan with status '${loan.status}'`);
	}

	if (!input.reason || input.reason.trim().length < 5) {
		throw new ValidationError('Rejection reason must be at least 5 characters');
	}

	// Get customer using helper function
	const customer = await getCustomerFromLoan(loan, 'rejectWithReason');

	let notes = loan.notes || '';
	const timestamp = new Date().toLocaleString();
	notes = notes
		? `${notes}\n\n[${timestamp}] Rejected: ${input.reason}`
		: `[${timestamp}] Rejected: ${input.reason}`;

	if (input.notes) {
		notes += `\nAdditional notes: ${input.notes}`;
	}

	const updatedLoan = await pb.collection(Collections.Loans).update<LoansResponse>(input.loanId, {
		status: LoansStatusOptions.rejected,
		rejected_by: userId,
		rejected_at: nowISO(),
		rejection_reason: input.reason.trim(),
		notes
	});

	// Log activity
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.loan_rejected,
		description: `Loan ${loan.loan_number} rejected: ${input.reason}`,
		entityType: ActivitiesEntityTypeOptions.loan,
		entityId: input.loanId,
		userId,
		metadata: {
			loanNumber: loan.loan_number,
			reason: input.reason
		}
	});

	// Send rejection email
	await sendRejectionEmail(loan, customer, input.reason);

	return updatedLoan;
}

/**
 * Disburse funds for approved loan
 */
export async function disburseFunds(
	input: DisburseLoanInput,
	userId: string,
	userPermissions: UserPermissions
): Promise<LoansResponse> {
	assertPermission(userPermissions, Permission.LOANS_DISBURSE);

	const loan = await getLoanById(input.loanId);

	if (loan.status !== LoansStatusOptions.approved) {
		throw new ForbiddenError(`Cannot disburse loan with status '${loan.status}'`);
	}

	// Get customer using helper function
	const customer = await getCustomerFromLoan(loan, 'disburseFunds');

	let notes = loan.notes || '';
	const timestamp = new Date().toLocaleString();
	const txRefNote = input.transactionReference ? ` (Ref: ${input.transactionReference})` : '';
	notes = notes
		? `${notes}\n\n[${timestamp}] Disbursed${txRefNote}${input.notes ? ': ' + input.notes : ''}`
		: `[${timestamp}] Disbursed${txRefNote}${input.notes ? ': ' + input.notes : ''}`;

	const updatedLoan = await pb.collection(Collections.Loans).update<LoansResponse>(input.loanId, {
		status: LoansStatusOptions.disbursed,
		disbursed_by: userId,
		disbursement_date: nowISO(),
		notes
	});

	// Update customer loan stats
	try {
		await incrementCustomerLoans(loan.customer, loan.loan_amount);
	} catch (error) {
		// console.warn(`[disburseFunds] Failed to update customer loan stats for customer ${loan.customer}:`, error);
		// Don't fail the disbursement if stats update fails, but log it
	}

	// Log activity
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.loan_disbursed,
		description: `Loan ${loan.loan_number} disbursed: ${formatKES(loan.disbursement_amount)}${input.transactionReference ? ` (Ref: ${input.transactionReference})` : ''}`,
		entityType: ActivitiesEntityTypeOptions.loan,
		entityId: input.loanId,
		userId,
		metadata: {
			loanNumber: loan.loan_number,
			disbursementAmount: loan.disbursement_amount,
			disbursementMethod: loan.disbursement_method,
			transactionReference: input.transactionReference
		}
	});

	// Send disbursement email
	try {
		await sendDisbursementEmail(updatedLoan, customer);
	} catch (error) {
		// console.warn(`[disburseFunds] Failed to send disbursement email for loan ${loan.id}:`, error);
	}

	// Notify admin users about disbursement
	try {
		await notifyLoanDisbursed({
			customerName: customer.name,
			loanNumber: loan.loan_number,
			disbursementAmount: loan.disbursement_amount,
			dueDate: loan.due_date
		});
	} catch { /* don't block on notification failure */ }

	return updatedLoan;
}

/**
 * Waive penalty on a loan
 */
export async function waivePenalty(
	input: WaivePenaltyInput,
	userId: string,
	userPermissions: UserPermissions
): Promise<LoansResponse> {
	assertPermission(userPermissions, Permission.LOANS_UPDATE);

	const loan = await getLoanById(input.loanId);

	if (!loan.penalty_amount || loan.penalty_amount <= 0) {
		throw new ValidationError('Loan has no penalty to waive');
	}

	if (input.waiveAmount <= 0) {
		throw new ValidationError('Waive amount must be greater than 0');
	}

	if (input.waiveAmount > (loan.penalty_amount || 0)) {
		throw new ValidationError('Waive amount cannot exceed current penalty');
	}

	if (!input.reason || input.reason.trim().length < 5) {
		throw new ValidationError('Waiver reason must be at least 5 characters');
	}

	const newPenalty = (loan.penalty_amount || 0) - input.waiveAmount;
	const newBalance = (loan.balance || 0) - input.waiveAmount;

	const timestamp = new Date().toLocaleString();
	const notes = loan.notes
		? `${loan.notes}\n\n[${timestamp}] Penalty waived: ${formatKES(input.waiveAmount)} - ${input.reason}`
		: `[${timestamp}] Penalty waived: ${formatKES(input.waiveAmount)} - ${input.reason}`;

	const updatedLoan = await pb.collection(Collections.Loans).update<LoansResponse>(input.loanId, {
		penalty_amount: newPenalty,
		balance: newBalance,
		notes
	});

	// Log activity
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.penalty_waived,
		description: `Penalty waived on loan ${loan.loan_number}: ${formatKES(input.waiveAmount)}`,
		entityType: ActivitiesEntityTypeOptions.loan,
		entityId: input.loanId,
		userId,
		metadata: {
			loanNumber: loan.loan_number,
			waivedAmount: input.waiveAmount,
			reason: input.reason,
			newPenalty,
			newBalance
		}
	});

	// Send Waiver Email
	try {
		const customer = await getCustomerFromLoan(loan, 'waivePenalty');
		if (customer) {
			const org = await getOrganization();
			await sendTemplateEmail(
				TEMPLATE_KEYS.PENALTY_WAIVER,
				customer.email,
				{
					borrower_name: customer.name.split(' ')[0],
					waiver_amount: formatKES(input.waiveAmount),
					new_total_due: formatKES(newBalance),
					principal_amount: formatKES(loan.loan_amount || 0),
					interest_amount: formatKES(loan.interest_amount || 0),
					processing_fee: formatKES(loan.processing_fee || 0),
					original_penalty: formatKES(loan.penalty_amount || 0),
					payment_instructions: `Pay via Paybill ${org.mpesa_paybill || '123456'}, Account Number ${org.account_number || 'Your ID'}`,
					COMPANY_NAME: org.name
				},
				{
					customerId: customer.id,
					loanId: loan.id,
					isAutomated: true
				}
			);
		}
	} catch (error) {
		// console.warn('Failed to send penalty waiver email:', error);
	}

	return updatedLoan;
}

/**
 * Mark loan as defaulted
 */
export async function markAsDefaulted(
	loanId: string,
	userId: string,
	reason: string,
	userPermissions: UserPermissions
): Promise<LoansResponse> {
	assertPermission(userPermissions, Permission.LOANS_UPDATE);

	const loan = await getLoanById(loanId);

	const validStatuses = [
		LoansStatusOptions.disbursed,
		LoansStatusOptions.partially_paid
	];

	if (!validStatuses.includes(loan.status as LoansStatusOptions)) {
		throw new ForbiddenError(`Cannot mark loan with status '${loan.status}' as defaulted`);
	}

	const timestamp = new Date().toLocaleString();
	const notes = loan.notes
		? `${loan.notes}\n\n[${timestamp}] Marked as defaulted: ${reason}`
		: `[${timestamp}] Marked as defaulted: ${reason}`;

	const updatedLoan = await pb.collection(Collections.Loans).update<LoansResponse>(loanId, {
		status: LoansStatusOptions.defaulted,
		default_date: nowISO(),
		notes
	});

	// Log activity
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.loan_defaulted,
		description: `Loan ${loan.loan_number} marked as defaulted`,
		entityType: ActivitiesEntityTypeOptions.loan,
		entityId: loanId,
		userId,
		metadata: {
			loanNumber: loan.loan_number,
			reason,
			balance: loan.balance,
			daysOverdue: loan.days_overdue
		}
	});

	return updatedLoan;
}

/**
 * Close loan as write-off input
 */
export interface CloseLoanInput {
	loanId: string;
	reason: string;
	notes?: string;
}

/**
 * Close a defaulted loan as write-off (loss)
 */
export async function closeLoanAsWriteOff(
	input: CloseLoanInput,
	userId: string,
	userPermissions: UserPermissions
): Promise<LoansResponse> {
	assertPermission(userPermissions, Permission.LOANS_UPDATE);

	const loan = await getLoanById(input.loanId);

	// Only defaulted loans can be written off
	if (loan.status !== LoansStatusOptions.defaulted) {
		throw new ForbiddenError(`Cannot write off loan with status '${loan.status}'. Only defaulted loans can be written off.`);
	}

	if (!input.reason || input.reason.trim().length < 5) {
		throw new ValidationError('Write-off reason must be at least 5 characters');
	}

	const timestamp = new Date().toLocaleString();
	let notes = loan.notes || '';
	notes = notes
		? `${notes}\n\n[${timestamp}] Written off: ${input.reason}`
		: `[${timestamp}] Written off: ${input.reason}`;

	if (input.notes) {
		notes += `\nAdditional notes: ${input.notes}`;
	}

	const updatedLoan = await pb.collection(Collections.Loans).update<LoansResponse>(input.loanId, {
		status: LoansStatusOptions.closed,
		closure_date: nowISO(),
		closure_reason: 'written_off',
		notes
	});

	// Log activity
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.loan_closed,
		description: `Loan ${loan.loan_number} written off: ${input.reason}`,
		entityType: ActivitiesEntityTypeOptions.loan,
		entityId: input.loanId,
		userId,
		metadata: {
			loanNumber: loan.loan_number,
			reason: input.reason,
			closureReason: 'written_off',
			outstandingBalance: loan.balance,
			lossAmount: loan.balance
		}
	});

	// Send Closure Email
	try {
		const customer = await getCustomerFromLoan(loan, 'closeLoanAsWriteOff');
		if (customer) {
			const org = await getOrganization();
			await sendTemplateEmail(
				TEMPLATE_KEYS.LOAN_CLOSED,
				customer.email,
				{
					borrower_name: customer.name.split(' ')[0],
					closure_reason: input.reason,
					closure_date: formatDate(todayISO()),
					final_status: 'Closed (Write-off)',
					COMPANY_NAME: org.name
				},
				{
					customerId: customer.id,
					loanId: loan.id,
					isAutomated: true
				}
			);
		}
	} catch (error) {
		// console.warn('Failed to send loan closure email:', error);
	}

	// Notify admin users about loan closure
	try {
		const closedCustomer = await getCustomerFromLoan(loan, 'closeLoanAsWriteOff-notify');
		await notifyLoanClosed({
			customerName: closedCustomer.name,
			loanNumber: loan.loan_number,
			reason: input.reason,
			outstandingBalance: loan.balance || 0
		});
	} catch { /* don't block on notification failure */ }

	return updatedLoan;
}

/**
 * Record a payment with email notification
 */
export async function recordPaymentWithEmail(
	input: RecordPaymentInput,
	userId: string,
	userPermissions: UserPermissions
): Promise<LoansResponse> {
	assertPermission(userPermissions, Permission.PAYMENTS_CREATE);

	// Validate amount
	if (!input.amount || input.amount <= 0) {
		throw new ValidationError('Payment amount must be greater than 0');
	}

	const loan = await getLoanById(input.loanId);

	// Allow payments on disbursed, partially_paid, or defaulted loans
	const validStatuses = [
		LoansStatusOptions.disbursed,
		LoansStatusOptions.partially_paid,
		LoansStatusOptions.defaulted
	];

	if (!validStatuses.includes(loan.status as LoansStatusOptions)) {
		throw new ForbiddenError(`Cannot record payment for loan with status '${loan.status}'`);
	}

	// Get customer using helper function
	const customer = await getCustomerFromLoan(loan, 'recordPaymentWithEmail');

	// Calculate new balances
	const newAmountPaid = (loan.amount_paid || 0) + input.amount;
	const currentBalance = loan.balance || loan.total_repayment || 0;
	const newBalance = Math.max(0, currentBalance - input.amount);

	// Determine new status
	let newStatus = loan.status;
	if (newBalance <= 0) {
		newStatus = LoansStatusOptions.repaid;
	} else if (newAmountPaid > 0 && loan.status !== LoansStatusOptions.defaulted) {
		newStatus = LoansStatusOptions.partially_paid;
	}

	// Build notes
	const timestamp = new Date().toLocaleString();
	const paymentNote = `Payment of ${formatKES(input.amount)} via ${input.paymentMethod}${input.transactionReference ? ` (Ref: ${input.transactionReference})` : ''}`;
	const notes = loan.notes
		? `${loan.notes}\n\n[${timestamp}] ${paymentNote}`
		: `[${timestamp}] ${paymentNote}`;

	// Create payment record
	const payment = await pb.collection(Collections.Payments).create({
		loan: input.loanId,
		customer: loan.customer,
		amount: input.amount,
		payment_method: input.paymentMethod,
		transaction_reference: input.transactionReference?.trim() || '',
		payment_date: nowISO(),
		notes: input.notes?.trim() || '',
		recorded_by: userId
	});

	// Update loan
	const updatedLoan = await pb.collection(Collections.Loans).update<LoansResponse>(input.loanId, {
		amount_paid: newAmountPaid,
		balance: newBalance,
		status: newStatus,
		notes,
		...(newStatus === LoansStatusOptions.repaid ? { repayment_date: nowISO() } : {})
	});

	// Mark customer loan as repaid if fully paid
	if (newStatus === LoansStatusOptions.repaid) {
		await markCustomerLoanRepaid(loan.customer, newAmountPaid);
	}

	// Log activity
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.payment_received,
		description: `Payment of ${formatKES(input.amount)} received for loan ${loan.loan_number}`,
		entityType: ActivitiesEntityTypeOptions.payment,
		entityId: payment.id,
		userId,
		metadata: {
			loanNumber: loan.loan_number,
			loanId: input.loanId,
			amount: input.amount,
			paymentMethod: input.paymentMethod,
			transactionReference: input.transactionReference,
			newBalance,
			previousBalance: currentBalance,
			isFullPayment: newBalance <= 0
		}
	});

	// Send payment confirmation email
	if (customer) {
		await sendPaymentConfirmationEmail(updatedLoan, customer, {
			amountPaid: input.amount,
			balance: newBalance,
			transactionReference: input.transactionReference,
			totalPaid: newAmountPaid,
			isFullPayment: newBalance <= 0
		});
	}

	// Notify admin users about payment
	try {
		await notifyPaymentRecorded({
			customerName: customer.name,
			loanNumber: loan.loan_number,
			amountPaid: input.amount,
			newBalance,
			isFullPayment: newBalance <= 0
		});
	} catch { /* don't block on notification failure */ }

	return updatedLoan;
}

/**
 * Send payment confirmation email
 */
async function sendPaymentConfirmationEmail(
	loan: LoansResponse,
	customer: CustomersResponse,
	paymentDetails: {
		amountPaid: number;
		balance: number;
		transactionReference?: string;
		totalPaid: number;
		isFullPayment: boolean;
		waiverAmount?: number;
	}
): Promise<void> {
	try {
		const org = await getOrganization();

		if (paymentDetails.isFullPayment) {
			// Send Loan Fully Paid email
			await sendTemplateEmail(
				TEMPLATE_KEYS.LOAN_FULLY_PAID,
				customer.email,
				{
					borrower_name: customer.name.split(' ')[0],
					final_payment_amount: formatKES(paymentDetails.amountPaid),
					closure_date: formatDate(todayISO()),
					transaction_code: paymentDetails.transactionReference || 'N/A',
					original_amount: formatKES(loan.loan_amount || 0),
					COMPANY_NAME: org.name
				},
				{
					customerId: customer.id,
					loanId: loan.id,
					isAutomated: true
				}
			);
		} else {
			// Send Payment Received email
			await sendTemplateEmail(
				TEMPLATE_KEYS.PAYMENT_RECEIVED,
				customer.email,
				{
					borrower_name: customer.name.split(' ')[0],
					payment_amount: formatKES(paymentDetails.amountPaid),
					remaining_balance: formatKES(paymentDetails.balance),
					transaction_code: paymentDetails.transactionReference || 'N/A',
					payment_date: formatDate(todayISO()),
					payment_instructions: `Pay via Paybill ${org.mpesa_paybill || '123456'}, Account Number ${org.account_number || 'Your ID'}`,
					COMPANY_NAME: org.name
				},
				{
					customerId: customer.id,
					loanId: loan.id,
					isAutomated: true
				}
			);
		}
	} catch (error) {
		// console.error('Failed to send payment confirmation email:', error);
	}
}
/**
 * Send approval email to customer
 */
async function sendApprovalEmail(
	loan: LoansResponse,
	customer: CustomersResponse
): Promise<void> {
	// Template not provided in current setup, skipping email or implement LOAN_APPROVED if needed
	// console.log(`[sendApprovalEmail] Skipping approval email for loan ${loan.loan_number} (no template configured)`);
}

/**
 * Send rejection email to customer
 */
async function sendRejectionEmail(
	loan: LoansResponse,
	customer: CustomersResponse,
	reason: string
): Promise<void> {
	try {
		const org = await getOrganization();

		await sendTemplateEmail(
			TEMPLATE_KEYS.APPLICATION_REJECTED,
			customer.email,
			{
				applicant_name: customer.name.split(' ')[0],
				rejection_reason: reason,
				COMPANY_NAME: org.name
			},
			{
				customerId: customer.id,
				loanId: loan.id,
				isAutomated: true
			}
		);
	} catch (error) {
		// console.error('Failed to send rejection email:', error);
	}
}

/**
 * Send disbursement email to customer with PDF attachment
 */
async function sendDisbursementEmail(
	loan: LoansResponse,
	customer: CustomersResponse
): Promise<void> {
	try {
		const org = await getOrganization();

		// Compile template logic manually to add attachment
		const vars = {
			borrower_name: customer.name.split(' ')[0],
			disbursed_amount: formatKES(loan.disbursement_amount || 0),
			disbursement_date: formatDate(loan.disbursement_date || todayISO()),
			disbursement_method: loan.disbursement_method === 'mpesa' ? 'M-Pesa' : 'Bank Transfer',
			loan_term: `${loan.loan_period_days} days`,
			interest_amount: formatKES(loan.interest_amount || 0),
			processing_fee: formatKES(loan.processing_fee || 0),
			total_repayment: formatKES(loan.total_repayment || 0),
			due_date: formatDate(loan.due_date),
			payment_instructions: `Pay via Paybill ${org.mpesa_paybill || '123456'}, Account Number ${org.account_number || 'Your ID'}`, // TODO: settings
			COMPANY_NAME: org.name
		};

		const compiled = await compileEmailTemplate(TEMPLATE_KEYS.LOAN_DISBURSED, vars);
		if (!compiled) {
			// console.warn(`Disbursement template ${TEMPLATE_KEYS.LOAN_DISBURSED} not found`);
			return;
		}

		// Generate PDF attachment
		let pdfBuffer: Buffer | undefined;
		try {
			const nameParts = customer.name.split(' ');
			const pdfData: LoanApplicationData = {
				firstName: nameParts[0] || '',
				middleName: nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : undefined,
				lastName: nameParts[nameParts.length - 1] || '',
				email: customer.email,
				phoneNumber: customer.phone,
				nationalId: customer.national_id,
				kraPin: customer.kra_pin,
				residentialAddress: customer.residential_address,
				employerName: customer.employer_name,
				employerLocation: customer.employer_branch,
				netSalary: formatKES(customer.net_salary || 0),
				nextSalaryPayDate: formatDate(loan.due_date),
				loanPurpose: loan.loan_purpose || 'Personal',
				requestedAmount: formatKES(loan.loan_amount || 0),
				disbursementMethod: loan.disbursement_method === 'mpesa' ? 'M-Pesa' : 'Bank Transfer',
				mpesaNumber: loan.mpesa_number,
				bankName: loan.bank_name,
				bankAccount: loan.bank_account,
				accountName: loan.account_name,
				loanAmount: loan.loan_amount || 0,
				interestAmount: loan.interest_amount || 0,
				processingFee: loan.processing_fee || 0,
				totalAmount: loan.total_repayment || 0,
				repaymentDate: formatDate(loan.due_date),
				daysToDueDate: loan.loan_period_days || 0,
				digitalSignature: loan.digital_signature || customer.name,
				applicationDate: formatDate(loan.application_date || loan.created),
				applicationId: loan.loan_number
			};

			const companyInfo: CompanyInfo = {
				name: org.name,
				email: org.email,
				phone: org.phone,
				paybill: org.mpesa_paybill,
				bankName: org.bank_name,
				bankAccount: org.bank_account
			};

			const pdfDoc = generateLoanApplicationPDF(pdfData, companyInfo);
			// Validate PDF output
			if (pdfDoc) {
				const pdfArrayBuffer = pdfDoc.output('arraybuffer');
				pdfBuffer = Buffer.from(pdfArrayBuffer);
			}
		} catch (pdfError) {
			// console.error('[sendDisbursementEmail] PDF Generation failed:', pdfError);
		}

		if (pdfBuffer) {
			await sendEmailWithAttachments(
				customer.email,
				compiled.subject,
				compiled.body,
				'funds_disbursed',
				[{
					filename: `Loan-${loan.loan_number}.pdf`,
					content: pdfBuffer,
					contentType: 'application/pdf'
				}],
				{
					customerId: customer.id,
					loanId: loan.id,
					isAutomated: true
				}
			);
		} else {
			await sendTemplateEmail(
				TEMPLATE_KEYS.LOAN_DISBURSED,
				customer.email,
				vars,
				{
					customerId: customer.id,
					loanId: loan.id,
					isAutomated: true
				}
			);
		}
	} catch (error) {
		// console.error('Failed to send disbursement email:', error);
	}
}

/**
 * Get workflow status info for UI display
 */
export function getWorkflowStatus(loan: LoansResponse): {
	step: number;
	stepName: string;
	canApprove: boolean;
	canReject: boolean;
	canDisburse: boolean;
	canRecordPayment: boolean;
	canWaivePenalty: boolean;
	canMarkDefaulted: boolean;
	isComplete: boolean;
} {
	const status = loan.status as LoansStatusOptions;

	switch (status) {
		case LoansStatusOptions.pending:
			return {
				step: 1,
				stepName: 'Review & Approval',
				canApprove: true,
				canReject: true,
				canDisburse: false,
				canRecordPayment: false,
				canWaivePenalty: false,
				canMarkDefaulted: false,
				isComplete: false
			};
		case LoansStatusOptions.approved:
			return {
				step: 2,
				stepName: 'Disburse Funds',
				canApprove: false,
				canReject: false,
				canDisburse: true,
				canRecordPayment: false,
				canWaivePenalty: false,
				canMarkDefaulted: false,
				isComplete: false
			};
		case LoansStatusOptions.disbursed:
		case LoansStatusOptions.partially_paid:
			return {
				step: 3,
				stepName: 'Active Loan',
				canApprove: false,
				canReject: false,
				canDisburse: false,
				canRecordPayment: true,
				canWaivePenalty: (loan.penalty_amount || 0) > 0,
				canMarkDefaulted: true,
				isComplete: false
			};
		case LoansStatusOptions.repaid:
			return {
				step: 4,
				stepName: 'Completed',
				canApprove: false,
				canReject: false,
				canDisburse: false,
				canRecordPayment: false,
				canWaivePenalty: false,
				canMarkDefaulted: false,
				isComplete: true
			};
		case LoansStatusOptions.defaulted:
			return {
				step: 5,
				stepName: 'Defaulted',
				canApprove: false,
				canReject: false,
				canDisburse: false,
				canRecordPayment: true, // Allow recovery payments
				canWaivePenalty: (loan.penalty_amount || 0) > 0,
				canMarkDefaulted: false,
				isComplete: true
			};
		case LoansStatusOptions.rejected:
			return {
				step: 0,
				stepName: 'Rejected',
				canApprove: false,
				canReject: false,
				canDisburse: false,
				canRecordPayment: false,
				canWaivePenalty: false,
				canMarkDefaulted: false,
				isComplete: true
			};
		default:
			return {
				step: 0,
				stepName: 'Unknown',
				canApprove: false,
				canReject: false,
				canDisburse: false,
				canRecordPayment: false,
				canWaivePenalty: false,
				canMarkDefaulted: false,
				isComplete: false
			};
	}
}
