/**
 * Loan detail page server actions
 * Handles email sending and other server-side operations
 */

import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { sendCustomEmail } from '$lib/services/email/client';
import {
	approveWithAmount,
	rejectWithReason,
	disburseFunds,
	waivePenalty,
	markAsDefaulted,
	recordPaymentWithEmail
} from '$lib/core/loans/workflow_service';
import type { UserPermissions } from '$lib/services/roles/permission_checker';
import { pb } from '$lib/infra/db/pb';

/**
 * Helper function to authenticate PocketBase with the user's token
 * This is required for server-side API calls to access protected collections
 */
function authenticatePb(authToken: string | null): void {
	if (authToken && authToken.trim()) {
		// Save the token to authStore - this enables authenticated API calls
		pb.authStore.save(authToken, null);
		// console.log('[authenticatePb] Auth token set, isValid:', pb.authStore.isValid);
	} else {
		// console.warn('[authenticatePb] No auth token provided');
	}
}

export const actions: Actions = {
	approve: async ({ request }) => {
		const formData = await request.formData();
		const loanId = formData.get('loanId') as string;
		const approvedAmount = parseFloat(formData.get('approvedAmount') as string);
		const userId = formData.get('userId') as string;
		const permissions = JSON.parse(formData.get('permissions') as string || '[]') as UserPermissions;
		const authToken = formData.get('authToken') as string;

		if (!loanId || !userId) {
			return fail(400, { success: false, action: 'approve', error: 'Missing required fields' });
		}

		// Authenticate PocketBase with user's token
		authenticatePb(authToken);

		try {
			await approveWithAmount({ loanId, approvedAmount }, userId, permissions);
			return { success: true, action: 'approve' };
		} catch (error) {
			// console.error('[loans/approve] Error:', error);
			return fail(500, {
				success: false,
				action: 'approve',
				error: error instanceof Error ? error.message : 'Failed to approve loan'
			});
		}
	},

	reject: async ({ request }) => {
		const formData = await request.formData();
		const loanId = formData.get('loanId') as string;
		const reason = formData.get('reason') as string;
		const userId = formData.get('userId') as string;
		const permissions = JSON.parse(formData.get('permissions') as string || '[]') as UserPermissions;
		const authToken = formData.get('authToken') as string;

		if (!loanId || !reason || !userId) {
			return fail(400, { success: false, action: 'reject', error: 'Missing required fields' });
		}

		// Authenticate PocketBase with user's token
		authenticatePb(authToken);

		try {
			await rejectWithReason({ loanId, reason }, userId, permissions);
			return { success: true, action: 'reject' };
		} catch (error) {
			// console.error('[loans/reject] Error:', error);
			return fail(500, {
				success: false,
				action: 'reject',
				error: error instanceof Error ? error.message : 'Failed to reject loan'
			});
		}
	},

	disburse: async ({ request }) => {
		const formData = await request.formData();
		const loanId = formData.get('loanId') as string;
		const transactionReference = formData.get('transactionReference') as string;
		const notes = formData.get('notes') as string;
		const userId = formData.get('userId') as string;
		const permissions = JSON.parse(formData.get('permissions') as string || '[]') as UserPermissions;
		const authToken = formData.get('authToken') as string;

		if (!loanId || !userId) {
			return fail(400, { success: false, action: 'disburse', error: 'Missing required fields' });
		}

		// Authenticate PocketBase with user's token
		authenticatePb(authToken);

		try {
			await disburseFunds({ loanId, transactionReference, notes }, userId, permissions);
			return { success: true, action: 'disburse' };
		} catch (error) {
			// console.error('[loans/disburse] Error:', error);
			return fail(500, {
				success: false,
				action: 'disburse',
				error: error instanceof Error ? error.message : 'Failed to disburse funds'
			});
		}
	},

	recordPayment: async ({ request }) => {
		const formData = await request.formData();
		const loanId = formData.get('loanId') as string;
		const amount = parseFloat(formData.get('amount') as string);
		const paymentMethod = formData.get('paymentMethod') as string;
		const transactionReference = formData.get('transactionReference') as string;
		const notes = formData.get('notes') as string;
		const userId = formData.get('userId') as string;
		const permissions = JSON.parse(formData.get('permissions') as string || '[]') as UserPermissions;
		const authToken = formData.get('authToken') as string;

		if (!loanId || !amount || !paymentMethod || !userId) {
			return fail(400, { success: false, action: 'recordPayment', error: 'Missing required fields' });
		}

		if (amount <= 0) {
			return fail(400, { success: false, action: 'recordPayment', error: 'Payment amount must be greater than 0' });
		}

		// Authenticate PocketBase with user's token
		authenticatePb(authToken);

		try {
			await recordPaymentWithEmail({ 
				loanId, 
				amount, 
				paymentMethod, 
				transactionReference, 
				notes 
			}, userId, permissions);
			return { success: true, action: 'recordPayment' };
		} catch (error) {
			// console.error('[loans/recordPayment] Error:', error);
			return fail(500, {
				success: false,
				action: 'recordPayment',
				error: error instanceof Error ? error.message : 'Failed to record payment'
			});
		}
	},

	waivePenalty: async ({ request }) => {
		const formData = await request.formData();
		const loanId = formData.get('loanId') as string;
		const waiveAmount = parseFloat(formData.get('waiveAmount') as string);
		const reason = formData.get('reason') as string;
		const userId = formData.get('userId') as string;
		const permissions = JSON.parse(formData.get('permissions') as string || '[]') as UserPermissions;
		const authToken = formData.get('authToken') as string;

		if (!loanId || !waiveAmount || !reason || !userId) {
			return fail(400, { success: false, action: 'waivePenalty', error: 'Missing required fields' });
		}

		// Authenticate PocketBase with user's token
		authenticatePb(authToken);

		try {
			await waivePenalty({ loanId, waiveAmount, reason }, userId, permissions);
			return { success: true, action: 'waivePenalty' };
		} catch (error) {
			// console.error('[loans/waivePenalty] Error:', error);
			return fail(500, {
				success: false,
				action: 'waivePenalty',
				error: error instanceof Error ? error.message : 'Failed to waive penalty'
			});
		}
	},

	markDefaulted: async ({ request }) => {
		const formData = await request.formData();
		const loanId = formData.get('loanId') as string;
		const reason = formData.get('reason') as string;
		const userId = formData.get('userId') as string;
		const permissions = JSON.parse(formData.get('permissions') as string || '[]') as UserPermissions;
		const authToken = formData.get('authToken') as string;

		if (!loanId || !reason || !userId) {
			return fail(400, { success: false, action: 'markDefaulted', error: 'Missing required fields' });
		}

		// Authenticate PocketBase with user's token
		authenticatePb(authToken);

		try {
			await markAsDefaulted(loanId, userId, reason, permissions);
			return { success: true, action: 'markDefaulted' };
		} catch (error) {
			// console.error('[loans/markDefaulted] Error:', error);
			return fail(500, {
				success: false,
				action: 'markDefaulted',
				error: error instanceof Error ? error.message : 'Failed to mark loan as defaulted'
			});
		}
	},

	sendEmail: async ({ request }) => {
		const formData = await request.formData();

		const to = formData.get('to') as string;
		const subject = formData.get('subject') as string;
		const body = formData.get('body') as string;
		const customerId = formData.get('customerId') as string;
		const loanId = formData.get('loanId') as string;
		const sentBy = formData.get('sentBy') as string;

		// Validation
		if (!to || !subject || !body) {
			return fail(400, {
				success: false,
				error: 'Missing required fields: to, subject, body'
			});
		}

		try {
			const result = await sendCustomEmail(
				to,
				subject,
				body,
				sentBy || '',
				{
					customerId: customerId || undefined,
					loanId: loanId || undefined
				}
			);

			if (result.success) {
				return {
					success: true,
					emailLogId: result.emailLogId
				};
			} else {
				return fail(500, {
					success: false,
					error: result.error || 'Failed to send email'
				});
			}
		} catch (error) {
			return fail(500, {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}
	}
};
