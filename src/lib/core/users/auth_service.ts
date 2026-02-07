/**
 * User authentication service using PocketBase
 * Supports email/password login with OTP verification
 */

import { pb, clearAuth } from '$lib/infra/db/pb';
import { Collections, type UsersResponse, type RolesResponse, type OrganizationResponse } from '$lib/types';
import {
	UnauthorizedError,
	ValidationError,
	ForbiddenError,
	NotFoundError
} from '$lib/shared/errors';
import { isValidEmail } from '$lib/shared/rules';
import { logUserLogin } from '$lib/core/activity/activity_service';
import type { PermissionType } from '$lib/services/roles/permissions';
import { logExternalEmail } from '$lib/services/email/email_logger';
import { EmailLogsEmailTypeOptions } from '$lib/types';

/**
 * User with expanded role and organization
 */
/**
 * User with expanded role
 */
export type UserWithRole = UsersResponse<{ 
	role: RolesResponse<PermissionType[]>;
}>;

/**
 * User with expanded role and organization
 */
export type UserWithRoleAndOrg = UsersResponse<{ 
	role: RolesResponse<PermissionType[]>;
	organization: OrganizationResponse;
}>;

/**
 * Login step 1 result - user validated, OTP sent
 */
export interface LoginStepOneResult {
	otpId: string;
	mfaId: string;
	userId: string;
	userEmail: string;
	message: string;
}

/**
 * Auth result after successful OTP verification
 */
export interface AuthResult {
	user: UserWithRoleAndOrg;
	organization: OrganizationResponse;
	token: string;
	permissions: PermissionType[];
}

/**
 * Step 1: Login with email/password, then request OTP
 * With MFA enabled, authWithPassword returns 401 with mfaId
 * We then request OTP for the second factor
 */
export async function loginStepOne(
	email: string,
	password: string
): Promise<LoginStepOneResult> {
	// Validate email
	const validation = isValidEmail(email);
	if (!validation.valid) {
		throw new ValidationError(validation.error || 'Invalid email');
	}

	if (!password || password.length < 8) {
		throw new ValidationError('Password must be at least 8 characters');
	}

	const normalizedEmail = email.toLowerCase().trim();

	try {
		// With MFA enabled, this will throw a 401 with mfaId
		await pb.collection(Collections.Users).authWithPassword(normalizedEmail, password);
		
		// If we get here, MFA is not enabled - shouldn't happen but handle it
		// Clear auth and require OTP anyway for security
		const userId = pb.authStore.record?.id || '';
		clearAuth();
		
		const otpResult = await pb.collection(Collections.Users).requestOTP(normalizedEmail);

		// Log the OTP email
		try {
			await logExternalEmail(
				normalizedEmail,
				'Verification Code',
				'Your verification code is: ******',
				EmailLogsEmailTypeOptions.auth_otp
			);
		} catch (e) {
		}

		return {
			otpId: otpResult.otpId,
			mfaId: '', // No MFA, but we still require OTP
			userId,
			userEmail: normalizedEmail,
			message: 'Verification code sent to your email'
		};
	} catch (error: unknown) {
		// Check if this is an MFA required response (401 with mfaId)
		const err = error as { response?: { mfaId?: string }; status?: number };
		
		const mfaId = err.response?.mfaId;
		if (mfaId) {
			// MFA is required - request OTP for second factor
			try {const otpResult = await pb.collection(Collections.Users).requestOTP(normalizedEmail);
				try {
					await logExternalEmail(
						normalizedEmail,
						'Verification Code',
						'Your verification code is: ******',
						EmailLogsEmailTypeOptions.auth_otp
					);
				} catch (e) {
					
				}

				return {
					otpId: otpResult.otpId,
					mfaId,
					userId: '', // We don't have user ID yet with MFA
					userEmail: normalizedEmail,
					message: 'Verification code sent to your email'
				};
			} catch (otpError) {
				throw new UnauthorizedError('Failed to send verification code');
			}
		}
		
		// Handle other errors
		if (error instanceof ForbiddenError || error instanceof ValidationError) {
			throw error;
		}
		throw new UnauthorizedError('Invalid email or password');
	}
}

/**
 * Step 2: Verify OTP and complete login
 * Uses mfaId from step 1 to complete MFA authentication
 * Organization is automatically determined from user's relationship
 */
export async function loginStepTwo(
	otpId: string,
	otp: string,
	mfaId: string,
	ipAddress?: string
): Promise<AuthResult> {
	if (!otpId || !otp) {
		throw new ValidationError('OTP ID and code are required');
	}

	try {
		const authOptions = mfaId ? { mfaId } : {};
		
		const authResult = await pb.collection(Collections.Users).authWithOTP(otpId, otp, authOptions);
		
		// Fetch user with role AND organization expanded
		const user = await pb.collection(Collections.Users).getOne<UserWithRoleAndOrg>(authResult.record.id, {
			expand: 'role,organization'
		});

		// Check user status
		if (user.status === 'suspended') {
			clearAuth();
			throw new ForbiddenError('Your account has been suspended. Contact support.');
		}

		// Get the organization from the expanded relationship
		const organization = user.expand?.organization;
		if (!organization) {
			clearAuth();
			throw new ForbiddenError('Your account is not associated with any organization. Contact support.');
		}

		// Extract permissions from role
		const permissions = user.expand?.role?.permissions || [];

		// Log the login activity (non-blocking - don't fail login if this fails)
		try {
			await logUserLogin(user.id, ipAddress);
		} catch (logError) {
			// Continue with login even if activity logging fails
		}

		return {
			user,
			organization,
			token: authResult.token,
			permissions
		};
	} catch (error: unknown) {
		// Log detailed PocketBase error
		const pbError = error as { response?: { message?: string; data?: unknown }; status?: number };
		if (pbError.response) {
			
		}
		
		if (error instanceof ForbiddenError || error instanceof NotFoundError) {
			throw error;
		}
		
		// Provide more specific error message if available
		const errorMessage = pbError.response?.message || 'Invalid or expired verification code';
		throw new UnauthorizedError(errorMessage);
	}
}

/**
 * Logout current user
 */
export function logout(): void {
	clearAuth();
}

/**
 * Get current authenticated user with role and organization
 */
export async function getCurrentUser(): Promise<UserWithRoleAndOrg | null> {
	if (!pb.authStore.isValid || !pb.authStore.record) {
		return null;
	}

	try {
		const user = await pb.collection(Collections.Users).getOne<UserWithRoleAndOrg>(
			pb.authStore.record.id,
			{ expand: 'role,organization' }
		);
		return user;
	} catch {
		clearAuth();
		return null;
	}
}

/**
 * Get current user's permissions
 */
export async function getCurrentUserPermissions(): Promise<PermissionType[]> {
	const user = await getCurrentUser();
	if (!user) return [];
	return user.expand?.role?.permissions || [];
}

/**
 * Refresh auth result with organization
 */
export interface RefreshAuthResult {
	user: UserWithRoleAndOrg;
	organization: OrganizationResponse;
	token: string;
	permissions: PermissionType[];
}

/**
 * Refresh current auth token
 */
export async function refreshAuth(): Promise<RefreshAuthResult | null> {
	if (!pb.authStore.isValid) {
		return null;
	}

	try {
		const authResult = await pb.collection(Collections.Users).authRefresh();

		const user = await pb.collection(Collections.Users).getOne<UserWithRoleAndOrg>(
			authResult.record.id,
			{ expand: 'role,organization' }
		);

		const organization = user.expand?.organization;
		if (!organization) {
			clearAuth();
			return null;
		}

		const permissions = user.expand?.role?.permissions || [];

		return {
			user,
			organization,
			token: authResult.token,
			permissions
		};
	} catch {
		clearAuth();
		return null;
	}
}

/**
 * Check if current session is valid
 */
export function isSessionValid(): boolean {
	return pb.authStore.isValid;
}

/**
 * Get current auth token
 */
export function getToken(): string | null {
	return pb.authStore.token || null;
}

/**
 * Resend OTP to user's email
 */
export async function resendOtp(email: string): Promise<{ otpId: string }> {
	const validation = isValidEmail(email);
	if (!validation.valid) {
		throw new ValidationError(validation.error || 'Invalid email');
	}

	const normalizedEmail = email.toLowerCase().trim();
	const result = await pb.collection(Collections.Users).requestOTP(normalizedEmail);

	// Log the OTP email
	try {
		await logExternalEmail(
			normalizedEmail,
			'Verification Code',
			'Your verification code is: ******',
			EmailLogsEmailTypeOptions.auth_otp
		);
	} catch (e) {
	}

	return { otpId: result.otpId };
}
