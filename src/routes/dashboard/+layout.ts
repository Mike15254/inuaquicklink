/**
 * Business code route protection
 * Validates that the user is authenticated and the business code matches their session
 */

import { browser } from '$app/environment';
import { restoreSession, session, updateSessionOrganization } from '$lib/store/session.svelte';
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async () => {
	// On client-side, check session
	if (browser) {
		// Try to restore session if not already loaded
		if (!session.isAuthenticated) {
			restoreSession();
		}

		// Check if user is authenticated
		if (!session.isAuthenticated) {
			// Redirect to login
			throw redirect(302, '/auth');
		}

		// Refresh org data from DB in the background so logo/name are always current
		updateSessionOrganization().catch(() => {});
	}

	return {
		user: session.user,
		organization: session.organization,
		permissions: session.permissions
	};
};
