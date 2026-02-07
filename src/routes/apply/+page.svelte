<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import DocumentUpload from '$lib/components/DocumentUpload.svelte';
	import DocumentUploadGuide from '$lib/components/DocumentUploadGuide.svelte';
	import SuccessModal from '$lib/components/SuccessModal.svelte';
	import { onMount } from 'svelte';
	import type { ActionData, PageData } from './$types';

	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import Banknote from '@lucide/svelte/icons/banknote';
	import Briefcase from '@lucide/svelte/icons/briefcase';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import FileText from '@lucide/svelte/icons/file-text';
	import Info from '@lucide/svelte/icons/info';
	import Loader from '@lucide/svelte/icons/loader-circle';
	import Shield from '@lucide/svelte/icons/shield';
	import User from '@lucide/svelte/icons/user';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	// LocalStorage key for form persistence
	const FORM_STORAGE_KEY = 'loan_application_form_data';

	// Redirect to main page if token is invalid
	onMount(() => {
		if (!data.tokenState?.valid) {
			goto('/');
		}
		loadFormData();
	});

	// Form state
	let currentStep = $state(1);
	const totalSteps = 5;
	let isSubmitting = $state(false);
	let hasSubmitted = $state(false);

	// Success modal
	let showSuccessModal = $state(false);
	let successLoanId = $state('');
	let successMessage = $state('');
	let showTermsDialog = $state(false);

	// Personal Information
	let firstName = $state('');
	let middleName = $state('');
	let lastName = $state('');
	let email = $state('');
	let phoneNumber = $state('');
	let nationalId = $state('');
	let kraPin = $state('');
	let residentialAddress = $state('');

	// Employment Details
	let employerName = $state('');
	let employerBranch = $state('');
	let netSalary = $state('');
	let nextSalaryPayDate = $state('');

	// Loan Details
	let loanPurpose = $state('');
	let loanAmount = $state('');
	let disbursementMethod = $state('mpesa');
	let mpesaNumber = $state('');
	let bankName = $state('');
	let bankAccount = $state('');
	let accountName = $state('');

	// Documents - Store document IDs from realtime uploads
	let nationalIdFrontId = $state('');
	let nationalIdBackId = $state('');
	let passportPhotoId = $state('');
	let latestPayslipId = $state('');
	let previousPayslipId = $state('');
	let postDatedChequeId = $state('');

	// Agreement
	let digitalSignature = $state('');
	let termsAccepted = $state(false);
	let dataUsageConsent = $state(false);
	let legalDocumentConsent = $state(false);
	let postDatedChequeConsent = $state(false);

	// Error state
	let errors = $state<Record<string, string>>({});

	// Validation warnings (non-blocking hints)
	let warnings = $state<Record<string, string>>({});

	// Save form data to localStorage whenever it changes
	$effect(() => {
		// Create an object with all form data
		const formData = {
			currentStep,
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
			netSalary,
			nextSalaryPayDate,
			loanPurpose,
			loanAmount,
			disbursementMethod,
			mpesaNumber,
			bankName,
			bankAccount,
			accountName,
			nationalIdFrontId,
			nationalIdBackId,
			passportPhotoId,
			latestPayslipId,
			previousPayslipId,
			postDatedChequeId,
			digitalSignature,
			termsAccepted,
			dataUsageConsent,
			legalDocumentConsent,
			postDatedChequeConsent
		};

		// Save to localStorage
		if (typeof window !== 'undefined') {
			localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formData));
		}
	});

	// Load form data from localStorage
	function loadFormData() {
		if (typeof window !== 'undefined') {
			const savedData = localStorage.getItem(FORM_STORAGE_KEY);
			if (savedData) {
				try {
					const formData = JSON.parse(savedData);
					currentStep = formData.currentStep || 1;
					firstName = formData.firstName || '';
					middleName = formData.middleName || '';
					lastName = formData.lastName || '';
					email = formData.email || '';
					phoneNumber = formData.phoneNumber || '';
					nationalId = formData.nationalId || '';
					kraPin = formData.kraPin || '';
					residentialAddress = formData.residentialAddress || '';
					employerName = formData.employerName || '';
					employerBranch = formData.employerBranch || '';
					netSalary = formData.netSalary || '';
					nextSalaryPayDate = formData.nextSalaryPayDate || '';
					loanPurpose = formData.loanPurpose || '';
					loanAmount = formData.loanAmount || '';
					disbursementMethod = formData.disbursementMethod || 'mpesa';
					mpesaNumber = formData.mpesaNumber || '';
					bankName = formData.bankName || '';
					bankAccount = formData.bankAccount || '';
					accountName = formData.accountName || '';
					nationalIdFrontId = formData.nationalIdFrontId || '';
					nationalIdBackId = formData.nationalIdBackId || '';
					passportPhotoId = formData.passportPhotoId || '';
					latestPayslipId = formData.latestPayslipId || '';
					previousPayslipId = formData.previousPayslipId || '';
					postDatedChequeId = formData.postDatedChequeId || '';
					digitalSignature = formData.digitalSignature || '';
					termsAccepted = formData.termsAccepted || false;
					dataUsageConsent = formData.dataUsageConsent || false;
					legalDocumentConsent = formData.legalDocumentConsent || false;
					postDatedChequeConsent = formData.postDatedChequeConsent || false;
				
				} catch (e) {
					// console.error('[apply] Failed to load form data from localStorage:', e);
				}
			}
		}
	}

	// Helper to get errors safely
	function getError(key: string): string | undefined {
		return errors[key];
	}

	function getWarning(key: string): string | undefined {
		return warnings[key];
	}

	function clearError(key: string) {
		if (errors[key]) {
			const newErrors = { ...errors };
			delete newErrors[key];
			errors = newErrors;
		}
	}

	function clearWarning(key: string) {
		if (warnings[key]) {
			const newWarnings = { ...warnings };
			delete newWarnings[key];
			warnings = newWarnings;
		}
	}

	// Validation patterns
	const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const PHONE_PATTERN = /^(\+254|0)?[17]\d{8}$/;
	const NATIONAL_ID_PATTERN = /^\d{7,8}$/;
	const KRA_PIN_PATTERN = /^[A-Z]\d{9}[A-Z]$/;

	// Real-time field validation
	function validateEmail(value: string) {
		if (!value) {
			clearWarning('email');
			return;
		}
		if (!EMAIL_PATTERN.test(value)) {
			warnings.email = 'Invalid email format';
		} else {
			clearWarning('email');
		}
	}

	function validatePhone(value: string) {
		if (!value) {
			clearWarning('phoneNumber');
			return;
		}
		if (!PHONE_PATTERN.test(value)) {
			warnings.phoneNumber = 'Invalid phone number';
		} else {
			clearWarning('phoneNumber');
		}
	}

	function validateNationalId(value: string) {
		if (!value) {
			clearWarning('nationalId');
			return;
		}
		if (!NATIONAL_ID_PATTERN.test(value)) {
			warnings.nationalId = 'Invalid ID format';
		} else {
			clearWarning('nationalId');
		}
	}

	function validateKraPin(value: string) {
		if (!value) {
			clearWarning('kraPin');
			return;
		}
		const upper = value.toUpperCase();
		if (!KRA_PIN_PATTERN.test(upper)) {
			warnings.kraPin = 'Invalid KRA PIN';
		} else {
			clearWarning('kraPin');
		}
	}

	// Repopulate form data on validation errors - only update fields that are present
	$effect(() => {
		if (form && 'data' in form && form.data) {
			const d = form.data;
			// Only update fields if they exist in the returned data (preserve current values otherwise)
			if (d.firstName !== undefined) firstName = d.firstName;
			if (d.middleName !== undefined) middleName = d.middleName;
			if (d.lastName !== undefined) lastName = d.lastName;
			if (d.email !== undefined) email = d.email;
			if (d.phoneNumber !== undefined) phoneNumber = d.phoneNumber;
			if (d.nationalId !== undefined) nationalId = d.nationalId;
			if (d.kraPin !== undefined) kraPin = d.kraPin;
			if (d.residentialAddress !== undefined) residentialAddress = d.residentialAddress;
			if (d.employerName !== undefined) employerName = d.employerName;
			if (d.employerBranch !== undefined) employerBranch = d.employerBranch;
			if (d.netSalary !== undefined) netSalary = d.netSalary;
			if (d.nextSalaryPayDate !== undefined) nextSalaryPayDate = d.nextSalaryPayDate;
			if (d.loanPurpose !== undefined) loanPurpose = d.loanPurpose;
			if (d.loanAmount !== undefined) loanAmount = d.loanAmount;
			if (d.disbursementMethod !== undefined) disbursementMethod = d.disbursementMethod;
			if (d.mpesaNumber !== undefined) mpesaNumber = d.mpesaNumber;
			if (d.bankName !== undefined) bankName = d.bankName;
			if (d.bankAccount !== undefined) bankAccount = d.bankAccount;
			if (d.accountName !== undefined) accountName = d.accountName;
			if (d.digitalSignature !== undefined) digitalSignature = d.digitalSignature;
			if (d.termsAccepted !== undefined) termsAccepted = d.termsAccepted;
			if (d.dataUsageConsent !== undefined) dataUsageConsent = d.dataUsageConsent;
			if (d.legalDocumentConsent !== undefined) legalDocumentConsent = d.legalDocumentConsent;
			if (d.postDatedChequeConsent !== undefined) postDatedChequeConsent = d.postDatedChequeConsent;
		}
	});

	// Loan calculations
	let calculatedMaxLoan = $derived(() => {
		const salary = parseFloat(netSalary) || 0;
		const settings = data.loanSettings;
		if (!settings || salary <= 0) return 0;
		const maxFromSalary = Math.floor(salary * settings.maxLoanPercentage);
		return Math.min(maxFromSalary, settings.maxLoanAmount);
	});

	// Loan period calculation (days until next salary)
	let loanPeriodDays = $derived(() => {
		if (!nextSalaryPayDate) return 0;
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const salaryDate = new Date(nextSalaryPayDate);
		salaryDate.setHours(0, 0, 0, 0);
		const diffTime = salaryDate.getTime() - today.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays > 0 ? diffDays : 0;
	});

	// Interest rate based on loan period
	let currentInterestRate = $derived(() => {
		const settings = data.loanSettings;
		if (!settings) return 0;
		const days = loanPeriodDays();
		return days <= 15 ? settings.interestRate15Days : settings.interestRate30Days;
	});

	// Max date for next salary (30 days from today)
	let maxSalaryDate = $derived(() => {
		const today = new Date();
		const maxDate = new Date(today);
		maxDate.setDate(today.getDate() + 30);
		return maxDate.toISOString().split('T')[0];
	});

	// Loan summary calculations
	let loanSummary = $derived(() => {
		const amount = parseFloat(loanAmount) || 0;
		const settings = data.loanSettings;
		const days = loanPeriodDays();

		if (!settings || amount <= 0 || days <= 0) {
			return null;
		}

		const interestRate = days <= 15 ? settings.interestRate15Days : settings.interestRate30Days;
		const interestAmount = Math.round(amount * interestRate);
		const processingFee = Math.round(amount * settings.processingFeeRate);
		const totalRepayment = amount + interestAmount;
		const disbursementAmount = amount - processingFee;

		// Calculate due date
		const dueDate = new Date(nextSalaryPayDate);

		return {
			applicationDate: new Date().toLocaleDateString('en-GB'),
			dueDate: dueDate.toLocaleDateString('en-GB'),
			loanAmount: amount,
			interestRate,
			interestAmount,
			processingFeeRate: settings.processingFeeRate,
			processingFee,
			totalRepayment,
			disbursementAmount,
			loanPeriodDays: days
		};
	});

	// Check if loan amount exceeds maximum
	let loanAmountExceedsMax = $derived(() => {
		const amount = parseFloat(loanAmount) || 0;
		const max = calculatedMaxLoan();
		return amount > max && max > 0;
	});

	// Check if loan amount is below minimum
	let loanAmountBelowMin = $derived(() => {
		const amount = parseFloat(loanAmount) || 0;
		const settings = data.loanSettings;
		return amount > 0 && settings && amount < settings.minLoanAmount;
	});

	// Step configuration
	const steps = [
		{ id: 1, title: 'Personal Information', icon: User },
		{ id: 2, title: 'Employment Details', icon: Briefcase },
		{ id: 3, title: 'Loan Details', icon: Banknote },
		{ id: 4, title: 'Required Documents', icon: FileText },
		{ id: 5, title: 'Agreement', icon: Shield }
	];

	// Loan purposes
	const loanPurposes = [
		{ value: 'emergency', label: 'Emergency' },
		{ value: 'medical', label: 'Medical Expenses' },
		{ value: 'education', label: 'Education' },
		{ value: 'business', label: 'Business' },
		{ value: 'personal', label: 'Personal' },
		{ value: 'other', label: 'Other' }
	];

	// Validation
	function validateStep(step: number): boolean {
		switch (step) {
			case 1:
				return !!(
					firstName &&
					lastName &&
					email &&
					EMAIL_PATTERN.test(email) &&
					phoneNumber &&
					PHONE_PATTERN.test(phoneNumber) &&
					nationalId &&
					NATIONAL_ID_PATTERN.test(nationalId) &&
					kraPin &&
					KRA_PIN_PATTERN.test(kraPin.toUpperCase()) &&
					residentialAddress
				);
			case 2:
				return !!(
					employerName &&
					employerBranch &&
					netSalary &&
					Number(netSalary) > 0 &&
					nextSalaryPayDate &&
					loanPeriodDays() > 0 &&
					loanPeriodDays() <= 30
				);
			case 3:
				if (!loanPurpose || !loanAmount || Number(loanAmount) <= 0) return false;
				if (loanAmountBelowMin() || loanAmountExceedsMax()) return false;
				if (disbursementMethod === 'mpesa' && !mpesaNumber) return false;
				if (disbursementMethod === 'bank_transfer' && (!bankName || !bankAccount || !accountName))
					return false;
				return true;
			case 4:
				return !!(
					nationalIdFrontId &&
					nationalIdBackId &&
					passportPhotoId &&
					latestPayslipId &&
					previousPayslipId &&
					postDatedChequeId
				);
			case 5:
				return !!(
					digitalSignature &&
					firstName &&
					digitalSignature.trim().toLowerCase() === firstName.trim().toLowerCase() &&
					termsAccepted &&
					dataUsageConsent &&
					legalDocumentConsent &&
					postDatedChequeConsent
				);
			default:
				return true;
		}
	}

	function nextStep() {
		if (currentStep < totalSteps && validateStep(currentStep)) {
			currentStep++;
			// Scroll to top of page immediately
			setTimeout(() => {
				const mainEl = document.querySelector('main');
				if (mainEl) {
					mainEl.scrollTo({ top: 0, behavior: 'smooth' });
				}
				window.scrollTo({ top: 0, behavior: 'smooth' });
			}, 0);
		}
	}

	function prevStep() {
		if (currentStep > 1) {
			currentStep--;
			// Scroll to top of page immediately
			setTimeout(() => {
				const mainEl = document.querySelector('main');
				if (mainEl) {
					mainEl.scrollTo({ top: 0, behavior: 'smooth' });
				}
				window.scrollTo({ top: 0, behavior: 'smooth' });
			}, 0);
		}
	}

	function goToStep(step: number) {
		// Only allow going to completed steps or current step
		if (step <= currentStep) {
			currentStep = step;
			// Scroll to top of page immediately
			setTimeout(() => {
				const mainEl = document.querySelector('main');
				if (mainEl) {
					mainEl.scrollTo({ top: 0, behavior: 'smooth' });
				}
				window.scrollTo({ top: 0, behavior: 'smooth' });
			}, 0);
		}
	}

	// Document handlers
	function handleFileUploaded(
		event: CustomEvent<{ documentId: string; documentKey: string; fileName: string }>
	) {
		const { documentId, documentKey } = event.detail;
		switch (documentKey) {
			case 'nationalIdFront':
				nationalIdFrontId = documentId;
				break;
			case 'nationalIdBack':
				nationalIdBackId = documentId;
				break;
			case 'passportPhoto':
				passportPhotoId = documentId;
				break;
			case 'latestPayslip':
				latestPayslipId = documentId;
				break;
			case 'previousPayslip':
				previousPayslipId = documentId;
				break;
			case 'postDatedCheque':
				postDatedChequeId = documentId;
				break;
		}
		clearError(documentKey);
	}

	function handleFileRemoved(event: CustomEvent<{ documentKey: string; documentId: string }>) {
		const { documentKey } = event.detail;
		switch (documentKey) {
			case 'nationalIdFront':
				nationalIdFrontId = '';
				break;
			case 'nationalIdBack':
				nationalIdBackId = '';
				break;
			case 'passportPhoto':
				passportPhotoId = '';
				break;
			case 'latestPayslip':
				latestPayslipId = '';
				break;
			case 'previousPayslip':
				previousPayslipId = '';
				break;
			case 'postDatedCheque':
				postDatedChequeId = '';
				break;
		}
	}

	// Handle form result
	$effect(() => {
		if (form?.success) {
			successLoanId = form.loanId || '';
			successMessage = form.message || 'Your loan application has been submitted successfully.';
			showSuccessModal = true;
		} else if (form && 'errors' in form && form.errors) {
			// Update local errors
			errors = { ...(form.errors as Record<string, string>) };

			// Scroll to the first error field
			const firstErrorField = (form as { firstErrorField?: string }).firstErrorField;
			if (firstErrorField) {
				// Map field names to step numbers for navigation
				const fieldToStep: Record<string, number> = {
					firstName: 1,
					middleName: 1,
					lastName: 1,
					email: 1,
					phoneNumber: 1,
					nationalId: 1,
					kraPin: 1,
					residentialAddress: 1,
					employerName: 2,
					employerBranch: 2,
					netSalary: 2,
					nextSalaryPayDate: 2,
					loanPurpose: 3,
					loanAmount: 3,
					disbursementMethod: 3,
					mpesaNumber: 3,
					bankName: 3,
					bankAccount: 3,
					accountName: 3,
					nationalIdFront: 4,
					nationalIdBack: 4,
					passportPhoto: 4,
					latestPayslip: 4,
					previousPayslip: 4,
					postDatedCheque: 4,
					digitalSignature: 5,
					termsAccepted: 5,
					dataUsageConsent: 5,
					legalDocumentConsent: 5,
					postDatedChequeConsent: 5
				};

				const targetStep = fieldToStep[firstErrorField];
				if (targetStep && targetStep !== currentStep) {
					currentStep = targetStep;
				}

				// Scroll to element after a short delay
				setTimeout(() => {
					const element =
						document.querySelector(`[name="${firstErrorField}"]`) ||
						document.getElementById(firstErrorField);
					if (element) {
						element.scrollIntoView({ behavior: 'smooth', block: 'center' });
						if (element instanceof HTMLInputElement) {
							element.focus();
						}
					}
				}, 100);
			}
		}
	});

	function handleModalClose() {
		showSuccessModal = false;
		// Clear all form data on successful submission
		clearFormData();
		goto('/');
	}

	// Clear all form data
	function clearFormData() {
		firstName = '';
		middleName = '';
		lastName = '';
		email = '';
		phoneNumber = '';
		nationalId = '';
		kraPin = '';
		residentialAddress = '';
		employerName = '';
		employerBranch = '';
		netSalary = '';
		nextSalaryPayDate = '';
		loanPurpose = '';
		loanAmount = '';
		disbursementMethod = 'mpesa';
		mpesaNumber = '';
		bankName = '';
		bankAccount = '';
		accountName = '';
		nationalIdFrontId = '';
		nationalIdBackId = '';
		passportPhotoId = '';
		latestPayslipId = '';
		previousPayslipId = '';
		postDatedChequeId = '';
		digitalSignature = '';
		termsAccepted = false;
		dataUsageConsent = false;
		legalDocumentConsent = false;
		postDatedChequeConsent = false;
		errors = {};
		warnings = {};
		currentStep = 1;

		// Clear localStorage
		if (typeof window !== 'undefined') {
			localStorage.removeItem(FORM_STORAGE_KEY);
		}
	}
</script>

<svelte:head>
	<title>{data.organization?.name || 'Loan'} Application</title>
</svelte:head>

{#if data.tokenState?.valid}
	<div class="flex h-screen flex-col bg-background">
		<!-- Header (fixed) -->
		<header class="shrink-0 bg-background/95 backdrop-blur">
			<div class="my-8 text-center">
				{#if data.organization?.name}
					<h1 class="mb-2 text-2xl font-bold tracking-tight text-foreground">
						{data.organization.name}
					</h1>
				{/if}
				<span
					class="rounded-2xl border border-dashed border-primary/10 bg-primary/10 p-2 text-primary"
					>Quick Simple Secure</span
				>
			</div>
		</header>

		<!-- Progress Steps (fixed) -->
		<div class="shrink-0">
			<div class="mx-auto max-w-3xl px-4 py-4">
				<div class="flex items-center justify-between">
					{#each steps as step, index}
						<button
							type="button"
							onclick={() => goToStep(step.id)}
							class="flex flex-col items-center gap-1.5 transition-colors"
							class:cursor-pointer={step.id <= currentStep}
							class:cursor-not-allowed={step.id > currentStep}
						>
							<div
								class="flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors {step.id >
								currentStep
									? 'border-muted-foreground/30'
									: ''}"
								class:border-primary={step.id === currentStep}
								class:bg-primary={step.id < currentStep}
								class:text-primary-foreground={step.id < currentStep}
								class:text-muted-foreground={step.id > currentStep}
							>
								<step.icon class="h-5 w-5" />
							</div>
						</button>
						{#if index < steps.length - 1}
							<div
								class="mx-2 h-0.5 flex-1 {step.id >= currentStep ? 'bg-muted-foreground/30' : ''}"
								class:bg-primary={step.id < currentStep}
							></div>
						{/if}
					{/each}
				</div>
			</div>
		</div>

		<!-- Form Content (scrollable) -->
		<main class="mb-18 min-h-0 flex-1 overflow-y-auto">
			<div class="mx-auto max-w-3xl px-4 py-6">
				<form
					method="POST"
					use:enhance={() => {
					
						isSubmitting = true;
						hasSubmitted = true;
						return async ({ result, update }) => {
							isSubmitting = false;

							// Handle success directly here instead of relying on $effect
							if (result.type === 'success' && result.data?.success) {
								// console.log('[apply/form] SUCCESS! Showing modal...');
								const data = result.data as { success: boolean; loanId?: string; message?: string };
								successLoanId = data.loanId || '';
								successMessage =
									data.message || 'Your loan application has been submitted successfully.';
								showSuccessModal = true;
								// Don't call update() on success - we want to show the modal
								return;
							}

							// For errors, update the form to show validation errors
							await update();
						};
					}}
					oninput={(e) => {
						const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
						if (target.name) {
							clearError(target.name);
						}
					}}
					class="space-y-6"
				>
					<!-- Hidden token field -->
					<input type="hidden" name="token" value={data.tokenState.token} />

					<!-- Hidden document IDs from realtime uploads -->
					<input type="hidden" name="nationalIdFront_id" value={nationalIdFrontId} />
					<input type="hidden" name="nationalIdBack_id" value={nationalIdBackId} />
					<input type="hidden" name="passportPhoto_id" value={passportPhotoId} />
					<input type="hidden" name="latestPayslip_id" value={latestPayslipId} />
					<input type="hidden" name="previousPayslip_id" value={previousPayslipId} />
					<input type="hidden" name="postDatedCheque_id" value={postDatedChequeId} />

					<!-- Step 1: Personal Information -->
					<div class="space-y-6" class:hidden={currentStep !== 1}>
						<div class="rounded-lg border bg-card p-6">
							<h2 class="mb-4 text-lg font-semibold text-foreground">Personal Information</h2>

							<div class="space-y-4">
								<!-- First Name -->
								<div>
									<label for="firstName" class="mb-1.5 block text-sm font-medium text-foreground">
										First Name <span class="text-destructive">*</span>
									</label>
									<input
										type="text"
										id="firstName"
										name="firstName"
										bind:value={firstName}
										placeholder="Enter first name"
										class="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
										class:border-destructive={getError('firstName')}
									/>
									{#if getError('firstName')}
										<p class="mt-1.5 text-sm text-destructive">{getError('firstName')}</p>
									{/if}
								</div>

								<!-- Middle Name -->
								<div>
									<label for="middleName" class="mb-1.5 block text-sm font-medium text-foreground">
										Middle Name
									</label>
									<input
										type="text"
										id="middleName"
										name="middleName"
										bind:value={middleName}
										placeholder="Enter middle name"
										class="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
									/>
								</div>

								<!-- Last Name -->
								<div>
									<label for="lastName" class="mb-1.5 block text-sm font-medium text-foreground">
										Last Name <span class="text-destructive">*</span>
									</label>
									<input
										type="text"
										id="lastName"
										name="lastName"
										bind:value={lastName}
										placeholder="Enter last name"
										class="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
										class:border-destructive={getError('lastName')}
									/>
									{#if getError('lastName')}
										<p class="mt-1.5 text-sm text-destructive">{getError('lastName')}</p>
									{/if}
								</div>

								<!-- Email -->
								<div>
									<label for="email" class="mb-1.5 block text-sm font-medium text-foreground">
										Email Address <span class="text-destructive">*</span>
									</label>
									<input
										type="email"
										id="email"
										name="email"
										bind:value={email}
										oninput={() => validateEmail(email)}
										placeholder="Enter email address"
										class="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
										class:border-destructive={getError('email')}
										class:border-yellow-500={getWarning('email')}
									/>
									{#if getError('email')}
										<p class="mt-1.5 text-sm text-destructive">{getError('email')}</p>
									{:else if getWarning('email')}
										<p class="mt-1.5 text-sm text-yellow-600">{getWarning('email')}</p>
									{/if}
								</div>

								<!-- Phone Number -->
								<div>
									<label for="phoneNumber" class="mb-1.5 block text-sm font-medium text-foreground">
										Phone Number <span class="text-destructive">*</span>
									</label>
									<input
										type="tel"
										id="phoneNumber"
										name="phoneNumber"
										bind:value={phoneNumber}
										oninput={() => validatePhone(phoneNumber)}
										placeholder="+254 712 345 678"
										class="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
										class:border-destructive={getError('phoneNumber')}
										class:border-yellow-500={getWarning('phoneNumber')}
									/>
									{#if getError('phoneNumber')}
										<p class="mt-1.5 text-sm text-destructive">{getError('phoneNumber')}</p>
									{:else if getWarning('phoneNumber')}
										<p class="mt-1.5 text-sm text-yellow-600">{getWarning('phoneNumber')}</p>
									{/if}
								</div>

								<!-- National ID -->
								<div>
									<label for="nationalId" class="mb-1.5 block text-sm font-medium text-foreground">
										National ID Number <span class="text-destructive">*</span>
									</label>
									<input
										type="text"
										id="nationalId"
										name="nationalId"
										bind:value={nationalId}
										oninput={() => validateNationalId(nationalId)}
										placeholder="Enter ID number"
										class="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
										class:border-destructive={getError('nationalId')}
										class:border-yellow-500={getWarning('nationalId')}
									/>
									{#if getError('nationalId')}
										<p class="mt-1.5 text-sm text-destructive">{getError('nationalId')}</p>
									{:else if getWarning('nationalId')}
										<p class="mt-1.5 text-sm text-yellow-600">{getWarning('nationalId')}</p>
									{/if}
								</div>

								<!-- KRA PIN -->
								<div>
									<label for="kraPin" class="mb-1.5 block text-sm font-medium text-foreground">
										KRA PIN <span class="text-destructive">*</span>
									</label>
									<input
										type="text"
										id="kraPin"
										name="kraPin"
										bind:value={kraPin}
										oninput={() => validateKraPin(kraPin)}
										placeholder="A000000000A"
										class="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground uppercase placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
										class:border-destructive={getError('kraPin')}
										class:border-yellow-500={getWarning('kraPin')}
									/>
									{#if getError('kraPin')}
										<p class="mt-1.5 text-sm text-destructive">{getError('kraPin')}</p>
									{:else if getWarning('kraPin')}
										<p class="mt-1.5 text-sm text-yellow-600">{getWarning('kraPin')}</p>
									{/if}
								</div>

								<!-- Residential Address -->
								<div>
									<label
										for="residentialAddress"
										class="mb-1.5 block text-sm font-medium text-foreground"
									>
										Residential Address <span class="text-destructive">*</span>
									</label>
									<textarea
										id="residentialAddress"
										name="residentialAddress"
										bind:value={residentialAddress}
										placeholder="Enter your full residential address"
										rows="3"
										class="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
										class:border-destructive={getError('residentialAddress')}
									></textarea>
									{#if getError('residentialAddress')}
										<p class="mt-1.5 text-sm text-destructive">{getError('residentialAddress')}</p>
									{/if}
								</div>
							</div>
						</div>
					</div>

					<!-- Step 2: Employment Details -->
					<div class="space-y-6" class:hidden={currentStep !== 2}>
						<div class="rounded-lg border bg-card p-6">
							<h2 class="mb-4 text-lg font-semibold text-foreground">Employment Details</h2>

							<div class="space-y-4">
								<!-- Employer Name -->
								<div>
									<label
										for="employerName"
										class="mb-1.5 block text-sm font-medium text-foreground"
									>
										Employer Name <span class="text-destructive">*</span>
									</label>
									<input
										type="text"
										id="employerName"
										name="employerName"
										bind:value={employerName}
										placeholder="Enter employer name"
										class="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
										class:border-destructive={getError('employerName')}
									/>
									{#if getError('employerName')}
										<p class="mt-1.5 text-sm text-destructive">{getError('employerName')}</p>
									{/if}
								</div>

								<!-- Employer Branch -->
								<div>
									<label
										for="employerBranch"
										class="mb-1.5 block text-sm font-medium text-foreground"
									>
										Employer Branch <span class="text-destructive">*</span>
									</label>
									<input
										type="text"
										id="employerBranch"
										name="employerBranch"
										bind:value={employerBranch}
										placeholder="Enter employer branch"
										class="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
										class:border-destructive={getError('employerBranch')}
									/>
									{#if getError('employerBranch')}
										<p class="mt-1.5 text-sm text-destructive">{getError('employerBranch')}</p>
									{/if}
								</div>

								<!-- Net Salary -->
								<div>
									<label for="netSalary" class="mb-1.5 block text-sm font-medium text-foreground">
										Net Salary <span class="text-destructive">*</span>
									</label>
									<div class="relative">
										<span
											class="absolute top-1/2 left-4 -translate-y-1/2 text-sm text-muted-foreground"
											>KES</span
										>
										<input
											type="number"
											id="netSalary"
											name="netSalary"
											bind:value={netSalary}
											placeholder="50000"
											min="0"
											class="w-full rounded-lg border border-input bg-background py-3 pr-4 pl-14 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
											class:border-destructive={getError('netSalary')}
										/>
									</div>
									{#if getError('netSalary')}
										<p class="mt-1.5 text-sm text-destructive">{getError('netSalary')}</p>
									{/if}
								</div>

								<!-- Next Salary Pay Date -->
								<div>
									<label
										for="nextSalaryPayDate"
										class="mb-1.5 block text-sm font-medium text-foreground"
									>
										Next Salary Pay Date <span class="text-destructive">*</span>
									</label>
									<input
										type="date"
										id="nextSalaryPayDate"
										name="nextSalaryPayDate"
										bind:value={nextSalaryPayDate}
										min={new Date().toISOString().split('T')[0]}
										max={maxSalaryDate()}
										class="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
										class:border-destructive={getError('nextSalaryPayDate')}
									/>
									{#if getError('nextSalaryPayDate')}
										<p class="mt-1.5 text-sm text-destructive">{getError('nextSalaryPayDate')}</p>
									{/if}
								</div>

								<!-- Loan Period Calculation -->
								{#if nextSalaryPayDate && loanPeriodDays() > 0}
									<div class="rounded-lg border border-border bg-muted/30 p-4">
										<div>
											<h4 class="font-medium text-foreground">Loan Period Calculation</h4>
											<p class="mt-1 text-sm text-muted-foreground">
												Based on your next salary date: <span class="font-semibold text-foreground"
													>{loanPeriodDays()} days</span
												>
											</p>
											<p class="mt-1 text-sm text-muted-foreground">
												Loan term: <span class="font-semibold text-foreground"
													>{loanPeriodDays()} Days</span
												>
												{#if data.loanSettings}
													— Interest rate: <span class="font-semibold text-foreground"
														>{(currentInterestRate() * 100).toFixed(0)}%</span
													>
													<span class="text-xs"
														>({loanPeriodDays() <= 15 ? '≤15 days rate' : '>15 days rate'})</span
													>
												{/if}
											</p>
										</div>
									</div>
								{:else if nextSalaryPayDate && loanPeriodDays() <= 0}
									<div class="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
										<div class="flex items-start gap-3">
											<AlertCircle class="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
											<div>
												<h4 class="font-medium text-destructive">Invalid Date</h4>
												<p class="mt-1 text-sm text-muted-foreground">
													Next salary pay date must be in the future.
												</p>
											</div>
										</div>
									</div>
								{/if}
							</div>
						</div>
					</div>

					<!-- Step 3: Loan Details -->
					<div class="space-y-6" class:hidden={currentStep !== 3}>
						<div class="rounded-lg border bg-card p-6">
							<h2 class="mb-4 text-lg font-semibold text-foreground">Loan Details</h2>

							<div class="space-y-4">
								<!-- Loan Purpose -->
								<div>
									<label for="loanPurpose" class="mb-1.5 block text-sm font-medium text-foreground">
										Loan Purpose <span class="text-destructive">*</span>
									</label>
									<select
										id="loanPurpose"
										name="loanPurpose"
										bind:value={loanPurpose}
										class="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
										class:border-destructive={getError('loanPurpose')}
									>
										<option value="">Select purpose</option>
										{#each loanPurposes as purpose}
											<option value={purpose.value}>{purpose.label}</option>
										{/each}
									</select>
									{#if getError('loanPurpose')}
										<p class="mt-1.5 text-sm text-destructive">{getError('loanPurpose')}</p>
									{/if}
								</div>

								<!-- Loan Amount -->
								<div>
									<label for="loanAmount" class="mb-1.5 block text-sm font-medium text-foreground">
										Loan Amount <span class="text-destructive">*</span>
									</label>
									<div class="relative">
										<span
											class="absolute top-1/2 left-4 -translate-y-1/2 text-sm text-muted-foreground"
											>KES</span
										>
										<input
											type="number"
											id="loanAmount"
											name="loanAmount"
											bind:value={loanAmount}
											placeholder="10000"
											min={data.loanSettings?.minLoanAmount || 1000}
											max={calculatedMaxLoan()}
											class="w-full rounded-lg border border-input bg-background py-3 pr-4 pl-14 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
											class:border-destructive={getError('loanAmount') ||
												loanAmountExceedsMax() ||
												loanAmountBelowMin()}
										/>
									</div>

									<!-- Max loan info -->
									{#if netSalary && calculatedMaxLoan() > 0 && data.loanSettings}
										<p class="mt-1.5 text-sm text-muted-foreground">
											Maximum loan amount is <span class="font-semibold"
												>KES {calculatedMaxLoan().toLocaleString()}</span
											>
											<span class="text-xs"
												>({(data.loanSettings.maxLoanPercentage * 100).toFixed(0)}% of your net
												salary)</span
											>
										</p>
									{/if}

									<!-- Warning if exceeds max -->
									{#if loanAmountExceedsMax()}
										<p class="mt-1.5 text-sm text-destructive">
											Loan amount exceeds maximum eligible amount of KES {calculatedMaxLoan().toLocaleString()}
										</p>
									{/if}

									<!-- Warning if below min -->
									{#if loanAmountBelowMin() && data.loanSettings}
										<p class="mt-1.5 text-sm text-destructive">
											Minimum loan amount is KES {data.loanSettings.minLoanAmount.toLocaleString()}
										</p>
									{/if}

									{#if getError('loanAmount')}
										<p class="mt-1.5 text-sm text-destructive">{getError('loanAmount')}</p>
									{/if}
								</div>

								<!-- Loan Summary -->
								{#if loanSummary() && !loanAmountExceedsMax() && !loanAmountBelowMin()}
									<div
										class="rounded-lg border border-primary/30 bg-linear-to-br from-primary/5 to-primary/10 p-5"
									>
										<h3
											class="mb-4 flex items-center gap-2 text-base font-semibold text-foreground"
										>
											<Info class="h-5 w-5 text-primary" />
											Loan Summary
										</h3>

										<div class="space-y-3 text-sm">
											<!-- Dates -->
											<div class="flex items-center justify-between border-b border-border/50 pb-2">
												<span class="text-muted-foreground">Application Date</span>
												<span class="font-medium text-foreground"
													>{loanSummary()?.applicationDate}</span
												>
											</div>
											<div class="flex items-center justify-between border-b border-border/50 pb-2">
												<div>
													<span class="text-muted-foreground">Due Date</span>
													<p class="text-xs text-amber-600 dark:text-amber-400">
														Repay on time to avoid daily penalties
													</p>
												</div>
												<span class="font-medium text-foreground">{loanSummary()?.dueDate}</span>
											</div>

											<!-- Amounts -->
											<div class="flex items-center justify-between">
												<span class="text-muted-foreground">Loan Amount</span>
												<span class="font-medium text-foreground"
													>KES {loanSummary()?.loanAmount.toLocaleString()}</span
												>
											</div>
											<div class="flex items-center justify-between">
												<span class="text-muted-foreground"
													>Interest ({(loanSummary()?.interestRate ?? 0) * 100}%)</span
												>
												<span class="font-medium text-foreground"
													>KES {loanSummary()?.interestAmount.toLocaleString()}</span
												>
											</div>
											<div class="flex items-center justify-between border-b border-border/50 pb-2">
												<span class="text-muted-foreground"
													>Processing Fee ({(loanSummary()?.processingFeeRate ?? 0) * 100}%)</span
												>
												<span class="font-medium text-foreground"
													>KES {loanSummary()?.processingFee.toLocaleString()}</span
												>
											</div>

											<!-- Total Repayment -->
											<div class="flex items-center justify-between pt-1">
												<span class="font-semibold text-foreground">Total Repayment</span>
												<span class="text-lg font-bold text-primary"
													>KES {loanSummary()?.totalRepayment.toLocaleString()}</span
												>
											</div>

											<!-- Disbursement -->
											<div class="mt-3 rounded-md bg-background/60 p-3">
												<div class="flex items-center justify-between">
													<div>
														<span class="font-medium text-foreground">Disbursement Amount:</span>
														<p class="text-xs text-muted-foreground">
															Processing fee deducted before disbursement.
														</p>
													</div>
													<span class="text-lg font-bold text-green-600 dark:text-green-400"
														>KES {loanSummary()?.disbursementAmount.toLocaleString()}</span
													>
												</div>
											</div>
										</div>
									</div>
								{/if}

								<!-- Disbursement Method -->
								<div>
									<label for="Disburse" class="mb-3 block text-sm font-medium text-foreground">
										Disbursement Method
									</label>
									<div class="grid grid-cols-2 gap-3">
										<button
											type="button"
											onclick={() => (disbursementMethod = 'mpesa')}
											class="rounded-lg border-2 p-4 text-center transition-colors {disbursementMethod ===
											'mpesa'
												? 'border-primary bg-primary/5'
												: 'border-input'}"
										>
											<span class="font-medium text-foreground">M-Pesa</span>
										</button>
										<button
											type="button"
											onclick={() => (disbursementMethod = 'bank_transfer')}
											class="rounded-lg border-2 p-4 text-center transition-colors {disbursementMethod ===
											'bank_transfer'
												? 'border-primary bg-primary/5'
												: 'border-input'}"
										>
											<span class="font-medium text-foreground">Bank Transfer</span>
										</button>
									</div>
									<input type="hidden" name="disbursementMethod" value={disbursementMethod} />
								</div>

								<!-- M-Pesa Number -->
								{#if disbursementMethod === 'mpesa'}
									<div>
										<label
											for="mpesaNumber"
											class="mb-1.5 block text-sm font-medium text-foreground"
										>
											M-Pesa Number <span class="text-destructive">*</span>
										</label>
										<input
											type="tel"
											id="mpesaNumber"
											name="mpesaNumber"
											bind:value={mpesaNumber}
											placeholder="+254 712 345 678"
											class="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
											class:border-destructive={getError('mpesaNumber')}
										/>
										{#if getError('mpesaNumber')}
											<p class="mt-1.5 text-sm text-destructive">{getError('mpesaNumber')}</p>
										{/if}
									</div>
								{/if}

								<!-- Bank Details -->
								{#if disbursementMethod === 'bank_transfer'}
									<div class="space-y-4">
										<div>
											<label
												for="bankName"
												class="mb-1.5 block text-sm font-medium text-foreground"
											>
												Bank Name <span class="text-destructive">*</span>
											</label>
											<input
												type="text"
												id="bankName"
												name="bankName"
												bind:value={bankName}
												placeholder="Enter bank name"
												class="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
												class:border-destructive={getError('bankName')}
											/>
											{#if getError('bankName')}
												<p class="mt-1.5 text-sm text-destructive">{getError('bankName')}</p>
											{/if}
										</div>

										<div>
											<label
												for="bankAccount"
												class="mb-1.5 block text-sm font-medium text-foreground"
											>
												Account Number <span class="text-destructive">*</span>
											</label>
											<input
												type="text"
												id="bankAccount"
												name="bankAccount"
												bind:value={bankAccount}
												placeholder="Enter account number"
												class="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
												class:border-destructive={getError('bankAccount')}
											/>
											{#if getError('bankAccount')}
												<p class="mt-1.5 text-sm text-destructive">{getError('bankAccount')}</p>
											{/if}
										</div>

										<div>
											<label
												for="accountName"
												class="mb-1.5 block text-sm font-medium text-foreground"
											>
												Account Name <span class="text-destructive">*</span>
											</label>
											<input
												type="text"
												id="accountName"
												name="accountName"
												bind:value={accountName}
												placeholder="Enter account name"
												class="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
												class:border-destructive={getError('accountName')}
											/>
											{#if getError('accountName')}
												<p class="mt-1.5 text-sm text-destructive">{getError('accountName')}</p>
											{/if}
										</div>
									</div>
								{/if}
							</div>
						</div>
					</div>

					<!-- Step 4: Required Documents -->
					<div class="space-y-6" class:hidden={currentStep !== 4}>
						<div class="rounded-lg border bg-card p-6">
							<h2 class="mb-4 text-lg font-semibold text-foreground">Required Documents</h2>
							

							<!-- Upload Guide -->
							<DocumentUploadGuide />

							<div class="grid gap-6 md:grid-cols-2">
								<!-- National ID Front -->
								<div>
									<label for="ID" class="mb-1.5 block text-sm font-medium text-foreground">
										National ID (Front) <span class="text-destructive">*</span>
									</label>
									<p class="mb-2 text-xs text-muted-foreground">
										Clear photo of the front of your National ID
									</p>
									<DocumentUpload
										documentKey="nationalIdFront"
										label="National ID (Front)"
										accept="image/jpeg,image/png,image/webp,application/pdf"
										required={true}
										uploadedDocumentId={nationalIdFrontId}
										{hasSubmitted}
										on:fileUploaded={handleFileUploaded}
										on:fileRemoved={handleFileRemoved}
									/>
									{#if getError('nationalIdFront')}
										<p class="mt-1.5 text-sm text-destructive">{getError('nationalIdFront')}</p>
									{/if}
								</div>

								<!-- National ID Back -->
								<div>
									<label for="National" class="mb-1.5 block text-sm font-medium text-foreground">
										National ID (Back) <span class="text-destructive">*</span>
									</label>
									<p class="mb-2 text-xs text-muted-foreground">
										Clear photo of the back of your National ID
									</p>
									<DocumentUpload
										documentKey="nationalIdBack"
										label="National ID (Back)"
										accept="image/jpeg,image/png,image/webp,application/pdf"
										required={true}
										uploadedDocumentId={nationalIdBackId}
										{hasSubmitted}
										on:fileUploaded={handleFileUploaded}
										on:fileRemoved={handleFileRemoved}
									/>
									{#if getError('nationalIdBack')}
										<p class="mt-1.5 text-sm text-destructive">{getError('nationalIdBack')}</p>
									{/if}
								</div>

								<!-- Passport Photo -->
								<div>
									<label for="Photo" class="mb-1.5 block text-sm font-medium text-foreground">
										Passport Photo <span class="text-destructive">*</span>
									</label>
									<p class="mb-2 text-xs text-muted-foreground">
										Clear selfie or passport-style photo
									</p>
									<DocumentUpload
										documentKey="passportPhoto"
										label="Passport Photo"
										accept="image/jpeg,image/png,image/webp,application/pdf"
										required={true}
										uploadedDocumentId={passportPhotoId}
										{hasSubmitted}
										on:fileUploaded={handleFileUploaded}
										on:fileRemoved={handleFileRemoved}
									/>
									{#if getError('passportPhoto')}
										<p class="mt-1.5 text-sm text-destructive">{getError('passportPhoto')}</p>
									{/if}
								</div>

								<!-- Latest Payslip -->
								<div>
									<label for="payslip" class="mb-1.5 block text-sm font-medium text-foreground">
										Latest Payslip <span class="text-destructive">*</span>
									</label>
									<p class="mb-2 text-xs text-muted-foreground">
										PDF or clear photo of current month payslip
									</p>
									<DocumentUpload
										documentKey="latestPayslip"
										label="Latest Payslip"
										accept="image/jpeg,image/png,image/webp,application/pdf"
										required={true}
										uploadedDocumentId={latestPayslipId}
										{hasSubmitted}
										on:fileUploaded={handleFileUploaded}
										on:fileRemoved={handleFileRemoved}
									/>
									{#if getError('latestPayslip')}
										<p class="mt-1.5 text-sm text-destructive">{getError('latestPayslip')}</p>
									{/if}
								</div>

								<!-- Previous Payslip -->
								<div>
									<label for="payslip" class="mb-1.5 block text-sm font-medium text-foreground">
										Previous Payslip <span class="text-destructive">*</span>
									</label>
									<p class="mb-2 text-xs text-muted-foreground">
										PDF or clear photo of previous month payslip
									</p>
									<DocumentUpload
										documentKey="previousPayslip"
										label="Previous Payslip"
										accept="image/jpeg,image/png,image/webp,application/pdf"
										required={true}
										uploadedDocumentId={previousPayslipId}
										{hasSubmitted}
										on:fileUploaded={handleFileUploaded}
										on:fileRemoved={handleFileRemoved}
									/>
									{#if getError('previousPayslip')}
										<p class="mt-1.5 text-sm text-destructive">{getError('previousPayslip')}</p>
									{/if}
								</div>

								<!-- Post-Dated Cheque -->
								<div>
									<p class="mb-1.5 block text-sm font-medium text-foreground">
										Post-Dated Cheque <span class="text-destructive">*</span>
									</p>
									<p class="mb-2 text-xs text-muted-foreground">
										Photo of a signed post-dated cheque
									</p>
									<DocumentUpload
										documentKey="postDatedCheque"
										label="Post-Dated Cheque"
										accept="image/jpeg,image/png,image/webp,application/pdf"
										required={true}
										uploadedDocumentId={postDatedChequeId}
										{hasSubmitted}
										on:fileUploaded={handleFileUploaded}
										on:fileRemoved={handleFileRemoved}
									/>
									{#if getError('postDatedCheque')}
										<p class="mt-1.5 text-sm text-destructive">{getError('postDatedCheque')}</p>
									{/if}
								</div>
							</div>
						</div>
					</div>

					<!-- Step 5: Agreement -->
					<div class="space-y-6" class:hidden={currentStep !== 5}>
						<div class="rounded-lg border bg-card p-6">
							<h2 class="mb-4 text-lg font-semibold text-foreground">Agreement</h2>

							<div class="space-y-6">
								<!-- Digital Signature -->
								<div>
									<label
										for="digitalSignature"
										class="mb-1.5 block text-sm font-medium text-foreground"
									>
										Digital Signature <span class="text-destructive">*</span>
									</label>
									<p class="mb-2 text-xs text-muted-foreground">
										Please enter your first name only as your digital signature.
									</p>
									<input
										type="text"
										id="digitalSignature"
										name="digitalSignature"
										bind:value={digitalSignature}
										placeholder="Your first name"
										class="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
										class:border-destructive={getError('digitalSignature')}
									/>
									<p class="mt-1.5 text-xs text-muted-foreground">
										By typing your name, you agree to sign electronically. For verification, this
										should match your first name.
									</p>
									{#if digitalSignature && firstName}
										{#if digitalSignature.trim().toLowerCase() === firstName.trim().toLowerCase()}
											<p class="mt-1.5 text-sm text-green-600">✓ Signature verified</p>
										{:else}
											<p class="mt-1.5 text-sm text-red-600">✗ Signature does not match</p>
										{/if}
									{/if}

									{#if getError('digitalSignature')}
										<p class="mt-1.5 text-sm text-destructive">{getError('digitalSignature')}</p>
									{/if}
								</div>

								<!-- Consent Checkboxes -->
								<div class="space-y-4 border-t pt-4">
									<!-- Terms and Conditions -->
									<label class="flex cursor-pointer items-start gap-3">
										<input
											type="checkbox"
											name="termsAccepted"
											bind:checked={termsAccepted}
											class="mt-0.5 h-5 w-5 rounded border-input text-primary focus:ring-primary/20"
										/>
										<span class="text-sm text-foreground">
											I agree to the loan terms and conditions, understand the repayment
											obligations, and confirm that I have provided a valid post-dated cheque. <span
												class="text-destructive">*</span
											>
										</span>
									</label>
									{#if getError('termsAccepted')}
										<p class="ml-8 text-sm text-destructive">{getError('termsAccepted')}</p>
									{/if}

									<!-- Data Usage Consent -->
									<label class="flex cursor-pointer items-start gap-3">
										<input
											type="checkbox"
											name="dataUsageConsent"
											bind:checked={dataUsageConsent}
											class="mt-0.5 h-5 w-5 rounded border-input text-primary focus:ring-primary/20"
										/>
										<span class="text-sm text-foreground">
											I consent to the processing of my personal data for this loan application. <span
												class="text-destructive">*</span
											>
										</span>
									</label>
									{#if getError('dataUsageConsent')}
										<p class="ml-8 text-sm text-destructive">{getError('dataUsageConsent')}</p>
									{/if}

									<!-- Legal Document Consent -->
									<label class="flex cursor-pointer items-start gap-3">
										<input
											type="checkbox"
											name="legalDocumentConsent"
											bind:checked={legalDocumentConsent}
											class="mt-0.5 h-5 w-5 rounded border-input text-primary focus:ring-primary/20"
										/>
										<span class="text-sm text-foreground">
											I confirm that all information provided is true and accurate, and that my
											post-dated cheque is valid and will be honored by my bank. <span
												class="text-destructive">*</span
											>
										</span>
									</label>
									{#if getError('legalDocumentConsent')}
										<p class="ml-8 text-sm text-destructive">{getError('legalDocumentConsent')}</p>
									{/if}

									<!-- Post-Dated Cheque Consent -->
									<label class="flex cursor-pointer items-start gap-3">
										<input
											type="checkbox"
											name="postDatedChequeConsent"
											bind:checked={postDatedChequeConsent}
											class="mt-0.5 h-5 w-5 rounded border-input text-primary focus:ring-primary/20"
										/>
										<span class="text-sm text-foreground">
											I acknowledge that failure to honor the post-dated cheque may result in legal
											action and reporting to credit reference bureaus. <span
												class="text-destructive">*</span
											>
										</span>
									</label>
									{#if getError('postDatedChequeConsent')}
										<p class="ml-8 text-sm text-destructive">
											{getError('postDatedChequeConsent')}
										</p>
									{/if}
								</div>
								<div class="text-left">
									<button
										type="button"
										onclick={() => (showTermsDialog = true)}
										class="text-sm text-primary hover:underline"
									>
										View full terms and conditions
									</button>
								</div>
							</div>
						</div>

						<!-- Submit Error -->
						{#if getError('submit')}
							<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
								<div class="flex items-center gap-2 text-destructive">
									<AlertCircle class="h-5 w-5 shrink-0" />
									<p class="text-sm font-medium">{getError('submit')}</p>
								</div>
							</div>
						{/if}
					</div>

					<!-- Navigation Buttons -->
					<div class="flex items-center justify-between gap-4 pt-4">
						<div class="flex gap-2">
							{#if currentStep > 1}
								<button
									type="button"
									onclick={prevStep}
									class="flex items-center gap-2 rounded-lg border border-input px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
								>
									<ChevronLeft class="h-4 w-4" />
									Previous
								</button>
							{/if}

							<button
								type="button"
								onclick={clearFormData}
								class="rounded-lg border border-destructive/50 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
							>
								Reset Form
							</button>
						</div>

						{#if currentStep < totalSteps}
							<button
								type="button"
								onclick={nextStep}
								disabled={!validateStep(currentStep)}
								class="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
							>
								Next
								<ChevronRight class="h-4 w-4" />
							</button>
						{:else}
							<button
								type="submit"
								disabled={isSubmitting || !validateStep(currentStep)}
								class="flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{#if isSubmitting}
									<Loader class="h-4 w-4 animate-spin" />
									Submitting...
								{:else}
									Submit Application
								{/if}
							</button>
						{/if}
					</div>
				</form>
			</div>
		</main>
	</div>

	{#if showTermsDialog}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			onclick={() => (showTermsDialog = false)}
			onkeydown={(e) => {
				if (e.key === 'Escape') showTermsDialog = false;
			}}
			role="dialog"
			aria-modal="true"
			aria-labelledby="terms-title"
			tabindex="-1"
		>
			<div
				class="relative max-h-[75vh] w-full max-w-2xl overflow-auto rounded-lg border border-border bg-white p-4 dark:bg-black"
				role="dialog"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => {
					if (e.key === 'Escape') {
						showTermsDialog = false;
					}
				}}
				tabindex="-1"
			>
				<!-- Close Button -->
				<button
					type="button"
					onclick={() => (showTermsDialog = false)}
					class="absolute top-4 right-4 rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:ring-2 focus:ring-primary focus:outline-none dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
					aria-label="Close terms and conditions"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>

				<div class="prose prose-sm max-w-none space-y-4 px-4 py-6 text-accent-foreground">
					<h1 class="text-center text-xl font-bold underline">Terms and Conditions.</h1>
					<section>
						<h2 class="text-sm font-semibold">1. LOAN AGREEMENT</h2>
						<p>
							This loan agreement is between {data.organization?.name} and the borrower. By accepting
							this loan, you agree to repay the full amount plus interest within the specified term, from
							the date of disbursement.
						</p>
					</section>

					<section>
						<h2 class="text-sm font-semibold">2. INTEREST RATES</h2>
						<p>
							Interest rates are fixed as advised at the time of application and cannot be changed
							during the loan term. Current rates:
						</p>
						<ul class="ml-6 list-disc">
							<li>
								15-day loans: {(data.loanSettings.interestRate15Days * 100).toFixed(1)}% of loan
								amount
							</li>
							<li>
								30-day loans: {(data.loanSettings.interestRate30Days * 100).toFixed(1)}% of loan
								amount
							</li>
						</ul>
					</section>

					<section>
						<h2 class="text-sm font-semibold">3. PROCESSING FEE</h2>
						<p>
							A processing fee of {(data.loanSettings.processingFeeRate * 100).toFixed(1)}% will be
							deducted from the loan amount at disbursement. This fee covers administrative costs
							and is non-refundable.
						</p>
					</section>

					<section>
						<h2 class="text-sm font-semibold">4. REPAYMENT</h2>
						<p>
							Full repayment is due on the due date specified in your loan agreement. Early
							repayment is allowed without penalty.
						</p>
					</section>

					<section>
						<h2 class="text-sm font-semibold">5. LATE PAYMENT PENALTIES</h2>
						<p>
							A grace period of 2 days is provided after the due date. After the grace period ends,
							late payments will attract penalties of 2% per day until full repayment is made.
							Penalties are calculated on the outstanding balance.
						</p>
					</section>

					<section>
						<h2 class="text-sm font-semibold">6. DEFAULT</h2>
						<p>
							Failure to repay within {data.loanSettings.gracePeriodDays +
								data.loanSettings.penaltyPeriodDays} days of the due date constitutes default and may
							result in legal action.
						</p>
					</section>

					<section>
						<h2 class="text-sm font-semibold">7. LOAN LIMITS</h2>
						<p>Loan amounts are subject to the following limits:</p>
						<ul class="ml-6 list-disc">
							<li>Minimum loan amount: KES {data.loanSettings.minLoanAmount.toLocaleString()}</li>
							<li>Maximum loan amount: KES {data.loanSettings.maxLoanAmount.toLocaleString()}</li>
							<li>
								Maximum loan percentage of net salary: {(
									data.loanSettings.maxLoanPercentage * 100
								).toFixed(0)}%
							</li>
						</ul>
					</section>

					<section>
						<h2 class="text-sm font-semibold">8. DATA PROTECTION</h2>
						<p>
							Your personal information will be protected according to applicable data protection
							laws. {data.organization?.name} is committed to maintaining the confidentiality and security
							of your personal data.
						</p>
					</section>

					<section>
						<h2 class="text-sm font-semibold">9. DISPUTE RESOLUTION</h2>
						<p>
							Any disputes arising from this agreement will be resolved through arbitration in
							Kenya, under the Arbitration Act. The place of arbitration shall be Nairobi, Kenya.
						</p>
					</section>

					<section>
						<h2 class="text-sm font-semibold">10. CONSENT AND AGREEMENT</h2>
						<p>
							By e-signing this agreement, you acknowledge that you have read, understood, and agree
							to these terms. You also confirm that:
						</p>
						<ul class="ml-6 list-disc">
							<li>All information provided is true and accurate</li>
							<li>You understand the repayment obligations</li>
							<li>You have the authority to issue the post-dated cheque</li>
							<li>You consent to the processing of your personal data</li>
						</ul>
					</section>
				</div>
			</div>
		</div>
	{/if}

	<!-- Success Modal -->
	<SuccessModal
		isOpen={showSuccessModal}
		onClose={handleModalClose}
		title="Application Submitted!"
		message={successMessage}
		loanId={successLoanId}
	/>
{/if}
