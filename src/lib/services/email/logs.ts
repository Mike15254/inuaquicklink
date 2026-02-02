/**
 * Email logs - Read-only operations (safe for browser)
 * For sending emails, use the server-only module: ./client.ts
 */

import { pb } from '$lib/infra/db/pb';
import { Collections, EmailLogsStatusOptions, type EmailLogsResponse } from '$lib/types';

/**
 * Get email logs for a customer
 */
export async function getEmailLogsForCustomer(
	customerId: string,
	limit: number = 20
): Promise<EmailLogsResponse[]> {
	const result = await pb.collection(Collections.EmailLogs).getList<EmailLogsResponse>(1, limit, {
		filter: `customer = "${customerId}"`,
		sort: '-created'
	});
	return result.items;
}

/**
 * Get email logs for a loan
 */
export async function getEmailLogsForLoan(
	loanId: string,
	limit: number = 20
): Promise<EmailLogsResponse[]> {
	const result = await pb.collection(Collections.EmailLogs).getList<EmailLogsResponse>(1, limit, {
		filter: `loan = "${loanId}"`,
		sort: '-created'
	});
	return result.items;
}

/**
 * Get recent email logs
 */
export async function getRecentEmailLogs(limit: number = 50): Promise<EmailLogsResponse[]> {
	const result = await pb.collection(Collections.EmailLogs).getList<EmailLogsResponse>(1, limit, {
		sort: '-created',
		expand: 'customer,loan,sent_by'
	});
	return result.items;
}

/**
 * Get email statistics
 */
export async function getEmailStats(): Promise<{
	total: number;
	sent: number;
	failed: number;
	pending: number;
}> {
	const [total, sent, failed, pending] = await Promise.all([
		pb.collection(Collections.EmailLogs).getList(1, 1),
		pb.collection(Collections.EmailLogs).getList(1, 1, {
			filter: `status = "${EmailLogsStatusOptions.sent}"`
		}),
		pb.collection(Collections.EmailLogs).getList(1, 1, {
			filter: `status = "${EmailLogsStatusOptions.failed}"`
		}),
		pb.collection(Collections.EmailLogs).getList(1, 1, {
			filter: `status = "${EmailLogsStatusOptions.pending}"`
		})
	]);

	return {
		total: total.totalItems,
		sent: sent.totalItems,
		failed: failed.totalItems,
		pending: pending.totalItems
	};
}
