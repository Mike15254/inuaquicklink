/**
 * CRM page data loader
 * Fetches customers needing follow-up, stats, and interaction history
 */

import type { PageLoad } from './$types';
import { 
	getCRMStats,
	getCustomersNeedingFollowUp,
	getOverdueCustomers
} from '$lib/core/crm';
import { getCustomerById, searchCustomers } from '$lib/core/customers';
import { pb } from '$lib/infra/db/pb';
import { Collections, type CustomersResponse } from '$lib/types';
import { session } from '$lib/store/session.svelte';
import { browser } from '$app/environment';

export const load: PageLoad = async ({ url }) => {
	const customerIdParam = url.searchParams.get('customer');

	if (!browser) {
		return {
			stats: {
				customersNeedingFollowUp: 0,
				overdueLoansCount: 0,
				upcomingDueCount: 0,
				totalActiveLoans: 0
			},
			followUpCustomers: [],
			overdueCustomers: [],
			selectedCustomer: null,
			recentEmails: []
		};
	}

	try {
		const permissions = session.permissions || [];

		// Fetch CRM stats
		const stats = await getCRMStats(permissions);

		// Fetch customers needing follow-up
		const followUpCustomers = await getCustomersNeedingFollowUp(permissions);
		const overdueCustomers = await getOverdueCustomers(permissions);

		// Get selected customer if provided
		let selectedCustomer: CustomersResponse | null = null;
		if (customerIdParam) {
			try {
				selectedCustomer = await getCustomerById(customerIdParam);
			} catch {
				// Customer not found, ignore
			}
		}

		// Fetch recent email logs
		const recentEmails = await pb.collection(Collections.EmailLogs).getList(1, 20, {
			sort: '-created',
			expand: 'customer'
		});

		return {
			stats,
			followUpCustomers,
			overdueCustomers,
			selectedCustomer,
			recentEmails: recentEmails.items
		};
	} catch (error) {
		return {
			stats: {
				customersNeedingFollowUp: 0,
				overdueLoansCount: 0,
				upcomingDueCount: 0,
				totalActiveLoans: 0
			},
			followUpCustomers: [],
			overdueCustomers: [],
			selectedCustomer: null,
			recentEmails: [],
			error: 'Failed to load CRM data'
		};
	}
};
