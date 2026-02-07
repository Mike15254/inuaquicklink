/**
 * Email transport service using Nodemailer
 * Handles actual email sending via SMTP
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// SMTP configuration
interface SmtpConfig {
	host: string;
	port: number;
	secure: boolean;
	user: string;
	pass: string;
	from: string;
	fromName: string;
}

// Default config from process.env (works in Node/Bun, fallback for SvelteKit if variables are missing)
let smtpConfig: SmtpConfig = {
	host: process.env.SMTP_HOST || '',
	port: parseInt(process.env.SMTP_PORT || '587'),
	secure: process.env.SMTP_SECURE === 'true',
	user: process.env.SMTP_USER || '',
	pass: process.env.SMTP_PASS || '',
	from: process.env.SMTP_FROM || '',
	fromName: process.env.SMTP_FROM_NAME || ''
};

/**
 * Configure SMTP settings manually (e.g. from SvelteKit $env)
 */
export function configureSmtp(config: Partial<SmtpConfig>) {
	smtpConfig = { ...smtpConfig, ...config };
	// Reset transporter to ensure new config is used
	transporter = null;
}

// Check if SMTP is configured
export function isSmtpConfigured(): boolean {
	return !!(smtpConfig.user && smtpConfig.pass);
}

// Create transporter
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
	if (!isSmtpConfigured()) {
		return null;
	}

	if (!transporter) {
		transporter = nodemailer.createTransport({
			host: smtpConfig.host,
			port: smtpConfig.port,
			secure: smtpConfig.secure,
			auth: {
				user: smtpConfig.user,
				pass: smtpConfig.pass
			}
		});
	}

	return transporter;
}

export interface EmailAttachment {
	filename: string;
	content: Buffer | string;
	contentType?: string;
}

export interface SendMailOptions {
	to: string;
	subject: string;
	html: string;
	from?: string;
	replyTo?: string;
	attachments?: EmailAttachment[];
}

export interface SendMailResult {
	success: boolean;
	messageId?: string;
	error?: string;
}

/**
 * Send an email via SMTP
 */
export async function sendMail(options: SendMailOptions): Promise<SendMailResult> {
	const transport = getTransporter();

	if (!transport) {
		return {
			success: false,
			error: 'SMTP not configured'
		};
	}

	try {
		const fromEmail = smtpConfig.from || smtpConfig.user;
		const fromName = smtpConfig.fromName;
		const fromAddress = options.from || `"${fromName}" <${fromEmail}>`;

		const info = await transport.sendMail({
			from: fromAddress,
			to: options.to,
			subject: options.subject,
			html: options.html,
			replyTo: options.replyTo,
			attachments: options.attachments?.map((att) => ({
				filename: att.filename,
				content: att.content,
				contentType: att.contentType
			}))
		});

		return {
			success: true,
			messageId: info.messageId
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return {
			success: false,
			error: errorMessage
		};
	}
}

/**
 * Verify SMTP connection
 */
export async function verifySmtpConnection(): Promise<boolean> {
	const transport = getTransporter();

	if (!transport) {
		return false;
	}

	try {
		await transport.verify();
		return true;
	} catch (error) {
		return false;
	}
}
