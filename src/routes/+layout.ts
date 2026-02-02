/**
 * Root layout - restores session from PocketBase localStorage
 */

import type { LayoutLoad } from './$types';
import { browser } from '$app/environment';
import { restoreSession } from '$lib/store/session.svelte';

export const load: LayoutLoad = async () => {
	// Restore session from PocketBase localStorage on client-side
	// PocketBase automatically loads auth from localStorage
	if (browser) {
		restoreSession();
	}

	return {};
};
