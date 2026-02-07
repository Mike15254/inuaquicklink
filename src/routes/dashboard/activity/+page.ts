/**
 * Activity page data loader
 * Fetches recent system activities
 */

import type { PageLoad } from './$types';
import { getRecentActivities, type EntityType, type ActivityType } from '$lib/core/activity';
import { browser } from '$app/environment';
import { ActivitiesEntityTypeOptions, ActivitiesActivityTypeOptions } from '$lib/types';

export const load: PageLoad = async ({ url }) => {
	const entityFilter = url.searchParams.get('entity') as EntityType | null;
	const activityFilter = url.searchParams.get('type') as ActivityType | null;

	if (!browser) {
		return {
			activities: [],
			entityFilter,
			activityFilter,
			entityTypes: Object.values(ActivitiesEntityTypeOptions),
			activityTypes: Object.values(ActivitiesActivityTypeOptions)
		};
	}

	try {
		const activities = await getRecentActivities(100, {
			entityType: entityFilter || undefined,
			activityType: activityFilter || undefined
		});

		return {
			activities,
			entityFilter,
			activityFilter,
			entityTypes: Object.values(ActivitiesEntityTypeOptions),
			activityTypes: Object.values(ActivitiesActivityTypeOptions)
		};
	} catch (error) {
		return {
			activities: [],
			entityFilter,
			activityFilter,
			entityTypes: Object.values(ActivitiesEntityTypeOptions),
			activityTypes: Object.values(ActivitiesActivityTypeOptions)
		};
	}
};