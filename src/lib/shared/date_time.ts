/**
 * Date and time utilities for loan management
 */

const DATE_LOCALE = 'en-KE';

const dateFormatter = new Intl.DateTimeFormat(DATE_LOCALE, {
	year: 'numeric',
	month: 'short',
	day: 'numeric'
});

const dateTimeFormatter = new Intl.DateTimeFormat(DATE_LOCALE, {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit'
});

const shortDateFormatter = new Intl.DateTimeFormat(DATE_LOCALE, {
	month: 'short',
	day: 'numeric'
});

const timeFormatter = new Intl.DateTimeFormat(DATE_LOCALE, {
	hour: '2-digit',
	minute: '2-digit'
});

const relativeTimeFormatter = new Intl.RelativeTimeFormat(DATE_LOCALE, {
	numeric: 'auto'
});

/**
 * Parse date string or Date to Date object
 */
export function toDate(dateInput: string | Date): Date {
	if (dateInput instanceof Date) return dateInput;
	return new Date(dateInput);
}

/**
 * Format date to display string "Jan 8, 2026"
 */
export function formatDate(dateInput: string | Date): string {
	return dateFormatter.format(toDate(dateInput));
}

/**
 * Format date with time "Jan 8, 2026, 10:30 AM"
 */
export function formatDateTime(dateInput: string | Date): string {
	return dateTimeFormatter.format(toDate(dateInput));
}

/**
 * Format short date "Jan 8"
 */
export function formatShortDate(dateInput: string | Date): string {
	return shortDateFormatter.format(toDate(dateInput));
}

/**
 * Format time only "10:30 AM"
 */
export function formatTime(dateInput: string | Date): string {
	return timeFormatter.format(toDate(dateInput));
}

/**
 * Format to ISO date string "2026-01-08"
 */
export function toISODate(dateInput: string | Date): string {
	return toDate(dateInput).toISOString().split('T')[0];
}

/**
 * Format to ISO datetime string "2026-01-08T10:30:00.000Z"
 */
export function toISODateTime(dateInput: string | Date): string {
	return toDate(dateInput).toISOString();
}

/**
 * Get current date as ISO string
 */
export function nowISO(): string {
	return new Date().toISOString();
}

/**
 * Get current date only as ISO string
 */
export function todayISO(): string {
	return toISODate(new Date());
}

/**
 * Add days to a date
 */
export function addDays(dateInput: string | Date, days: number): Date {
	const date = toDate(dateInput);
	date.setDate(date.getDate() + days);
	return date;
}

/**
 * Subtract days from a date
 */
export function subtractDays(dateInput: string | Date, days: number): Date {
	return addDays(dateInput, -days);
}

/**
 * Calculate due date from disbursement date
 */
export function calculateDueDate(disbursementDate: string | Date, loanPeriodDays: number): Date {
	return addDays(disbursementDate, loanPeriodDays);
}

/**
 * Calculate days between two dates
 */
export function daysBetween(startDate: string | Date, endDate: string | Date): number {
	const start = toDate(startDate);
	const end = toDate(endDate);
	const diffTime = end.getTime() - start.getTime();
	return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days overdue from due date (negative if not yet due)
 */
export function calculateDaysOverdue(dueDate: string | Date): number {
	return daysBetween(dueDate, new Date());
}

/**
 * Check if a date is in the past
 */
export function isPastDate(dateInput: string | Date): boolean {
	return toDate(dateInput) < new Date();
}

/**
 * Check if a date is today
 */
export function isToday(dateInput: string | Date): boolean {
	return toISODate(dateInput) === todayISO();
}

/**
 * Check if a loan is overdue
 */
export function isOverdue(dueDate: string | Date): boolean {
	return calculateDaysOverdue(dueDate) > 0;
}

/**
 * Check if due date is within reminder window
 */
export function isDueWithinDays(dueDate: string | Date, days: number): boolean {
	const daysUntilDue = -calculateDaysOverdue(dueDate);
	return daysUntilDue >= 0 && daysUntilDue <= days;
}

/**
 * Format relative time "2 days ago", "in 3 days"
 */
export function formatRelativeTime(dateInput: string | Date): string {
	// Calculate days from now to the input date (negative = past, positive = future)
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	const inputDate = toDate(dateInput);
	inputDate.setHours(0, 0, 0, 0);
	const days = Math.round((inputDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

	if (Math.abs(days) < 1) {
		const hours = Math.round((toDate(dateInput).getTime() - Date.now()) / (1000 * 60 * 60));
		if (Math.abs(hours) < 1) {
			const minutes = Math.round((toDate(dateInput).getTime() - Date.now()) / (1000 * 60));
			return relativeTimeFormatter.format(minutes, 'minute');
		}
		return relativeTimeFormatter.format(hours, 'hour');
	}

	if (Math.abs(days) < 30) {
		return relativeTimeFormatter.format(days, 'day');
	}

	if (Math.abs(days) < 365) {
		const months = Math.round(days / 30);
		return relativeTimeFormatter.format(months, 'month');
	}

	const years = Math.round(days / 365);
	return relativeTimeFormatter.format(years, 'year');
}

/**
 * Format due date status for display
 */
export function formatDueStatus(dueDate: string | Date): { text: string; isOverdue: boolean } {
	const daysOverdue = calculateDaysOverdue(dueDate);

	if (daysOverdue > 0) {
		return {
			text: `${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue`,
			isOverdue: true
		};
	}

	if (daysOverdue === 0) {
		return { text: 'Due today', isOverdue: false };
	}

	const daysUntil = Math.abs(daysOverdue);
	return {
		text: `Due in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`,
		isOverdue: false
	};
}

/**
 * Check if date is within a range
 */
export function isWithinRange(
	dateInput: string | Date,
	startDate: string | Date,
	endDate: string | Date
): boolean {
	const date = toDate(dateInput);
	return date >= toDate(startDate) && date <= toDate(endDate);
}

/**
 * Get start of day for a date
 */
export function startOfDay(dateInput: string | Date): Date {
	const date = new Date(toDate(dateInput));  // Create a new Date to avoid mutation
	date.setHours(0, 0, 0, 0);
	return date;
}

/**
 * Get end of day for a date
 */
export function endOfDay(dateInput: string | Date): Date {
	const date = new Date(toDate(dateInput));  // Create a new Date to avoid mutation
	date.setHours(23, 59, 59, 999);
	return date;
}

/**
 * Calculate link expiry date (default 24 hours from now)
 * @param hoursValid - Number of hours the link should be valid (can be fractional)
 */
export function calculateLinkExpiryDate(hoursValid: number = 24): Date {
	const expiry = new Date();
	// Use milliseconds to properly handle fractional hours
	expiry.setTime(expiry.getTime() + (hoursValid * 60 * 60 * 1000));
	return expiry;
}

/**
 * Calculate link expiry date from minutes
 * @param minutesValid - Number of minutes the link should be valid
 */
export function calculateLinkExpiryFromMinutes(minutesValid: number = 20): Date {
	const expiry = new Date();
	expiry.setTime(expiry.getTime() + (minutesValid * 60 * 1000));
	return expiry;
}

/**
 * Check if a link/token has expired
 */
export function isExpired(expiryDate: string | Date): boolean {
	return toDate(expiryDate) < new Date();
}
