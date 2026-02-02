/**
 * Analytics types for financial reporting and charts
 */

import type { LoansStatusOptions } from '$lib/types';

/**
 * Time period for filtering analytics
 */
export type TimePeriod = 'today' | 'week' | 'month' | 'custom';

/**
 * Date range for custom period queries
 */
export interface DateRange {
	startDate: string;
	endDate: string;
}

/**
 * Chart data point for time series (line/bar charts)
 */
export interface ChartDataPoint {
	label: string;
	value: number;
}

/**
 * Multi-series chart data point
 */
export interface MultiSeriesDataPoint {
	label: string;
	[key: string]: string | number;
}

/**
 * Loan status distribution for pie/bar charts
 */
export interface LoanStatusCount {
	status: LoansStatusOptions;
	count: number;
	totalAmount: number;
}

/**
 * Summary metrics for dashboard cards
 */
export interface SummaryMetrics {
	totalDisbursed: number;
	totalCollected: number;
	totalOutstanding: number;
	totalInterestEarned: number;
	totalFeesCollected: number;
	totalPenaltiesCollected: number;
	activeLoansCount: number;
	overdueLoansCount: number;
	repaidLoansCount: number;
	defaultedLoansCount: number;
	collectionRate: number;
}

/**
 * Profitability metrics
 */
export interface ProfitabilityMetrics {
	grossRevenue: number;
	interestIncome: number;
	feeIncome: number;
	penaltyIncome: number;
	totalDisbursed: number;
	netIncome: number;
	profitMargin: number;
	avgLoanSize: number;
	avgInterestRate: number;
}

/**
 * P&L statement line item
 */
export interface PLLineItem {
	label: string;
	amount: number;
	isExpense: boolean;
}

/**
 * Profit and Loss statement
 */
export interface PLStatement {
	period: DateRange;
	revenue: {
		interestIncome: number;
		processingFees: number;
		penaltiesCollected: number;
		totalRevenue: number;
	};
	expenses: {
		loansDisbursed: number;
		outstandingPrincipal: number;
		potentialLosses: number;
		totalExpenses: number;
	};
	summary: {
		grossProfit: number;
		netProfit: number;
		profitMargin: number;
	};
	lineItems: PLLineItem[];
}

/**
 * Loan-to-payment rate metrics
 */
export interface LoanPaymentRateMetrics {
	totalLoansDisbursed: number;
	totalPaymentsReceived: number;
	paymentRate: number;
	avgPaymentPerLoan: number;
	onTimePaymentRate: number;
}

/**
 * Trend data for line charts
 */
export interface TrendData {
	disbursementTrend: ChartDataPoint[];
	collectionTrend: ChartDataPoint[];
	profitTrend: ChartDataPoint[];
	loanCountTrend: ChartDataPoint[];
}

/**
 * Daily breakdown for bar charts
 */
export interface DailyBreakdown {
	date: string;
	disbursed: number;
	collected: number;
	loansCreated: number;
	loansRepaid: number;
}

/**
 * Transaction record for history table
 */
export interface Transaction {
	id: string;
	customerName: string;
	customerId: string;
	date: string;
	amount: number;
	type: 'disbursement' | 'payment' | 'penalty' | 'fee' | 'interest';
	loanId: string;
	loanNumber?: string;
	customerPhotoUrl?: string;
	recorderName?: string;
}

/**
 * Complete analytics response
 */
export interface AnalyticsData {
	period: DateRange;
	summary: SummaryMetrics;
	profitability: ProfitabilityMetrics;
	loanStatusDistribution: LoanStatusCount[];
	paymentRate: LoanPaymentRateMetrics;
	trends: TrendData;
	dailyBreakdown: DailyBreakdown[];
	recentTransactions: Transaction[];
}
