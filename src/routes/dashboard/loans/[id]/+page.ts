/**
 * Loan detail page data loader
 */

import { browser } from '$app/environment';
import { getLoanById } from '$lib/core/loans/loan_service';
import { getLoanPayments } from '$lib/core/loans/payment_service';
import { getEmailLogsForLoan } from '$lib/services/email/logs';
import { session } from '$lib/store/session.svelte';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const loanId = params.id;

	if (!browser) {
		return {
			loan: null,
			payments: [],
			emails: [],
			loanId
		};
	}

	try {
		const permissions = session.permissions || [];

		const [loan, payments, emails] = await Promise.all([
			getLoanById(loanId),
			getLoanPayments(loanId, permissions),
			getEmailLogsForLoan(loanId)
		]);
		console.log('Loan details:', loan);
		console.log('Loan payments:', payments);
		console.log('Email logs:', emails);

		return {
			loan,
			payments,
			emails,
			loanId
		};
	} catch (error) {
		console.error('Failed to load loan details:', error);
		return {
			loan: null,
			payments: [],
			emails: [],
			loanId,
			error: 'Failed to load loan details'
		};
	}
};
