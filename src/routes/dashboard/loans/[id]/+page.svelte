<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { getLoanById, type LoanWithRelations } from '$lib/core/loans/loan_service';
	import { getLoanPayments, type PaymentWithRelations } from '$lib/core/loans/payment_service';
	import { getEmailLogsForLoan } from '$lib/services/email/logs';
	import { getWorkflowStatus } from '$lib/core/loans/workflow_status';
	import { session, sessionHasPermission } from '$lib/store/session.svelte';
	import { formatDate, formatDateTime, formatDueStatus } from '$lib/shared/date_time';
	import { formatKES } from '$lib/shared/currency';
	import { LoansStatusOptions, type EmailLogsResponse } from '$lib/types';
	import { Permission } from '$lib/services/roles/permissions';
	import { toast } from 'svelte-sonner';
	import type { ActionData } from './$types';
	import type { PageData } from './$types';

	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import CheckIcon from '@lucide/svelte/icons/check';
	import XCircleIcon from '@lucide/svelte/icons/x-circle';
	import SendIcon from '@lucide/svelte/icons/send';
	import CreditCardIcon from '@lucide/svelte/icons/credit-card';
	import PercentIcon from '@lucide/svelte/icons/percent';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import BanknoteIcon from '@lucide/svelte/icons/banknote';
	import UserIcon from '@lucide/svelte/icons/user';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import MailIcon from '@lucide/svelte/icons/mail';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
	import CircleIcon from '@lucide/svelte/icons/circle';
	import CircleDotIcon from '@lucide/svelte/icons/circle-dot';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	// Local state
	let loan = $state<LoanWithRelations | null>(null);
	let payments = $state<PaymentWithRelations[]>([]);
	let emails = $state<EmailLogsResponse[]>([]);
	let isLoading = $state(false);

	// Dialog states
	let showApproveDialog = $state(false);
	let showRejectDialog = $state(false);
	let showPaymentDialog = $state(false);
	let showWaiverDialog = $state(false);
	let showDefaultDialog = $state(false);
	let showEmailDialog = $state(false);
	let showDisburseDialog = $state(false);

	// Form states
	let isProcessing = $state(false);
	let approveAmount = $state(0);
	let rejectReason = $state('');
	let paymentAmount = $state(0);
	let paymentMethod = $state<string>('mpesa');
	let transactionRef = $state('');
	let paymentNotes = $state('');
	let disburseTransactionRef = $state('');
	let disburseNotes = $state('');
	let waiverAmount = $state(0);
	let waiverReason = $state('');
	let defaultReason = $state('');
	let emailSubject = $state('');
	let emailBody = $state('');

	// Derived values
	let businessCode = 'dashboard';
	let workflowInfo = $derived(loan ? getWorkflowStatus(loan) : null);
	let dueStatus = $derived(loan ? formatDueStatus(loan.due_date) : null);
	let customer = $derived(loan?.expand?.customer);

	// Permissions
	let canApprove = $derived(sessionHasPermission(Permission.LOANS_APPROVE));
	let canReject = $derived(sessionHasPermission(Permission.LOANS_REJECT));
	let canDisburse = $derived(sessionHasPermission(Permission.LOANS_DISBURSE));
	let canRecordPayment = $derived(sessionHasPermission(Permission.PAYMENTS_CREATE));
	let canUpdateLoan = $derived(sessionHasPermission(Permission.LOANS_UPDATE));

	// Sync state from page data
	$effect(() => {
		loan = data.loan;
		payments = (data.payments || []) as PaymentWithRelations[];
		emails = data.emails || [];
		if (data.loan) {
			approveAmount = data.loan.loan_amount || 0;
		}
	});

	// Navigate back to loans list
	function goBack() {
		goto(`/${businessCode}/loans`);
	}

	// Refresh loan data
	async function refreshLoan() {
		if (!loan) return;
		isLoading = true;
		try {
			const permissions = session.permissions || [];
			const [updatedLoan, updatedPayments, updatedEmails] = await Promise.all([
				getLoanById(loan.id),
				getLoanPayments(loan.id, permissions),
				getEmailLogsForLoan(loan.id)
			]);
			loan = updatedLoan;
			payments = updatedPayments as PaymentWithRelations[];
			emails = updatedEmails;
			approveAmount = updatedLoan.loan_amount || 0;
		} catch (error) {
			console.error('Failed to refresh loan:', error);
			toast.error('Failed to refresh loan data');
		} finally {
			isLoading = false;
		}
	}

	// Reset all forms
	function resetForms() {
		rejectReason = '';
		paymentAmount = 0;
		paymentMethod = 'mpesa';
		transactionRef = '';
		paymentNotes = '';
		disburseTransactionRef = '';
		disburseNotes = '';
		waiverAmount = 0;
		waiverReason = '';
		defaultReason = '';
		emailSubject = '';
		emailBody = '';
	}

	// Workflow actions - these now use enhanced form submissions
	function handleApproveSubmit() {
		if (!loan) return false;
		isProcessing = true;
		return true;
	}

	function handleRejectSubmit() {
		if (!loan || !rejectReason.trim()) return false;
		isProcessing = true;
		return true;
	}

	function handleDisburseSubmit() {
		if (!loan) return false;
		isProcessing = true;
		return true;
	}

	function handleRecordPaymentSubmit() {
		if (!loan || paymentAmount <= 0) return false;
		isProcessing = true;
		return true;
	}

	function handleWaivePenaltySubmit() {
		if (!loan || waiverAmount <= 0 || !waiverReason.trim()) return false;
		isProcessing = true;
		return true;
	}

	function handleMarkDefaultedSubmit() {
		if (!loan || !defaultReason.trim()) return false;
		isProcessing = true;
		return true;
	}

	async function handleSendEmail() {
		// This is now handled by form action
		// Validation is done before form submit
		if (!loan || !customer || !emailSubject.trim() || !emailBody.trim()) {
			toast.error('Please fill in all fields');
			return false;
		}
		isProcessing = true;
		return true;
	}

	// Status badge helpers
	function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'pending':
				return 'secondary';
			case 'approved':
				return 'outline';
			case 'disbursed':
				return 'default';
			case 'partially_paid':
				return 'default';
			case 'repaid':
				return 'default';
			case 'defaulted':
				return 'destructive';
			case 'rejected':
				return 'destructive';
			default:
				return 'outline';
		}
	}

	function getStatusLabel(status: string): string {
		const labels: Record<string, string> = {
			pending: 'Pending Review',
			approved: 'Approved',
			disbursed: 'Active',
			partially_paid: 'Partially Paid',
			repaid: 'Completed',
			defaulted: 'Defaulted',
			rejected: 'Rejected'
		};
		return labels[status] || status;
	}

	// Workflow steps
	const workflowSteps = [
		{ id: 1, name: 'Application', description: 'Loan submitted' },
		{ id: 2, name: 'Review', description: 'Pending approval' },
		{ id: 3, name: 'Disbursement', description: 'Funds released' },
		{ id: 4, name: 'Repayment', description: 'Active loan' },
		{ id: 5, name: 'Completed', description: 'Fully repaid' }
	];

	function getStepStatus(stepId: number) {
		if (!loan || !workflowInfo) return 'pending';

		const status = loan.status as LoansStatusOptions;

		if (status === LoansStatusOptions.rejected) {
			return stepId <= 2 ? (stepId === 2 ? 'rejected' : 'complete') : 'pending';
		}
		if (status === LoansStatusOptions.defaulted) {
			return stepId <= 4 ? 'complete' : 'defaulted';
		}

		const stepMap: Record<string, number> = {
			pending: 2,
			approved: 2,
			disbursed: 4,
			partially_paid: 4,
			repaid: 5
		};

		const currentStep = stepMap[status] || 1;

		if (stepId < currentStep) return 'complete';
		if (stepId === currentStep) return 'current';
		return 'pending';
	}
</script>

<svelte:head>
	<title>Loan {loan?.loan_number || ''} | inuaquicklink</title>
	<meta name="description" content="Loan details and management" />
</svelte:head>

<div class="flex flex-col gap-6 py-4">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="icon" onclick={goBack}>
				<ArrowLeftIcon class="h-5 w-5" />
			</Button>
			<div>
				{#if loan}
					<div class="flex items-center gap-3">
						<div class="flex">
							<h1 class="rounded-2xl border px-2 font-mono text-sm tracking-tight">
								{loan.loan_number}
							</h1>
						</div>

						<Badge variant={getStatusVariant(loan.status || 'pending')} class="text-sm">
							{getStatusLabel(loan.status || 'pending')}
						</Badge>
					</div>
				{:else}
					<Skeleton class="h-8 w-48" />
					<Skeleton class="mt-1 h-4 w-32" />
				{/if}
			</div>
		</div>

		<!-- Action Buttons -->
		{#if loan && workflowInfo}
			<div class="flex flex-wrap gap-2">
				{#if workflowInfo.canApprove && canApprove}
					<Button onclick={() => (showApproveDialog = true)} size="sm">
						<CheckIcon class="mr-2 h-4 w-4" />
						Approve
					</Button>
					<Button onclick={() => (showRejectDialog = true)} variant="destructive" size="sm">
						<XCircleIcon class="mr-2 h-4 w-4" />
						Reject
					</Button>
				{/if}

				{#if workflowInfo.canDisburse && canDisburse}
					<Button onclick={() => (showDisburseDialog = true)} size="sm">
						<SendIcon class="mr-2 h-4 w-4" />
						Disburse Funds
					</Button>
				{/if}

				{#if workflowInfo.canRecordPayment && canRecordPayment}
					<Button onclick={() => (showPaymentDialog = true)} size="sm">
						<CreditCardIcon class="mr-2 h-4 w-4" />
						Record Payment
					</Button>
				{/if}

				{#if customer}
					<Button onclick={() => (showEmailDialog = true)} variant="outline" size="sm">
						<MailIcon class="mr-2 h-4 w-4" />
						Send Email
					</Button>
				{/if}

				{#if workflowInfo.canWaivePenalty && canUpdateLoan}
					<Button onclick={() => (showWaiverDialog = true)} variant="outline" size="sm">
						<PercentIcon class="mr-2 h-4 w-4" />
						Waive Penalty
					</Button>
				{/if}

				{#if workflowInfo.canMarkDefaulted && canUpdateLoan}
					<Button
						onclick={() => (showDefaultDialog = true)}
						variant="outline"
						size="sm"
						class="hover:text-destructive-foreground border-destructive text-destructive hover:bg-destructive"
					>
						<AlertTriangleIcon class="mr-2 h-4 w-4" />
						Mark Defaulted
					</Button>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Workflow Stepper -->
	{#if loan}
		<Card.Root>
			<Card.Content>
				<div class="relative">
					<div class="flex items-center justify-between">
						{#each workflowSteps as step, i (step.id)}
							{@const status = getStepStatus(step.id)}
							<div class="relative z-10 flex flex-col items-center">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full border-2
									{status === 'complete' ? 'border-primary bg-primary text-primary-foreground' : ''}
									{status === 'current' ? 'border-primary bg-background text-primary' : ''}
									{status === 'pending' ? 'border-muted bg-background text-muted-foreground' : ''}
									{status === 'rejected' ? 'text-destructive-foreground border-destructive bg-destructive' : ''}
									{status === 'defaulted' ? 'text-destructive-foreground border-destructive bg-destructive' : ''}
								"
								>
									{#if status === 'complete'}
										<CheckCircleIcon class="h-5 w-5" />
									{:else if status === 'current'}
										<CircleDotIcon class="h-5 w-5" />
									{:else if status === 'rejected' || status === 'defaulted'}
										<XCircleIcon class="h-5 w-5" />
									{:else}
										<CircleIcon class="h-5 w-5" />
									{/if}
								</div>
								<span
									class="hidden text-center text-xs font-medium sm:block
									{status === 'current' ? 'text-primary' : 'text-muted-foreground'}
								"
								>
									{step.name}
								</span>
							</div>
							{#if i < workflowSteps.length - 1}
								<div
									class="mx-2 h-0.5 flex-1
									{getStepStatus(step.id) === 'complete' ? 'bg-primary' : 'bg-muted'}
								"
								></div>
							{/if}
						{/each}
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Main Content -->
	<div class="grid gap-6 lg:grid-cols-3">
		<div class="space-y-6">
			{#if loan}
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<UserIcon class="h-5 w-5" />
							Customer Details
						</Card.Title>
					</Card.Header>
					<Card.Content>
						<div class="gap-4">
							<div class="space-y-3">
								<div class="flex justify-between">
									<span class="text-sm text-muted-foreground">Name</span>
									<span class="font-medium">{customer?.name || 'N/A'}</span>
								</div>
								<div class="flex justify-between">
									<span class="text-sm text-muted-foreground">Phone</span>
									<span>{customer?.phone || 'N/A'}</span>
								</div>
								<div class="flex justify-between">
									<span class="text-sm text-muted-foreground">Email</span>
									<span class="text-xs">{customer?.email || 'N/A'}</span>
								</div>
								<div class="flex justify-between">
									<span class="text-sm text-muted-foreground">Employer</span>
									<span>{customer?.employer_name || 'N/A'}</span>
								</div>
								<div class="flex justify-between">
									<span class="text-sm text-muted-foreground">Net Salary</span>
									<span>{formatKES(customer?.net_salary || 0)}</span>
								</div>
							</div>
						</div>
					</Card.Content>
				</Card.Root>

				<!-- Dates -->
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<CalendarIcon class="h-5 w-5" />
							Important Dates
						</Card.Title>
					</Card.Header>
					<Card.Content>
						<div class="gap-4">
							<div class="space-y-3">
								<div class="flex justify-between">
									<span class="text-sm text-muted-foreground">Application Date</span>
									<span>{loan.application_date ? formatDate(loan.application_date) : 'N/A'}</span>
								</div>
								{#if loan.disbursement_date && loan.status !== 'pending' && loan.status !== 'rejected'}
									<div class="flex justify-between">
										<span class="text-sm text-muted-foreground">Disbursed On</span>
										<span>{formatDate(loan.disbursement_date)}</span>
									</div>
								{/if}
								{#if loan.status !== 'pending' && loan.status !== 'rejected'}
									<div class="flex justify-between">
										<span class="text-sm text-muted-foreground">Due Date</span>
										<span class={dueStatus?.isOverdue ? 'font-medium text-destructive' : ''}>
											{formatDate(loan.due_date)}
										</span>
									</div>
									{#if dueStatus}
										<div class="flex justify-between">
											<span class="text-sm text-muted-foreground">Status</span>
											<span
												class={dueStatus.isOverdue ? 'text-destructive' : 'text-muted-foreground'}
											>
												{dueStatus.text}
											</span>
										</div>
									{/if}
								{/if}
								<div class="flex justify-between">
									<span class="text-sm text-muted-foreground">Loan Period</span>
									<span>{loan.loan_period_days} days</span>
								</div>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/if}
		</div>
		<!-- Left Column: Loan & Customer Details -->
		<div class="space-y-6 lg:col-span-2">
			{#if loan}
				<!-- Loan Details -->
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<BanknoteIcon class="h-5 w-5" />
							Loan Details
						</Card.Title>
					</Card.Header>
					<Card.Content>
						<div class="grid gap-4">
							<div class="space-y-3">
								<div class="flex justify-between">
									<span class="text-sm text-muted-foreground">Loan Amount</span>
									<span class="font-medium">{formatKES(loan.loan_amount || 0)}</span>
								</div>
								<div class="flex justify-between">
									<span class="text-sm text-muted-foreground"
										>Interest ({((loan.interest_rate || 0) * 100).toFixed(0)}%)</span
									>
									<span>{formatKES(loan.interest_amount || 0)}</span>
								</div>
								<div class="flex justify-between">
									<span class="text-sm text-muted-foreground">Processing Fee</span>
									<span>{formatKES(loan.processing_fee || 0)}</span>
								</div>
								<Separator />
								<div class="flex justify-between">
									<span class="text-sm text-muted-foreground">Disbursement Amount</span>
									<span class="font-medium text-green-600"
										>{formatKES(loan.disbursement_amount || 0)}</span
									>
								</div>
							</div>
							<div class="space-y-3">
								<div class="flex justify-between">
									<span class="text-sm text-muted-foreground">Total Repayment</span>
									<span class="font-semibold">{formatKES(loan.total_repayment || 0)}</span>
								</div>
								<div class="flex justify-between">
									<span class="text-sm text-muted-foreground">Amount Paid</span>
									<span class="text-green-600">{formatKES(loan.amount_paid || 0)}</span>
								</div>
								{#if (loan.penalty_amount || 0) > 0}
									<div class="flex justify-between text-destructive">
										<span class="text-sm">Penalty</span>
										<span>{formatKES(loan.penalty_amount || 0)}</span>
									</div>
								{/if}
								<Separator />
								<div class="flex justify-between font-semibold">
									<span>Balance</span>
									<span class={(loan.balance || 0) > 0 ? 'text-destructive' : 'text-green-600'}>
										{formatKES(loan.balance || 0)}
									</span>
								</div>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
				<!-- Payments -->
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<CreditCardIcon class="h-5 w-5" />
							Payment History
						</Card.Title>
					</Card.Header>
					<Card.Content>
						{#if payments.length === 0}
							<p class="py-4 text-center text-sm text-muted-foreground">No payments recorded</p>
						{:else}
							<div class="space-y-3">
								{#each payments as payment (payment.id)}
									<div class="flex items-center justify-between border-b py-2 last:border-0">
										<div>
											<div class="text-sm font-medium">{formatKES(payment.amount || 0)}</div>
											<div class="text-xs text-muted-foreground">
												{formatDate(payment.payment_date)} • {payment.payment_method}
											</div>
										</div>
										{#if payment.transaction_reference}
											<div class="font-mono text-xs text-muted-foreground">
												{payment.transaction_reference}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
				{#if loan?.notes}
					<Card.Root>
						<Card.Header>
							<Card.Title class="text-sm font-medium">Notes</Card.Title>
						</Card.Header>
						<Card.Content>
							<p class="text-sm whitespace-pre-wrap text-muted-foreground">{loan.notes}</p>
						</Card.Content>
					</Card.Root>
				{/if}
			{:else}
				<Card.Root>
					<Card.Content class="py-8">
						<div class="text-center text-muted-foreground">Loading loan details...</div>
					</Card.Content>
				</Card.Root>
			{/if}
		</div>

		<!-- Right Column: Payments & Emails -->
	</div>
</div>

<!-- Approve Dialog -->
<Dialog.Root bind:open={showApproveDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Approve Loan</Dialog.Title>
			<Dialog.Description>
				Approve this loan application. You can adjust the approved amount if needed.
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/approve"
			use:enhance={({ cancel }) => {
				if (!handleApproveSubmit()) {
					cancel();
					return;
				}
				return async ({ result, update }) => {
					await update();
					isProcessing = false;
					if (result.type === 'success') {
						toast.success('Loan approved successfully');
						showApproveDialog = false;
						refreshLoan();
						resetForms();
					} else if (result.type === 'failure') {
						toast.error((result.data?.message as string) || 'Failed to approve loan');
					} else if (result.type === 'error') {
						toast.error('An unexpected error occurred');
					}
				};
			}}
		>
			<input type="hidden" name="loanId" value={loan?.id || ''} />
			<input type="hidden" name="userId" value={session.user?.id || ''} />
			<input type="hidden" name="permissions" value={JSON.stringify(session.permissions || [])} />
			<input type="hidden" name="authToken" value={session.token || ''} />
			<div class="space-y-4 py-4">
				<div class="space-y-2">
					<Label>Approved Amount</Label>
					<Input type="number" name="approvedAmount" bind:value={approveAmount} />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (showApproveDialog = false)}
					>Cancel</Button
				>
				<Button type="submit" disabled={isProcessing}>
					{#if isProcessing}
						<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					Approve
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Reject Dialog -->
<Dialog.Root bind:open={showRejectDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Reject Loan</Dialog.Title>
			<Dialog.Description>Provide a reason for rejecting this loan application.</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/reject"
			use:enhance={({ cancel }) => {
				if (!handleRejectSubmit()) {
					cancel();
					return;
				}
				return async ({ result, update }) => {
					await update();
					isProcessing = false;
					if (result.type === 'success') {
						toast.success('Loan rejected');
						showRejectDialog = false;
						refreshLoan();
						resetForms();
					} else if (result.type === 'failure') {
						toast.error((result.data?.message as string) || 'Failed to reject loan');
					} else if (result.type === 'error') {
						toast.error('An unexpected error occurred');
					}
				};
			}}
		>
			<input type="hidden" name="loanId" value={loan?.id || ''} />
			<input type="hidden" name="userId" value={session.user?.id || ''} />
			<input type="hidden" name="permissions" value={JSON.stringify(session.permissions || [])} />
			<input type="hidden" name="authToken" value={session.token || ''} />
			<div class="space-y-4 py-4">
				<div class="space-y-2">
					<Label>Rejection Reason</Label>
					<Input name="reason" bind:value={rejectReason} placeholder="Enter reason for rejection" />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (showRejectDialog = false)}
					>Cancel</Button
				>
				<Button type="submit" variant="destructive" disabled={isProcessing || !rejectReason.trim()}>
					{#if isProcessing}
						<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					Reject
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Record Payment Dialog -->
<Dialog.Root bind:open={showPaymentDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Record Payment</Dialog.Title>
			<Dialog.Description>
				Record a payment received for this loan. Current balance: {formatKES(loan?.balance || 0)}
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/recordPayment"
			use:enhance={({ cancel }) => {
				if (!handleRecordPaymentSubmit()) {
					cancel();
					return;
				}
				return async ({ result, update }) => {
					await update();
					isProcessing = false;
					if (result.type === 'success') {
						toast.success('Payment recorded successfully');
						showPaymentDialog = false;
						refreshLoan();
						resetForms();
					} else if (result.type === 'failure') {
						toast.error((result.data?.message as string) || 'Failed to record payment');
					} else if (result.type === 'error') {
						toast.error('An unexpected error occurred');
					}
				};
			}}
		>
			<input type="hidden" name="loanId" value={loan?.id || ''} />
			<input type="hidden" name="userId" value={session.user?.id || ''} />
			<input type="hidden" name="permissions" value={JSON.stringify(session.permissions || [])} />
			<input type="hidden" name="authToken" value={session.token || ''} />
			<input type="hidden" name="paymentMethod" value={paymentMethod} />
			<div class="space-y-4 py-4">
				<div class="space-y-2">
					<Label>Amount</Label>
					<Input
						type="number"
						name="amount"
						bind:value={paymentAmount}
						placeholder="Payment amount"
						min="1"
					/>
					<p class="text-xs text-muted-foreground">
						Max: {formatKES(loan?.balance || 0)}
					</p>
				</div>
				<div class="space-y-2">
					<Label>Payment Method</Label>
					<Select.Root type="single" bind:value={paymentMethod}>
						<Select.Trigger>
							{paymentMethod === 'mpesa'
								? 'M-Pesa'
								: paymentMethod === 'bank_transfer'
									? 'Bank Transfer'
									: paymentMethod === 'cash'
										? 'Cash'
										: 'Cheque'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="mpesa">M-Pesa</Select.Item>
							<Select.Item value="bank_transfer">Bank Transfer</Select.Item>
							<Select.Item value="cash">Cash</Select.Item>
							<Select.Item value="cheque">Cheque</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-2">
					<Label>Transaction Reference</Label>
					<Input
						name="transactionReference"
						bind:value={transactionRef}
						placeholder="e.g., MPESA code"
					/>
				</div>
				<div class="space-y-2">
					<Label>Notes (optional)</Label>
					<Input name="notes" bind:value={paymentNotes} placeholder="Additional notes" />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (showPaymentDialog = false)}
					>Cancel</Button
				>
				<Button type="submit" disabled={isProcessing || paymentAmount <= 0}>
					{#if isProcessing}
						<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					Record Payment
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Disburse Funds Dialog -->
<Dialog.Root bind:open={showDisburseDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Disburse Funds</Dialog.Title>
			<Dialog.Description>
				Confirm disbursement of {formatKES(loan?.disbursement_amount || 0)} via {loan?.disbursement_method ===
				'mpesa'
					? 'M-Pesa'
					: 'Bank Transfer'}
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/disburse"
			use:enhance={({ cancel }) => {
				if (!handleDisburseSubmit()) {
					cancel();
					return;
				}
				return async ({ result, update }) => {
					await update();
					isProcessing = false;
					if (result.type === 'success') {
						toast.success('Funds disbursed successfully');
						showDisburseDialog = false;
						refreshLoan();
						resetForms();
					} else if (result.type === 'failure') {
						toast.error((result.data?.message as string) || 'Failed to disburse funds');
					} else if (result.type === 'error') {
						toast.error('An unexpected error occurred');
					}
				};
			}}
		>
			<input type="hidden" name="loanId" value={loan?.id || ''} />
			<input type="hidden" name="userId" value={session.user?.id || ''} />
			<input type="hidden" name="permissions" value={JSON.stringify(session.permissions || [])} />
			<input type="hidden" name="authToken" value={session.token || ''} />
			<div class="space-y-4 py-4">
				<div class="space-y-2 rounded-lg bg-muted p-4">
					<div class="flex justify-between text-sm">
						<span class="text-muted-foreground">Amount to Disburse</span>
						<span class="font-medium text-green-600"
							>{formatKES(loan?.disbursement_amount || 0)}</span
						>
					</div>
					<div class="flex justify-between text-sm">
						<span class="text-muted-foreground">Method</span>
						<span>{loan?.disbursement_method === 'mpesa' ? 'M-Pesa' : 'Bank Transfer'}</span>
					</div>
					{#if loan?.disbursement_method === 'mpesa'}
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">Phone</span>
							<span class="font-mono">{loan?.mpesa_number || 'N/A'}</span>
						</div>
					{:else}
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">Bank</span>
							<span>{loan?.bank_name || 'N/A'}</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">Account</span>
							<span class="font-mono">{loan?.bank_account || 'N/A'}</span>
						</div>
					{/if}
				</div>
				<div class="space-y-2">
					<Label>Transaction Reference</Label>
					<Input
						name="transactionReference"
						bind:value={disburseTransactionRef}
						placeholder="Enter MPESA or Bank reference code"
					/>
					<p class="text-xs text-muted-foreground">
						Enter the transaction reference from your payment to confirm disbursement
					</p>
				</div>
				<div class="space-y-2">
					<Label>Notes (optional)</Label>
					<Input name="notes" bind:value={disburseNotes} placeholder="Additional notes" />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (showDisburseDialog = false)}
					>Cancel</Button
				>
				<Button type="submit" disabled={isProcessing}>
					{#if isProcessing}
						<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
					{:else}
						<SendIcon class="mr-2 h-4 w-4" />
					{/if}
					Confirm Disbursement
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Waive Penalty Dialog -->
<Dialog.Root bind:open={showWaiverDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Waive Penalty</Dialog.Title>
			<Dialog.Description>
				Current penalty: {formatKES(loan?.penalty_amount || 0)}
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/waivePenalty"
			use:enhance={({ cancel }) => {
				if (!handleWaivePenaltySubmit()) {
					cancel();
					return;
				}
				return async ({ result, update }) => {
					await update();
					isProcessing = false;
					if (result.type === 'success') {
						toast.success('Penalty waived successfully');
						showWaiverDialog = false;
						refreshLoan();
						resetForms();
					} else if (result.type === 'failure') {
						toast.error((result.data?.message as string) || 'Failed to waive penalty');
					} else if (result.type === 'error') {
						toast.error('An unexpected error occurred');
					}
				};
			}}
		>
			<input type="hidden" name="loanId" value={loan?.id || ''} />
			<input type="hidden" name="userId" value={session.user?.id || ''} />
			<input type="hidden" name="permissions" value={JSON.stringify(session.permissions || [])} />
			<input type="hidden" name="authToken" value={session.token || ''} />
			<div class="space-y-4 py-4">
				<div class="space-y-2">
					<Label>Amount to Waive</Label>
					<Input
						type="number"
						name="waiveAmount"
						bind:value={waiverAmount}
						max={loan?.penalty_amount || 0}
					/>
				</div>
				<div class="space-y-2">
					<Label>Reason</Label>
					<Input name="reason" bind:value={waiverReason} placeholder="Reason for waiver" />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (showWaiverDialog = false)}
					>Cancel</Button
				>
				<Button type="submit" disabled={isProcessing || waiverAmount <= 0 || !waiverReason.trim()}>
					{#if isProcessing}
						<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					Waive Penalty
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Mark Defaulted Dialog -->
<Dialog.Root bind:open={showDefaultDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="text-destructive">Mark as Defaulted</Dialog.Title>
			<Dialog.Description>
				This action will mark the loan as defaulted. This cannot be easily undone.
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/markDefaulted"
			use:enhance={({ cancel }) => {
				if (!handleMarkDefaultedSubmit()) {
					cancel();
					return;
				}
				return async ({ result, update }) => {
					await update();
					isProcessing = false;
					if (result.type === 'success') {
						toast.success('Loan marked as defaulted');
						showDefaultDialog = false;
						refreshLoan();
						resetForms();
					} else if (result.type === 'failure') {
						toast.error((result.data?.message as string) || 'Failed to mark loan as defaulted');
					} else if (result.type === 'error') {
						toast.error('An unexpected error occurred');
					}
				};
			}}
		>
			<input type="hidden" name="loanId" value={loan?.id || ''} />
			<input type="hidden" name="userId" value={session.user?.id || ''} />
			<input type="hidden" name="permissions" value={JSON.stringify(session.permissions || [])} />
			<input type="hidden" name="authToken" value={session.token || ''} />
			<div class="space-y-4 py-4">
				<div class="space-y-2">
					<Label>Reason</Label>
					<Input
						name="reason"
						bind:value={defaultReason}
						placeholder="Reason for marking as defaulted"
					/>
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (showDefaultDialog = false)}
					>Cancel</Button
				>
				<Button
					type="submit"
					variant="destructive"
					disabled={isProcessing || !defaultReason.trim()}
				>
					{#if isProcessing}
						<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					Mark Defaulted
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Send Email Dialog -->
<Dialog.Root bind:open={showEmailDialog}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Send Email to Customer</Dialog.Title>
			<Dialog.Description>
				Send an email to {customer?.name} ({customer?.email})
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/sendEmail"
			use:enhance={({ cancel }) => {
				if (!handleSendEmail()) {
					cancel();
					return;
				}
				return async ({ result, update }) => {
					await update();
					isProcessing = false;
					if (result.type === 'success') {
						toast.success('Email sent successfully');
						showEmailDialog = false;
						refreshLoan();
						resetForms();
					} else if (result.type === 'failure') {
						toast.error((result.data?.message as string) || 'Failed to send email');
					} else if (result.type === 'error') {
						toast.error('An unexpected error occurred');
					}
				};
			}}
		>
			<!-- Hidden fields -->
			<input type="hidden" name="to" value={customer?.email || ''} />
			<input type="hidden" name="customerId" value={customer?.id || ''} />
			<input type="hidden" name="loanId" value={loan?.id || ''} />
			<input type="hidden" name="sentBy" value={session.user?.id || ''} />

			<div class="space-y-4 py-4">
				<div class="space-y-2">
					<Label>Subject</Label>
					<Input name="subject" bind:value={emailSubject} placeholder="Email subject" />
				</div>
				<div class="space-y-2">
					<Label>Message</Label>
					<textarea
						name="body"
						bind:value={emailBody}
						placeholder="Write your message here..."
						class="flex min-h-50 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					></textarea>
					<p class="text-xs text-muted-foreground">
						You can use basic HTML tags for formatting: &lt;b&gt;bold&lt;/b&gt;,
						&lt;i&gt;italic&lt;/i&gt;, &lt;ul&gt;&lt;li&gt;lists&lt;/li&gt;&lt;/ul&gt;
					</p>
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (showEmailDialog = false)}
					>Cancel</Button
				>
				<Button type="submit" disabled={isProcessing || !emailSubject.trim() || !emailBody.trim()}>
					{#if isProcessing}
						<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
					{:else}
						<MailIcon class="mr-2 h-4 w-4" />
					{/if}
					Send Email
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
