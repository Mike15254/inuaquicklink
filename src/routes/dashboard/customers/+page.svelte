<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { getCustomers } from '$lib/core/customers';
	import { session } from '$lib/store/session.svelte';
	import { formatDate } from '$lib/shared/date_time';
	import type { CustomersResponse, CustomersStatusOptions } from '$lib/types';
	import type { PageData } from './$types';

	import EyeIcon from '@lucide/svelte/icons/eye';
	import MessageIcon from '@lucide/svelte/icons/message-square';
	import SearchIcon from '@lucide/svelte/icons/search';
	import UsersIcon from '@lucide/svelte/icons/users';
	import UserCheckIcon from '@lucide/svelte/icons/user-check';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import XIcon from '@lucide/svelte/icons/x';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Local state - initialized empty, synced via $effect
	let searchValue = $state('');
	let statusFilter = $state<string>('all');
	let customers = $state<CustomersResponse[]>([]);
	let isLoadingMore = $state(false);
	let currentPage = $state(1);
	let totalItems = $state(0);
	let totalPages = $state(0);

	// Derived values
	let hasMoreCustomers = $derived(currentPage < totalPages);
	let businessCode = 'dashboard';

	// Sync state from page data
	$effect(() => {
		searchValue = data.searchQuery || '';
		statusFilter = data.statusFilter || 'all';
		customers = data.customers || [];
		currentPage = data.currentPage || 1;
		totalItems = data.totalItems || 0;
		totalPages = data.totalPages || 0;
	});

	// Search handler
	function handleSearch() {
		const params = new URLSearchParams();
		if (searchValue.trim()) {
			params.set('search', searchValue.trim());
		}
		if (statusFilter && statusFilter !== 'all') {
			params.set('status', statusFilter);
		}
		const queryString = params.toString();
		goto(`/${businessCode}/customers${queryString ? `?${queryString}` : ''}`);
	}

	function handleClearSearch() {
		searchValue = '';
		handleSearch();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleSearch();
		}
	}

	// Status filter handler
	function handleStatusChange(value: string | undefined) {
		if (value !== undefined) {
			statusFilter = value;
			const params = new URLSearchParams();
			if (searchValue.trim()) {
				params.set('search', searchValue.trim());
			}
			if (value && value !== 'all') {
				params.set('status', value);
			}
			const queryString = params.toString();
			goto(`/${businessCode}/customers${queryString ? `?${queryString}` : ''}`);
		}
	}

	// Load more handler
	async function handleLoadMore() {
		if (isLoadingMore || !hasMoreCustomers) return;

		isLoadingMore = true;
		try {
			const permissions = session.permissions || [];
			const nextPage = currentPage + 1;
			const result = await getCustomers(nextPage, 20, permissions, {
				status: (statusFilter !== 'all' ? statusFilter : undefined) as
					| CustomersStatusOptions
					| undefined,
				search: searchValue.trim() || undefined
			});
			customers = [...customers, ...result.items];
			currentPage = nextPage;
		} catch (error) {
		} finally {
			isLoadingMore = false;
		}
	}

	// Navigation handlers
	function viewCustomer(customerId: string) {
		goto(`/${businessCode}/customers/${customerId}`);
	}

	function openCRM(customerId: string) {
		goto(`/${businessCode}/crm?customer=${customerId}`);
	}

	// Status badge color
	function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'active':
				return 'default';
			case 'blocked':
				return 'destructive';
			case 'pending':
				return 'secondary';
			default:
				return 'outline';
		}
	}
</script>

<svelte:head>
	<title>Customers | Inua Quick Link</title>
	<meta name="description" content="Manage your customers" />
</svelte:head>

<div class="flex flex-col gap-6 py-4 pb-24">
	<!-- Page Header -->
	<div class="flex flex-col gap-1">
		<h1 class="text-2xl font-semibold tracking-tight">Customers</h1>
		<p class="text-sm text-muted-foreground">Manage and view all your customers</p>
	</div>

	<!-- Stats Cards -->
	<div
		class="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-2 dark:*:data-[slot=card]:bg-card"
	>
		<Card.Root class="@container/card">
			<Card.Header>
				<Card.Description class="flex items-center gap-2">
					<UserCheckIcon class="h-4 w-4" />
					Active Customers
				</Card.Description>
				<Card.Title class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
					{data.stats?.active ?? 0}
				</Card.Title>
				<Card.Action>
					<Badge variant="outline">with loans</Badge>
				</Card.Action>
			</Card.Header>
			<Card.Footer class="flex-col items-start gap-1.5 text-sm">
				<div class="text-muted-foreground">Customers with active loans</div>
			</Card.Footer>
		</Card.Root>

		<Card.Root class="@container/card">
			<Card.Header>
				<Card.Description class="flex items-center gap-2">
					<UsersIcon class="h-4 w-4" />
					Total Customers
				</Card.Description>
				<Card.Title class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
					{data.stats?.total ?? 0}
				</Card.Title>
				<Card.Action>
					<Badge variant="secondary">all</Badge>
				</Card.Action>
			</Card.Header>
			<Card.Footer class="flex-col items-start gap-1.5 text-sm">
				<div class="text-muted-foreground">All customers in the system</div>
			</Card.Footer>
		</Card.Root>
	</div>

	<!-- Search and Filters -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="relative flex-1">
			<SearchIcon class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				class="pr-20 pl-10"
				placeholder="Search by name, email, phone..."
				bind:value={searchValue}
				onkeydown={handleKeydown}
			/>
			{#if searchValue.trim()}
				<div class="absolute top-1/2 right-2 flex -translate-y-1/2 gap-1">
					<Button size="sm" variant="default" class="h-7 px-2" onclick={handleSearch}>
						Search
					</Button>
					<Button size="sm" variant="ghost" class="h-7 px-2" onclick={handleClearSearch}>
						<XIcon class="h-4 w-4" />
					</Button>
				</div>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			<Select.Root type="single" value={statusFilter} onValueChange={handleStatusChange}>
				<Select.Trigger class="w-37.5">
					{statusFilter === 'all'
						? 'All Status'
						: statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all">All Status</Select.Item>
					<Select.Item value="active">Active</Select.Item>
					<Select.Item value="pending">Pending</Select.Item>
					<Select.Item value="blocked">Blocked</Select.Item>
				</Select.Content>
			</Select.Root>
		</div>
	</div>

	<!-- Customers Table -->
	<div class="rounded-lg border bg-card">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-25">ID</Table.Head>
					<Table.Head>Name</Table.Head>
					<Table.Head class="hidden md:table-cell">Email</Table.Head>
					<Table.Head class="hidden sm:table-cell">Phone</Table.Head>
					<Table.Head class="hidden lg:table-cell">Member Since</Table.Head>
					<Table.Head>Status</Table.Head>
					<Table.Head class="text-right">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if customers.length === 0}
					<Table.Row>
						<Table.Cell colspan={7} class="h-24 text-center text-muted-foreground">
							{#if data.searchQuery || data.statusFilter}
								No customers found matching your filters
							{:else}
								No customers yet
							{/if}
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each customers as customer (customer.id)}
						<Table.Row
							class="cursor-pointer hover:bg-muted/50"
							onclick={() => viewCustomer(customer.id)}
						>
							<Table.Cell class="font-mono text-xs text-muted-foreground">
								<span class="rounded-2xl bg-border px-2 py-1">
									{customer.id}
								</span>
							</Table.Cell>
							<Table.Cell class="font-medium">{customer.name}</Table.Cell>
							<Table.Cell class="hidden text-muted-foreground md:table-cell">
								{customer.email}
							</Table.Cell>
							<Table.Cell class="hidden text-muted-foreground sm:table-cell">
								{customer.phone}
							</Table.Cell>
							<Table.Cell class="hidden text-muted-foreground lg:table-cell">
								{formatDate(customer.created)}
							</Table.Cell>
							<Table.Cell>
								<Badge variant={getStatusVariant(customer.status || 'pending')}>
									{customer.status || 'pending'}
								</Badge>
							</Table.Cell>
							<Table.Cell class="text-right">
								<div class="flex items-center justify-end gap-1">
									<Button
										size="sm"
										variant="ghost"
										class="h-8 w-8 p-0"
										onclick={(e: MouseEvent) => {
											e.stopPropagation();
											viewCustomer(customer.id);
										}}
										title="View customer"
									>
										<EyeIcon class="h-4 w-4" />
									</Button>
									<Button
										size="sm"
										variant="ghost"
										class="h-8 w-8 p-0"
										onclick={(e: MouseEvent) => {
											e.stopPropagation();
											openCRM(customer.id);
										}}
										title="Open CRM"
									>
										<MessageIcon class="h-4 w-4" />
									</Button>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>

		<!-- Load More -->
		{#if hasMoreCustomers}
			<div class="flex items-center justify-center border-t p-4">
				<Button variant="outline" onclick={handleLoadMore} disabled={isLoadingMore}>
					{#if isLoadingMore}
						<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
						Loading...
					{:else}
						Load More ({totalItems - customers.length} remaining)
					{/if}
				</Button>
			</div>
		{/if}
	</div>

	<!-- Results summary -->
	<div class="text-sm text-muted-foreground">
		Showing {customers.length} of {totalItems} customers
	</div>
</div>
