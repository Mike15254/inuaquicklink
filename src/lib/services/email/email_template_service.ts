/**
 * Email Template Service
 * Fetches email templates from database and compiles them with variables
 */

import { sendEmail, type SendEmailResult } from './client';
import { compileTemplate } from './composer';
import { getEmailTemplate, TEMPLATE_KEYS, type TemplateKey } from './email_template_data';

// Re-export needed types and functions
export { TEMPLATE_KEYS, type TemplateKey } from './email_template_data';
export { getAllEmailTemplates, getEmailTemplate, updateEmailTemplate, clearTemplateCache } from './email_template_data';

/**
 * Compile email template with variables
 */
export async function compileEmailTemplate(
    templateKey: string,
    variables: Record<string, unknown>
): Promise<{ subject: string; body: string } | null> {
    const template = await getEmailTemplate(templateKey);
    if (!template) {
        // console.warn(`[compileEmailTemplate] Template not found: ${templateKey}`);
        return null;
    }

    const subject = compileTemplate(template.subject, variables);
    let body = compileTemplate(template.body, variables);

    // Decode HTML entities if the body was stored with escaped HTML
    // This handles templates that may have been double-encoded in the database
    body = body
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&'); // Do &amp; last to avoid double-decoding

    return { subject, body };
}

/**
 * Send email using database template
 */
export async function sendTemplateEmail(
    templateKey: string,
    to: string,
    variables: Record<string, unknown>,
    options?: {
        customerId?: string;
        loanId?: string;
        sentBy?: string;
        isAutomated?: boolean;
    }
): Promise<SendEmailResult> {
    const compiled = await compileEmailTemplate(templateKey, variables);

    if (!compiled) {
        console.error(`[sendTemplateEmail] Template not found in database: "${templateKey}". Check that the EmailTemplates collection has a record with template_key="${templateKey}" and is_active=true.`);
        return {
            success: false,
            error: `Email template not found: ${templateKey}`
        };
    }

    return sendEmail({
        to,
        subject: compiled.subject,
        html: compiled.body,
        customerId: options?.customerId,
        loanId: options?.loanId,
        sentBy: options?.sentBy,
        isAutomated: options?.isAutomated ?? true
    });
}
