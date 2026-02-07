/**
 * Organization page data loader
 * Fetches users and roles for team management
 */

import type { PageLoad } from './$types';
import { getAllUsers } from '$lib/core/users';
import { getAllRoles } from '$lib/services/roles';
import { session } from '$lib/store/session.svelte';
import { browser } from '$app/environment';

export const load: PageLoad = async ({ url }) => {
	const tab = url.searchParams.get('tab') || 'profile';

	if (!browser) {
		return {
			tab,
			users: [],
			roles: []
		};
	}

	try {
		const permissions = session.permissions || [];

		const [users, roles] = await Promise.all([
			getAllUsers(permissions),
			getAllRoles()
		]);

		return {
			tab,
			users,
			roles
		};
	} catch (error) {
		return {
			tab,
			users: [],
			roles: []
		};
	}
};
