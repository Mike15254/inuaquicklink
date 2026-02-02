/**
 * Email service for sending emails via PocketBase
 * Uses email_logs collection for tracking
 */

import { pb } from '$lib/infra/db/pb';
import { Collections, EmailLogsStatusOptions, EmailLogsEmailTypeOptions, type EmailLogsResponse } from '$lib/types';
import { logEmailSent } from '$lib/core/activity/activity_service';
import type { EmailTemplateType } from './composer';
import { sendMail, isSmtpConfigured } from './transport';
import { logEmailToDb, type SendEmailRequest, type EmailAttachment } from './email_logger';

// Re-export EmailAttachment for external use
export type { EmailAttachment } from './email_logger';

/**
 * Email send request
 */
export type { SendEmailRequest } from './email_logger';

/**
 * Email send result
 */
export interface SendEmailResult {
	success: boolean;
	emailLogId?: string;
	error?: string;
}

/**
 * Map template type to email log type
 */
function mapTemplateTypeToEmailType(templateType: EmailTemplateType): EmailLogsEmailTypeOptions {
	const mapping: Record<EmailTemplateType, EmailLogsEmailTypeOptions> = {
		application_received: EmailLogsEmailTypeOptions.application_received,
		application_success: EmailLogsEmailTypeOptions.loan_approved,
		application_rejected: EmailLogsEmailTypeOptions.loan_rejected,
		funds_disbursed: EmailLogsEmailTypeOptions.loan_disbursed,
		payment_reminder: EmailLogsEmailTypeOptions.payment_reminder,
		loan_overdue: EmailLogsEmailTypeOptions.overdue_notice,
		loan_grace_period: EmailLogsEmailTypeOptions.payment_reminder,
		loan_defaulted: EmailLogsEmailTypeOptions.overdue_notice
	};
	return mapping[templateType] || EmailLogsEmailTypeOptions.custom;
}

/**
 * Log email to database
 */
// LogEmailToDb and logExternalEmail moved to email_logger.ts
export { logExternalEmail } from './email_logger';

/**
 * Send email via SMTP and log to database
 */
export async function sendEmail(request: SendEmailRequest): Promise<SendEmailResult> {
	let emailLog: EmailLogsResponse | null = null;
	
	try {
		// First, try to send the actual email via SMTP
		let emailSent = false;
		let sendError: string | undefined;

		if (isSmtpConfigured()) {
			console.log('[sendEmail] SMTP configured, sending email...');
			const sendResult = await sendMail({
				to: request.to,
				subject: request.subject,
				html: request.html,
				attachments: request.attachments
			});
			emailSent = sendResult.success;
			sendError = sendResult.error;
			
			if (sendResult.success) {
				console.log('[sendEmail] Email sent successfully via SMTP');
			} else {
				console.warn('[sendEmail] SMTP send failed:', sendResult.error);
			}
		} else {
			console.warn('[sendEmail] SMTP not configured, email will only be logged');
		}

		// Log the email to database
		const status = emailSent ? EmailLogsStatusOptions.sent : EmailLogsStatusOptions.pending;
		emailLog = await logEmailToDb(request, status, emailSent ? undefined : sendError);

		// Log activity
		try {
			await logEmailSent(
				emailLog.id,
				request.sentBy,
				request.to,
				request.subject,
				request.isAutomated || false
			);
		} catch (activityError) {
			console.warn('[sendEmail] Failed to log activity:', activityError);
		}

		return {
			success: true,
			emailLogId: emailLog.id
		};
	} catch (error) {
		// Log failed email
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error('[sendEmail] Error:', errorMessage);
		
		try {
			await logEmailToDb(request, EmailLogsStatusOptions.failed, errorMessage);
		} catch {
			// Ignore logging error
		}

		return {
			success: false,
			error: errorMessage
		};
	}
}

/**
 * Send templated email
 */
export async function sendTemplatedEmail(
	to: string,
	subject: string,
	html: string,
	templateType: EmailTemplateType,
	options?: {
		customerId?: string;
		loanId?: string;
		sentBy?: string;
		isAutomated?: boolean;
	}
): Promise<SendEmailResult> {
	return sendEmail({
		to,
		subject,
		html,
		emailType: mapTemplateTypeToEmailType(templateType),
		customerId: options?.customerId,
		loanId: options?.loanId,
		sentBy: options?.sentBy,
		isAutomated: options?.isAutomated
	});
}

/**
 * Send templated email with attachments
 */
export async function sendEmailWithAttachments(
	to: string,
	subject: string,
	html: string,
	templateType: EmailTemplateType,
	attachments: EmailAttachment[],
	options?: {
		customerId?: string;
		loanId?: string;
		sentBy?: string;
		isAutomated?: boolean;
	}
): Promise<SendEmailResult> {
	return sendEmail({
		to,
		subject,
		html,
		emailType: mapTemplateTypeToEmailType(templateType),
		customerId: options?.customerId,
		loanId: options?.loanId,
		sentBy: options?.sentBy,
		isAutomated: options?.isAutomated,
		attachments
	});
}

/**
 * Send custom email
 */
export async function sendCustomEmail(
	to: string,
	subject: string,
	html: string,
	sentBy: string,
	options?: {
		customerId?: string;
		loanId?: string;
	}
): Promise<SendEmailResult> {
	return sendEmail({
		to,
		subject,
		html,
		emailType: EmailLogsEmailTypeOptions.custom,
		customerId: options?.customerId,
		loanId: options?.loanId,
		sentBy,
		isAutomated: false
	});
}

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

/**
 * Retry failed email
 */
export async function retryFailedEmail(emailLogId: string): Promise<SendEmailResult> {
	const emailLog = await pb.collection(Collections.EmailLogs).getOne<EmailLogsResponse>(emailLogId);

	if (emailLog.status !== EmailLogsStatusOptions.failed) {
		return {
			success: false,
			error: 'Email is not in failed status'
		};
	}

	// Update to pending
	await pb.collection(Collections.EmailLogs).update(emailLogId, {
		status: EmailLogsStatusOptions.pending,
		error_message: ''
	});

	return {
		success: true,
		emailLogId
	};
}

/**
 * Send application received confirmation email
 * Uses template from database (EmailTemplates collection)
 */
export async function sendApplicationReceivedEmail(params: {
	customerEmail: string;
	customerName: string;
	loanNumber: string;
	loanAmount: number;
	loanPeriodDays: number;
	applicationDate: Date;
	customerId: string;
	loanId: string;
	organizationName: string;
	organizationPhone: string;
	organizationEmail: string;
}): Promise<SendEmailResult> {
	// Import the template service to fetch from database
	const { sendTemplateEmail, TEMPLATE_KEYS } = await import('./email_template_service');
	
	const year = new Date().getFullYear().toString();
	const formattedDate = params.applicationDate.toLocaleDateString('en-GB');
	const formattedAmount = `KES ${params.loanAmount.toLocaleString()}`;

	// Template variables to be replaced in the database template
	const variables = {
		customer_name: params.customerName,
		applicant_name: params.customerName, // Added for template compatibility
		loan_number: params.loanNumber,
		loan_amount: formattedAmount,
		loan_period_days: params.loanPeriodDays,
		application_date: formattedDate,
		organization_name: params.organizationName,
		COMPANY_NAME: params.organizationName, // Added for template compatibility
		organization_phone: params.organizationPhone,
		organization_email: params.organizationEmail,
		year: year
	};

	// Fetch template from database and send
	return sendTemplateEmail(
		TEMPLATE_KEYS.APPLICATION_RECEIVED,
		params.customerEmail,
		variables,
		{
			customerId: params.customerId,
			loanId: params.loanId,
			isAutomated: true
		}
	);
}
