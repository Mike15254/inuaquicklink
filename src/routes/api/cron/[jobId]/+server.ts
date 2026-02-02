/**
 * Cron job execution API endpoint
 * Handles scheduled job execution triggered from PocketBase hooks
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { runCronJob } from '$lib/cron';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ params, request }: RequestEvent) => {
	try {
		const jobId = params.jobId;

		// Validation
		if (!jobId) {
			return json({ success: false, error: 'Job ID is required' }, { status: 400 });
		}

		// Security check - verify secret if configured
		const cronSecret = env.CRON_SECRET;
		const authHeader = request.headers.get('X-Cron-Secret');

		console.log(`[cron] Received request for job: ${jobId}`);
		console.log(`[cron] Secret configured: ${!!cronSecret}`);
		console.log(`[cron] Auth header present: ${!!authHeader}`);

		if (cronSecret && cronSecret !== authHeader) {
			console.error(`[cron] Unauthorized: Secret mismatch for job ${jobId}`);
			return json({ success: false, error: 'Unauthorized' }, { status: 401 });
		}

		// Execute the cron job
		console.log(`[cron] Starting job: ${jobId}`);
		const result = await runCronJob(jobId);
		console.log(`[cron] Job ${jobId} completed:`, result);

		return json(result);
	} catch (error) {
		console.error('[cron] Job execution error:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Job execution failed'
			},
			{ status: 500 }
		);
	}
};
