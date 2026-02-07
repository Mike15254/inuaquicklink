/**
 * Customers page data loader
 * Fetches customer stats and paginated customers list
 */

import type { PageLoad } from './$types';
import { getCustomers, getCustomerStats } from '$lib/core/customers';
import type { CustomersStatusOptions } from '$lib/types';
import { session } from '$lib/store/session.svelte';
import { browser } from '$app/environment';

const CUSTOMERS_PER_PAGE = 20;

export const load: PageLoad = async ({ url }) => {
	// Get query params for filtering
	const searchParam = url.searchParams.get('search') || '';
	const statusParam = url.searchParams.get('status') as CustomersStatusOptions | null;
	const pageParam = parseInt(url.searchParams.get('page') || '1');

	if (!browser) {
		return {
			customers: [],
			stats: { total: 0, active: 0, blocked: 0, pending: 0 },
			totalItems: 0,
			totalPages: 0,
			currentPage: 1,
			searchQuery: searchParam,
			statusFilter: statusParam
		};
	}

	try {
		const permissions = session.permissions || [];

		// Fetch stats and customers in parallel
		const [stats, customersResult] = await Promise.all([
			getCustomerStats(permissions),
			getCustomers(pageParam, CUSTOMERS_PER_PAGE, permissions, {
				status: statusParam || undefined,
				search: searchParam || undefined
			})
		]);

		return {
			customers: customersResult.items,
			stats,
			totalItems: customersResult.totalItems,
			totalPages: customersResult.totalPages,
			currentPage: pageParam,
			searchQuery: searchParam,
			statusFilter: statusParam
		};
	} catch (error) {
		return {
			customers: [],
			stats: { total: 0, active: 0, blocked: 0, pending: 0 },
			totalItems: 0,
			totalPages: 0,
			currentPage: 1,
			searchQuery: searchParam,
			statusFilter: statusParam,
			error: 'Failed to load customers'
		};
	}
};
