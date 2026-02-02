/**
 * Email logger service
 * Separated from client.ts to avoid importing nodemailer (safe for client/auth usage)
 */

import { pb } from '$lib/infra/db/pb';
import { Collections, EmailLogsStatusOptions, EmailLogsEmailTypeOptions, type EmailLogsResponse } from '$lib/types';
/**
 * Email attachment interface
 */
export interface EmailAttachment {
	filename: string;
	content: Buffer | string;
	contentType?: string;
}

/**
 * Email send request
 */
export interface SendEmailRequest {
	to: string;
	subject: string;
	html: string;
	customerId?: string;
	loanId?: string;
	emailType?: EmailLogsEmailTypeOptions;
	sentBy?: string;
	isAutomated?: boolean;
	attachments?: EmailAttachment[];
}

/**
 * Log email to database
 */
export async function logEmailToDb(
	request: SendEmailRequest,
	status: EmailLogsStatusOptions,
	errorMessage?: string
): Promise<EmailLogsResponse> {
	const emailData = {
		recipient_email: request.to,
		subject: request.subject,
		body: request.html,
		email_type: request.emailType || EmailLogsEmailTypeOptions.custom,
		status,
		// Only include relations if they have valid values
		...(request.customerId ? { customer: request.customerId } : {}),
		...(request.loanId ? { loan: request.loanId } : {}),
		...(request.sentBy ? { sent_by: request.sentBy } : {}),
		is_automated: request.isAutomated || false,
		sent_at: new Date().toISOString(),
		error_message: errorMessage || ''
	};

	console.log('[logEmailToDb] Creating email log with:', JSON.stringify(emailData, (key, value) => {
		// Truncate body for logging
		if (key === 'body' && typeof value === 'string') return value.substring(0, 100) + '...';
		return value;
	}, 2));

	try {
		const emailLog = await pb.collection(Collections.EmailLogs).create<EmailLogsResponse>(emailData);
		console.log('[logEmailToDb] Email log created:', emailLog.id);
		return emailLog;
	} catch (error) {
		console.error('[logEmailToDb] Failed to create email log:', error);
		if (error && typeof error === 'object' && 'response' in error) {
			console.error('[logEmailToDb] PocketBase response:', JSON.stringify((error as { response: unknown }).response, null, 2));
		}
		throw error;
	}
}

/**
 * Log externally sent email (e.g. from PocketBase auth)
 */
export async function logExternalEmail(
	to: string,
	subject: string,
	html: string,
	emailType: EmailLogsEmailTypeOptions = EmailLogsEmailTypeOptions.custom
): Promise<EmailLogsResponse> {
	return logEmailToDb(
		{
			to,
			subject,
			html,
			emailType,
			isAutomated: true
		},
		EmailLogsStatusOptions.sent
	);
}
