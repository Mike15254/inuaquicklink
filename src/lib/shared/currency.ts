/**
 * Currency utilities for KES (Kenyan Shilling) formatting and parsing
 */

const KES_LOCALE = 'en-KE';
const KES_CURRENCY = 'KES';

const currencyFormatter = new Intl.NumberFormat(KES_LOCALE, {
	style: 'currency',
	currency: KES_CURRENCY,
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

const compactFormatter = new Intl.NumberFormat(KES_LOCALE, {
	style: 'currency',
	currency: KES_CURRENCY,
	notation: 'compact',
	minimumFractionDigits: 0,
	maximumFractionDigits: 1
});

const numberFormatter = new Intl.NumberFormat(KES_LOCALE, {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

/**
 * Format amount to KES currency string
 * @example formatKES(1500.5) => "KES 1,500.50"
 */
export function formatKES(amount: number): string {
	return currencyFormatter.format(amount);
}

/**
 * Format amount to compact KES string for display
 * @example formatKESCompact(1500000) => "KES 1.5M"
 */
export function formatKESCompact(amount: number): string {
	return compactFormatter.format(amount);
}

/**
 * Format amount as plain number with commas (no currency symbol)
 * @example formatNumber(1500.5) => "1,500.50"
 */
export function formatNumber(amount: number): string {
	return numberFormatter.format(amount);
}

/**
 * Parse currency string to number, handles KES prefix and commas
 * @example parseKES("KES 1,500.50") => 1500.5
 */
export function parseKES(value: string): number {
	const cleaned = value.replace(/[KES,\s]/gi, '').trim();
	const parsed = parseFloat(cleaned);
	return isNaN(parsed) ? 0 : parsed;
}

/**
 * Round to 2 decimal places for currency operations
 */
export function roundCurrency(amount: number): number {
	return Math.round(amount * 100) / 100;
}

/**
 * Calculate percentage of an amount
 * @example calculatePercentage(10000, 10) => 1000
 */
export function calculatePercentage(amount: number, percentage: number): number {
	return roundCurrency((amount * percentage) / 100);
}

/**
 * Calculate interest amount based on principal and rate
 */
export function calculateInterest(principal: number, ratePercent: number): number {
	return calculatePercentage(principal, ratePercent);
}

/**
 * Calculate processing fee
 */
export function calculateProcessingFee(principal: number, feePercent: number): number {
	return calculatePercentage(principal, feePercent);
}

/**
 * Calculate total repayment (principal + interest + fees)
 */
export function calculateTotalRepayment(
	principal: number,
	interest: number,
	processingFee: number,
	penalty: number = 0
): number {
	return roundCurrency(principal + interest + processingFee + penalty);
}

/**
 * Calculate disbursement amount (principal - processing fee)
 */
export function calculateDisbursementAmount(principal: number, processingFee: number): number {
	return roundCurrency(principal - processingFee);
}

/**
 * Calculate remaining balance after payment
 */
export function calculateBalance(totalDue: number, amountPaid: number): number {
	const balance = roundCurrency(totalDue - amountPaid);
	return balance < 0 ? 0 : balance;
}

/**
 * Check if amount is within valid loan range
 */
export function isWithinLoanRange(
	amount: number,
	minAmount: number,
	maxAmount: number
): boolean {
	return amount >= minAmount && amount <= maxAmount;
}

/**
 * Calculate maximum loan based on salary percentage
 */
export function calculateMaxLoanFromSalary(
	netSalary: number,
	maxPercentage: number,
	absoluteMax: number
): number {
	const salaryBasedMax = calculatePercentage(netSalary, maxPercentage);
	return Math.min(salaryBasedMax, absoluteMax);
}
