<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { createApplicationLink } from '$lib/core/loans/link_service';
	import { getLoans, type LoanWithRelations } from '$lib/core/loans/loan_service';
	import { Permission } from '$lib/services/roles/permissions';
	import { formatKES } from '$lib/shared/currency';
	import { formatDate, formatDueStatus } from '$lib/shared/date_time';
	import { session, sessionHasPermission } from '$lib/store/session.svelte';
	import { LoansStatusOptions } from '$lib/types';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import BanknoteIcon from '@lucide/svelte/icons/banknote';
	import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import LinkIcon from '@lucide/svelte/icons/link';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import SearchIcon from '@lucide/svelte/icons/search';
	import XIcon from '@lucide/svelte/icons/x';
	import XCircleIcon from '@lucide/svelte/icons/x-circle';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Local state
	let searchValue = $state('');
	let statusFilter = $state<string>('all');
	let loans = $state<LoanWithRelations[]>([]);
	let isLoadingMore = $state(false);
	let currentPage = $state(1);
	let totalItems = $state(0);
	let totalPages = $state(0);

	// Application link dialog state
	let showLinkDialog = $state(false);
	let generatedLink = $state('');
	let isGeneratingLink = $state(false);

	// Derived values
	let hasMoreLoans = $derived(currentPage < totalPages);
	let businessCode = 'dashboard';

	// Permissions
	let canCreateLink = $derived(sessionHasPermission(Permission.LOANS_CREATE));

	// Sync state from page data
	$effect(() => {
		searchValue = data.searchQuery || '';
		statusFilter = data.statusFilter || 'all';
		loans = data.loans || [];
		currentPage = data.currentPage || 1;
		totalItems = data.totalItems || 0;
		totalPages = data.totalPages || 0;
	});

	// Handle action from URL
	$effect(() => {
		if (data.action === 'generate-link' && canCreateLink) {
			showLinkDialog = true;
		}
	});

	// Search handler
	function handleSearch() {
		const params = new URLSearchParams();
		if (searchValue.trim()) params.set('search', searchValue.trim());
		if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
		goto(`/${businessCode}/loans${params.toString() ? `?${params.toString()}` : ''}`);
	}

	function handleClearSearch() {
		searchValue = '';
		handleSearch();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') handleSearch();
	}

	function handleStatusChange(value: string | undefined) {
		if (value !== undefined) {
			statusFilter = value;
			const params = new URLSearchParams();
			if (searchValue.trim()) params.set('search', searchValue.trim());
			if (value && value !== 'all') params.set('status', value);
			goto(`/${businessCode}/loans${params.toString() ? `?${params.toString()}` : ''}`);
		}
	}

	// Load more handler
	async function handleLoadMore() {
		if (isLoadingMore || !hasMoreLoans) return;
		isLoadingMore = true;
		try {
			const permissions = session.permissions || [];
			const nextPage = currentPage + 1;
			const result = await getLoans(nextPage, 20, permissions, {
				status: (statusFilter !== 'all' ? statusFilter : undefined) as
					| LoansStatusOptions
					| undefined,
				search: searchValue.trim() || undefined
			});
			loans = [...loans, ...result.items];
			currentPage = nextPage;
		} catch (error) {
			toast.error('Failed to load more loans');
		} finally {
			isLoadingMore = false;
		}
	}

	// Navigate to loan detail page
	function openLoanDetail(loanId: string) {
		goto(`/${businessCode}/loans/${loanId}`);
	}

	// Generate application link
	async function handleGenerateLink() {
		isGeneratingLink = true;
		try {
			const permissions = session.permissions || [];
			const userId = session.user?.id || '';

			if (!userId) {
				toast.error('User session not found. Please log in again.');
				return;
			}

			const link = await createApplicationLink({}, userId, permissions);
			const baseUrl = window.location.origin;
			generatedLink = `${baseUrl}/apply?token=${link.token}`;
			toast.success('Application link generated');
		} catch (error) {

			// Extract the most useful error message
			let errorMessage = 'Failed to generate link';
			if (error instanceof Error) {
				errorMessage = error.message;
			} else if (typeof error === 'object' && error !== null) {
				const pbError = error as { response?: { message?: string }; message?: string };
				errorMessage = pbError.response?.message || pbError.message || errorMessage;
			}

			toast.error(errorMessage);
		} finally {
			isGeneratingLink = false;
		}
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(generatedLink);
			toast.success('Link copied to clipboard');
		} catch {
			toast.error('Failed to copy link');
		}
	}

	function closeLinkDialog() {
		showLinkDialog = false;
		generatedLink = '';
		const params = new URLSearchParams($page.url.searchParams);
		params.delete('action');
		const queryString = params.toString();
		goto(`/${businessCode}/loans${queryString ? `?${queryString}` : ''}`, { replaceState: true });
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
</script>

<!-- Stats Cards -->
<div class="grid grid-cols-2 gap-4 py-4 pb-24 sm:grid-cols-3 lg:grid-cols-6">
	<Card.Root class="@container/card">
		<Card.Header class="pb-2">
			<Card.Description class="flex items-center gap-2 text-xs">
				<FileTextIcon class="h-3.5 w-3.5" />
				Total
			</Card.Description>
			<Card.Title class="text-xl font-semibold tabular-nums">
				{data.stats?.total ?? 0}
			</Card.Title>
		</Card.Header>
	</Card.Root>

	<Card.Root class="@container/card">
		<Card.Header class="pb-2">
			<Card.Description class="flex items-center gap-2 text-xs">
				<ClockIcon class="h-3.5 w-3.5" />
				Pending
			</Card.Description>
			<Card.Title class="text-xl font-semibold text-yellow-600 tabular-nums">
				{data.stats?.pending ?? 0}
			</Card.Title>
		</Card.Header>
	</Card.Root>

	<Card.Root class="@container/card">
		<Card.Header class="pb-2">
			<Card.Description class="flex items-center gap-2 text-xs">
				<CheckCircleIcon class="h-3.5 w-3.5" />
				Approved
			</Card.Description>
			<Card.Title class="text-xl font-semibold text-blue-600 tabular-nums">
				{data.stats?.approved ?? 0}
			</Card.Title>
		</Card.Header>
	</Card.Root>

	<Card.Root class="@container/card">
		<Card.Header class="pb-2">
			<Card.Description class="flex items-center gap-2 text-xs">
				<BanknoteIcon class="h-3.5 w-3.5" />
				Active
			</Card.Description>
			<Card.Title class="text-xl font-semibold text-green-600 tabular-nums">
				{data.stats?.disbursed ?? 0}
			</Card.Title>
		</Card.Header>
	</Card.Root>

	<Card.Root class="@container/card">
		<Card.Header class="pb-2">
			<Card.Description class="flex items-center gap-2 text-xs">
				<AlertTriangleIcon class="h-3.5 w-3.5" />
				Overdue
			</Card.Description>
			<Card.Title class="text-xl font-semibold text-orange-600 tabular-nums">
				{data.stats?.overdue ?? 0}
			</Card.Title>
		</Card.Header>
	</Card.Root>

	<Card.Root class="@container/card">
		<Card.Header class="pb-2">
			<Card.Description class="flex items-center gap-2 text-xs">
				<XCircleIcon class="h-3.5 w-3.5" />
				Defaulted
			</Card.Description>
			<Card.Title class="text-xl font-semibold text-red-600 tabular-nums">
				{data.stats?.defaulted ?? 0}
			</Card.Title>
		</Card.Header>
	</Card.Root>
</div>

<!-- Search and Filters -->
<div class="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
	<div class="relative flex-1">
		<SearchIcon class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
		<Input
			class="pr-20 pl-10"
			placeholder="Search by loan number, customer..."
			bind:value={searchValue}
			onkeydown={handleKeydown}
		/>
		{#if searchValue.trim()}
			<div class="absolute top-1/2 right-2 flex -translate-y-1/2 gap-1">
				<Button size="sm" variant="default" class="h-7 px-2" onclick={handleSearch}>Search</Button>
				<Button size="sm" variant="ghost" class="h-7 px-2" onclick={handleClearSearch}>
					<XIcon class="h-4 w-4" />
				</Button>
			</div>
		{/if}
	</div>

	<div class="flex items-center gap-2">
		<Select.Root type="single" value={statusFilter} onValueChange={handleStatusChange}>
			<Select.Trigger class="w-40">
				{statusFilter === 'all' ? 'All Status' : getStatusLabel(statusFilter)}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="all">All Status</Select.Item>
				<Select.Item value="pending">Pending</Select.Item>
				<Select.Item value="approved">Approved</Select.Item>
				<Select.Item value="disbursed">Active</Select.Item>
				<Select.Item value="partially_paid">Partially Paid</Select.Item>
				<Select.Item value="repaid">Completed</Select.Item>
				<Select.Item value="defaulted">Defaulted</Select.Item>
				<Select.Item value="rejected">Rejected</Select.Item>
			</Select.Content>
		</Select.Root>
	</div>
</div>

<!-- Loans Table -->
<div class="rounded-lg border bg-card">
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Loan #</Table.Head>
				<Table.Head>Customer</Table.Head>
				<Table.Head class="hidden md:table-cell">Amount</Table.Head>
				<Table.Head class="hidden sm:table-cell">Due Date</Table.Head>
				<Table.Head class="hidden lg:table-cell">Balance</Table.Head>
				<Table.Head>Status</Table.Head>
				<Table.Head class="w-10"></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#if loans.length === 0}
				<Table.Row>
					<Table.Cell colspan={7} class="h-24 text-center text-muted-foreground">
						{#if data.searchQuery || data.statusFilter}
							No loans found matching your filters
						{:else}
							No loans yet
						{/if}
					</Table.Cell>
				</Table.Row>
			{:else}
				{#each loans as loan (loan.id)}
					{@const customer = loan.expand?.customer}
					{@const loanDueStatus = formatDueStatus(loan.due_date)}
					<Table.Row
						class="cursor-pointer hover:bg-muted/50"
						onclick={() => openLoanDetail(loan.id)}
					>
						<Table.Cell class="font-mono text-xs font-medium">
							<span class="rounded-2xl bg-border px-2 py-1">
								{loan.loan_number}
							</span>
						</Table.Cell>
						<Table.Cell>
							<div class="flex flex-col">
								<span class="font-medium">{customer?.name || 'Unknown'}</span>
								<span class="hidden text-xs text-muted-foreground sm:block"
									>{customer?.phone || ''}</span
								>
							</div>
						</Table.Cell>
						<Table.Cell class="hidden md:table-cell">
							<div class="flex flex-col">
								<span class="font-medium">{formatKES(loan.loan_amount || 0)}</span>
								<span class="text-xs text-muted-foreground"
									>Repay: {formatKES(loan.total_repayment || 0)}</span
								>
							</div>
						</Table.Cell>
						<Table.Cell class="hidden sm:table-cell">
							<div class="flex flex-col">
								{#if loan.status === 'pending' || loan.status === 'rejected'}
									<span class="text-muted-foreground">-</span>
								{:else}
									<span>{formatDate(loan.due_date)}</span>
									<span
										class="text-xs {loanDueStatus.isOverdue
											? 'text-destructive'
											: 'text-muted-foreground'}"
									>
										{loanDueStatus.text}
									</span>
								{/if}
							</div>
						</Table.Cell>
						<Table.Cell class="hidden lg:table-cell">
							<span
								class="font-medium {(loan.balance || 0) > 0
									? 'text-destructive'
									: 'text-green-600'}"
							>
								{formatKES(loan.balance || 0)}
							</span>
						</Table.Cell>
						<Table.Cell>
							<Badge variant={getStatusVariant(loan.status || 'pending')}>
								{getStatusLabel(loan.status || 'pending')}
							</Badge>
						</Table.Cell>
						<Table.Cell>
							<ChevronRightIcon class="h-4 w-4 text-muted-foreground" />
						</Table.Cell>
					</Table.Row>
				{/each}
			{/if}
		</Table.Body>
	</Table.Root>

	{#if hasMoreLoans}
		<div class="flex items-center justify-center border-t p-4">
			<Button variant="outline" onclick={handleLoadMore} disabled={isLoadingMore}>
				{#if isLoadingMore}
					<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
					Loading...
				{:else}
					Load More ({totalItems - loans.length} remaining)
				{/if}
			</Button>
		</div>
	{/if}
</div>

<div class="text-sm text-muted-foreground">
	Showing {loans.length} of {totalItems} loans
</div>

<!-- Generate Application Link Dialog -->
<Dialog.Root bind:open={showLinkDialog} onOpenChange={(open) => !open && closeLinkDialog()}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<LinkIcon class="h-5 w-5" />
				Generate Link
			</Dialog.Title>
			<Dialog.Description>Create a one-time loan application link.</Dialog.Description>
		</Dialog.Header>

		{#if generatedLink}
			<div class="space-y-4">
				<div class="rounded-lg border bg-muted/50 p-3">
					<Label class="text-xs text-muted-foreground">Application Link</Label>
					<div class="mt-1 flex items-center gap-2">
						<Input value={generatedLink} readonly class="font-mono text-xs" />
						<Button size="icon" variant="outline" onclick={copyLink}>
							<CopyIcon class="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>
			<Dialog.Footer class="flex gap-2">
				<Button variant="outline" onclick={closeLinkDialog}>Close</Button>
				<Button
					onclick={() => {
						generatedLink = '';
						handleGenerateLink();
					}}
					variant="secondary"
				>
					Generate New
				</Button>
			</Dialog.Footer>
		{:else}
			<Dialog.Footer class="flex gap-2">
				<Button variant="ghost" onclick={closeLinkDialog}>Cancel</Button>
				<Button onclick={handleGenerateLink} disabled={isGeneratingLink}>
					{#if isGeneratingLink}
						<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
						Generating...
					{:else}
						<LinkIcon class="mr-2 h-4 w-4" />
						Generate Link
					{/if}
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
