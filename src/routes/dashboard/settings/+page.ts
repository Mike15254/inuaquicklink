/**
 * Settings page data loader
 * Fetches loan settings
 */

import type { PageLoad } from './$types';
import { getLoanSettings } from '$lib/core/settings';
import { browser } from '$app/environment';

export const load: PageLoad = async () => {
	if (!browser) {
		return {
			loanSettings: null
		};
	}

	try {
		const loanSettings = await getLoanSettings();
		return { loanSettings };
	} catch (error) {
		console.error('Failed to load settings:', error);
		return { loanSettings: null };
	}
};