/**
 * Admin notification service
 * Sends email notifications to users with system.emails permission
 * All notifications are fire-and-forget — failures never affect the main flow
 */

import { pb } from '$lib/infra/db/pb';
import {
	Collections,
	UsersStatusOptions,
	type RolesResponse,
	type UsersResponse,
	type OrganizationResponse
} from '$lib/types';
import { sendEmail } from './client';
import { Permission } from '../roles/permissions';
import { formatKES } from '$lib/shared/currency';
import { formatDate } from '$lib/shared/date_time';

/**
 * Get emails of all active users whose role includes the system.emails permission
 */
async function getNotificationRecipients(): Promise<string[]> {
	try {
		const roles = await pb
			.collection(Collections.Roles)
			.getFullList<RolesResponse<string[]>>();

		const eligibleRoleIds = roles
			.filter((role) => {
				const perms = role.permissions;
				return Array.isArray(perms) && perms.includes(Permission.SYSTEM_EMAILS);
			})
			.map((role) => role.id);

		if (eligibleRoleIds.length === 0) return [];

		const roleFilter = eligibleRoleIds.map((id) => `role = "${id}"`).join(' || ');
		const users = await pb.collection(Collections.Users).getFullList<UsersResponse>({
			filter: `(${roleFilter}) && status = "${UsersStatusOptions.active}"`
		});

		return users.map((u) => u.email).filter(Boolean);
	} catch {
		return [];
	}
}

/**
 * Get the organization name for email branding
 */
async function getOrgName(): Promise<string> {
	try {
		const orgs = await pb
			.collection(Collections.Organization)
			.getFullList<OrganizationResponse>();
		if (orgs.length > 0 && orgs[0].name) return orgs[0].name;
	} catch {
		/* use default */
	}
	return 'Inua Quick Link';
}

/**
 * Simple HTML wrapper for admin notification emails
 */
function buildNotificationHtml(
	title: string,
	message: string,
	orgName: string
): string {
	return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5;">
<div style="max-width:480px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.1);">
  <div style="background:#1e293b;padding:16px 24px;">
    <h2 style="margin:0;color:#fff;font-size:16px;">${title}</h2>
  </div>
  <div style="padding:24px;">
    <p style="color:#334155;line-height:1.6;margin:0 0 20px;">${message}</p>
    <p style="color:#64748b;font-size:13px;margin:0;">Open the app to view full details and take action.</p>
  </div>
  <div style="padding:12px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">${orgName} &mdash; Automated Notification</p>
  </div>
</div>
</body>
</html>`;
}

/**
 * Send notification to all eligible admin users
 */
async function sendAdminNotification(
	subject: string,
	title: string,
	message: string
): Promise<void> {
	const recipients = await getNotificationRecipients();
	if (recipients.length === 0) return;

	const orgName = await getOrgName();
	const html = buildNotificationHtml(title, message, orgName);

	const sendPromises = recipients.map((email) =>
		sendEmail({
			to: email,
			subject,
			html,
			isAutomated: true
		}).catch(() => {
			/* ignore individual send failures */
		})
	);

	await Promise.allSettled(sendPromises);
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
