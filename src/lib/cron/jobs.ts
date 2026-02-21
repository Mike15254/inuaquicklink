/**
 * Cron job type definitions and utilities
 * These define the jobs that will be registered in PocketBase hooks
 */

import { CronJobsJobTypeOptions } from '$lib/types';

/**
 * Cron job configuration
 */
export interface CronJobConfig {
	id: string;
	name: string;
	jobType: CronJobsJobTypeOptions;
	schedule: string; // Cron expression
	description: string;
	enabled: boolean;
}

/**
 * Cron job result
 */
export interface CronJobResult {
	success: boolean;
	processedCount: number;
	errors: string[];
	duration: number;
	details?: Record<string, unknown>;
}

/**
 * All cron job configurations
 */
export const CRON_JOBS: CronJobConfig[] = [
	{
		id: 'payment_reminder',
		name: 'Payment Reminder',
		jobType: CronJobsJobTypeOptions.payment_reminder,
		schedule: '0 9 * * *', // Daily at 9 AM
		description: 'Send payment reminders for loans due within 3 days',
		enabled: true
	},
	{
		id: 'overdue_check',
		name: 'Overdue Check',
		jobType: CronJobsJobTypeOptions.overdue_check,
		schedule: '0 8 * * *', // Daily at 8 AM
		description: 'Check for overdue loans, mark as overdue and track grace period',
		enabled: true
	},
	{
		id: 'penalty_calculation',
		name: 'Penalty Calculation',
		jobType: CronJobsJobTypeOptions.penalty_calculation,
		schedule: '0 0 * * *', // Daily at midnight
		description: 'Apply one-time penalty after grace period ends',
		enabled: true
	},
	{
		id: 'default_check',
		name: 'Default Check',
		jobType: CronJobsJobTypeOptions.overdue_check, // Reuse type until enum updated
		schedule: '0 1 * * *', // Daily at 1 AM
		description: 'Mark loans as defaulted after penalty period ends',
		enabled: true
	},
	{
		id: 'link_expiry_check',
		name: 'Link Expiry Check',
		jobType: CronJobsJobTypeOptions.link_expiry_check,
		schedule: '*/10 * * * *', // Every 10 minutes
		description: 'Mark expired application links (Disabled - handled by backend)',
		enabled: false
	},
	{
		id: 'system_cleanup',
		name: 'System Cleanup',
		jobType: CronJobsJobTypeOptions.system_cleanup,
		schedule: '0 2 * * 0', // Weekly on Sunday at 2 AM
		description: 'Clean up old logs and temporary data',
		enabled: true
	},
	{
		id: 'email_queue_process',
		name: 'Email Queue Processor',
		jobType: CronJobsJobTypeOptions.system_cleanup, // Reuse type until enum updated
		schedule: '*/10 * * * *', // Every 10 minutes
		description: 'Process pending emails in the queue and send via SMTP',
		enabled: true
	},
	{
		id: 'failed_email_retry',
		name: 'Failed Email Retry',
		jobType: CronJobsJobTypeOptions.system_cleanup, // Reuse type until enum updated
		schedule: '0 * * * *', // Every hour
		description: 'Retry sending emails that previously failed',
		enabled: true
	},
	{
		id: 'pre_due_reminder',
		name: 'Pre-Due Reminder',
		jobType: CronJobsJobTypeOptions.payment_reminder,
		schedule: '0 7 * * *', // Daily at 7 AM
		description: 'Send pre-due reminders for loans due within 1-3 days',
		enabled: true
	},
	{
		id: 'urgent_payment_reminder',
		name: 'Urgent Payment Reminder',
		jobType: CronJobsJobTypeOptions.payment_reminder,
		schedule: '0 8,12,16 * * *', // 8 AM, 12 PM, 4 PM
		description: 'Send urgent reminders for loans due today or in grace period',
		enabled: true
	},
	{
		id: 'grace_period_reminder',
		name: 'Grace Period Reminder',
		jobType: CronJobsJobTypeOptions.payment_reminder,
		schedule: '0 11 * * *', // Daily at 11 AM
		description: 'Send daily grace period reminders with penalty warning',
		enabled: true
	}
];

/**
 * Get cron job config by ID
 */
export function getCronJobConfig(jobId: string): CronJobConfig | undefined {
	return CRON_JOBS.find((job) => job.id === jobId);
}

/**
 * Get all enabled cron jobs
 */
export function getEnabledCronJobs(): CronJobConfig[] {
	return CRON_JOBS.filter((job) => job.enabled);
}

/**
 * Format cron result for logging
 */
export function formatCronResult(result: CronJobResult): string {
	const status = result.success ? 'SUCCESS' : 'FAILED';
	const errorSummary = result.errors.length > 0 ? ` (${result.errors.length} errors)` : '';
	return `[${status}] Processed ${result.processedCount} items in ${result.duration}ms${errorSummary}`;
}
