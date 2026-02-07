/**
 * Customer details page data loader
 * Fetches customer info, loans, activities, and documents
 */

import type { PageLoad } from './$types';
import { getCustomerById } from '$lib/core/customers';
import { getRecentActivities } from '$lib/core/activity/activity_service';
import { pb } from '$lib/infra/db/pb';
import { Collections, ActivitiesEntityTypeOptions, type LoansResponse, type LoanDocumentsResponse } from '$lib/types';
import { session } from '$lib/store/session.svelte';
import { browser } from '$app/environment';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
	const customerId = params.name;

	if (!browser) {
		return {
			customer: null,
			loans: [],
			activities: [],
			documents: [],
			interactions: []
		};
	}

	try {
		// Fetch customer details
		const customer = await getCustomerById(customerId);

		// Fetch customer's loans
		const loansResult = await pb.collection(Collections.Loans).getFullList<LoansResponse>({
			filter: `customer = "${customerId}"`,
			sort: '-created'
		});

		// Fetch activities for this customer
		const activities = await getRecentActivities(50, {
			entityType: ActivitiesEntityTypeOptions.customer,
			entityId: customerId
		});

		// Fetch loan-related activities for this customer
		const loanIds = loansResult.map(l => l.id);
		let loanActivities: typeof activities = [];
		if (loanIds.length > 0) {
			const loanActivityPromises = loanIds.slice(0, 5).map(loanId =>
				getRecentActivities(10, {
					entityType: ActivitiesEntityTypeOptions.loan,
					entityId: loanId
				})
			);
			const results = await Promise.all(loanActivityPromises);
			loanActivities = results.flat();
		}

		// Combine and sort all activities
		const allActivities = [...activities, ...loanActivities]
			.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
			.slice(0, 50);

		// Fetch documents from loans
		let documents: LoanDocumentsResponse[] = [];
		if (loanIds.length > 0) {
			const docFilter = loanIds.map(id => `loan = "${id}"`).join(' || ');
			documents = await pb.collection(Collections.LoanDocuments).getFullList<LoanDocumentsResponse>({
				filter: docFilter,
				sort: '-created'
			});
		}

		// Interactions are tracked via email logs and CRM activities
		const emailInteractions = await pb.collection(Collections.EmailLogs).getList(1, 20, {
			filter: `customer = "${customerId}"`,
			sort: '-created'
		});

		return {
			customer,
			loans: loansResult,
			activities: allActivities,
			documents,
			interactions: emailInteractions.items
		};
	} catch (err) {
		throw error(404, 'Customer not found');
	}
};
