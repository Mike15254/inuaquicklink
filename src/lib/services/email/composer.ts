/**
 * Email template types and composition utilities
 */

import { formatDate } from '$lib/shared/date_time';
import { formatKES } from '$lib/shared/currency';

/**
 * Email template types matching the templates folder
 */
export type EmailTemplateType =
	| 'application_received'
	| 'application_success'
	| 'application_rejected'
	| 'funds_disbursed'
	| 'payment_reminder'
	| 'loan_overdue'
	| 'loan_grace_period'
	| 'loan_defaulted';

/**
 * Base template variables that all templates share
 */
export interface BaseTemplateVars {
	customerName: string;
	organizationName: string;
	organizationPhone: string;
	organizationEmail: string;
	year: string;
}

/**
 * Application received template variables
 */
export interface ApplicationReceivedVars extends BaseTemplateVars {
	loanNumber: string;
	loanAmount: string;
	loanPeriod: number;
	applicationDate: string;
}

/**
 * Application success (approved) template variables
 */
export interface ApplicationSuccessVars extends BaseTemplateVars {
	loanNumber: string;
	loanAmount: string;
	interestRate: string;
	processingFee: string;
	disbursementAmount: string;
	totalRepayment: string;
	dueDate: string;
	disbursementMethod: string;
}

/**
 * Application rejected template variables
 */
export interface ApplicationRejectedVars extends BaseTemplateVars {
	loanNumber: string;
	rejectionReason: string;
}

/**
 * Funds disbursed template variables
 */
export interface FundsDisbursedVars extends BaseTemplateVars {
	loanNumber: string;
	loanAmount: string;
	processingFee: string;
	disbursementAmount: string;
	totalRepayment: string;
	dueDate: string;
	disbursementMethod: string;
	mpesaPaybill: string;
	bankAccount: string;
	bankName: string;
}

/**
 * Payment reminder template variables
 */
export interface PaymentReminderVars extends BaseTemplateVars {
	loanNumber: string;
	loanAmount: string;
	totalRepayment: string;
	amountPaid: string;
	balance: string;
	dueDate: string;
	daysUntilDue: number;
	mpesaPaybill: string;
	bankAccount: string;
	bankName: string;
}

/**
 * Loan overdue template variables
 */
export interface LoanOverdueVars extends BaseTemplateVars {
	loanNumber: string;
	totalRepayment: string;
	penaltyAmount: string;
	balance: string;
	dueDate: string;
	daysOverdue: number;
	mpesaPaybill: string;
	bankAccount: string;
	bankName: string;
}

/**
 * Grace period template variables
 */
export interface GracePeriodVars extends BaseTemplateVars {
	loanNumber: string;
	balance: string;
	dueDate: string;
	graceDaysRemaining: number;
	gracePeriodEnd: string;
	mpesaPaybill: string;
	bankAccount: string;
	bankName: string;
}

/**
 * Loan defaulted template variables
 */
export interface LoanDefaultedVars extends BaseTemplateVars {
	loanNumber: string;
	totalRepayment: string;
	penaltyAmount: string;
	totalOwed: string;
	dueDate: string;
	daysOverdue: number;
}

/**
 * All template variable types
 */
export type TemplateVars =
	| ApplicationReceivedVars
	| ApplicationSuccessVars
	| ApplicationRejectedVars
	| FundsDisbursedVars
	| PaymentReminderVars
	| LoanOverdueVars
	| GracePeriodVars
	| LoanDefaultedVars;

/**
 * Replace template placeholders with values
 * Supports both {key} and {{key}} syntax for flexibility
 */
export function compileTemplate(template: string, vars: Record<string, unknown>): string {
	let compiled = template;

	for (const [key, value] of Object.entries(vars)) {
		// Support single curly braces: {key}
		const singleBracePlaceholder = new RegExp(`\\{${key}\\}`, 'g');
		compiled = compiled.replace(singleBracePlaceholder, String(value ?? ''));

		// Support double curly braces: {{key}}
		const doubleBracePlaceholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
		compiled = compiled.replace(doubleBracePlaceholder, String(value ?? ''));
	}

	return compiled;
}

/**
 * Create base template variables from organization data
 */
export function createBaseVars(
	customerName: string,
	orgName: string,
	orgPhone: string,
	orgEmail: string
): BaseTemplateVars {
	return {
		customerName,
		organizationName: orgName,
		organizationPhone: orgPhone,
		organizationEmail: orgEmail,
		year: new Date().getFullYear().toString()
	};
}

/**
 * Build application received email variables
 */
export function buildApplicationReceivedVars(
	baseVars: BaseTemplateVars,
	loanNumber: string,
	loanAmount: number,
	loanPeriod: number,
	applicationDate: string | Date
): ApplicationReceivedVars {
	return {
		...baseVars,
		loanNumber,
		loanAmount: formatKES(loanAmount),
		loanPeriod,
		applicationDate: formatDate(applicationDate)
	};
}

/**
 * Build application success email variables
 */
export function buildApplicationSuccessVars(
	baseVars: BaseTemplateVars,
	loanNumber: string,
	loanAmount: number,
	interestRate: number,
	processingFee: number,
	disbursementAmount: number,
	totalRepayment: number,
	dueDate: string | Date,
	disbursementMethod: string
): ApplicationSuccessVars {
	return {
		...baseVars,
		loanNumber,
		loanAmount: formatKES(loanAmount),
		interestRate: `${(interestRate * 100).toFixed(0)}`,
		processingFee: formatKES(processingFee),
		disbursementAmount: formatKES(disbursementAmount),
		totalRepayment: formatKES(totalRepayment),
		dueDate: formatDate(dueDate),
		disbursementMethod: disbursementMethod === 'mpesa' ? 'M-Pesa' : 'Bank Transfer'
	};
}

/**
 * Build application rejected email variables
 */
export function buildApplicationRejectedVars(
	baseVars: BaseTemplateVars,
	loanNumber: string,
	rejectionReason: string
): ApplicationRejectedVars {
	return {
		...baseVars,
		loanNumber,
		rejectionReason
	};
}

/**
 * Build funds disbursed email variables
 */
export function buildFundsDisbursedVars(
	baseVars: BaseTemplateVars,
	loanNumber: string,
	loanAmount: number,
	processingFee: number,
	disbursementAmount: number,
	totalRepayment: number,
	dueDate: string | Date,
	disbursementMethod: string,
	mpesaPaybill: string,
	bankName: string,
	bankAccount: string
): FundsDisbursedVars {
	return {
		...baseVars,
		loanNumber,
		loanAmount: formatKES(loanAmount),
		processingFee: formatKES(processingFee),
		disbursementAmount: formatKES(disbursementAmount),
		totalRepayment: formatKES(totalRepayment),
		dueDate: formatDate(dueDate),
		disbursementMethod: disbursementMethod === 'mpesa' ? 'M-Pesa' : 'Bank Transfer',
		mpesaPaybill,
		bankName,
		bankAccount
	};
}

/**
 * Build payment reminder email variables
 */
export function buildPaymentReminderVars(
	baseVars: BaseTemplateVars,
	loanNumber: string,
	loanAmount: number,
	totalRepayment: number,
	amountPaid: number,
	balance: number,
	dueDate: string | Date,
	daysUntilDue: number,
	mpesaPaybill: string,
	bankName: string,
	bankAccount: string
): PaymentReminderVars {
	return {
		...baseVars,
		loanNumber,
		loanAmount: formatKES(loanAmount),
		totalRepayment: formatKES(totalRepayment),
		amountPaid: formatKES(amountPaid),
		balance: formatKES(balance),
		dueDate: formatDate(dueDate),
		daysUntilDue,
		mpesaPaybill,
		bankName,
		bankAccount
	};
}

/**
 * Build loan overdue email variables
 */
export function buildLoanOverdueVars(
	baseVars: BaseTemplateVars,
	loanNumber: string,
	totalRepayment: number,
	penaltyAmount: number,
	balance: number,
	dueDate: string | Date,
	daysOverdue: number,
	mpesaPaybill: string,
	bankName: string,
	bankAccount: string
): LoanOverdueVars {
	return {
		...baseVars,
		loanNumber,
		totalRepayment: formatKES(totalRepayment),
		penaltyAmount: formatKES(penaltyAmount),
		balance: formatKES(balance),
		dueDate: formatDate(dueDate),
		daysOverdue,
		mpesaPaybill,
		bankName,
		bankAccount
	};
}

/**
 * Build grace period email variables
 */
export function buildGracePeriodVars(
	baseVars: BaseTemplateVars,
	loanNumber: string,
	balance: number,
	dueDate: string | Date,
	graceDaysRemaining: number,
	gracePeriodEnd: string | Date,
	mpesaPaybill: string,
	bankName: string,
	bankAccount: string
): GracePeriodVars {
	return {
		...baseVars,
		loanNumber,
		balance: formatKES(balance),
		dueDate: formatDate(dueDate),
		graceDaysRemaining,
		gracePeriodEnd: formatDate(gracePeriodEnd),
		mpesaPaybill,
		bankName,
		bankAccount
	};
}

/**
 * Build loan defaulted email variables
 */
export function buildLoanDefaultedVars(
	baseVars: BaseTemplateVars,
	loanNumber: string,
	totalRepayment: number,
	penaltyAmount: number,
	totalOwed: number,
	dueDate: string | Date,
	daysOverdue: number
): LoanDefaultedVars {
	return {
		...baseVars,
		loanNumber,
		totalRepayment: formatKES(totalRepayment),
		penaltyAmount: formatKES(penaltyAmount),
		totalOwed: formatKES(totalOwed),
		dueDate: formatDate(dueDate),
		daysOverdue
	};
}

/**
 * Email subject lines for each template type
 */
export const EMAIL_SUBJECTS: Record<EmailTemplateType, string> = {
	application_received: 'Loan Application Received - {{loanNumber}}',
	application_success: 'Congratulations! Loan Approved - {{loanNumber}}',
	application_rejected: 'Loan Application Update - {{loanNumber}}',
	funds_disbursed: 'Funds Disbursed - Loan {{loanNumber}}',
	payment_reminder: 'Payment Reminder - Loan {{loanNumber}}',
	loan_overdue: 'URGENT: Payment Overdue - Loan {{loanNumber}}',
	loan_grace_period: 'Grace Period Notice - Loan {{loanNumber}}',
	loan_defaulted: 'IMPORTANT: Loan Default Notice - {{loanNumber}}'
};

/**
 * Get compiled subject line for a template
 */
export function getEmailSubject(
	templateType: EmailTemplateType,
	vars: Record<string, unknown>
): string {
	const subjectTemplate = EMAIL_SUBJECTS[templateType];
	return compileTemplate(subjectTemplate, vars);
}
