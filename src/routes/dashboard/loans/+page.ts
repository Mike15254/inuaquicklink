/**
 * Loans overview page data loader
 */

import type { PageLoad } from './$types';
import { getLoans, getLoanStats, getLoansByStatus } from '$lib/core/loans/loan_service';
import { LoansStatusOptions } from '$lib/types';
import { session } from '$lib/store/session.svelte';
import { browser } from '$app/environment';

const LOANS_PER_PAGE = 20;

export const load: PageLoad = async ({ url }) => {
	const searchParam = url.searchParams.get('search') || '';
	const statusParam = url.searchParams.get('status') as LoansStatusOptions | null;
	const pageParam = parseInt(url.searchParams.get('page') || '1');
	const actionParam = url.searchParams.get('action');
	const loanIdParam = url.searchParams.get('loan');

	if (!browser) {
		return {
			loans: [],
			stats: {
				total: 0,
				pending: 0,
				approved: 0,
				disbursed: 0,
				repaid: 0,
				defaulted: 0,
				overdue: 0
			},
			totalItems: 0,
			totalPages: 0,
			currentPage: 1,
			searchQuery: searchParam,
			statusFilter: statusParam,
			action: actionParam,
			selectedLoanId: loanIdParam
		};
	}

	try {
		const permissions = session.permissions || [];

		const [stats, loansResult] = await Promise.all([
			getLoanStats(permissions),
			getLoans(pageParam, LOANS_PER_PAGE, permissions, {
				status: statusParam || undefined,
				search: searchParam || undefined
			})
		]);

		return {
			loans: loansResult.items,
			stats,
			totalItems: loansResult.totalItems,
			totalPages: loansResult.totalPages,
			currentPage: pageParam,
			searchQuery: searchParam,
			statusFilter: statusParam,
			action: actionParam,
			selectedLoanId: loanIdParam
		};
	} catch (error) {
		console.error('Failed to load loans:', error);
		return {
			loans: [],
			stats: {
				total: 0,
				pending: 0,
				approved: 0,
				disbursed: 0,
				repaid: 0,
				defaulted: 0,
				overdue: 0
			},
			totalItems: 0,
			totalPages: 0,
			currentPage: 1,
			searchQuery: searchParam,
			statusFilter: statusParam,
			action: actionParam,
			selectedLoanId: loanIdParam,
			error: 'Failed to load loans'
		};
	}
};
