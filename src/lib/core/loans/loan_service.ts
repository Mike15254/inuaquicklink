/**
 * Loan service
 * Manages loan lifecycle: creation, approval, rejection, disbursement
 */

import { pb } from '$lib/infra/db/pb';
import {
	Collections,
	LoansStatusOptions,
	LoansDisbursementMethodOptions,
	LoansLoanPurposeOptions,
	type LoansResponse,
	type CustomersResponse
} from '$lib/types';
import { NotFoundError, ValidationError, ForbiddenError } from '$lib/shared/errors';
import { nowISO, addDays, calculateDaysOverdue } from '$lib/shared/date_time';
import { normalizePhone } from '$lib/shared/rules';
import {
	logLoanCreated,
	logLoanApproved,
	logLoanRejected,
	logLoanDisbursed,
	logLoanRepaid
} from '$lib/core/activity/activity_service';
import { assertPermission, type UserPermissions } from '$lib/services/roles/permission_checker';
import { Permission } from '$lib/services/roles/permissions';
import {
	calculateLoan,
	generateLoanNumber,
	calculatePenalty,
	calculateBalanceDue,
	type LoanCalculationSettings,
	DEFAULT_LOAN_SETTINGS
} from './loan_calculations';
import { markLinkAsUsed } from './link_service';
import {
	incrementCustomerLoans,
	markCustomerLoanRepaid,
	markCustomerLoanDefaulted,
	getCustomerById
} from '$lib/core/customers/customer_service';

/**
 * Loan with expanded relations
 */
export type LoanWithRelations = LoansResponse<{
	customer?: CustomersResponse;
}>;

/**
 * Create loan input (from application form)
 */
export interface CreateLoanInput {
	customerId: string;
	applicationLinkId: string;
	loanAmount: number;
	loanPurpose: LoansLoanPurposeOptions;
	salaryDate: string;
	disbursementMethod: LoansDisbursementMethodOptions;
	mpesaNumber?: string;
	bankName?: string;
	bankAccount?: string;
	accountName?: string;
	digitalSignature: string;
	ipAddress?: string;
	userAgent?: string;
}

/**
 * Create a new loan application
 */
export async function createLoan(
	input: CreateLoanInput,
	settings: LoanCalculationSettings = DEFAULT_LOAN_SETTINGS
): Promise<LoansResponse> {
	const calculation = calculateLoan(input.loanAmount, input.salaryDate, settings);

	// Validate loan period
	if (calculation.loanPeriodDays <= 0) {
		throw new ValidationError('Salary date must be in the future');
	}

	if (calculation.loanPeriodDays > 30) {
		throw new ValidationError('Loan period cannot exceed 30 days');
	}

	// Generate loan number
	const loanNumber = generateLoanNumber();
	const loanData = {
		loan_number: loanNumber,
		customer: input.customerId,
		application_link: input.applicationLinkId,
		loan_amount: input.loanAmount,
		loan_purpose: input.loanPurpose,
		loan_period_days: calculation.loanPeriodDays,
		interest_rate: calculation.interestRate,
		interest_amount: calculation.interestAmount,
		processing_fee: calculation.processingFee,
		disbursement_amount: calculation.disbursementAmount,
		total_repayment: calculation.totalRepayment,
		application_date: nowISO(),
		// We set due_date based on calculation, but for pending loans it might change upon approval/disbursement
		// However, keeping it calculated is fine as an estimate.
		due_date: calculation.dueDate.toISOString(),
		status: LoansStatusOptions.pending,
		disbursement_method: input.disbursementMethod,

		// Initialize other dates to empty/null to prevent 'now' default if schema allows
		// IMPORTANT: These fields must be of type 'Date' in PocketBase, NOT 'Autodate'.
		// 'Autodate' fields (with onCreate: true) will automatically set to NOW, overwriting these nulls.
		approved_at: null,
		rejected_at: null,
		disbursement_date: null,
		repayment_date: null,
		grace_period_end_date: null,
		penalty_start_date: null,
		closure_date: null,
		waiver_date: null,

		// Only include mpesa_number if using mpesa, otherwise omit - normalize to E.164 format
		...(input.disbursementMethod === 'mpesa' && input.mpesaNumber
			? { mpesa_number: normalizePhone(input.mpesaNumber) }
			: {}),
		// Only include bank details if using bank_transfer
		...(input.disbursementMethod === 'bank_transfer'
			? {
					bank_name: input.bankName || '',
					bank_account: input.bankAccount || '',
					account_name: input.accountName || ''
				}
			: {}),
		digital_signature: input.digitalSignature,
		amount_paid: 0,
		balance: calculation.totalRepayment,
		penalty_amount: 0,
		days_overdue: 0
	};

	let loan: LoansResponse;
	try {
		loan = await pb.collection(Collections.Loans).create<LoansResponse>(loanData);
	} catch (error) {
		if (error && typeof error === 'object' && 'response' in error) {
			// console.error('[createLoan] PocketBase response:', JSON.stringify((error as any).response, null, 2));
		}
		throw error;
	}

	// Mark application link as used
	await markLinkAsUsed(input.applicationLinkId, loan.id, input.ipAddress, input.userAgent);

	// Log activity (system action since customer submitted)
	await logLoanCreated(loan.id, '', loanNumber, input.loanAmount);

	return loan;
}

/**
 * Get loan by ID
 */
export async function getLoanById(loanId: string): Promise<LoanWithRelations> {
	try {
		const loan = await pb.collection(Collections.Loans).getOne<LoanWithRelations>(loanId, {
			expand: 'customer'
		});
		return loan;
	} catch {
		throw new NotFoundError('Loan', loanId);
	}
}

/**
 * Get loan by loan number
 */
export async function getLoanByNumber(loanNumber: string): Promise<LoanWithRelations | null> {
	try {
		const loan = await pb
			.collection(Collections.Loans)
			.getFirstListItem<LoanWithRelations>(`loan_number = "${loanNumber}"`, {
				expand: 'customer'
			});
		return loan;
	} catch {
		return null;
	}
}

/**
 * Approve a loan
 */
export async function approveLoan(
	loanId: string,
	userId: string,
	userPermissions: UserPermissions
): Promise<LoansResponse> {
	assertPermission(userPermissions, Permission.LOANS_APPROVE);

	const loan = await getLoanById(loanId);

	if (loan.status !== LoansStatusOptions.pending) {
		throw new ForbiddenError(`Cannot approve loan with status '${loan.status}'`);
	}

	const updatedLoan = await pb.collection(Collections.Loans).update<LoansResponse>(loanId, {
		status: LoansStatusOptions.approved,
		approved_by: userId,
		approved_at: nowISO()
	});

	await logLoanApproved(loanId, userId, loan.loan_number);

	return updatedLoan;
}

/**
 * Reject a loan
 */
export async function rejectLoan(
	loanId: string,
	userId: string,
	reason: string,
	userPermissions: UserPermissions
): Promise<LoansResponse> {
	assertPermission(userPermissions, Permission.LOANS_REJECT);

	const loan = await getLoanById(loanId);

	if (loan.status !== LoansStatusOptions.pending) {
		throw new ForbiddenError(`Cannot reject loan with status '${loan.status}'`);
	}

	if (!reason || reason.trim().length < 5) {
		throw new ValidationError('Rejection reason must be at least 5 characters');
	}

	const updatedLoan = await pb.collection(Collections.Loans).update<LoansResponse>(loanId, {
		status: LoansStatusOptions.rejected,
		rejected_by: userId,
		rejected_at: nowISO(),
		rejection_reason: reason.trim()
	});

	await logLoanRejected(loanId, userId, loan.loan_number, reason);

	return updatedLoan;
}

/**
 * Disburse a loan
 */
export async function disburseLoan(
	loanId: string,
	userId: string,
	userPermissions: UserPermissions
): Promise<LoansResponse> {
	assertPermission(userPermissions, Permission.LOANS_DISBURSE);

	const loan = await getLoanById(loanId);

	if (loan.status !== LoansStatusOptions.approved) {
		throw new ForbiddenError(`Cannot disburse loan with status '${loan.status}'`);
	}

	const updatedLoan = await pb.collection(Collections.Loans).update<LoansResponse>(loanId, {
		status: LoansStatusOptions.disbursed,
		disbursed_by: userId,
		disbursement_date: nowISO()
	});

	// Update customer loan stats
	await incrementCustomerLoans(loan.customer, loan.loan_amount);

	await logLoanDisbursed(loanId, userId, loan.loan_number, loan.disbursement_amount);

	return updatedLoan;
}

/**
 * Record a payment on a loan
 */
export async function recordPayment(
	loanId: string,
	amount: number,
	settings: LoanCalculationSettings = DEFAULT_LOAN_SETTINGS
): Promise<LoansResponse> {
	const loan = await getLoanById(loanId);

	if (
		loan.status !== LoansStatusOptions.disbursed &&
		loan.status !== LoansStatusOptions.partially_paid
	) {
		throw new ForbiddenError(`Cannot record payment for loan with status '${loan.status}'`);
	}

	// Calculate current state
	const daysOverdue = calculateDaysOverdue(loan.due_date);
	const penalty = calculatePenalty(loan.total_repayment, daysOverdue, settings);
	const newAmountPaid = (loan.amount_paid || 0) + amount;
	const newBalance = calculateBalanceDue(loan.total_repayment, newAmountPaid, penalty);

	// Determine new status
	let newStatus = LoansStatusOptions.partially_paid;
	if (newBalance <= 0) {
		newStatus = LoansStatusOptions.repaid;
	}

	const updatedLoan = await pb.collection(Collections.Loans).update<LoansResponse>(loanId, {
		amount_paid: newAmountPaid,
		balance: newBalance,
		penalty_amount: penalty,
		days_overdue: Math.max(0, daysOverdue),
		status: newStatus,
		...(newStatus === LoansStatusOptions.repaid ? { repayment_date: nowISO() } : {})
	});

	// Update customer stats if fully repaid
	if (newStatus === LoansStatusOptions.repaid) {
		await markCustomerLoanRepaid(loan.customer, newAmountPaid);
		await logLoanRepaid(loanId, '', loan.loan_number);
	}

	return updatedLoan;
}

/**
 * Mark loan as defaulted
 */
export async function markLoanDefaulted(
	loanId: string,
	userId: string,
	userPermissions: UserPermissions
): Promise<LoansResponse> {
	assertPermission(userPermissions, Permission.LOANS_UPDATE);

	const loan = await getLoanById(loanId);

	if (loan.status === LoansStatusOptions.repaid) {
		throw new ForbiddenError('Cannot mark a repaid loan as defaulted');
	}

	const updatedLoan = await pb.collection(Collections.Loans).update<LoansResponse>(loanId, {
		status: LoansStatusOptions.defaulted
	});

	await markCustomerLoanDefaulted(loan.customer);

	return updatedLoan;
}

/**
 * Update loan overdue status (for cron job)
 */
export async function updateOverdueLoans(
	settings: LoanCalculationSettings = DEFAULT_LOAN_SETTINGS
): Promise<number> {
	// Find all disbursed or partially paid loans
	const loans = await pb.collection(Collections.Loans).getFullList<LoansResponse>({
		filter: `status = "${LoansStatusOptions.disbursed}" || status = "${LoansStatusOptions.partially_paid}"`
	});

	let updatedCount = 0;

	for (const loan of loans) {
		const daysOverdue = calculateDaysOverdue(loan.due_date);

		if (daysOverdue > 0) {
			const penalty = calculatePenalty(loan.total_repayment, daysOverdue, settings);
			const balance = calculateBalanceDue(loan.total_repayment, loan.amount_paid, penalty);

			await pb.collection(Collections.Loans).update(loan.id, {
				days_overdue: daysOverdue,
				penalty_amount: penalty,
				balance
			});

			updatedCount++;
		}
	}

	return updatedCount;
}

/**
 * Get loans with pagination
 */
export async function getLoans(
	page: number,
	perPage: number,
	userPermissions: UserPermissions,
	filters?: {
		status?: LoansStatusOptions;
		customerId?: string;
		search?: string;
	}
): Promise<{ items: LoanWithRelations[]; totalItems: number; totalPages: number }> {
	assertPermission(userPermissions, Permission.LOANS_VIEW);

	const filterParts: string[] = [];

	if (filters?.status) {
		filterParts.push(`status = "${filters.status}"`);
	}

	if (filters?.customerId) {
		filterParts.push(`customer = "${filters.customerId}"`);
	}

	if (filters?.search) {
		const search = filters.search.trim();
		filterParts.push(`loan_number ~ "${search}"`);
	}

	const filter = filterParts.length > 0 ? filterParts.join(' && ') : '';

	const result = await pb.collection(Collections.Loans).getList<LoanWithRelations>(page, perPage, {
		filter,
		sort: '-created',
		expand: 'customer'
	});

	return {
		items: result.items,
		totalItems: result.totalItems,
		totalPages: result.totalPages
	};
}

/**
 * Get loans by status
 */
export async function getLoansByStatus(
	status: LoansStatusOptions,
	userPermissions: UserPermissions
): Promise<LoanWithRelations[]> {
	assertPermission(userPermissions, Permission.LOANS_VIEW);

	return await pb.collection(Collections.Loans).getFullList<LoanWithRelations>({
		filter: `status = "${status}"`,
		sort: '-created',
		expand: 'customer'
	});
}

/**
 * Get due loans (due within N days)
 */
export async function getDueLoans(
	withinDays: number,
	userPermissions: UserPermissions
): Promise<LoanWithRelations[]> {
	assertPermission(userPermissions, Permission.LOANS_VIEW);

	const today = new Date();
	const futureDate = addDays(today, withinDays);

	return await pb.collection(Collections.Loans).getFullList<LoanWithRelations>({
		filter: `(status = "${LoansStatusOptions.disbursed}" || status = "${LoansStatusOptions.partially_paid}") && due_date <= "${futureDate.toISOString()}"`,
		sort: 'due_date',
		expand: 'customer'
	});
}

/**
 * Get overdue loans
 */
export async function getOverdueLoans(
	userPermissions: UserPermissions
): Promise<LoanWithRelations[]> {
	assertPermission(userPermissions, Permission.LOANS_VIEW);

	const today = new Date().toISOString();

	return await pb.collection(Collections.Loans).getFullList<LoanWithRelations>({
		filter: `(status = "${LoansStatusOptions.disbursed}" || status = "${LoansStatusOptions.partially_paid}") && due_date < "${today}"`,
		sort: 'due_date',
		expand: 'customer'
	});
}

/**
 * Get customer's loans
 */
export async function getCustomerLoans(
	customerId: string,
	userPermissions: UserPermissions
): Promise<LoanWithRelations[]> {
	assertPermission(userPermissions, Permission.LOANS_VIEW);

	return await pb.collection(Collections.Loans).getFullList<LoanWithRelations>({
		filter: `customer = "${customerId}"`,
		sort: '-created',
		expand: 'customer'
	});
}

/**
 * Get loan statistics
 */
export async function getLoanStats(userPermissions: UserPermissions): Promise<{
	total: number;
	pending: number;
	approved: number;
	disbursed: number;
	repaid: number;
	defaulted: number;
	overdue: number;
}> {
	assertPermission(userPermissions, Permission.ANALYTICS_VIEW);

	const today = new Date().toISOString();

	const [total, pending, approved, disbursed, repaid, defaulted, overdue] = await Promise.all([
		pb.collection(Collections.Loans).getList(1, 1),
		pb.collection(Collections.Loans).getList(1, 1, {
			filter: `status = "${LoansStatusOptions.pending}"`
		}),
		pb.collection(Collections.Loans).getList(1, 1, {
			filter: `status = "${LoansStatusOptions.approved}"`
		}),
		pb.collection(Collections.Loans).getList(1, 1, {
			filter: `status = "${LoansStatusOptions.disbursed}"`
		}),
		pb.collection(Collections.Loans).getList(1, 1, {
			filter: `status = "${LoansStatusOptions.repaid}"`
		}),
		pb.collection(Collections.Loans).getList(1, 1, {
			filter: `status = "${LoansStatusOptions.defaulted}"`
		}),
		pb.collection(Collections.Loans).getList(1, 1, {
			filter: `(status = "${LoansStatusOptions.disbursed}" || status = "${LoansStatusOptions.partially_paid}") && due_date < "${today}"`
		})
	]);

	return {
		total: total.totalItems,
		pending: pending.totalItems,
		approved: approved.totalItems,
		disbursed: disbursed.totalItems,
		repaid: repaid.totalItems,
		defaulted: defaulted.totalItems,
		overdue: overdue.totalItems
	};
}

/**
 * Check if customer has active loan
 */
export async function customerHasActiveLoan(customerId: string): Promise<boolean> {
	const result = await pb.collection(Collections.Loans).getList(1, 1, {
		filter: `customer = "${customerId}" && (status = "${LoansStatusOptions.pending}" || status = "${LoansStatusOptions.approved}" || status = "${LoansStatusOptions.disbursed}" || status = "${LoansStatusOptions.partially_paid}")`
	});

	return result.totalItems > 0;
}

/**
 * Add notes to loan
 */
export async function addLoanNotes(
	loanId: string,
	notes: string,
	userId: string,
	userPermissions: UserPermissions
): Promise<LoansResponse> {
	assertPermission(userPermissions, Permission.LOANS_UPDATE);

	const loan = await getLoanById(loanId);
	const existingNotes = loan.notes || '';
	const timestamp = new Date().toLocaleString();
	const newNotes = existingNotes
		? `${existingNotes}\n\n[${timestamp}]\n${notes}`
		: `[${timestamp}]\n${notes}`;

	return await pb.collection(Collections.Loans).update<LoansResponse>(loanId, {
		notes: newNotes
	});
}
