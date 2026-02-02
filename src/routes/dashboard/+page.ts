/**
 * Dashboard analytics page data loader
 */

import type { PageLoad } from './$types';
import { browser } from '$app/environment';
import { session } from '$lib/store/session.svelte';
import { getAnalyticsData, type TimePeriod, type DateRange } from '$lib/core/analytics';

export const load: PageLoad = async ({ url }) => {
	const periodParam = (url.searchParams.get('period') as TimePeriod) || 'week';
	const startDate = url.searchParams.get('start');
	const endDate = url.searchParams.get('end');

	const customRange: DateRange | undefined =
		periodParam === 'custom' && startDate && endDate
			? { startDate, endDate }
			: undefined;

	if (!browser) {
		return {
			analytics: null,
			period: periodParam,
			customRange,
			isLoading: true
		};
	}

	try {
		const userId = session.user?.id;
		const analytics = await getAnalyticsData(periodParam, customRange, userId);

		return {
			analytics,
			period: periodParam,
			customRange,
			isLoading: false
		};
	} catch (error) {
		console.error('Failed to load analytics:', error);
		return {
			analytics: null,
			period: periodParam,
			customRange,
			isLoading: false,
			error: 'Failed to load analytics data'
		};
	}
};
