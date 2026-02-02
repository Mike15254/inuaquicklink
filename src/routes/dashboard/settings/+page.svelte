<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { session } from '$lib/store/session.svelte';
	import { updateLoanSettings } from '$lib/core/settings';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	import PercentIcon from '@lucide/svelte/icons/percent';
	import BanknoteIcon from '@lucide/svelte/icons/banknote';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import SaveIcon from '@lucide/svelte/icons/save';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import XIcon from '@lucide/svelte/icons/x';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let isEditing = $state(false);
	let isSaving = $state(false);

	// Loan Settings Form state
	let formData = $state({
		min_loan_amount: 0,
		max_loan_amount: 0,
		max_loan_percentage: 0,
		interest_rate_15_days: 0,
		interest_rate_30_days: 0,
		processing_fee_rate: 0,
		late_payment_penalty_rate: 0,
		default_days_threshold: 0
	});

	// Sync loan settings from page data
	$effect(() => {
		if (data.loanSettings) {
			formData = {
				min_loan_amount: data.loanSettings.min_loan_amount || 0,
				max_loan_amount: data.loanSettings.max_loan_amount || 0,
				max_loan_percentage: data.loanSettings.max_loan_percentage || 0,
				interest_rate_15_days: data.loanSettings.interest_rate_15_days || 0,
				interest_rate_30_days: data.loanSettings.interest_rate_30_days || 0,
				processing_fee_rate: data.loanSettings.processing_fee_rate || 0,
				late_payment_penalty_rate: data.loanSettings.late_payment_penalty_rate || 0,
				default_days_threshold: data.loanSettings.default_days_threshold || 0
			};
		}
	});

	async function handleSave() {
		isSaving = true;
		try {
			const permissions = session.permissions || [];
			const actorId = session.user?.id || '';
			await updateLoanSettings(formData, actorId, permissions);
			toast.success('Loan settings updated successfully');
			isEditing = false;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to update settings';
			toast.error(message);
		} finally {
			isSaving = false;
		}
	}

	function handleCancel() {
		if (data.loanSettings) {
			formData = {
				min_loan_amount: data.loanSettings.min_loan_amount || 0,
				max_loan_amount: data.loanSettings.max_loan_amount || 0,
				max_loan_percentage: data.loanSettings.max_loan_percentage || 0,
				interest_rate_15_days: data.loanSettings.interest_rate_15_days || 0,
				interest_rate_30_days: data.loanSettings.interest_rate_30_days || 0,
				processing_fee_rate: data.loanSettings.processing_fee_rate || 0,
				late_payment_penalty_rate: data.loanSettings.late_payment_penalty_rate || 0,
				default_days_threshold: data.loanSettings.default_days_threshold || 0
			};
		}
		isEditing = false;
	}
</script>

<div class="flex flex-col gap-6 pb-24">
	<!-- Header with Actions -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h2 class="text-lg font-semibold">Loan Configuration</h2>
			<p class="text-sm text-muted-foreground">
				Configure loan amounts, interest rates, and penalties
			</p>
		</div>
		<div class="flex gap-2">
			{#if isEditing}
				<Button variant="outline" onclick={handleCancel} disabled={isSaving}>
					<XIcon class="mr-2 h-4 w-4" />
					Cancel
				</Button>
				<Button onclick={handleSave} disabled={isSaving}>
					{#if isSaving}
						<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
						Saving...
					{:else}
						<SaveIcon class="mr-2 h-4 w-4" />
						Save Changes
					{/if}
				</Button>
			{:else}
				<Button onclick={() => (isEditing = true)}>
					<PencilIcon class="mr-2 h-4 w-4" />
					Edit Settings
				</Button>
			{/if}
		</div>
	</div>

	<!-- Loan Amount Limits -->
	<Card.Root>
		<Card.Header>
			<div class="flex items-center gap-2">
				<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
					<BanknoteIcon class="h-5 w-5 text-primary" />
				</div>
				<div>
					<Card.Title>Loan Amount Limits</Card.Title>
					<Card.Description>Set minimum and maximum loan amounts</Card.Description>
				</div>
			</div>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="grid gap-4 sm:grid-cols-3">
				<div class="space-y-2">
					<Label for="min-amount">Minimum Amount (KES)</Label>
					<Input
						id="min-amount"
						type="number"
						placeholder="1000"
						bind:value={formData.min_loan_amount}
						disabled={!isEditing}
					/>
				</div>
				<div class="space-y-2">
					<Label for="max-amount">Maximum Amount (KES)</Label>
					<Input
						id="max-amount"
						type="number"
						placeholder="500000"
						bind:value={formData.max_loan_amount}
						disabled={!isEditing}
					/>
				</div>
				<div class="space-y-2">
					<Label for="max-percentage">Max % of Salary</Label>
					<div class="relative">
						<Input
							id="max-percentage"
							type="number"
							placeholder="50"
							bind:value={formData.max_loan_percentage}
							disabled={!isEditing}
						/>
						<PercentIcon
							class="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
						/>
					</div>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Interest Rates -->
	<Card.Root>
		<Card.Header>
			<div class="flex items-center gap-2">
				<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
					<PercentIcon class="h-5 w-5 text-green-600" />
				</div>
				<div>
					<Card.Title>Interest Rates</Card.Title>
					<Card.Description>Configure interest rates based on loan period</Card.Description>
				</div>
			</div>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="grid gap-4 sm:grid-cols-3">
				<div class="space-y-2">
					<Label for="interest-15">15-Day Loans (%)</Label>
					<Input
						id="interest-15"
						type="number"
						step="0.1"
						placeholder="10"
						bind:value={formData.interest_rate_15_days}
						disabled={!isEditing}
					/>
				</div>
				<div class="space-y-2">
					<Label for="interest-30">30-Day Loans (%)</Label>
					<Input
						id="interest-30"
						type="number"
						step="0.1"
						placeholder="15"
						bind:value={formData.interest_rate_30_days}
						disabled={!isEditing}
					/>
				</div>
				<div class="space-y-2">
					<Label for="processing-fee">Processing Fee (%)</Label>
					<Input
						id="processing-fee"
						type="number"
						step="0.1"
						placeholder="3"
						bind:value={formData.processing_fee_rate}
						disabled={!isEditing}
					/>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Penalties & Defaults -->
	<Card.Root>
		<Card.Header>
			<div class="flex items-center gap-2">
				<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
					<AlertTriangleIcon class="h-5 w-5 text-orange-600" />
				</div>
				<div>
					<Card.Title>Penalties & Defaults</Card.Title>
					<Card.Description
						>Configure late payment penalties and default thresholds</Card.Description
					>
				</div>
			</div>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<Label for="penalty-rate">Late Payment Penalty (%)</Label>
					<Input
						id="penalty-rate"
						type="number"
						step="0.1"
						placeholder="5"
						bind:value={formData.late_payment_penalty_rate}
						disabled={!isEditing}
					/>
					<p class="text-xs text-muted-foreground">Applied to overdue balance per month</p>
				</div>
				<div class="space-y-2">
					<Label for="default-threshold">Default Threshold (Days)</Label>
					<div class="relative">
						<Input
							id="default-threshold"
							type="number"
							placeholder="30"
							bind:value={formData.default_days_threshold}
							disabled={!isEditing}
						/>
						<ClockIcon
							class="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
						/>
					</div>
					<p class="text-xs text-muted-foreground">
						Days overdue before loan is marked as defaulted
					</p>
				</div>
			</div>
		</Card.Content>
	</Card.Root>
</div>
