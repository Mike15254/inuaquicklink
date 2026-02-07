/**
 * Email Template Data Service
 * Handles database operations for email templates
 * Client-safe (no nodemailer dependencies)
 */

import { pb } from '$lib/infra/db/pb';
import { Collections, type EmailTemplatesResponse } from '$lib/types';

/**
 * Cache for email templates to reduce DB calls
 */
const templateCache = new Map<string, { template: EmailTemplatesResponse; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

/**
 * Get email template by key with caching
 */
export async function getEmailTemplate(templateKey: string): Promise<EmailTemplatesResponse | null> {
    // Check cache first
    const cached = templateCache.get(templateKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return cached.template;
    }

    try {
        const template = await pb
            .collection(Collections.EmailTemplates)
            .getFirstListItem<EmailTemplatesResponse>(`template_key = "${templateKey}" && is_active = true`);

        // Cache the result
        templateCache.set(templateKey, { template, cachedAt: Date.now() });
        return template;
    } catch {
        return null;
    }
}

/**
 * Get all active email templates
 */
export async function getAllEmailTemplates(): Promise<EmailTemplatesResponse[]> {
    try {
        return await pb
            .collection(Collections.EmailTemplates)
            .getFullList<EmailTemplatesResponse>({
                filter: 'is_active = true',
                sort: 'template_name'
            });
    } catch {
        return [];
    }
}

/**
 * Update an email template
 */
export async function updateEmailTemplate(
    id: string,
    data: { subject: string; body: string }
): Promise<EmailTemplatesResponse> {
    try {
        const result = await pb.collection(Collections.EmailTemplates).update<EmailTemplatesResponse>(id, data);

        // Invalidate cache for this template
        for (const [key, value] of templateCache.entries()) {
            if (value.template.id === id) {
                templateCache.delete(key);
                break;
            }
        }

        return result;
    } catch (error) {
        // console.error('[updateEmailTemplate] Failed to update template:', error);
        throw error;
    }
}

/**
 * Clear template cache (useful after template updates)
 */
export function clearTemplateCache(): void {
    templateCache.clear();
}

/**
 * Standard template keys for loan lifecycle
 */
export const TEMPLATE_KEYS = {
    // Application stage
    APPLICATION_RECEIVED: 'application_received',
    APPLICATION_REJECTED: 'application_rejected',

    // Disbursement stage
    LOAN_DISBURSED: 'loan_disbursed',

    // Payment reminders
    PAYMENT_REMINDER_3_DAYS: 'payment_reminder_3_days',
    PAYMENT_REMINDER_2_DAYS: 'payment_reminder_2_days',
    PAYMENT_REMINDER_1_DAY: 'payment_reminder_1_day',
    PAYMENT_DUE_TODAY: 'payment_due_today',

    // Overdue stage
    OVERDUE_GRACE_PERIOD: 'overdue_grace_period',
    DAILY_OVERDUE_REMINDER: 'daily_overdue_reminder',

    // Penalty stage
    PENALTY_APPLIED: 'penalty_applied',
    DAILY_PENALTY_REMINDER: 'daily_penalty_reminder',

    // Default stage
    LOAN_DEFAULTED: 'loan_defaulted',

    // Payment received
    PAYMENT_RECEIVED: 'payment_received',
    LOAN_FULLY_PAID: 'loan_fully_paid',

    // Waiver
    PENALTY_WAIVER: 'penalty_waiver',

    // Closure
    LOAN_CLOSED: 'loan_closed'
} as const;

export type TemplateKey = typeof TEMPLATE_KEYS[keyof typeof TEMPLATE_KEYS];
