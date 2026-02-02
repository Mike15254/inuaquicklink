/**
 * Auth page load and form actions
 * Organization is automatically determined from user's account
 */

import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { loginStepOne, loginStepTwo, resendOtp } from '$lib/core/users/auth_service';

export const load: PageServerLoad = async () => {
	return {};
};

export const actions: Actions = {
	/**
	 * Step 1: Login with email/password, sends OTP
	 */
	login: async ({ request }) => {
		const formData = await request.formData();
		const email = formData.get('email')?.toString() || '';
		const password = formData.get('password')?.toString() || '';

		if (!email || !password) {
			return fail(400, {
				message: 'Email and password are required',
				email
			});
		}

		try {
			const result = await loginStepOne(email, password);

			console.log('[Auth Page] loginStepOne success. Returning to client:', {
				step: 'otp',
				otpId: result.otpId,
				mfaId: result.mfaId,
				userId: result.userId
			});

			return {
				success: true,
				step: 'otp',
				otpId: result.otpId,
				mfaId: result.mfaId,
				userId: result.userId,
				userEmail: result.userEmail,
				message: result.message
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Login failed';
			return fail(400, {
				message: errorMessage,
				email
			});
		}
	},

	/**
	 * Step 2: Verify OTP and complete login
	 * Organization is automatically fetched from user's relationship
	 */
	verify: async ({ request, getClientAddress }) => {
		const formData = await request.formData();
		const otpId = formData.get('otpId')?.toString() || '';
		const code = formData.get('code')?.toString() || '';
		const userEmail = formData.get('userEmail')?.toString() || '';
		const mfaId = formData.get('mfaId')?.toString() || '';

		if (!otpId || !code) {
			return fail(400, {
				message: 'Verification code is required',
				step: 'otp',
				otpId,
				mfaId,
				userEmail
			});
		}

		if (code.length !== 6) {
			return fail(400, {
				message: 'Please enter a 6-digit code',
				step: 'otp',
				otpId,
				mfaId,
				userEmail
			});
		}

		try {
			const ipAddress = getClientAddress();
			// Organization is now automatically determined from user's account
			const result = await loginStepTwo(otpId, code, mfaId, ipAddress);

			// Return auth data to client for session initialization
			return {
				success: true,
				step: 'complete',
				user: result.user,
				organization: result.organization,
				token: result.token,
				permissions: result.permissions,
				redirectTo: '/dashboard'
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Verification failed';
			return fail(400, {
				message: errorMessage,
				step: 'otp',
				otpId,
				mfaId,
				userEmail
			});
		}
	},

	/**
	 * Resend OTP code
	 */
	resend: async ({ request }) => {
		const formData = await request.formData();
		const userEmail = formData.get('userEmail')?.toString() || '';

		if (!userEmail) {
			return fail(400, {
				message: 'Email is required to resend code',
				step: 'otp'
			});
		}

		try {
			const result = await resendOtp(userEmail);

			return {
				success: true,
				step: 'otp',
				otpId: result.otpId,
				userEmail,
				message: 'New verification code sent to your email'
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to resend code';
			return fail(400, {
				message: errorMessage,
				step: 'otp',
				userEmail
			});
		}
	}
};
