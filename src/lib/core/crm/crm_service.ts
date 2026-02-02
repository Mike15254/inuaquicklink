/**
 * CRM service for customer communication and relationship management
 */

import { pb } from '$lib/infra/db/pb';
import { Collections, type CustomersResponse, type LoansResponse } from '$lib/types';
import { assertPermission, type UserPermissions } from '$lib/services/roles/permission_checker';
import { Permission } from '$lib/services/roles/permissions';
import { formatDate, addDays, todayISO } from '$lib/shared/date_time';
import { formatKES } from '$lib/shared/currency';

/**
 * Communication plan types
 */
export type CommunicationType = 'email' | 'sms' | 'call' | 'meeting';
export type CommunicationStatus = 'planned' | 'sent' | 'completed' | 'failed' | 'cancelled';

/**
 * Communication record structure (stored in metadata or separate collection)
 */
export interface CommunicationRecord {
	id: string;
	customerId: string;
	loanId?: string;
	type: CommunicationType;
	subject: string;
	content: string;
	scheduledAt: string;
	sentAt?: string;
	status: CommunicationStatus;
	createdBy: string;
	notes?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Customer context for communication
 */
export interface CustomerContext {
	customer: CustomersResponse;
	activeLoans: LoansResponse[];
	overdueLoans: LoansResponse[];
	upcomingDueLoans: LoansResponse[];
}

/**
 * Get customer context for CRM actions
 */
export async function getCustomerContext(
	customerId: string,
	userPermissions: UserPermissions
): Promise<CustomerContext> {
	assertPermission(userPermissions, Permission.CRM_VIEW);

	const customer = await pb.collection(Collections.Customers).getOne<CustomersResponse>(customerId);

	const today = todayISO();
	const sevenDaysFromNow = addDays(new Date(), 7).toISOString().split('T')[0];

	// Get all active loans for this customer
	const loansResult = await pb.collection(Collections.Loans).getFullList<LoansResponse>({
		filter: `customer = "${customerId}" && (status = "disbursed" || status = "partially_paid")`,
		sort: 'due_date'
	});

	const activeLoans = loansResult;
	const overdueLoans = loansResult.filter((loan) => loan.due_date < today);
	const upcomingDueLoans = loansResult.filter(
		(loan) => loan.due_date >= today && loan.due_date <= sevenDaysFromNow
	);

	return {
		customer,
		activeLoans,
		overdueLoans,
		upcomingDueLoans
	};
}

/**
 * Get customers needing follow-up
 */
export async function getCustomersNeedingFollowUp(
	userPermissions: UserPermissions
): Promise<CustomerContext[]> {
	assertPermission(userPermissions, Permission.CRM_VIEW);

	const today = todayISO();

	// Get loans that are overdue or due within 3 days
	const threeDaysFromNow = addDays(new Date(), 3).toISOString().split('T')[0];

	const loansNeedingAttention = await pb.collection(Collections.Loans).getFullList<LoansResponse>({
		filter: `(status = "disbursed" || status = "partially_paid") && due_date <= "${threeDaysFromNow}"`,
		expand: 'customer',
		sort: 'due_date'
	});

	// Group by customer
	const customerMap = new Map<string, CustomerContext>();

	for (const loan of loansNeedingAttention) {
		const customerId = loan.customer;
		if (!customerMap.has(customerId)) {
			const context = await getCustomerContext(customerId, userPermissions);
			customerMap.set(customerId, context);
		}
	}

	return Array.from(customerMap.values());
}

/**
 * Get customers with overdue loans
 */
export async function getOverdueCustomers(
	userPermissions: UserPermissions
): Promise<CustomerContext[]> {
	assertPermission(userPermissions, Permission.CRM_VIEW);

	const today = todayISO();

	const overdueLoans = await pb.collection(Collections.Loans).getFullList<LoansResponse>({
		filter: `(status = "disbursed" || status = "partially_paid") && due_date < "${today}"`,
		sort: 'due_date'
	});

	const customerMap = new Map<string, CustomerContext>();

	for (const loan of overdueLoans) {
		const customerId = loan.customer;
		if (!customerMap.has(customerId)) {
			const context = await getCustomerContext(customerId, userPermissions);
			customerMap.set(customerId, context);
		}
	}

	return Array.from(customerMap.values());
}

/**
 * Generate email content for customer
 */
export interface EmailContentParams {
	customerName: string;
	loanNumber?: string;
	loanAmount?: number;
	dueDate?: string;
	daysOverdue?: number;
	balance?: number;
	totalRepayment?: number;
	organizationName: string;
	organizationPhone: string;
	organizationEmail: string;
}

/**
 * Generate payment reminder content
 */
export function generatePaymentReminderContent(params: EmailContentParams): {
	subject: string;
	body: string;
} {
	const dueFormatted = params.dueDate ? formatDate(params.dueDate) : '';
	const balanceFormatted = params.balance ? formatKES(params.balance) : '';

	return {
		subject: `Payment Reminder - Loan ${params.loanNumber}`,
		body: `
Dear ${params.customerName},

This is a friendly reminder that your loan payment is due on ${dueFormatted}.

Loan Details:
- Loan Number: ${params.loanNumber}
- Outstanding Balance: ${balanceFormatted}

Please ensure payment is made before the due date to avoid late payment penalties.

Payment Methods:
- M-Pesa Paybill
- Bank Transfer

If you have any questions, please contact us:
Phone: ${params.organizationPhone}
Email: ${params.organizationEmail}

Thank you for choosing ${params.organizationName}.

Best regards,
${params.organizationName} Team
		`.trim()
	};
}

/**
 * Generate overdue notice content
 */
export function generateOverdueNoticeContent(params: EmailContentParams): {
	subject: string;
	body: string;
} {
	const balanceFormatted = params.balance ? formatKES(params.balance) : '';

	return {
		subject: `Urgent: Overdue Payment - Loan ${params.loanNumber}`,
		body: `
Dear ${params.customerName},

Your loan payment is now ${params.daysOverdue} day(s) overdue.

Loan Details:
- Loan Number: ${params.loanNumber}
- Outstanding Balance: ${balanceFormatted}
- Days Overdue: ${params.daysOverdue}

Please make payment immediately to avoid additional penalties and impact on your credit record.

If you are experiencing difficulties, please contact us to discuss payment arrangements:
Phone: ${params.organizationPhone}
Email: ${params.organizationEmail}

${params.organizationName} Team
		`.trim()
	};
}

/**
 * Generate loan approval content
 */
export function generateLoanApprovalContent(params: EmailContentParams): {
	subject: string;
	body: string;
} {
	const amountFormatted = params.loanAmount ? formatKES(params.loanAmount) : '';
	const repaymentFormatted = params.totalRepayment ? formatKES(params.totalRepayment) : '';
	const dueFormatted = params.dueDate ? formatDate(params.dueDate) : '';

	return {
		subject: `Loan Approved - ${params.loanNumber}`,
		body: `
Dear ${params.customerName},

Congratulations! Your loan application has been approved.

Loan Details:
- Loan Number: ${params.loanNumber}
- Approved Amount: ${amountFormatted}
- Total Repayment: ${repaymentFormatted}
- Due Date: ${dueFormatted}

Your funds will be disbursed shortly. You will receive a confirmation once the disbursement is complete.

Thank you for choosing ${params.organizationName}.

Best regards,
${params.organizationName} Team
		`.trim()
	};
}

/**
 * Generate loan rejection content
 */
export function generateLoanRejectionContent(
	params: EmailContentParams,
	reason: string
): { subject: string; body: string } {
	return {
		subject: `Loan Application Update - ${params.loanNumber}`,
		body: `
Dear ${params.customerName},

We regret to inform you that your loan application could not be approved at this time.

Application Reference: ${params.loanNumber}
Reason: ${reason}

This decision does not affect your ability to apply for a loan in the future. If you have any questions or would like to discuss this further, please contact us:
Phone: ${params.organizationPhone}
Email: ${params.organizationEmail}

Thank you for your understanding.

${params.organizationName} Team
		`.trim()
	};
}

/**
 * Generate disbursement confirmation content
 */
export function generateDisbursementContent(
	params: EmailContentParams,
	disbursementAmount: number,
	method: string
): { subject: string; body: string } {
	const disbursedFormatted = formatKES(disbursementAmount);
	const repaymentFormatted = params.totalRepayment ? formatKES(params.totalRepayment) : '';
	const dueFormatted = params.dueDate ? formatDate(params.dueDate) : '';

	return {
		subject: `Funds Disbursed - Loan ${params.loanNumber}`,
		body: `
Dear ${params.customerName},

Great news! Your loan funds have been disbursed.

Disbursement Details:
- Loan Number: ${params.loanNumber}
- Amount Disbursed: ${disbursedFormatted}
- Disbursement Method: ${method === 'mpesa' ? 'M-Pesa' : 'Bank Transfer'}

Repayment Details:
- Total Amount Due: ${repaymentFormatted}
- Due Date: ${dueFormatted}

Please ensure timely repayment to maintain a good credit record.

If you have any questions, contact us:
Phone: ${params.organizationPhone}
Email: ${params.organizationEmail}

Thank you for choosing ${params.organizationName}.

Best regards,
${params.organizationName} Team
		`.trim()
	};
}

/**
 * Generate custom email content
 */
export function generateCustomEmailContent(
	customerName: string,
	subject: string,
	customBody: string,
	organizationName: string
): { subject: string; body: string } {
	return {
		subject,
		body: `
Dear ${customerName},

${customBody}

Best regards,
${organizationName} Team
		`.trim()
	};
}

/**
 * CRM Dashboard stats
 */
export interface CRMStats {
	customersNeedingFollowUp: number;
	overdueLoansCount: number;
	upcomingDueCount: number;
	totalActiveLoans: number;
}

/**
 * Get CRM dashboard statistics
 */
export async function getCRMStats(userPermissions: UserPermissions): Promise<CRMStats> {
	assertPermission(userPermissions, Permission.CRM_VIEW);

	const today = todayISO();
	const sevenDaysFromNow = addDays(new Date(), 7).toISOString().split('T')[0];

	const [overdueLoans, upcomingLoans, activeLoans] = await Promise.all([
		pb.collection(Collections.Loans).getList(1, 1, {
			filter: `(status = "disbursed" || status = "partially_paid") && due_date < "${today}"`
		}),
		pb.collection(Collections.Loans).getList(1, 1, {
			filter: `(status = "disbursed" || status = "partially_paid") && due_date >= "${today}" && due_date <= "${sevenDaysFromNow}"`
		}),
		pb.collection(Collections.Loans).getList(1, 1, {
			filter: `status = "disbursed" || status = "partially_paid"`
		})
	]);

	// Customers needing follow-up = overdue + upcoming
	const customersNeedingFollowUp = overdueLoans.totalItems + upcomingLoans.totalItems;

	return {
		customersNeedingFollowUp,
		overdueLoansCount: overdueLoans.totalItems,
		upcomingDueCount: upcomingLoans.totalItems,
		totalActiveLoans: activeLoans.totalItems
	};
}
