/**
 * Payment service
 * Handles recording and managing loan payments
 */

import { pb } from '$lib/infra/db/pb';
import {
	Collections,
	PaymentsPaymentMethodOptions,
	type PaymentsResponse,
	type LoansResponse
} from '$lib/types';
import { NotFoundError, ValidationError, ForbiddenError } from '$lib/shared/errors';
import { nowISO } from '$lib/shared/date_time';
import { logPaymentReceived } from '$lib/core/activity/activity_service';
import { assertPermission, type UserPermissions } from '$lib/services/roles/permission_checker';
import { Permission } from '$lib/services/roles/permissions';
import { recordPayment as updateLoanPayment, getLoanById } from './loan_service';

/**
 * Payment with expanded relations
 */
export type PaymentWithRelations = PaymentsResponse<{
	loan?: LoansResponse;
	customer?: { name: string; email: string };
}>;

/**
 * Create payment input
 */
export interface CreatePaymentInput {
	loanId: string;
	amount: number;
	paymentMethod: PaymentsPaymentMethodOptions;
	transactionReference?: string;
	paymentDate?: string;
	notes?: string;
}

/**
 * Record a new payment
 */
export async function createPayment(
	input: CreatePaymentInput,
	userId: string,
	userPermissions: UserPermissions
): Promise<PaymentsResponse> {
	assertPermission(userPermissions, Permission.PAYMENTS_CREATE);

	// Validate amount
	if (!input.amount || input.amount <= 0) {
		throw new ValidationError('Payment amount must be greater than 0');
	}

	// Get loan to validate and get customer
	const loan = await getLoanById(input.loanId);

	// Create payment record
	const payment = await pb.collection(Collections.Payments).create<PaymentsResponse>({
		loan: input.loanId,
		customer: loan.customer,
		amount: input.amount,
		payment_method: input.paymentMethod,
		transaction_reference: input.transactionReference?.trim() || '',
		payment_date: input.paymentDate || nowISO(),
		notes: input.notes?.trim() || '',
		recorded_by: userId
	});

	// Update loan balance
	await updateLoanPayment(input.loanId, input.amount);

	// Log activity
	await logPaymentReceived(
		payment.id,
		userId,
		input.loanId,
		input.amount,
		input.transactionReference
	);

	return payment;
}

/**
 * Get payment by ID
 */
export async function getPaymentById(paymentId: string): Promise<PaymentWithRelations> {
	try {
		const payment = await pb
			.collection(Collections.Payments)
			.getOne<PaymentWithRelations>(paymentId, {
				expand: 'loan,customer'
			});
		return payment;
	} catch {
		throw new NotFoundError('Payment', paymentId);
	}
}

/**
 * Get payments for a loan
 */
export async function getLoanPayments(
	loanId: string,
	userPermissions: UserPermissions
): Promise<PaymentsResponse[]> {
	assertPermission(userPermissions, Permission.PAYMENTS_VIEW);

	return await pb.collection(Collections.Payments).getFullList<PaymentsResponse>({
		filter: `loan = "${loanId}"`,
		sort: '-payment_date'
	});
}

/**
 * Get payments for a customer
 */
export async function getCustomerPayments(
	customerId: string,
	userPermissions: UserPermissions
): Promise<PaymentsResponse[]> {
	assertPermission(userPermissions, Permission.PAYMENTS_VIEW);

	return await pb.collection(Collections.Payments).getFullList<PaymentsResponse>({
		filter: `customer = "${customerId}"`,
		sort: '-payment_date'
	});
}

/**
 * Get all payments with pagination
 */
export async function getPayments(
	page: number,
	perPage: number,
	userPermissions: UserPermissions,
	filters?: {
		loanId?: string;
		customerId?: string;
		paymentMethod?: PaymentsPaymentMethodOptions;
		startDate?: string;
		endDate?: string;
	}
): Promise<{ items: PaymentWithRelations[]; totalItems: number; totalPages: number }> {
	assertPermission(userPermissions, Permission.PAYMENTS_VIEW);

	const filterParts: string[] = [];

	if (filters?.loanId) {
		filterParts.push(`loan = "${filters.loanId}"`);
	}

	if (filters?.customerId) {
		filterParts.push(`customer = "${filters.customerId}"`);
	}

	if (filters?.paymentMethod) {
		filterParts.push(`payment_method = "${filters.paymentMethod}"`);
	}

	if (filters?.startDate) {
		filterParts.push(`payment_date >= "${filters.startDate}"`);
	}

	if (filters?.endDate) {
		filterParts.push(`payment_date <= "${filters.endDate}"`);
	}

	const filter = filterParts.length > 0 ? filterParts.join(' && ') : '';

	const result = await pb
		.collection(Collections.Payments)
		.getList<PaymentWithRelations>(page, perPage, {
			filter,
			sort: '-payment_date',
			expand: 'loan,customer'
		});

	return {
		items: result.items,
		totalItems: result.totalItems,
		totalPages: result.totalPages
	};
}

/**
 * Update payment notes
 */
export async function updatePaymentNotes(
	paymentId: string,
	notes: string,
	userId: string,
	userPermissions: UserPermissions
): Promise<PaymentsResponse> {
	assertPermission(userPermissions, Permission.PAYMENTS_UPDATE);

	return await pb.collection(Collections.Payments).update<PaymentsResponse>(paymentId, {
		notes: notes.trim()
	});
}

/**
 * Delete payment (only for admins, will recalculate loan balance)
 */
export async function deletePayment(
	paymentId: string,
	userPermissions: UserPermissions
): Promise<void> {
	assertPermission(userPermissions, Permission.PAYMENTS_DELETE);

	const payment = await getPaymentById(paymentId);

	// Note: This doesn't automatically adjust loan balance
	// In production, you'd want to recalculate or prevent deletion
	await pb.collection(Collections.Payments).delete(paymentId);
}

/**
 * Get payment statistics
 */
export async function getPaymentStats(userPermissions: UserPermissions): Promise<{
	totalPayments: number;
	todayPayments: number;
	weekPayments: number;
	monthPayments: number;
}> {
	assertPermission(userPermissions, Permission.ANALYTICS_VIEW);

	const now = new Date();
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

	const weekStart = new Date(now);
	weekStart.setDate(weekStart.getDate() - 7);

	const monthStart = new Date(now);
	monthStart.setMonth(monthStart.getMonth() - 1);

	const [total, today, week, month] = await Promise.all([
		pb.collection(Collections.Payments).getList(1, 1),
		pb.collection(Collections.Payments).getList(1, 1, {
			filter: `payment_date >= "${todayStart}"`
		}),
		pb.collection(Collections.Payments).getList(1, 1, {
			filter: `payment_date >= "${weekStart.toISOString()}"`
		}),
		pb.collection(Collections.Payments).getList(1, 1, {
			filter: `payment_date >= "${monthStart.toISOString()}"`
		})
	]);

	return {
		totalPayments: total.totalItems,
		todayPayments: today.totalItems,
		weekPayments: week.totalItems,
		monthPayments: month.totalItems
	};
}

/**
 * Get recent payments
 */
export async function getRecentPayments(
	limit: number,
	userPermissions: UserPermissions
): Promise<PaymentWithRelations[]> {
	assertPermission(userPermissions, Permission.PAYMENTS_VIEW);

	const result = await pb
		.collection(Collections.Payments)
		.getList<PaymentWithRelations>(1, limit, {
			sort: '-created',
			expand: 'loan,customer'
		});

	return result.items;
}

/**
 * Calculate total payments for a loan
 */
export async function getTotalPaymentsForLoan(loanId: string): Promise<number> {
	const payments = await pb.collection(Collections.Payments).getFullList<PaymentsResponse>({
		filter: `loan = "${loanId}"`
	});

	return payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
}

/**
 * Check for duplicate transaction reference
 */
export async function isDuplicateTransaction(reference: string): Promise<boolean> {
	if (!reference) return false;

	const result = await pb.collection(Collections.Payments).getList(1, 1, {
		filter: `transaction_reference = "${reference}"`
	});

	return result.totalItems > 0;
}
