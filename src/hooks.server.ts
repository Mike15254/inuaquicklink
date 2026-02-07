import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { configureSmtp } from '$lib/services/email/transport';
import { pb } from '$lib/infra/db/pb';

// Initialize SMTP config on server startup
(() => {
	const smtpSettings = {
		host: env.SMTP_HOST,
		port: env.SMTP_PORT ? parseInt(env.SMTP_PORT) : undefined,
		secure: env.SMTP_SECURE === 'true',
		user: env.SMTP_USER,
		pass: env.SMTP_PASS,
		from: env.SMTP_FROM,
		fromName: env.SMTP_FROM_NAME
	};

	const cleanSettings = Object.fromEntries(
		Object.entries(smtpSettings).filter(([_, v]) => v !== undefined)
	);

	if (Object.keys(cleanSettings).length > 0) {
	
		configureSmtp(cleanSettings);
	} else {
		// console.warn('[hooks.server] WARNING: No SMTP environment variables found in $env/dynamic/private');
	}
})();

/**
 * Server hook to manage auth session
 * Reads auth token from cookie and validates it server-side
 */
export const handle: Handle = async ({ event, resolve }) => {
	// Get auth token from cookie (set by PocketBase client)
	const authCookie = event.cookies.get('pb_auth');
	
	if (authCookie) {
		try {
			// Load the auth data from cookie into server-side PocketBase
			// PocketBase cookie format: JSON with token and model
			const authData = JSON.parse(authCookie);
			pb.authStore.save(authData.token, authData.model);
			
			// Attach auth state to event.locals for server-side access
			event.locals.user = pb.authStore.model;
			event.locals.token = pb.authStore.token;
		} catch (error) {
			event.cookies.delete('pb_auth', { path: '/' });
		}
	}
	
	const response = await resolve(event);
	return response;
};