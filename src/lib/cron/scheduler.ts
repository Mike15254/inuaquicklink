/**
 * Cron scheduler for manual/API-triggered job execution
 * PocketBase handles actual cron scheduling via cronAdd in hooks
 * This module provides utilities for manual job triggering and status tracking
 */

import { pb } from '$lib/infra/db/pb';
import { Collections, CronJobsStatusOptions, CronJobsJobTypeOptions } from '$lib/types';
import { CRON_JOBS, type CronJobConfig, type CronJobResult } from './jobs';
import { runCronJob } from './handlers';

export interface CronJobStatus {
	jobId: string;
	name: string;
	lastRun: string | null;
	lastResult: CronJobResult | null;
	nextRun: string | null;
	isEnabled: boolean;
}

export interface SchedulerState {
	jobs: CronJobStatus[];
	isRunning: boolean;
}

/**
 * Get all job configurations
 */
export function getCronJobs(): CronJobConfig[] {
	return CRON_JOBS;
}

/**
 * Get a specific job configuration
 */
export function getCronJob(jobId: string): CronJobConfig | undefined {
	return CRON_JOBS.find((job) => job.id === jobId);
}

/**
 * Map job ID to job type enum
 */
function getJobType(jobId: string): CronJobsJobTypeOptions | undefined {
	const mapping: Record<string, CronJobsJobTypeOptions> = {
		payment_reminder: CronJobsJobTypeOptions.payment_reminder,
		overdue_check: CronJobsJobTypeOptions.overdue_check,
		penalty_calculation: CronJobsJobTypeOptions.penalty_calculation,
		link_expiry_check: CronJobsJobTypeOptions.link_expiry_check,
		system_cleanup: CronJobsJobTypeOptions.system_cleanup
	};
	return mapping[jobId];
}

/**
 * Run a cron job manually and log the result
 */
export async function triggerCronJob(
	jobId: string,
	_triggeredBy?: string
): Promise<CronJobResult> {
	const job = getCronJob(jobId);
	if (!job) {
		return {
			success: false,
			processedCount: 0,
			errors: [`Job not found: ${jobId}`],
			duration: 0
		};
	}

	const jobType = getJobType(jobId);
	const now = new Date().toISOString();

	// Run the job
	const result = await runCronJob(jobId);

	// Update or create job record in database
	try {
		const existingJobs = await pb.collection(Collections.CronJobs).getFullList({
			filter: `job_type = "${jobType}"`
		});

		if (existingJobs.length > 0) {
			// Update existing record
			await pb.collection(Collections.CronJobs).update(existingJobs[0].id, {
				last_run: now,
				run_count: (existingJobs[0].run_count || 0) + 1,
				status: result.success ? CronJobsStatusOptions.active : CronJobsStatusOptions.failed,
				error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
				last_result: result
			});
		} else {
			// Create new record
			await pb.collection(Collections.CronJobs).create({
				job_name: job.name,
				job_type: jobType,
				last_run: now,
				next_run: now, // Will be updated by actual cron
				run_count: 1,
				status: result.success ? CronJobsStatusOptions.active : CronJobsStatusOptions.failed,
				error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
				last_result: result
			});
		}
	} catch (error) {
		console.error('Failed to log cron job result:', error);
	}

	return result;
}

/**
 * Get recent job runs for a specific job type
 */
export async function getJobHistory(
	jobId: string
): Promise<{
	jobName: string;
	lastRun: string | null;
	runCount: number;
	status: string;
	errorMessage: string | null;
} | null> {
	const jobType = getJobType(jobId);
	if (!jobType) return null;

	try {
		const records = await pb.collection(Collections.CronJobs).getFullList({
			filter: `job_type = "${jobType}"`
		});

		if (records.length === 0) return null;

		const record = records[0];
		return {
			jobName: record.job_name,
			lastRun: record.last_run,
			runCount: record.run_count || 0,
			status: record.status,
			errorMessage: record.error_message || null
		};
	} catch {
		return null;
	}
}

/**
 * Get all job statuses
 */
export async function getAllJobStatuses(): Promise<CronJobStatus[]> {
	const statuses: CronJobStatus[] = [];

	for (const job of CRON_JOBS) {
		const history = await getJobHistory(job.id);

		statuses.push({
			jobId: job.id,
			name: job.name,
			lastRun: history?.lastRun || null,
			lastResult: null, // Would need to store full result
			nextRun: null, // Would need cron parsing to calculate
			isEnabled: job.enabled
		});
	}

	return statuses;
}

/**
 * PocketBase cronAdd script generator
 * Use this to generate the JavaScript code for PocketBase hooks
 */
export function generatePocketBaseHooks(): string {
	const hooks: string[] = [];

	for (const job of CRON_JOBS) {
		if (!job.enabled) continue;

		hooks.push(`
// ${job.name}: ${job.description}
cronAdd("${job.id}", "${job.schedule}", async () => {
    try {
        const response = await $http.send({
            method: 'POST',
            url: $app.settings().meta.appURL + '/api/cron/${job.id}',
            headers: {
                'Content-Type': 'application/json',
                'X-Cron-Secret': process.env.CRON_SECRET || ''
            }
        });
        console.log("Cron ${job.id} completed:", response.statusCode);
    } catch (error) {
        console.error("Cron ${job.id} failed:", error);
    }
});`);
	}

	return hooks.join('\n');
}
