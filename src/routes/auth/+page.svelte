<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import {
		initSession,
		session,
		restoreSession,
		getSessionOrgCode
	} from '$lib/store/session.svelte';
	import { onMount } from 'svelte';

	// Check for active session on mount and redirect if authenticated
	onMount(() => {
		if (browser) {
			restoreSession();
			if (session.isAuthenticated) {
				const orgCode = getSessionOrgCode();
				if (orgCode) {
					goto(`/${orgCode}`);
				}
			}
		}
	});

	type FormResult = {
		success?: boolean;
		step?: string;
		message?: string;
		otpId?: string;
		mfaId?: string;
		userId?: string;
		userEmail?: string;
		user?: any;
		organization?: any;
		token?: string;
		permissions?: any[];
		redirectTo?: string;
	};

	let { form }: { form: FormResult | null } = $props();

	// Form state
	let email = $state('');
	let password = $state('');
	let verificationCode = $state('');
	let showPassword = $state(false);
	let loading = $state(false);

	// OTP step state
	let showVerification = $state(false);
	let otpId = $state('');
	let mfaId = $state('');
	let userEmail = $state('');
	let isRedirecting = $state(false);

	// Handle form results
	$effect(() => {
		if (isRedirecting) return; // Prevent re-processing during redirect

		if (form?.success && form?.step === 'otp') {
			// Move to OTP verification step
			showVerification = true;
			otpId = form.otpId || '';
			mfaId = form.mfaId || '';
			userEmail = form.userEmail || '';
		} else if (form?.success && form?.step === 'complete') {
			// Login complete - initialize session and redirect
			if (form.user && form.organization && form.token) {
				isRedirecting = true;
				initSession(form.user, form.organization, form.token);
				goto(form.redirectTo || '/' + form.organization.code);
			}
		} else if (form?.step === 'otp') {
			// Stay on OTP step but show error
			showVerification = true;
			if (form.otpId) otpId = form.otpId;
			if (form.mfaId) mfaId = form.mfaId;
			if (form.userEmail) userEmail = form.userEmail;
		}
	});

	// Track resend loading separately
	let resendLoading = $state(false);

	function resetToLogin() {
		showVerification = false;
		otpId = '';
		mfaId = '';
		verificationCode = '';
		loading = false;
		resendLoading = false;
	}

	function getInputClasses(hasError: boolean): string {
		const base =
			'block w-full rounded-lg bg-muted px-4 py-4 text-foreground placeholder-muted-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-background sm:text-sm';
		return hasError
			? base +
					' border-destructive focus:border-destructive focus:ring-destructive/50 bg-destructive/5'
			: base + ' border-input bg-background focus:border-primary focus:ring-ring';
	}
</script>

<svelte:head>
	<title>Sign In</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
	<div class="w-full max-w-md space-y-8">
		<div class="text-center">
			<h2 class="text-3xl font-bold text-foreground">
				{showVerification ? 'Verify Your Login' : 'Welcome Back'}
			</h2>
		</div>

		{#if showVerification}
			<!-- Verification Code Form -->
			<form
				method="POST"
				action="?/verify"
				class="mt-8 space-y-6"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						loading = false;
						await update();
					};
				}}
			>
				<input type="hidden" name="otpId" value={otpId} />
				<input type="hidden" name="mfaId" value={mfaId} />
				<input type="hidden" name="userEmail" value={userEmail} />

				{#if form?.success && form?.message}
					<div class="rounded-lg border border-primary/20 bg-primary/10 p-4">
						<div class="flex">
							<div class="shrink-0">
								<svg
									class="h-5 w-5 text-primary"
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 20 20"
									fill="currentColor"
								>
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
										clip-rule="evenodd"
									/>
								</svg>
							</div>
							<div class="ml-3">
								<p class="text-sm font-medium text-primary">
									{form.message}
								</p>
							</div>
						</div>
					</div>
				{/if}

				{#if form?.message && !form?.success}
					<div class="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
						<div class="flex">
							<div class="shrink-0">
								<svg
									class="h-5 w-5 text-destructive"
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 20 20"
									fill="currentColor"
								>
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
										clip-rule="evenodd"
									/>
								</svg>
							</div>
							<div class="ml-3">
								<p class="text-sm text-destructive">
									{form.message}
								</p>
							</div>
						</div>
					</div>
				{/if}

				<div class="space-y-4">
					<div>
						<label for="code" class="mb-2 block text-sm font-medium text-foreground">
							Verification Code <span class="text-destructive">*</span>
						</label>
						<input
							id="code"
							name="code"
							type="text"
							inputmode="numeric"
							maxlength="6"
							autocomplete="one-time-code"
							required
							bind:value={verificationCode}
							class={getInputClasses(!!form?.message && !form?.success)}
							placeholder="Enter 6-digit code"
						/>
						<p class="mt-1 text-xs text-muted-foreground">
							Code sent to {userEmail}. Expires in 4 minutes.
						</p>
					</div>
				</div>

				<div class="flex flex-col space-y-4">
					<button
						type="submit"
						disabled={loading || !verificationCode || verificationCode.length !== 6}
						class="group relative flex w-full justify-center rounded-lg border border-transparent bg-primary px-2 py-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if loading}
							<svg
								class="mr-3 -ml-1 h-5 w-5 animate-spin text-primary-foreground"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
						{:else}
							Verify & Sign In
						{/if}
					</button>

					<div class="text-center">
						<span class="text-sm text-muted-foreground">Didn't receive the code? </span>
						<button
							type="button"
							disabled={loading || resendLoading}
							class="text-sm text-primary underline transition-colors hover:text-primary/80 disabled:opacity-50"
							onclick={async (e) => {
								e.preventDefault();
								resendLoading = true;
								try {
									const formData = new FormData();
									formData.set('userEmail', userEmail);
									const response = await fetch('?/resend', {
										method: 'POST',
										body: formData
									});
									const result = await response.json();
									if (result.data?.otpId) {
										otpId = result.data.otpId;
									}
								} catch (error) {
									// console.error('Failed to resend OTP:', error);
								} finally {
									resendLoading = false;
								}
							}}
						>
							{#if resendLoading}
								Sending...
							{:else}
								Resend code
							{/if}
						</button>
					</div>

					<button
						type="button"
						onclick={resetToLogin}
						class="text-sm text-muted-foreground underline transition-colors hover:text-foreground"
					>
						← Back to login
					</button>
				</div>
			</form>
		{:else}
			<!-- Login Form -->
			<form
				method="POST"
				action="?/login"
				class="mt-8 space-y-6"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						loading = false;
						await update();
					};
				}}
			>
				{#if form?.message && form?.step !== 'otp'}
					<div
						class="rounded-lg border border-destructive/20 bg-destructive/10 p-4 dark:border-destructive/30 dark:bg-destructive/5"
					>
						<div class="flex">
							<div class="shrink-0">
								<svg
									class="h-5 w-5 text-destructive"
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 20 20"
									fill="currentColor"
								>
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
										clip-rule="evenodd"
									/>
								</svg>
							</div>
							<div class="ml-3">
								<p class="text-sm text-destructive">
									{form.message}
								</p>
							</div>
						</div>
					</div>
				{/if}

				<div class="space-y-4">
					<div>
						<label for="email" class="mb-2 block text-sm font-medium text-foreground">
							Email <span class="text-destructive">*</span>
						</label>
						<input
							id="email"
							name="email"
							type="email"
							autocomplete="email"
							required
							bind:value={email}
							class={getInputClasses(!!form?.message)}
							placeholder="you@example.com"
						/>
					</div>

					<div>
						<label for="password" class="mb-2 block text-sm font-medium text-foreground">
							Password <span class="text-destructive">*</span>
						</label>
						<div class="relative">
							<input
								id="password"
								name="password"
								type={showPassword ? 'text' : 'password'}
								autocomplete="current-password"
								required
								bind:value={password}
								class={getInputClasses(!!form?.message)}
								placeholder="••••••••"
							/>
							<button
								type="button"
								class="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
								onclick={() => (showPassword = !showPassword)}
							>
								{#if showPassword}
									<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
										/>
									</svg>
								{:else}
									<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
										/>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
										/>
									</svg>
								{/if}
							</button>
						</div>
					</div>
				</div>

				<div>
					<button
						type="submit"
						disabled={loading || !email || !password}
						class="group relative flex w-full justify-center rounded-lg border border-transparent bg-primary px-2 py-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if loading}
							<svg
								class="mr-3 -ml-1 h-5 w-5 animate-spin text-primary-foreground"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
							Signing in...
						{:else}
							Sign in
						{/if}
					</button>
				</div>
			</form>
		{/if}
	</div>
</div>
