/**
 * Custom error classes for consistent error handling
 * Errors are thrown from services and caught at handler/route level
 */

export class AppError extends Error {
	readonly code: string;
	readonly status: number;
	readonly isOperational: boolean;

	constructor(message: string, code: string, status: number = 500) {
		super(message);
		this.name = this.constructor.name;
		this.code = code;
		this.status = status;
		this.isOperational = true;
		Error.captureStackTrace(this, this.constructor);
	}
}

export class NotFoundError extends AppError {
	constructor(resource: string, identifier?: string) {
		const message = identifier
			? `${resource} with ID '${identifier}' not found`
			: `${resource} not found`;
		super(message, 'NOT_FOUND', 404);
	}
}

export class ValidationError extends AppError {
	readonly field?: string;

	constructor(message: string, field?: string) {
		super(message, 'VALIDATION_ERROR', 400);
		this.field = field;
	}
}

export class UnauthorizedError extends AppError {
	constructor(message: string = 'Authentication required') {
		super(message, 'UNAUTHORIZED', 401);
	}
}

export class ForbiddenError extends AppError {
	readonly requiredPermission?: string;

	constructor(message: string = 'Access denied', requiredPermission?: string) {
		super(message, 'FORBIDDEN', 403);
		this.requiredPermission = requiredPermission;
	}
}

export class ConflictError extends AppError {
	constructor(message: string) {
		super(message, 'CONFLICT', 409);
	}
}

export class RateLimitError extends AppError {
	readonly retryAfter: number;

	constructor(retryAfter: number = 60) {
		super('Too many requests. Please try again later.', 'RATE_LIMIT', 429);
		this.retryAfter = retryAfter;
	}
}

export class ServiceError extends AppError {
	readonly service: string;

	constructor(service: string, message: string) {
		super(`${service} service error: ${message}`, 'SERVICE_ERROR', 500);
		this.service = service;
	}
}

export class DatabaseError extends AppError {
	constructor(message: string = 'Database operation failed') {
		super(message, 'DATABASE_ERROR', 500);
	}
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
	return error instanceof AppError;
}

/**
 * Type guard to check if error is a PocketBase error
 */
export function isPocketBaseError(error: unknown): error is { status: number; message: string } {
	return (
		typeof error === 'object' &&
		error !== null &&
		'status' in error &&
		typeof (error as { status: unknown }).status === 'number'
	);
}

/**
 * PocketBase ClientResponseError structure
 */
interface PocketBaseClientError {
	status: number;
	message: string;
	response?: {
		data?: Record<string, { code?: string; message?: string }>;
		message?: string;
	};
}

/**
 * Check if error is a PocketBase ClientResponseError with detailed data
 */
export function isPocketBaseClientError(error: unknown): error is PocketBaseClientError {
	return (
		typeof error === 'object' &&
		error !== null &&
		'status' in error &&
		'response' in error &&
		typeof (error as PocketBaseClientError).response === 'object'
	);
}

/**
 * Privacy-friendly field error messages for unique constraint violations
 * These messages don't reveal that a duplicate exists (data privacy)
 */
const PRIVACY_FRIENDLY_FIELD_ERRORS: Record<string, string> = {
	phone: 'Please verify your phone number is correct and try again.',
	email: 'Please verify your email address is correct and try again.',
	national_id: 'Please verify your National ID number is correct and try again.',
	kra_pin: 'Please verify your KRA PIN is correct and try again.',
	// Default fallback
	default: 'Please verify this information is correct and try again.'
};

/**
 * Map PocketBase field names to form field names
 */
const FIELD_NAME_MAP: Record<string, string> = {
	phone: 'phoneNumber',
	email: 'email',
	national_id: 'nationalId',
	kra_pin: 'kraPin'
};

/**
 * Parse PocketBase unique constraint errors into privacy-friendly form errors
 * Returns field-level errors without revealing that duplicates exist
 */
export function parsePocketBaseUniqueErrors(error: unknown): Record<string, string> | null {
	if (!isPocketBaseClientError(error)) {
		return null;
	}

	// Check if this is a "Failed to create record" error with field data
	if (error.status !== 400 || !error.response?.data) {
		return null;
	}

	const fieldErrors: Record<string, string> = {};
	const data = error.response.data;

	for (const [pbField, errorInfo] of Object.entries(data)) {
		// Check if it's a unique constraint violation
		// PocketBase sends code like "validation_not_unique" or similar
		const isUniqueError = 
			errorInfo?.code?.includes('unique') ||
			errorInfo?.code?.includes('not_unique') ||
			errorInfo?.message?.toLowerCase().includes('unique') ||
			errorInfo?.message?.toLowerCase().includes('already exists');

		if (isUniqueError || errorInfo?.code) {
			// Map to form field name and get privacy-friendly message
			const formField = FIELD_NAME_MAP[pbField] || pbField;
			fieldErrors[formField] = PRIVACY_FRIENDLY_FIELD_ERRORS[pbField] || PRIVACY_FRIENDLY_FIELD_ERRORS.default;
		}
	}

	return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
}

/**
 * Get a generic privacy-friendly error message for form submission failures
 */
export function getPrivacyFriendlySubmitError(): string {
	return 'We could not process your application. Please review your information and try again. If the problem persists, contact support.';
}

/**
 * Convert any error to a consistent error response format
 */
export interface ErrorResponse {
	error: string;
	code: string;
	status: number;
	field?: string;
}

export function toErrorResponse(error: unknown): ErrorResponse {
	if (isAppError(error)) {
		return {
			error: error.message,
			code: error.code,
			status: error.status,
			field: error instanceof ValidationError ? error.field : undefined
		};
	}

	if (isPocketBaseError(error)) {
		return {
			error: error.message || 'An error occurred',
			code: 'POCKETBASE_ERROR',
			status: error.status
		};
	}

	if (error instanceof Error) {
		return {
			error: error.message,
			code: 'INTERNAL_ERROR',
			status: 500
		};
	}

	return {
		error: 'An unexpected error occurred',
		code: 'UNKNOWN_ERROR',
		status: 500
	};
}

/**
 * Wrap async function with error handling
 */
export async function tryCatch<T>(
	fn: () => Promise<T>
): Promise<[T, null] | [null, ErrorResponse]> {
	try {
		const result = await fn();
		return [result, null];
	} catch (error) {
		return [null, toErrorResponse(error)];
	}
}
