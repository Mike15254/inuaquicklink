/**
 * Validation rules and utilities for the loan management system
 */

// Regex patterns
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(?:\+254|0)?[17]\d{8}$/;
const NATIONAL_ID_REGEX = /^\d{7,8}$/;
const KRA_PIN_REGEX = /^[A-Z]\d{9}[A-Z]$/;

export type ValidationResult = {
	valid: boolean;
	error?: string;
};

export type ValidationRule<T> = (value: T) => ValidationResult;

/**
 * Create a valid result
 */
export function valid(): ValidationResult {
	return { valid: true };
}

/**
 * Create an invalid result with error message
 */
export function invalid(error: string): ValidationResult {
	return { valid: false, error };
}

/**
 * Combine multiple validation results
 */
export function combineValidations(...results: ValidationResult[]): ValidationResult {
	for (const result of results) {
		if (!result.valid) return result;
	}
	return valid();
}

/**
 * Run multiple validators on a value
 */
export function validate<T>(value: T, ...validators: ValidationRule<T>[]): ValidationResult {
	for (const validator of validators) {
		const result = validator(value);
		if (!result.valid) return result;
	}
	return valid();
}

// String validators

export function required(fieldName: string): ValidationRule<string | undefined | null> {
	return (value) => {
		if (!value || value.trim() === '') {
			return invalid(`${fieldName} is required`);
		}
		return valid();
	};
}

export function minLength(min: number, fieldName: string): ValidationRule<string> {
	return (value) => {
		if (value.length < min) {
			return invalid(`${fieldName} must be at least ${min} characters`);
		}
		return valid();
	};
}

export function maxLength(max: number, fieldName: string): ValidationRule<string> {
	return (value) => {
		if (value.length > max) {
			return invalid(`${fieldName} must be at most ${max} characters`);
		}
		return valid();
	};
}

export function pattern(regex: RegExp, errorMessage: string): ValidationRule<string> {
	return (value) => {
		if (!regex.test(value)) {
			return invalid(errorMessage);
		}
		return valid();
	};
}

// Number validators

export function minValue(min: number, fieldName: string): ValidationRule<number> {
	return (value) => {
		if (value < min) {
			return invalid(`${fieldName} must be at least ${min}`);
		}
		return valid();
	};
}

export function maxValue(max: number, fieldName: string): ValidationRule<number> {
	return (value) => {
		if (value > max) {
			return invalid(`${fieldName} must be at most ${max}`);
		}
		return valid();
	};
}

export function range(min: number, max: number, fieldName: string): ValidationRule<number> {
	return (value) => {
		if (value < min || value > max) {
			return invalid(`${fieldName} must be between ${min} and ${max}`);
		}
		return valid();
	};
}

export function positive(fieldName: string): ValidationRule<number> {
	return (value) => {
		if (value <= 0) {
			return invalid(`${fieldName} must be positive`);
		}
		return valid();
	};
}

// Field-specific validators

export function isValidEmail(email: string): ValidationResult {
	if (!email) return invalid('Email is required');
	if (!EMAIL_REGEX.test(email)) return invalid('Invalid email format');
	return valid();
}

export function isValidPhone(phone: string): ValidationResult {
	if (!phone) return invalid('Phone number is required');
	const cleaned = phone.replace(/[\s-]/g, '');
	if (!PHONE_REGEX.test(cleaned)) {
		return invalid('Invalid phone number. Use format: 0712345678 or +254712345678');
	}
	return valid();
}

export function isValidNationalId(nationalId: string): ValidationResult {
	if (!nationalId) return invalid('National ID is required');
	if (!NATIONAL_ID_REGEX.test(nationalId)) {
		return invalid('National ID must be 7-8 digits');
	}
	return valid();
}

export function isValidKraPin(kraPin: string): ValidationResult {
	if (!kraPin) return invalid('KRA PIN is required');
	if (!KRA_PIN_REGEX.test(kraPin.toUpperCase())) {
		return invalid('Invalid KRA PIN format. Example: A123456789Z');
	}
	return valid();
}

export function isValidPassword(password: string): ValidationResult {
	if (!password) return invalid('Password is required');
	if (password.length < 8) return invalid('Password must be at least 8 characters');
	if (!/[A-Z]/.test(password)) return invalid('Password must contain an uppercase letter');
	if (!/[a-z]/.test(password)) return invalid('Password must contain a lowercase letter');
	if (!/\d/.test(password)) return invalid('Password must contain a number');
	return valid();
}

// Loan-specific validators

export function isValidLoanAmount(
	amount: number,
	minAmount: number,
	maxAmount: number
): ValidationResult {
	if (!amount || amount <= 0) return invalid('Loan amount is required');
	if (amount < minAmount) return invalid(`Minimum loan amount is KES ${minAmount.toLocaleString()}`);
	if (amount > maxAmount) return invalid(`Maximum loan amount is KES ${maxAmount.toLocaleString()}`);
	return valid();
}

export function isValidLoanPeriod(days: number): ValidationResult {
	if (!days || days <= 0) return invalid('Loan period is required');
	if (days !== 15 && days !== 30) {
		return invalid('Loan period must be either 15 or 30 days');
	}
	return valid();
}

export function isValidNetSalary(salary: number): ValidationResult {
	if (!salary || salary <= 0) return invalid('Net salary is required');
	if (salary < 10000) return invalid('Minimum net salary is KES 10,000');
	return valid();
}

// Customer validators

export interface CustomerData {
	name: string;
	email: string;
	phone: string;
	national_id: string;
	kra_pin: string;
	employer_name: string;
	employer_branch: string;
	residential_address: string;
	net_salary?: number;
}

export function validateCustomer(data: CustomerData): ValidationResult {
	return combineValidations(
		validate(data.name, required('Name'), minLength(2, 'Name'), maxLength(100, 'Name')),
		isValidEmail(data.email),
		isValidPhone(data.phone),
		isValidNationalId(data.national_id),
		isValidKraPin(data.kra_pin),
		validate(data.employer_name, required('Employer name')),
		validate(data.employer_branch, required('Employer branch')),
		validate(data.residential_address, required('Residential address'))
	);
}

// User validators

export interface UserData {
	name: string;
	email: string;
	password?: string;
	role: string;
}

export function validateUser(data: UserData, isNew: boolean = true): ValidationResult {
	const baseValidations = combineValidations(
		validate(data.name, required('Name'), minLength(2, 'Name')),
		isValidEmail(data.email),
		validate(data.role, required('Role'))
	);

	if (!baseValidations.valid) return baseValidations;

	if (isNew && data.password) {
		return isValidPassword(data.password);
	}

	return valid();
}

// Normalize phone number to E.164 format for Kenya
export function normalizePhone(phone: string): string {
	const cleaned = phone.replace(/[\s-]/g, '');
	if (cleaned.startsWith('+254')) return cleaned;
	if (cleaned.startsWith('0')) return `+254${cleaned.slice(1)}`;
	if (cleaned.startsWith('254')) return `+${cleaned}`;
	return `+254${cleaned}`;
}

// Normalize KRA PIN to uppercase
export function normalizeKraPin(kraPin: string): string {
	return kraPin.toUpperCase().trim();
}

// Normalize email to lowercase
export function normalizeEmail(email: string): string {
	return email.toLowerCase().trim();
}
