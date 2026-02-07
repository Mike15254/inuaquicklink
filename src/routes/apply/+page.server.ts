/**
 * Application form server-side logic
 * Handles token validation and form submission
 */

import { createCustomer, findExistingCustomerByMatch, type CreateCustomerInput } from '$lib/core/customers/customer_service';
import { validateLink } from '$lib/core/loans/link_service';
import {
	DEFAULT_LOAN_SETTINGS,
	type LoanCalculationSettings
} from '$lib/core/loans/loan_calculations';
import { createLoan, type CreateLoanInput } from '$lib/core/loans/loan_service';
import { pb } from '$lib/infra/db/pb';
import { sendApplicationReceivedEmail } from '$lib/services/email/client';
import { normalizeEmail, normalizeKraPin, normalizePhone } from '$lib/shared/rules';
import {
	Collections,
	LoansDisbursementMethodOptions,
	LoansLoanPurposeOptions,
	type LoanSettingsResponse,
	type OrganizationResponse
} from '$lib/types';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(\+254|0)?[17]\d{8}$/;
const NATIONAL_ID_REGEX = /^\d{7,8}$/;
const KRA_PIN_REGEX = /^[A-Z]\d{9}[A-Z]$/;

interface TokenValidationState {
	valid: boolean;
	token: string | null;
	linkId: string | null;
	customerId: string | null;
	error?: string;
	errorCode?: 'NOT_FOUND' | 'EXPIRED' | 'USED' | 'INVALID' | 'MISSING';
}

interface LoanSettings {
	interestRate15Days: number;
	interestRate30Days: number;
	processingFeeRate: number;
	penaltyRate: number;
	maxLoanPercentage: number;
	minLoanAmount: number;
	maxLoanAmount: number;
	gracePeriodDays: number;
	penaltyPeriodDays: number;
}

/**
 * Fetch loan settings from database
 */
async function fetchLoanSettings(): Promise<LoanSettings> {
	try {
		// console.log('[fetchLoanSettings] Fetching loan settings...');
		const settings = await pb
			.collection(Collections.LoanSettings)
			.getFullList<LoanSettingsResponse>();

		// console.log('[fetchLoanSettings] Found settings:', settings.length, 'records');

		if (settings.length > 0) {
			const s = settings[0];
			const result = {
				interestRate15Days: s.interest_rate_15_days ?? DEFAULT_LOAN_SETTINGS.interestRate15Days,
				interestRate30Days: s.interest_rate_30_days ?? DEFAULT_LOAN_SETTINGS.interestRate30Days,
				processingFeeRate: s.processing_fee_rate ?? DEFAULT_LOAN_SETTINGS.processingFeeRate,
				penaltyRate: s.penalty_rate ?? s.late_payment_penalty_rate ?? DEFAULT_LOAN_SETTINGS.penaltyRate,
				maxLoanPercentage: s.max_loan_percentage ?? DEFAULT_LOAN_SETTINGS.maxLoanPercentage,
				minLoanAmount: s.min_loan_amount ?? DEFAULT_LOAN_SETTINGS.minLoanAmount,
				maxLoanAmount: s.max_loan_amount ?? DEFAULT_LOAN_SETTINGS.maxLoanAmount,
				gracePeriodDays: s.grace_period_days ?? DEFAULT_LOAN_SETTINGS.gracePeriodDays,
				penaltyPeriodDays: s.penalty_period_days ?? DEFAULT_LOAN_SETTINGS.penaltyPeriodDays
			};
			// console.log('[fetchLoanSettings] Using DB settings:', result);
			return result;
		}
	} catch (error) {
		// console.error('[fetchLoanSettings] Error fetching settings:', error);
	}

	return {
		interestRate15Days: DEFAULT_LOAN_SETTINGS.interestRate15Days,
		interestRate30Days: DEFAULT_LOAN_SETTINGS.interestRate30Days,
		processingFeeRate: DEFAULT_LOAN_SETTINGS.processingFeeRate,
		penaltyRate: DEFAULT_LOAN_SETTINGS.penaltyRate,
		maxLoanPercentage: DEFAULT_LOAN_SETTINGS.maxLoanPercentage,
		minLoanAmount: DEFAULT_LOAN_SETTINGS.minLoanAmount,
		maxLoanAmount: DEFAULT_LOAN_SETTINGS.maxLoanAmount,
		gracePeriodDays: DEFAULT_LOAN_SETTINGS.gracePeriodDays,
		penaltyPeriodDays: DEFAULT_LOAN_SETTINGS.penaltyPeriodDays
	};
}

/**
 * Validate token from URL
 */
async function validateApplicationToken(token: string | null): Promise<TokenValidationState> {
	if (!token) {
		return {
			valid: false,
			token: null,
			linkId: null,
			customerId: null,
			error: 'No application token provided. Please use a valid application link.',
			errorCode: 'MISSING'
		};
	}

	const result = await validateLink(token);

	if (!result.valid || !result.link) {
		return {
			valid: false,
			token,
			linkId: null,
			customerId: null,
			error: result.error || 'Invalid application link',
			errorCode: result.errorCode
		};
	}

	return {
		valid: true,
		token,
		linkId: result.link.id,
		customerId: result.link.customer || null
	};
}

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token');

	// Validate token
	const tokenState = await validateApplicationToken(token);

	// Fetch loan settings
	const loanSettings = await fetchLoanSettings();

	// Fetch Organization details
	let organization: OrganizationResponse | null = null;
	try {
		const orgs = await pb.collection(Collections.Organization).getList<OrganizationResponse>(1, 1);
		if (orgs.items.length > 0) {
			organization = orgs.items[0];
		}
	} catch (e) {
		// console.warn('Failed to fetch organization details:', e);
	}

	return {
		tokenState,
		loanSettings,
		organization
	};
};

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		// console.log('[apply/default] ====== FORM SUBMISSION RECEIVED ======');
		const formData = await request.formData();

		// Log form data keys for debugging
		const formKeys = Array.from(formData.keys());
		// console.log('[apply/default] Form data keys:', formKeys);

		// Re-validate token on submission
		const token = formData.get('token') as string;
		// console.log('[apply/default] Token:', token ? token.substring(0, 20) + '...' : 'MISSING');
		
		const tokenState = await validateApplicationToken(token);
		

		if (!tokenState.valid || !tokenState.linkId) {
			return fail(400, {
				success: false,
				errors: {
					submit: tokenState.error || 'Invalid or expired application link. Please request a new link.'
				}
			});
		}

		// Extract form fields
		const firstName = (formData.get('firstName') as string)?.trim();
		const middleName = (formData.get('middleName') as string)?.trim() || '';
		const lastName = (formData.get('lastName') as string)?.trim();
		const email = (formData.get('email') as string)?.trim();
		const phoneNumber = (formData.get('phoneNumber') as string)?.trim();
		const nationalId = (formData.get('nationalId') as string)?.trim();
		const kraPin = (formData.get('kraPin') as string)?.trim().toUpperCase();
		const residentialAddress = (formData.get('residentialAddress') as string)?.trim();
		const employerName = (formData.get('employerName') as string)?.trim();
		const employerBranch = (formData.get('employerBranch') as string)?.trim();
		const netSalary = parseFloat(formData.get('netSalary') as string) || 0;
		const nextSalaryPayDate = (formData.get('nextSalaryPayDate') as string)?.trim();
		const loanPurpose = formData.get('loanPurpose') as string;
		const loanAmount = parseFloat(formData.get('loanAmount') as string) || 0;
		const disbursementMethod = formData.get('disbursementMethod') as string;
		const mpesaNumber = (formData.get('mpesaNumber') as string)?.trim() || '';
		const bankName = (formData.get('bankName') as string)?.trim() || '';
		const bankAccount = (formData.get('bankAccount') as string)?.trim() || '';
		const accountName = (formData.get('accountName') as string)?.trim() || '';
		const digitalSignature = (formData.get('digitalSignature') as string)?.trim();
		const termsAccepted = formData.get('termsAccepted') === 'on';
		const dataUsageConsent = formData.get('dataUsageConsent') === 'on';
		const legalDocumentConsent = formData.get('legalDocumentConsent') === 'on';
		const postDatedChequeConsent = formData.get('postDatedChequeConsent') === 'on';

		// Extract document IDs from realtime uploads
		const nationalIdFrontId = formData.get('nationalIdFront_id') as string;
		const nationalIdBackId = formData.get('nationalIdBack_id') as string;
		const passportPhotoId = formData.get('passportPhoto_id') as string;
		const latestPayslipId = formData.get('latestPayslip_id') as string;
		const previousPayslipId = formData.get('previousPayslip_id') as string;
		const postDatedChequeId = formData.get('postDatedCheque_id') as string;

		// Validation errors
		const errors: Record<string, string> = {};

		// Required field validations
		if (!firstName) errors.firstName = 'First name is required';
		if (!lastName) errors.lastName = 'Last name is required';
		if (!email) {
			errors.email = 'Email is required';
		} else if (!EMAIL_REGEX.test(email)) {
			errors.email = 'Please enter a valid email address';
		}
		if (!phoneNumber) {
			errors.phoneNumber = 'Phone number is required';
		} else if (!PHONE_REGEX.test(phoneNumber)) {
			errors.phoneNumber = 'Please enter a valid Kenyan phone number';
		}
		if (!nationalId) {
			errors.nationalId = 'National ID is required';
		} else if (!NATIONAL_ID_REGEX.test(nationalId)) {
			errors.nationalId = 'National ID must be 7-8 digits';
		}
		if (!kraPin) {
			errors.kraPin = 'KRA PIN is required';
		} else if (!KRA_PIN_REGEX.test(kraPin)) {
			errors.kraPin = 'KRA PIN must be in format A000000000A';
		}
		if (!residentialAddress) errors.residentialAddress = 'Residential address is required';
		if (!employerName) errors.employerName = 'Employer name is required';
		if (!employerBranch) errors.employerBranch = 'Employer branch is required';
		if (!netSalary || netSalary <= 0) errors.netSalary = 'Net salary is required';
		if (!nextSalaryPayDate) {
			errors.nextSalaryPayDate = 'Next salary pay date is required';
		} else {
			const today = new Date();
			const salaryDate = new Date(nextSalaryPayDate);
			const diffDays = Math.ceil((salaryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
			if (diffDays <= 0) {
				errors.nextSalaryPayDate = 'Next salary pay date must be in the future';
			} else if (diffDays > 30) {
				errors.nextSalaryPayDate = 'Next salary pay date cannot be more than 30 days from today';
			}
		}
		if (!loanPurpose) errors.loanPurpose = 'Loan purpose is required';

		// Loan amount validation
		const loanSettings = await fetchLoanSettings();
		const maxLoanFromSalary = Math.floor(netSalary * loanSettings.maxLoanPercentage);
		const maxAllowed = Math.min(maxLoanFromSalary, loanSettings.maxLoanAmount);

		if (!loanAmount || loanAmount <= 0) {
			errors.loanAmount = 'Loan amount is required';
		} else if (loanAmount < loanSettings.minLoanAmount) {
			errors.loanAmount = `Minimum loan amount is KES ${loanSettings.minLoanAmount.toLocaleString()}`;
		} else if (loanAmount > maxAllowed) {
			errors.loanAmount = `Maximum loan amount is KES ${maxAllowed.toLocaleString()}`;
		}

		// Disbursement method validation
		if (disbursementMethod === 'mpesa' && !mpesaNumber) {
			errors.mpesaNumber = 'M-Pesa number is required';
		}
		if (disbursementMethod === 'bank_transfer') {
			if (!bankName) errors.bankName = 'Bank name is required';
			if (!bankAccount) errors.bankAccount = 'Account number is required';
			if (!accountName) errors.accountName = 'Account name is required';
		}

		// Digital signature validation
		if (!digitalSignature) {
			errors.digitalSignature = 'Digital signature is required';
		} else if (digitalSignature.toLowerCase() !== firstName?.toLowerCase()) {
			errors.digitalSignature = 'Signature must match your first name';
		}

		// Consent validations
		if (!termsAccepted) errors.termsAccepted = 'You must accept the terms and conditions';
		if (!dataUsageConsent) errors.dataUsageConsent = 'You must consent to data processing';
		if (!legalDocumentConsent) errors.legalDocumentConsent = 'You must confirm information accuracy';
		if (!postDatedChequeConsent) errors.postDatedChequeConsent = 'You must acknowledge cheque obligations';

		// Document validations - check for uploaded document IDs
		if (!nationalIdFrontId) errors.nationalIdFront = 'National ID front is required';
		if (!nationalIdBackId) errors.nationalIdBack = 'National ID back is required';
		if (!passportPhotoId) errors.passportPhoto = 'Passport photo is required';
		if (!latestPayslipId) errors.latestPayslip = 'Latest payslip is required';
		if (!previousPayslipId) errors.previousPayslip = 'Previous payslip is required';
		if (!postDatedChequeId) errors.postDatedCheque = 'Post-dated cheque is required';

		// Return errors if any
		if (Object.keys(errors).length > 0) {
			const firstErrorField = Object.keys(errors)[0];
			return fail(400, {
				success: false,
				errors,
				firstErrorField,
				data: {
					firstName,
					middleName,
					lastName,
					email,
					phoneNumber,
					nationalId,
					kraPin,
					residentialAddress,
					employerName,
					employerBranch,
					netSalary: netSalary.toString(),
					nextSalaryPayDate,
					loanPurpose,
					loanAmount: loanAmount.toString(),
					disbursementMethod,
					mpesaNumber,
					bankName,
					bankAccount,
					accountName,
					digitalSignature,
					termsAccepted,
					dataUsageConsent,
					legalDocumentConsent,
					postDatedChequeConsent
				}
			});
		}

		try {
			// Construct full name
			const fullName = middleName
				? `${firstName} ${middleName} ${lastName}`
				: `${firstName} ${lastName}`;
			let customerId: string;

			const existingCustomer = await findExistingCustomerByMatch(nationalId, email, phoneNumber);

			if (existingCustomer) {
				customerId = existingCustomer.id;
					} else {
				const customerInput: CreateCustomerInput = {
					name: fullName,
					email: normalizeEmail(email),
					phone: normalizePhone(phoneNumber),
					national_id: nationalId,
					kra_pin: normalizeKraPin(kraPin),
					employer_name: employerName,
					employer_branch: employerBranch,
					residential_address: residentialAddress,
					net_salary: netSalary
				};

				const newCustomer = await createCustomer(customerInput);
				customerId = newCustomer.id;
					}

			// Create loan
			const loanInput: CreateLoanInput = {
				customerId,
				applicationLinkId: tokenState.linkId!,
				loanAmount,
				loanPurpose: loanPurpose as LoansLoanPurposeOptions,
				salaryDate: nextSalaryPayDate,
				disbursementMethod: disbursementMethod as LoansDisbursementMethodOptions,
				mpesaNumber,
				bankName,
				bankAccount,
				accountName,
				digitalSignature,
				ipAddress: getClientAddress(),
				userAgent: request.headers.get('user-agent') || undefined
			};
			const calcSettings: LoanCalculationSettings = {
				interestRate15Days: loanSettings.interestRate15Days,
				interestRate30Days: loanSettings.interestRate30Days,
				processingFeeRate: loanSettings.processingFeeRate,
				penaltyRate: loanSettings.penaltyRate ?? DEFAULT_LOAN_SETTINGS.penaltyRate,
				maxLoanPercentage: loanSettings.maxLoanPercentage,
				minLoanAmount: loanSettings.minLoanAmount,
				maxLoanAmount: loanSettings.maxLoanAmount,
				gracePeriodDays: loanSettings.gracePeriodDays,
				penaltyPeriodDays: loanSettings.penaltyPeriodDays
			};
	const loan = await createLoan(loanInput, calcSettings);

		const documentIds = [
			nationalIdFrontId,
			nationalIdBackId,
			passportPhotoId,
			latestPayslipId,
			previousPayslipId,
			postDatedChequeId
		].filter(Boolean); // Remove any empty strings

		for (const documentId of documentIds) {
			try {
				await pb.collection(Collections.LoanDocuments).update(documentId, {
					loan: loan.id
				});} catch (docError) {
				// console.error(`[apply/default] Failed to link document ${documentId}:`, docError);
				// Continue with other documents even if one fails
			}
		}

			// Send application received confirmation email
			try {
				// Fetch organization details for email
				let orgName = 'inuaquicklink';
				let orgPhone = '+254 700 000 000';
				let orgEmail = 'support@inuaquicklink.com';

				try {
					const orgs = await pb.collection(Collections.Organization).getFullList<OrganizationResponse>({ requestKey: null });
					if (orgs.length > 0) {
						orgName = orgs[0].name || orgName;
						orgPhone = orgs[0].phone || orgPhone;
						orgEmail = orgs[0].email || orgEmail;
					}
				} catch (orgError) {
					// console.warn('[apply/default] Could not fetch organization details:', orgError);
				}

				// Construct full customer name
				const fullName = middleName
					? `${firstName} ${middleName} ${lastName}`
					: `${firstName} ${lastName}`;

				// Send the confirmation email
				const emailResult = await sendApplicationReceivedEmail({
					customerEmail: email,
					customerName: fullName,
					loanNumber: loan.loan_number,
					loanAmount: loan.loan_amount,
					loanPeriodDays: loan.loan_period_days,
					applicationDate: new Date(),
					customerId: customerId,
					loanId: loan.id,
					organizationName: orgName,
					organizationPhone: orgPhone,
					organizationEmail: orgEmail
				});

				if (emailResult.success) {
					// console.log('[apply/default] Confirmation email sent successfully:', emailResult.emailLogId);
				} else {
					// console.warn('[apply/default] Failed to send confirmation email:', emailResult.error);
				}
			} catch (emailError) {
			}

			return {
				success: true,
				loanId: loan.loan_number,
				message: 'Your loan application has been submitted successfully. We will review your application and get back to you shortly.'
			};
		} catch (error) {
		
			return fail(500, {
				success: false,
				errors: {
					submit: 'We encountered an issue processing your application. Please try again or contact support if the problem persists.'
				}
			});
		}
	}
};
