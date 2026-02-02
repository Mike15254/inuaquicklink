/**
 * Loan calculation utilities
 * Handles all loan-related calculations
 */

import { roundCurrency } from '$lib/shared/currency';

/**
 * Loan settings for calculations
 */
export interface LoanCalculationSettings {
	interestRate15Days: number; // e.g., 0.13 for 13%
	interestRate30Days: number; // e.g., 0.18 for 18%
	processingFeeRate: number; // e.g., 0.05 for 5%
	penaltyRate: number; // e.g., 0.05 for 5% one-time penalty
	gracePeriodDays: number; // Days after due date before penalty
	penaltyPeriodDays: number; // Days in penalty period before default
	maxLoanPercentage: number; // e.g., 0.6 for 60% of salary
	minLoanAmount: number;
	maxLoanAmount: number;
}

/**
 * Default loan settings
 */
export const DEFAULT_LOAN_SETTINGS: LoanCalculationSettings = {
	interestRate15Days: 0.13, // 13%
	interestRate30Days: 0.18, // 18%
	processingFeeRate: 0.05, // 5%
	penaltyRate: 0.05, // 5% one-time penalty
	gracePeriodDays: 3, // 3 day grace period
	penaltyPeriodDays: 30, // 30 days until default
	maxLoanPercentage: 0.6, // 60% of salary
	minLoanAmount: 1000,
	maxLoanAmount: 100000
};

/**
 * Get interest rate based on loan period
 */
export function getInterestRate(
	loanPeriodDays: number,
	settings: LoanCalculationSettings = DEFAULT_LOAN_SETTINGS
): number {
	if (loanPeriodDays <= 15) {
		return settings.interestRate15Days;
	}
	return settings.interestRate30Days;
}

/**
 * Calculate interest amount
 */
export function calculateInterestAmount(
	principal: number,
	loanPeriodDays: number,
	settings: LoanCalculationSettings = DEFAULT_LOAN_SETTINGS
): number {
	const rate = getInterestRate(loanPeriodDays, settings);
	return roundCurrency(principal * rate);
}

/**
 * Calculate processing fee
 */
export function calculateProcessingFee(
	principal: number,
	settings: LoanCalculationSettings = DEFAULT_LOAN_SETTINGS
): number {
	return roundCurrency(principal * settings.processingFeeRate);
}

/**
 * Calculate disbursement amount (principal - processing fee)
 */
export function calculateDisbursementAmount(
	principal: number,
	settings: LoanCalculationSettings = DEFAULT_LOAN_SETTINGS
): number {
	const processingFee = calculateProcessingFee(principal, settings);
	return roundCurrency(principal - processingFee);
}

/**
 * Calculate total repayment (principal + interest)
 * Note: Processing fee is deducted upfront, not added to repayment
 */
export function calculateTotalRepayment(
	principal: number,
	loanPeriodDays: number,
	settings: LoanCalculationSettings = DEFAULT_LOAN_SETTINGS
): number {
	const interest = calculateInterestAmount(principal, loanPeriodDays, settings);
	return roundCurrency(principal + interest);
}

/**
 * Calculate late payment penalty (ONE-TIME, not compounding)
 * Penalty is only applied after grace period ends
 */
export function calculatePenalty(
	totalRepayment: number,
	daysOverdue: number,
	settings: LoanCalculationSettings = DEFAULT_LOAN_SETTINGS
): number {
	// No penalty during grace period
	if (daysOverdue <= settings.gracePeriodDays) return 0;
	// ONE-TIME penalty (not cumulative per day)
	return roundCurrency(totalRepayment * settings.penaltyRate);
}

/**
 * Check if loan is in grace period
 */
export function isInGracePeriod(
	daysOverdue: number,
	settings: LoanCalculationSettings = DEFAULT_LOAN_SETTINGS
): boolean {
	return daysOverdue > 0 && daysOverdue <= settings.gracePeriodDays;
}

/**
 * Check if loan is in penalty period (after grace, before default)
 */
export function isInPenaltyPeriod(
	daysOverdue: number,
	settings: LoanCalculationSettings = DEFAULT_LOAN_SETTINGS
): boolean {
	const afterGrace = daysOverdue > settings.gracePeriodDays;
	const beforeDefault = daysOverdue <= (settings.gracePeriodDays + settings.penaltyPeriodDays);
	return afterGrace && beforeDefault;
}

/**
 * Check if loan should be defaulted
 */
export function shouldBeDefaulted(
	daysOverdue: number,
	settings: LoanCalculationSettings = DEFAULT_LOAN_SETTINGS
): boolean {
	return daysOverdue > (settings.gracePeriodDays + settings.penaltyPeriodDays);
}

/**
 * Calculate grace period end date
 */
export function calculateGracePeriodEndDate(
	dueDate: Date,
	settings: LoanCalculationSettings = DEFAULT_LOAN_SETTINGS
): Date {
	const endDate = new Date(dueDate);
	endDate.setDate(endDate.getDate() + settings.gracePeriodDays);
	return endDate;
}

/**
 * Calculate default date (when loan would be marked as defaulted)
 */
export function calculateDefaultDate(
	dueDate: Date,
	settings: LoanCalculationSettings = DEFAULT_LOAN_SETTINGS
): Date {
	const defaultDate = new Date(dueDate);
	defaultDate.setDate(defaultDate.getDate() + settings.gracePeriodDays + settings.penaltyPeriodDays);
	return defaultDate;
}

/**
 * Calculate current balance due
 */
export function calculateBalanceDue(
	totalRepayment: number,
	amountPaid: number,
	penalty: number = 0
): number {
	const balance = roundCurrency(totalRepayment + penalty - amountPaid);
	return balance < 0 ? 0 : balance;
}

/**
 * Calculate maximum loan amount based on salary
 */
export function calculateMaxLoanFromSalary(
	netSalary: number,
	settings: LoanCalculationSettings = DEFAULT_LOAN_SETTINGS
): number {
	const salaryBased = Math.floor(netSalary * settings.maxLoanPercentage);
	return Math.min(salaryBased, settings.maxLoanAmount);
}

/**
 * Validate loan amount
 */
export function validateLoanAmount(
	amount: number,
	netSalary: number,
	settings: LoanCalculationSettings = DEFAULT_LOAN_SETTINGS
): { valid: boolean; error?: string } {
	if (amount < settings.minLoanAmount) {
		return {
			valid: false,
			error: `Minimum loan amount is KES ${settings.minLoanAmount.toLocaleString()}`
		};
	}

	const maxFromSalary = calculateMaxLoanFromSalary(netSalary, settings);
	if (amount > maxFromSalary) {
		return {
			valid: false,
			error: `Maximum loan amount is KES ${maxFromSalary.toLocaleString()} (${settings.maxLoanPercentage * 100}% of your salary)`
		};
	}

	if (amount > settings.maxLoanAmount) {
		return {
			valid: false,
			error: `Maximum loan amount is KES ${settings.maxLoanAmount.toLocaleString()}`
		};
	}

	return { valid: true };
}

/**
 * Calculate loan period in days from today to salary date
 */
export function calculateLoanPeriodDays(salaryDate: string | Date): number {
	const today = new Date();
	const payDate = new Date(salaryDate);
	const diffTime = payDate.getTime() - today.getTime();
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
	return Math.max(0, diffDays);
}

/**
 * Validate loan period
 */
export function validateLoanPeriod(
	salaryDate: string | Date
): { valid: boolean; days: number; error?: string } {
	const days = calculateLoanPeriodDays(salaryDate);

	if (days <= 0) {
		return {
			valid: false,
			days,
			error: 'Salary date must be in the future'
		};
	}

	if (days > 30) {
		return {
			valid: false,
			days,
			error: 'Loan period cannot exceed 30 days'
		};
	}

	return { valid: true, days };
}

/**
 * Full loan calculation result
 */
export interface LoanCalculation {
	principal: number;
	loanPeriodDays: number;
	interestRate: number;
	interestAmount: number;
	processingFee: number;
	disbursementAmount: number;
	totalRepayment: number;
	dueDate: Date;
}

/**
 * Calculate all loan details
 */
export function calculateLoan(
	principal: number,
	salaryDate: string | Date,
	settings: LoanCalculationSettings = DEFAULT_LOAN_SETTINGS
): LoanCalculation {
	const loanPeriodDays = calculateLoanPeriodDays(salaryDate);
	const interestRate = getInterestRate(loanPeriodDays, settings);
	const interestAmount = calculateInterestAmount(principal, loanPeriodDays, settings);
	const processingFee = calculateProcessingFee(principal, settings);
	const disbursementAmount = calculateDisbursementAmount(principal, settings);
	const totalRepayment = calculateTotalRepayment(principal, loanPeriodDays, settings);

	return {
		principal,
		loanPeriodDays,
		interestRate,
		interestAmount,
		processingFee,
		disbursementAmount,
		totalRepayment,
		dueDate: new Date(salaryDate)
	};
}

/**
 * Generate loan number
 * Format: LN-YYYYMMDD-XXXXX (where XXXXX is random)
 */
export function generateLoanNumber(): string {
	const date = new Date();
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const random = Math.random().toString(36).substring(2, 7).toUpperCase();

	return `LN-${year}${month}${day}-${random}`;
}

/**
 * Get loan term label for display
 */
export function getLoanTermLabel(days: number): string {
	if (days <= 15) return '15 Days';
	return '30 Days';
}

/**
 * Get interest rate display (as percentage)
 */
export function getInterestRateDisplay(
	loanPeriodDays: number,
	settings: LoanCalculationSettings = DEFAULT_LOAN_SETTINGS
): string {
	const rate = getInterestRate(loanPeriodDays, settings);
	return `${(rate * 100).toFixed(0)}%`;
}
