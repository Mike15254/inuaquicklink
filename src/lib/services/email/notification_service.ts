/**
 * Admin notification service
 * Sends email notifications to the organization's notification email address.
 * Falls back to the main organization email if notification_email is not set.
 * All notifications are fire-and-forget — failures never affect the main flow.
 */

import { pb } from '$lib/infra/db/pb';
import { Collections, type OrganizationResponse } from '$lib/types';
import { sendEmail } from './client';
import { formatKES } from '$lib/shared/currency';
import { formatDate } from '$lib/shared/date_time';

/**
 * Get the organization's notification recipient email.
 * Uses notification_email if set, otherwise falls back to the main email.
 */
async function getNotificationRecipient(): Promise<{ email: string; orgName: string } | null> {
	try {
		const orgs = await pb
			.collection(Collections.Organization)
			.getList<OrganizationResponse>(1, 1);

		const org = orgs.items[0];
		if (!org) return null;

		const email = org.notification_email?.trim() || org.email?.trim();
		if (!email) return null;

		return { email, orgName: org.name || 'Inua Quick LInk' };
	} catch {
		return null;
	}
}

/**
 * Plain text HTML wrapper for admin notification emails — no decorative colors or styling.
 */
function buildNotificationHtml(title: string, message: string, orgName: string): string {
	return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:32px auto;padding:24px;">
  <h2 style="font-size:16px;margin:0 0 16px;">${title}</h2>
  <p style="font-size:14px;line-height:1.7;margin:0 0 16px;">${message}</p>
  <p style="font-size:13px;margin:0 0 8px;">Open the app to view full details and take action.</p>
  <hr style="border:none;border-top:1px solid #ccc;margin:20px 0;">
  <p style="font-size:11px;color:#666;margin:0;">${orgName} — Automated Notification</p>
</div>
</body>
</html>`;
}

/**
 * Send notification to the organization notification inbox.
 */
async function sendAdminNotification(
	subject: string,
	title: string,
	message: string
): Promise<void> {
	const recipient = await getNotificationRecipient();
	if (!recipient) return;

	const html = buildNotificationHtml(title, message, recipient.orgName);

	await sendEmail({
		to: recipient.email,
		subject,
		html,
		isAutomated: true
	}).catch(() => {
		/* ignore send failures — never affects the main flow */
	});
}

// ─── Notification Functions ───────────────────────────────────────

/**
 * Notify admins: new loan application submitted
 */
export async function notifyNewLoanApplication(params: {
	customerName: string;
	loanNumber: string;
	loanAmount: number;
	interestAmount: number;
	dueDate: string;
}): Promise<void> {
	try {
		const message =
			`New loan application from <strong>${params.customerName}</strong>.<br><br>` +
			`Amount: <strong>${formatKES(params.loanAmount)}</strong><br>` +
			`Interest: <strong>${formatKES(params.interestAmount)}</strong><br>` +
			`Due date: <strong>${formatDate(params.dueDate)}</strong><br>` +
			`Loan #: <strong>${params.loanNumber}</strong>`;

		await sendAdminNotification(
			`New Loan Application — ${params.customerName}`,
			'New Loan Application',
			message
		);
	} catch {
		/* never let notification failure affect the main flow */
	}
}

/**
 * Notify admins: loan has been disbursed
 */
export async function notifyLoanDisbursed(params: {
	customerName: string;
	loanNumber: string;
	disbursementAmount: number;
	dueDate: string;
}): Promise<void> {
	try {
		const message =
			`Loan <strong>${params.loanNumber}</strong> has been disbursed.<br><br>` +
			`Customer: <strong>${params.customerName}</strong><br>` +
			`Amount disbursed: <strong>${formatKES(params.disbursementAmount)}</strong><br>` +
			`Due date: <strong>${formatDate(params.dueDate)}</strong>`;

		await sendAdminNotification(
			`Loan Disbursed — ${params.loanNumber}`,
			'Loan Disbursed',
			message
		);
	} catch {
		/* silent */
	}
}

/**
 * Notify admins: payment recorded on a loan
 */
export async function notifyPaymentRecorded(params: {
	customerName: string;
	loanNumber: string;
	amountPaid: number;
	newBalance: number;
	isFullPayment: boolean;
}): Promise<void> {
	try {
		const status = params.isFullPayment
			? 'Loan fully repaid!'
			: `Remaining balance: <strong>${formatKES(params.newBalance)}</strong>`;

		const message =
			`Payment received for loan <strong>${params.loanNumber}</strong>.<br><br>` +
			`Customer: <strong>${params.customerName}</strong><br>` +
			`Amount paid: <strong>${formatKES(params.amountPaid)}</strong><br>` +
			status;

		await sendAdminNotification(
			`Payment Received — ${params.loanNumber}`,
			params.isFullPayment ? 'Loan Fully Repaid' : 'Payment Received',
			message
		);
	} catch {
		/* silent */
	}
}

/**
 * Notify admins: loan has been closed (write-off)
 */
export async function notifyLoanClosed(params: {
	customerName: string;
	loanNumber: string;
	reason: string;
	outstandingBalance: number;
}): Promise<void> {
	try {
		const message =
			`Loan <strong>${params.loanNumber}</strong> has been closed.<br><br>` +
			`Customer: <strong>${params.customerName}</strong><br>` +
			`Reason: <strong>${params.reason}</strong><br>` +
			`Outstanding balance: <strong>${formatKES(params.outstandingBalance)}</strong>`;

		await sendAdminNotification(
			`Loan Closed — ${params.loanNumber}`,
			'Loan Closed',
			message
		);
	} catch {
		/* silent */
	}
}

/**
 * Notify admins: daily summary of due / overdue loans (called from cron)
 */
export async function notifyDueAndOverdueLoans(params: {
	dueTodayCount: number;
	overdueCount: number;
	totalOverdueAmount: number;
}): Promise<void> {
	if (params.dueTodayCount === 0 && params.overdueCount === 0) return;

	try {
		const parts: string[] = [];
		if (params.dueTodayCount > 0) parts.push(`${params.dueTodayCount} due today`);
		if (params.overdueCount > 0) parts.push(`${params.overdueCount} overdue`);

		let message = '';
		if (params.dueTodayCount > 0) {
			message += `<strong>${params.dueTodayCount}</strong> loan${params.dueTodayCount !== 1 ? 's' : ''} due today.<br>`;
		}
		if (params.overdueCount > 0) {
			message += `<strong>${params.overdueCount}</strong> loan${params.overdueCount !== 1 ? 's' : ''} overdue, totalling <strong>${formatKES(params.totalOverdueAmount)}</strong>.<br>`;
		}
		message += '<br>Please review and take necessary action.';

		await sendAdminNotification(
			`Loan Alert — ${parts.join(', ')}`,
			'Loan Status Alert',
			message
		);
	} catch {
		/* silent */
	}
}
