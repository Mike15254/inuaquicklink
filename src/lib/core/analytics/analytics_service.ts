/**
 * Analytics service for financial reporting and business metrics
 * Provides chart-ready data for profitability, loan status, and P&L analysis
 */

import { pb } from '$lib/infra/db/pb';
import {
	Collections,
	LoansStatusOptions,
	type LoansResponse,
	type PaymentsResponse
} from '$lib/types';
import { roundCurrency } from '$lib/shared/currency';
import { toDate, toISODate, formatShortDate } from '$lib/shared/date_time';
import { logReportGenerated } from '$lib/core/activity/activity_service';
import type {
	TimePeriod,
	DateRange,
	SummaryMetrics,
	ProfitabilityMetrics,
	LoanStatusCount,
	LoanPaymentRateMetrics,
	PLStatement,
	PLLineItem,
	ChartDataPoint,
	TrendData,
	DailyBreakdown,
	AnalyticsData
} from './analytics_types';
import {
	getDateRangeForPeriod,
	buildDateFilter,
	generateDateRange,
	getDaysInPeriod
} from './period_utils';

/**
 * Get YYYY-MM-DD string using local time to match period_utils logic
 */
function toLocalKey(dateInput: string | Date): string {
	const d = toDate(dateInput);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Fetch loans within date range
 */
async function fetchLoansInRange(dateRange: DateRange): Promise<LoansResponse[]> {
	const filter = buildDateFilter('created', dateRange);
	return await pb.collection(Collections.Loans).getFullList<LoansResponse>({
		filter,
		sort: 'created',
		requestKey: null
	});
}

/**
 * Fetch disbursed loans within date range
 */
async function fetchDisbursedLoansInRange(dateRange: DateRange): Promise<LoansResponse[]> {
	const baseFilter = buildDateFilter('disbursement_date', dateRange);
	const statusFilter = `status != "${LoansStatusOptions.pending}" && status != "${LoansStatusOptions.rejected}"`;
	return await pb.collection(Collections.Loans).getFullList<LoansResponse>({
		filter: `${baseFilter} && ${statusFilter}`,
		sort: 'disbursement_date',
		requestKey: null
	});
}

/**
 * Fetch payments within date range
 */
async function fetchPaymentsInRange(dateRange: DateRange): Promise<PaymentsResponse[]> {
	const filter = buildDateFilter('payment_date', dateRange);
	return await pb.collection(Collections.Payments).getFullList<PaymentsResponse>({
		filter,
		sort: 'payment_date',
		requestKey: null
	});
}

/**
 * Fetch repaid loans within date range
 */
async function fetchRepaidLoansInRange(dateRange: DateRange): Promise<LoansResponse[]> {
	const baseFilter = buildDateFilter('repayment_date', dateRange);
	return await pb.collection(Collections.Loans).getFullList<LoansResponse>({
		filter: `${baseFilter} && status = "${LoansStatusOptions.repaid}"`,
		sort: 'repayment_date',
		requestKey: null
	});
}

/**
 * Get summary metrics for dashboard cards
 */
export async function getSummaryMetrics(
	period: TimePeriod = 'today',
	customRange?: DateRange
): Promise<SummaryMetrics> {
	const dateRange = getDateRangeForPeriod(period, customRange);

	const [disbursedLoans, payments, allLoans] = await Promise.all([
		fetchDisbursedLoansInRange(dateRange),
		fetchPaymentsInRange(dateRange),
		fetchLoansInRange(dateRange)
	]);

	const totalDisbursed = disbursedLoans.reduce((sum, l) => sum + (l.disbursement_amount || 0), 0);
	const totalCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

	const activeLoans = allLoans.filter(
		(l) => l.status === LoansStatusOptions.disbursed || l.status === LoansStatusOptions.partially_paid
	);
	const overdueLoans = activeLoans.filter((l) => toDate(l.due_date) < new Date());
	const repaidLoans = allLoans.filter((l) => l.status === LoansStatusOptions.repaid);
	const defaultedLoans = allLoans.filter((l) => l.status === LoansStatusOptions.defaulted);

	const totalOutstanding = activeLoans.reduce((sum, l) => sum + (l.balance || 0), 0);
	
	// Calculate fees from all disbursed loans in the period
	const totalFeesCollected = disbursedLoans.reduce((sum, l) => sum + (l.processing_fee || 0), 0);
	
	// Calculate interest and penalties from all loans that have received payments (not just fully repaid)
	// This includes partially paid and fully repaid loans
	const loansWithPayments = allLoans.filter((l) => (l.amount_paid || 0) > 0);
	const totalInterestEarned = loansWithPayments.reduce((sum, l) => sum + (l.interest_amount || 0), 0);
	const totalPenaltiesCollected = loansWithPayments.reduce((sum, l) => sum + (l.penalty_amount || 0), 0);

	const collectionRate = totalDisbursed > 0 ? (totalCollected / totalDisbursed) * 100 : 0;

	return {
		totalDisbursed: roundCurrency(totalDisbursed),
		totalCollected: roundCurrency(totalCollected),
		totalOutstanding: roundCurrency(totalOutstanding),
		totalInterestEarned: roundCurrency(totalInterestEarned),
		totalFeesCollected: roundCurrency(totalFeesCollected),
		totalPenaltiesCollected: roundCurrency(totalPenaltiesCollected),
		activeLoansCount: activeLoans.length,
		overdueLoansCount: overdueLoans.length,
		repaidLoansCount: repaidLoans.length,
		defaultedLoansCount: defaultedLoans.length,
		collectionRate: roundCurrency(collectionRate)
	};
}

/**
 * Get profitability metrics
 */
export async function getProfitabilityMetrics(
	period: TimePeriod = 'today',
	customRange?: DateRange
): Promise<ProfitabilityMetrics> {
	const dateRange = getDateRangeForPeriod(period, customRange);

	const [disbursedLoans, allLoans, payments] = await Promise.all([
		fetchDisbursedLoansInRange(dateRange),
		fetchLoansInRange(dateRange),
		fetchPaymentsInRange(dateRange)
	]);

	// Calculate revenue from all loans with payments (not just fully repaid)
	const loansWithPayments = allLoans.filter((l) => (l.amount_paid || 0) > 0);
	
	const interestIncome = loansWithPayments.reduce((sum, l) => sum + (l.interest_amount || 0), 0);
	const feeIncome = disbursedLoans.reduce((sum, l) => sum + (l.processing_fee || 0), 0);
	const penaltyIncome = loansWithPayments.reduce((sum, l) => sum + (l.penalty_amount || 0), 0);
	const grossRevenue = interestIncome + feeIncome + penaltyIncome;

	const totalDisbursed = disbursedLoans.reduce((sum, l) => sum + (l.disbursement_amount || 0), 0);
	const totalCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

	const netIncome = totalCollected - totalDisbursed;
	const profitMargin = totalCollected > 0 ? (netIncome / totalCollected) * 100 : 0;

	const avgLoanSize =
		disbursedLoans.length > 0
			? disbursedLoans.reduce((sum, l) => sum + (l.loan_amount || 0), 0) / disbursedLoans.length
			: 0;

	const avgInterestRate =
		disbursedLoans.length > 0
			? disbursedLoans.reduce((sum, l) => sum + (l.interest_rate || 0), 0) / disbursedLoans.length
			: 0;

	return {
		grossRevenue: roundCurrency(grossRevenue),
		interestIncome: roundCurrency(interestIncome),
		feeIncome: roundCurrency(feeIncome),
		penaltyIncome: roundCurrency(penaltyIncome),
		totalDisbursed: roundCurrency(totalDisbursed),
		netIncome: roundCurrency(netIncome),
		profitMargin: roundCurrency(profitMargin),
		avgLoanSize: roundCurrency(avgLoanSize),
		avgInterestRate: roundCurrency(avgInterestRate * 100)
	};
}

/**
 * Get loan status distribution for charts
 */
export async function getLoanStatusDistribution(
	period: TimePeriod = 'today',
	customRange?: DateRange
): Promise<LoanStatusCount[]> {
	const dateRange = getDateRangeForPeriod(period, customRange);
	const loans = await fetchLoansInRange(dateRange);

	const statusMap = new Map<LoansStatusOptions, { count: number; totalAmount: number }>();

	for (const status of Object.values(LoansStatusOptions)) {
		statusMap.set(status, { count: 0, totalAmount: 0 });
	}

	for (const loan of loans) {
		const rawStatus = loan.status || LoansStatusOptions.pending;
		// Ensure case-insensitive match and fallback
		const status = Object.values(LoansStatusOptions).find(
			s => s.toLowerCase() === rawStatus.toLowerCase()
		) || LoansStatusOptions.pending;

		if (statusMap.has(status)) {
			const current = statusMap.get(status)!;
			current.count += 1;
			current.totalAmount += loan.loan_amount || 0;
		}
	}

	return Array.from(statusMap.entries()).map(([status, data]) => ({
		status,
		count: data.count,
		totalAmount: roundCurrency(data.totalAmount)
	}));
}

/**
 * Get loan to payment rate metrics
 */
export async function getLoanPaymentRateMetrics(
	period: TimePeriod = 'today',
	customRange?: DateRange
): Promise<LoanPaymentRateMetrics> {
	const dateRange = getDateRangeForPeriod(period, customRange);

	const [disbursedLoans, payments, repaidLoans] = await Promise.all([
		fetchDisbursedLoansInRange(dateRange),
		fetchPaymentsInRange(dateRange),
		fetchRepaidLoansInRange(dateRange)
	]);

	const totalLoansDisbursed = disbursedLoans.reduce(
		(sum, l) => sum + (l.total_repayment || 0),
		0
	);
	const totalPaymentsReceived = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

	const paymentRate = totalLoansDisbursed > 0 ? (totalPaymentsReceived / totalLoansDisbursed) * 100 : 0;

	const avgPaymentPerLoan =
		disbursedLoans.length > 0 ? totalPaymentsReceived / disbursedLoans.length : 0;

	const onTimeRepayments = repaidLoans.filter((l) => {
		const repaymentDate = toDate(l.repayment_date);
		const dueDate = toDate(l.due_date);
		return repaymentDate <= dueDate;
	});

	const onTimePaymentRate = repaidLoans.length > 0
		? (onTimeRepayments.length / repaidLoans.length) * 100
		: 0;

	return {
		totalLoansDisbursed: roundCurrency(totalLoansDisbursed),
		totalPaymentsReceived: roundCurrency(totalPaymentsReceived),
		paymentRate: roundCurrency(paymentRate),
		avgPaymentPerLoan: roundCurrency(avgPaymentPerLoan),
		onTimePaymentRate: roundCurrency(onTimePaymentRate)
	};
}

/**
 * Generate P&L statement
 */
export async function getPLStatement(
	period: TimePeriod = 'today',
	customRange?: DateRange,
	userId?: string
): Promise<PLStatement> {
	const dateRange = getDateRangeForPeriod(period, customRange);

	const [disbursedLoans, allLoans, payments] = await Promise.all([
		fetchDisbursedLoansInRange(dateRange),
		fetchLoansInRange(dateRange),
		fetchPaymentsInRange(dateRange)
	]);

	// Calculate revenue from all loans with payments (not just fully repaid)
	const loansWithPayments = allLoans.filter((l) => (l.amount_paid || 0) > 0);
	const interestIncome = loansWithPayments.reduce((sum, l) => sum + (l.interest_amount || 0), 0);
	const processingFees = disbursedLoans.reduce((sum, l) => sum + (l.processing_fee || 0), 0);
	const penaltiesCollected = loansWithPayments.reduce((sum, l) => sum + (l.penalty_amount || 0), 0);
	const totalRevenue = interestIncome + processingFees + penaltiesCollected;

	const loansDisbursed = disbursedLoans.reduce((sum, l) => sum + (l.disbursement_amount || 0), 0);
	const activeLoans = disbursedLoans.filter(
		(l) => l.status === LoansStatusOptions.disbursed || l.status === LoansStatusOptions.partially_paid
	);
	const outstandingPrincipal = activeLoans.reduce((sum, l) => sum + (l.balance || 0), 0);

	const defaultedLoans = disbursedLoans.filter((l) => l.status === LoansStatusOptions.defaulted);
	const potentialLosses = defaultedLoans.reduce((sum, l) => sum + (l.balance || 0), 0);
	const totalExpenses = loansDisbursed + potentialLosses;

	const totalCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
	const grossProfit = totalCollected - loansDisbursed;
	const netProfit = totalRevenue - potentialLosses;
	const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

	const lineItems: PLLineItem[] = [
		{ label: 'Interest Income', amount: roundCurrency(interestIncome), isExpense: false },
		{ label: 'Processing Fees', amount: roundCurrency(processingFees), isExpense: false },
		{ label: 'Penalties Collected', amount: roundCurrency(penaltiesCollected), isExpense: false },
		{ label: 'Loans Disbursed', amount: roundCurrency(loansDisbursed), isExpense: true },
		{ label: 'Potential Losses (Defaults)', amount: roundCurrency(potentialLosses), isExpense: true }
	];

	// Log report generation
	if (userId) {
		await logReportGenerated(userId, 'P&L Statement', period, dateRange);
	}

	return {
		period: dateRange,
		revenue: {
			interestIncome: roundCurrency(interestIncome),
			processingFees: roundCurrency(processingFees),
			penaltiesCollected: roundCurrency(penaltiesCollected),
			totalRevenue: roundCurrency(totalRevenue)
		},
		expenses: {
			loansDisbursed: roundCurrency(loansDisbursed),
			outstandingPrincipal: roundCurrency(outstandingPrincipal),
			potentialLosses: roundCurrency(potentialLosses),
			totalExpenses: roundCurrency(totalExpenses)
		},
		summary: {
			grossProfit: roundCurrency(grossProfit),
			netProfit: roundCurrency(netProfit),
			profitMargin: roundCurrency(profitMargin)
		},
		lineItems
	};
}

/**
 * Get trend data for line charts
 */
export async function getTrendData(
	period: TimePeriod = 'week',
	customRange?: DateRange
): Promise<TrendData> {
	const dateRange = getDateRangeForPeriod(period, customRange);
	const dates = generateDateRange(dateRange.startDate, dateRange.endDate);

	const [disbursedLoans, payments, allLoans, repaidLoans] = await Promise.all([
		fetchDisbursedLoansInRange(dateRange),
		fetchPaymentsInRange(dateRange),
		fetchLoansInRange(dateRange),
		fetchRepaidLoansInRange(dateRange)
	]);

	const disbursementTrend: ChartDataPoint[] = [];
	const collectionTrend: ChartDataPoint[] = [];
	const profitTrend: ChartDataPoint[] = [];
	const loanCountTrend: ChartDataPoint[] = [];

	for (const date of dates) {
		const dateStr = toLocalKey(date);
		const label = formatShortDate(date);

		const dayDisbursed = disbursedLoans
			.filter((l) => toLocalKey(l.disbursement_date) === dateStr)
			.reduce((sum, l) => sum + (l.disbursement_amount || 0), 0);

		const dayCollected = payments
			.filter((p) => toLocalKey(p.payment_date) === dateStr)
			.reduce((sum, p) => sum + (p.amount || 0), 0);

		const dayProfit = dayCollected - dayDisbursed;

		const dayLoansCreated = allLoans.filter((l) => toLocalKey(l.created) === dateStr).length;

		disbursementTrend.push({ label, value: roundCurrency(dayDisbursed) });
		collectionTrend.push({ label, value: roundCurrency(dayCollected) });
		profitTrend.push({ label, value: roundCurrency(dayProfit) });
		loanCountTrend.push({ label, value: dayLoansCreated });
	}

	return {
		disbursementTrend,
		collectionTrend,
		profitTrend,
		loanCountTrend
	};
}

/**
 * Get daily breakdown for bar charts
 */
export async function getDailyBreakdown(
	period: TimePeriod = 'week',
	customRange?: DateRange
): Promise<DailyBreakdown[]> {
	const dateRange = getDateRangeForPeriod(period, customRange);
	const dates = generateDateRange(dateRange.startDate, dateRange.endDate);

	const [disbursedLoans, payments, allLoans, repaidLoans] = await Promise.all([
		fetchDisbursedLoansInRange(dateRange),
		fetchPaymentsInRange(dateRange),
		fetchLoansInRange(dateRange),
		fetchRepaidLoansInRange(dateRange)
	]);

	return dates.map((date) => {
		const dateStr = toLocalKey(date);

		const disbursed = disbursedLoans
			.filter((l) => toLocalKey(l.disbursement_date) === dateStr)
			.reduce((sum, l) => sum + (l.disbursement_amount || 0), 0);

		const collected = payments
			.filter((p) => toLocalKey(p.payment_date) === dateStr)
			.reduce((sum, p) => sum + (p.amount || 0), 0);

		const loansCreated = allLoans.filter((l) => toLocalKey(l.created) === dateStr).length;
		const loansRepaid = repaidLoans.filter((l) => toLocalKey(l.repayment_date) === dateStr).length;

		return {
			date: dateStr,
			disbursed: roundCurrency(disbursed),
			collected: roundCurrency(collected),
			loansCreated,
			loansRepaid
		};
	});
}

/**
 * Get recent transactions (disbursements and payments)
 */
export async function getRecentTransactions(
	period: TimePeriod = 'week',
	customRange?: DateRange,
	limit: number = 20
): Promise<import('./analytics_types').Transaction[]> {
	const dateRange = getDateRangeForPeriod(period, customRange);

	const [disbursedLoans, payments] = await Promise.all([
		pb.collection(Collections.Loans).getFullList<LoansResponse>({
			filter: buildDateFilter('disbursement_date', dateRange),
			sort: '-disbursement_date',
			expand: 'customer,disbursed_by',
			limit: limit * 2, // Fetch more to ensure we have enough after combining
			requestKey: null
		}),
		pb.collection(Collections.Payments).getFullList<PaymentsResponse>({
			filter: buildDateFilter('payment_date', dateRange),
			sort: '-payment_date',
			expand: 'customer,loan,recorded_by',
			limit: limit * 2,
			requestKey: null
		})
	]);

	const transactions: import('./analytics_types').Transaction[] = [];

	// Add disbursements
	for (const loan of disbursedLoans) {
		const expand = loan.expand as any;
		const customer = expand?.customer || {};
		const disburser = expand?.disbursed_by || {};
		
		transactions.push({
			id: loan.id,
			customerName: customer.name || 'Unknown',
			customerId: loan.customer,
			date: loan.disbursement_date,
			amount: loan.disbursement_amount || 0,
			type: 'disbursement',
			loanId: loan.id,
			loanNumber: loan.loan_number,
			customerPhotoUrl: customer.avatar ? pb.files.getURL(customer, customer.avatar) : undefined,
			recorderName: disburser.name || 'System'
		});
	}

	// Add payments
	for (const payment of payments) {
		const expand = payment.expand as any;
		const customer = expand?.customer || {};
		const loan = expand?.loan || {};
		const recorder = expand?.recorded_by || {};
		
		transactions.push({
			id: payment.id,
			customerName: customer.name || 'Unknown',
			customerId: payment.customer || '',
			date: payment.payment_date,
			amount: payment.amount || 0,
			type: 'payment',
			loanId: payment.loan || '',
			loanNumber: loan.loan_number,
			customerPhotoUrl: customer.avatar ? pb.files.getURL(customer, customer.avatar) : undefined,
			recorderName: recorder.name || 'System'
		});
	}

	// Sort by date descending and limit
	return transactions
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
		.slice(0, limit);
}

/**
 * Export P&L statement to CSV
 */
export function exportPLStatementToCSV(plStatement: PLStatement): string {
	const lines: string[] = [];
	
	// Header
	lines.push('Profit & Loss Statement');
	lines.push(`Period: ${plStatement.period.startDate} to ${plStatement.period.endDate}`);
	lines.push('');
	
	// Revenue section
	lines.push('REVENUE,,');
	lines.push(`Interest Income,${plStatement.revenue.interestIncome},`);
	lines.push(`Processing Fees,${plStatement.revenue.processingFees},`);
	lines.push(`Penalties Collected,${plStatement.revenue.penaltiesCollected},`);
	lines.push(`Total Revenue,${plStatement.revenue.totalRevenue},`);
	lines.push('');
	
	// Expenses section
	lines.push('OUTFLOWS,,');
	lines.push(`Loans Disbursed,${plStatement.expenses.loansDisbursed},`);
	lines.push(`Outstanding Principal,${plStatement.expenses.outstandingPrincipal},`);
	lines.push(`Potential Losses,${plStatement.expenses.potentialLosses},`);
	lines.push(`Total Outflows,${plStatement.expenses.totalExpenses},`);
	lines.push('');
	
	// Summary
	lines.push('SUMMARY,,');
	lines.push(`Gross Profit,${plStatement.summary.grossProfit},`);
	lines.push(`Net Profit,${plStatement.summary.netProfit},`);
	lines.push(`Profit Margin,${plStatement.summary.profitMargin}%,`);
	
	return lines.join('\n');
}


/**
 * Get complete analytics data
 */
export async function getAnalyticsData(
	period: TimePeriod = 'today',
	customRange?: DateRange,
	userId?: string
): Promise<AnalyticsData> {
	const dateRange = getDateRangeForPeriod(period, customRange);

	const [summary, profitability, loanStatusDistribution, paymentRate, trends, dailyBreakdown, recentTransactions] =
		await Promise.all([
			getSummaryMetrics(period, customRange),
			getProfitabilityMetrics(period, customRange),
			getLoanStatusDistribution(period, customRange),
			getLoanPaymentRateMetrics(period, customRange),
			getTrendData(period, customRange),
			getDailyBreakdown(period, customRange),
			getRecentTransactions(period, customRange, 15)
		]);

	// Log report generation
	// if (userId) {
	// 	await logReportGenerated(userId, 'Analytics Dashboard', period, dateRange);
	// }

	return {
		period: dateRange,
		summary,
		profitability,
		loanStatusDistribution,
		paymentRate,
		trends,
		dailyBreakdown,
		recentTransactions
	};
}
