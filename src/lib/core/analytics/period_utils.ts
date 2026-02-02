/**
 * Time period utilities for analytics filtering
 */

import {
	toDate,
	startOfDay,
	endOfDay,
	subtractDays,
	toISODateTime,
	todayISO
} from '$lib/shared/date_time';
import type { TimePeriod, DateRange } from './analytics_types';

/**
 * Get date range for a time period
 */
export function getDateRangeForPeriod(
	period: TimePeriod,
	customRange?: DateRange
): DateRange {
	const now = new Date();
	const todayStart = startOfDay(now);
	const todayEnd = endOfDay(now);

	switch (period) {
		case 'today':
			return {
				startDate: toISODateTime(todayStart),
				endDate: toISODateTime(todayEnd)
			};

		case 'week': {
			const weekStart = startOfDay(subtractDays(now, 6));
			return {
				startDate: toISODateTime(weekStart),
				endDate: toISODateTime(todayEnd)
			};
		}

		case 'month': {
			const monthStart = startOfDay(subtractDays(now, 29));
			return {
				startDate: toISODateTime(monthStart),
				endDate: toISODateTime(todayEnd)
			};
		}

		case 'custom':
			if (!customRange) {
				return {
					startDate: toISODateTime(todayStart),
					endDate: toISODateTime(todayEnd)
				};
			}
			return {
				startDate: toISODateTime(startOfDay(customRange.startDate)),
				endDate: toISODateTime(endOfDay(customRange.endDate))
			};

		default:
			return {
				startDate: toISODateTime(todayStart),
				endDate: toISODateTime(todayEnd)
			};
	}
}

/**
 * Get label for date based on period granularity
 */
export function getDateLabel(dateInput: string | Date, period: TimePeriod): string {
	const date = toDate(dateInput);
	const options: Intl.DateTimeFormatOptions =
		period === 'today'
			? { hour: '2-digit' }
			: { month: 'short', day: 'numeric' };

	return date.toLocaleDateString('en-KE', options);
}

/**
 * Generate array of dates between start and end
 */
export function generateDateRange(startDate: string | Date, endDate: string | Date): Date[] {
	const dates: Date[] = [];
	const current = startOfDay(startDate);
	const end = startOfDay(endDate);

	while (current <= end) {
		dates.push(new Date(current));
		current.setDate(current.getDate() + 1);
	}

	return dates;
}

/**
 * Get number of days in period
 */
export function getDaysInPeriod(period: TimePeriod, customRange?: DateRange): number {
	switch (period) {
		case 'today':
			return 1;
		case 'week':
			return 7;
		case 'month':
			return 30;
		case 'custom':
			if (!customRange) return 1;
			const start = toDate(customRange.startDate);
			const end = toDate(customRange.endDate);
			return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
		default:
			return 1;
	}
}

/**
 * Build PocketBase filter for date range
 */
export function buildDateFilter(
	field: string,
	dateRange: DateRange
): string {
	return `${field} >= "${dateRange.startDate}" && ${field} <= "${dateRange.endDate}"`;
}

/**
 * Get previous period range for comparison
 */
export function getPreviousPeriodRange(
	currentRange: DateRange
): DateRange {
	const start = toDate(currentRange.startDate);
	const end = toDate(currentRange.endDate);
	const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

	const prevEnd = subtractDays(start, 1);
	const prevStart = subtractDays(prevEnd, daysDiff - 1);

	return {
		startDate: toISODateTime(startOfDay(prevStart)),
		endDate: toISODateTime(endOfDay(prevEnd))
	};
}
