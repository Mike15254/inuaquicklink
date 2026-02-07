/**
 * CRM page server actions
 * Handles email sending and other server-side operations
 */

import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { sendEmail } from '$lib/services/email/client';
import { EmailLogsEmailTypeOptions } from '$lib/types';

export const actions: Actions = {
	sendEmail: async ({ request }) => {
		const formData = await request.formData();

		const to = formData.get('to') as string;
		const subject = formData.get('subject') as string;
		const html = formData.get('html') as string;
		const customerId = formData.get('customerId') as string;
		const sentBy = formData.get('sentBy') as string;

		// Validation
		if (!to || !subject || !html) {
			return fail(400, {
				success: false,
				error: 'Missing required fields: to, subject, html'
			});
		}

		try {
			const result = await sendEmail({
				to,
				subject,
				html,
				customerId: customerId || undefined,
				sentBy: sentBy || undefined,
				emailType: EmailLogsEmailTypeOptions.custom,
				isAutomated: false
			});

			if (result.success) {
				return {
					success: true,
					emailLogId: result.emailLogId
				};
			} else {
				return fail(500, {
					success: false,
					error: result.error || 'Failed to send email'
				});
			}
		} catch (error) {
			return fail(500, {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}
	}
};
