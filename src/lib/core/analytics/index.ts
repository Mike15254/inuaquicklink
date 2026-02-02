/**
 * Analytics module barrel export
 */

export type {
	TimePeriod,
	DateRange,
	ChartDataPoint,
	MultiSeriesDataPoint,
	LoanStatusCount,
	SummaryMetrics,
	ProfitabilityMetrics,
	PLLineItem,
	PLStatement,
	LoanPaymentRateMetrics,
	TrendData,
	DailyBreakdown,
	AnalyticsData,
	Transaction
} from './analytics_types';

// Period utilities
export {
	getDateRangeForPeriod,
	getDateLabel,
	generateDateRange,
	getDaysInPeriod,
	buildDateFilter,
	getPreviousPeriodRange
} from './period_utils';

export {
	getSummaryMetrics,
	getProfitabilityMetrics,
	getLoanStatusDistribution,
	getLoanPaymentRateMetrics,
	getPLStatement,
	getTrendData,
	getDailyBreakdown,
	getAnalyticsData,
	getRecentTransactions,
	exportPLStatementToCSV
} from './analytics_service';
