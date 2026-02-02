/**
 * Loan Calculator Service
 * Handles all loan-related calculations including interest, fees, and repayment schedules
 * This is an extended calculator with more features than loan_calculations.ts
 */

import {
	calculatePercentage,
	roundCurrency
} from '$lib/shared/currency';
import { addDays, calculateDaysOverdue } from '$lib/shared/date_time';

export type RepaymentFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'one_time';

/**
 * Add weeks to a date
 */
function addWeeks(dateInput: Date, weeks: number): Date {
	return addDays(dateInput, weeks * 7);
}

/**
 * Add months to a date
 */
function addMonths(dateInput: Date, months: number): Date {
	const date = new Date(dateInput);
	date.setMonth(date.getMonth() + months);
	return date;
}

export interface LoanTerms {
	principal: number;
	interestRate: number; // Annual percentage rate (e.g., 24 for 24%)
	processingFeeRate: number; // Percentage of principal (e.g., 3 for 3%)
	insuranceFeeRate: number; // Percentage of principal
	termDays: number; // Loan term in days
	repaymentFrequency: RepaymentFrequency;
	startDate?: Date;
}

export interface ExtendedLoanCalculation {
	principal: number;
	interestAmount: number;
	processingFee: number;
	insuranceFee: number;
	totalFees: number;
	totalRepayment: number;
	disbursementAmount: number;
	effectiveRate: number; // Effective interest rate including fees
	dueDate: Date;
	installmentAmount: number;
	numberOfInstallments: number;
}

export interface RepaymentScheduleItem {
	installmentNumber: number;
	dueDate: Date;
	principalPortion: number;
	interestPortion: number;
	totalPayment: number;
	remainingBalance: number;
}

export interface RepaymentSchedule {
	items: RepaymentScheduleItem[];
	totalPrincipal: number;
	totalInterest: number;
	totalPayment: number;
}

export interface PaymentAllocation {
	principalPaid: number;
	interestPaid: number;
	penaltyPaid: number;
	feesPaid: number;
	remainingBalance: number;
	isFullyPaid: boolean;
}

/**
 * Calculate the number of installments based on term and frequency
 */
export function calculateInstallmentCount(
	termDays: number,
	frequency: RepaymentFrequency
): number {
	switch (frequency) {
		case 'daily':
			return termDays;
		case 'weekly':
			return Math.ceil(termDays / 7);
		case 'biweekly':
			return Math.ceil(termDays / 14);
		case 'monthly':
			return Math.ceil(termDays / 30);
		case 'one_time':
			return 1;
		default:
			return 1;
	}
}

/**
 * Get the next payment date based on frequency
 */
export function getNextPaymentDate(
	currentDate: Date,
	frequency: RepaymentFrequency,
	installmentNumber: number
): Date {
	switch (frequency) {
		case 'daily':
			return addDays(currentDate, installmentNumber);
		case 'weekly':
			return addWeeks(currentDate, installmentNumber);
		case 'biweekly':
			return addWeeks(currentDate, installmentNumber * 2);
		case 'monthly':
			return addMonths(currentDate, installmentNumber);
		case 'one_time':
			return addDays(currentDate, 30); // Default 30 days for one-time
		default:
			return addDays(currentDate, installmentNumber);
	}
}

/**
 * Calculate full loan details from terms
 */
export function calculateExtendedLoan(terms: LoanTerms): ExtendedLoanCalculation {
	const { principal, interestRate, processingFeeRate, insuranceFeeRate, termDays } = terms;
	const startDate = terms.startDate || new Date();

	// Calculate interest based on term (pro-rated from annual rate)
	const dailyRate = interestRate / 365;
	const termInterestRate = dailyRate * termDays;
	const interestAmount = roundCurrency(calculatePercentage(principal, termInterestRate));

	// Calculate fees
	const processingFee = roundCurrency(calculatePercentage(principal, processingFeeRate));
	const insuranceFee = roundCurrency(calculatePercentage(principal, insuranceFeeRate));
	const totalFees = roundCurrency(processingFee + insuranceFee);

	// Total repayment
	const totalRepayment = roundCurrency(principal + interestAmount);

	// Disbursement amount (minus upfront fees)
	const disbursementAmount = roundCurrency(principal - totalFees);

	// Effective rate (total cost / principal * 365 / term)
	const totalCost = interestAmount + totalFees;
	const effectiveRate = roundCurrency((totalCost / principal) * (365 / termDays) * 100);

	// Due date
	const dueDate = addDays(startDate, termDays);

	// Installment calculations
	const numberOfInstallments = calculateInstallmentCount(termDays, terms.repaymentFrequency);
	const installmentAmount = roundCurrency(totalRepayment / numberOfInstallments);

	return {
		principal,
		interestAmount,
		processingFee,
		insuranceFee,
		totalFees,
		totalRepayment,
		disbursementAmount,
		effectiveRate,
		dueDate,
		installmentAmount,
		numberOfInstallments
	};
}

/**
 * Generate a repayment schedule
 */
export function generateRepaymentSchedule(
	terms: LoanTerms,
	calculation: ExtendedLoanCalculation
): RepaymentSchedule {
	const items: RepaymentScheduleItem[] = [];
	const startDate = terms.startDate || new Date();
	const { numberOfInstallments, principal, interestAmount, totalRepayment } = calculation;

	// Calculate per-installment amounts
	const principalPerInstallment = roundCurrency(principal / numberOfInstallments);
	const interestPerInstallment = roundCurrency(interestAmount / numberOfInstallments);
	const paymentPerInstallment = roundCurrency(totalRepayment / numberOfInstallments);

	let remainingBalance = totalRepayment;

	for (let i = 1; i <= numberOfInstallments; i++) {
		const isLast = i === numberOfInstallments;

		// Last installment covers any rounding differences
		const principalPortion = isLast
			? roundCurrency(remainingBalance - interestPerInstallment)
			: principalPerInstallment;

		const interestPortion = interestPerInstallment;
		const totalPayment = isLast ? remainingBalance : paymentPerInstallment;

		remainingBalance = isLast ? 0 : roundCurrency(remainingBalance - totalPayment);

		items.push({
			installmentNumber: i,
			dueDate: getNextPaymentDate(startDate, terms.repaymentFrequency, i),
			principalPortion,
			interestPortion,
			totalPayment,
			remainingBalance
		});
	}

	return {
		items,
		totalPrincipal: principal,
		totalInterest: interestAmount,
		totalPayment: totalRepayment
	};
}

/**
 * Allocate a payment to loan components
 * Order: Penalties -> Fees -> Interest -> Principal
 */
export function allocatePayment(
	paymentAmount: number,
	currentBalance: number,
	principalOutstanding: number,
	interestOutstanding: number,
	penaltyOutstanding: number,
	feesOutstanding: number
): PaymentAllocation {
	let remaining = paymentAmount;
	let penaltyPaid = 0;
	let feesPaid = 0;
	let interestPaid = 0;
	let principalPaid = 0;

	// 1. Pay penalties first
	if (remaining > 0 && penaltyOutstanding > 0) {
		penaltyPaid = Math.min(remaining, penaltyOutstanding);
		remaining = roundCurrency(remaining - penaltyPaid);
	}

	// 2. Pay fees
	if (remaining > 0 && feesOutstanding > 0) {
		feesPaid = Math.min(remaining, feesOutstanding);
		remaining = roundCurrency(remaining - feesPaid);
	}

	// 3. Pay interest
	if (remaining > 0 && interestOutstanding > 0) {
		interestPaid = Math.min(remaining, interestOutstanding);
		remaining = roundCurrency(remaining - interestPaid);
	}

	// 4. Pay principal
	if (remaining > 0 && principalOutstanding > 0) {
		principalPaid = Math.min(remaining, principalOutstanding);
		remaining = roundCurrency(remaining - principalPaid);
	}

	const totalPaid = roundCurrency(penaltyPaid + feesPaid + interestPaid + principalPaid);
	const remainingBalance = roundCurrency(currentBalance - totalPaid);

	return {
		principalPaid: roundCurrency(principalPaid),
		interestPaid: roundCurrency(interestPaid),
		penaltyPaid: roundCurrency(penaltyPaid),
		feesPaid: roundCurrency(feesPaid),
		remainingBalance,
		isFullyPaid: remainingBalance <= 0
	};
}

/**
 * Calculate penalty for late payment
 */
export function calculateLatePenalty(
	outstandingBalance: number,
	daysOverdue: number,
	dailyPenaltyRate: number // e.g., 0.001 for 0.1% per day
): number {
	if (daysOverdue <= 0 || outstandingBalance <= 0) return 0;

	const penalty = outstandingBalance * dailyPenaltyRate * daysOverdue;
	return roundCurrency(penalty);
}

/**
 * Calculate early repayment details
 */
export function calculateEarlyRepayment(
	originalTermDays: number,
	daysElapsed: number,
	principal: number,
	totalInterest: number,
	balance: number
): {
	interestSaved: number;
	earlyRepaymentAmount: number;
	interestRebate: number;
} {
	// Pro-rate the interest based on days elapsed
	const interestRate = daysElapsed / originalTermDays;
	const earnedInterest = roundCurrency(totalInterest * interestRate);
	const interestRebate = roundCurrency(totalInterest - earnedInterest);

	// Amount to pay off the loan early
	const earlyRepaymentAmount = roundCurrency(balance - interestRebate);

	return {
		interestSaved: interestRebate,
		earlyRepaymentAmount,
		interestRebate
	};
}

/**
 * Check loan eligibility based on customer history
 */
export function checkLoanEligibility(
	requestedAmount: number,
	maxLoanAmount: number,
	existingLoans: number,
	maxActiveLoans: number,
	defaultedLoans: number
): {
	eligible: boolean;
	reason?: string;
	maxEligibleAmount?: number;
} {
	// Check for defaults
	if (defaultedLoans > 0) {
		return {
			eligible: false,
			reason: 'Customer has defaulted loans on record'
		};
	}

	// Check active loans limit
	if (existingLoans >= maxActiveLoans) {
		return {
			eligible: false,
			reason: `Maximum active loans (${maxActiveLoans}) reached`
		};
	}

	// Check amount limit
	if (requestedAmount > maxLoanAmount) {
		return {
			eligible: true,
			reason: `Amount exceeds limit. Maximum eligible: KES ${maxLoanAmount.toLocaleString()}`,
			maxEligibleAmount: maxLoanAmount
		};
	}

	return {
		eligible: true,
		maxEligibleAmount: maxLoanAmount
	};
}
