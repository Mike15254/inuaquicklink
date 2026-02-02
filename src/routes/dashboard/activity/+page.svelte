<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { formatDateTime, formatRelativeTime, formatDate } from '$lib/shared/date_time';
	import type { PageData } from './$types';

	import ActivityIcon from '@lucide/svelte/icons/activity';
	import BanknoteIcon from '@lucide/svelte/icons/banknote';
	import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import CreditCardIcon from '@lucide/svelte/icons/credit-card';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import FilterIcon from '@lucide/svelte/icons/filter';
	import LinkIcon from '@lucide/svelte/icons/link';
	import LogInIcon from '@lucide/svelte/icons/log-in';
	import MailIcon from '@lucide/svelte/icons/mail';
	import PlusCircleIcon from '@lucide/svelte/icons/plus-circle';
	import RefreshIcon from '@lucide/svelte/icons/refresh-cw';
	import SendIcon from '@lucide/svelte/icons/send';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';
	import UserIcon from '@lucide/svelte/icons/user';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import UsersIcon from '@lucide/svelte/icons/users';
	import XCircleIcon from '@lucide/svelte/icons/x-circle';
	import XIcon from '@lucide/svelte/icons/x';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let businessCode = 'dashboard';
	let activities = $derived(data.activities || []);
	let entityFilter = $state('');
	let activityFilter = $state('');

	// Sync filters from page data
	$effect(() => {
		entityFilter = data.entityFilter || '';
		activityFilter = data.activityFilter || '';
	});

	function handleEntityFilterChange(value: string | undefined) {
		entityFilter = value || '';
		applyFilters();
	}

	function handleActivityFilterChange(value: string | undefined) {
		activityFilter = value || '';
		applyFilters();
	}

	function applyFilters() {
		const params = new URLSearchParams();
		if (entityFilter) params.set('entity', entityFilter);
		if (activityFilter) params.set('type', activityFilter);
		const queryString = params.toString();
		goto(`/${businessCode}/activity${queryString ? `?${queryString}` : ''}`);
	}

	function clearFilters() {
		entityFilter = '';
		activityFilter = '';
		goto(`/${businessCode}/activity`);
	}

	function refreshActivities() {
		goto(`/${businessCode}/activity`, { invalidateAll: true });
	}

	function getEntityIcon(entityType: string) {
		switch (entityType) {
			case 'loan':
				return CreditCardIcon;
			case 'customer':
				return UsersIcon;
			case 'payment':
				return BanknoteIcon;
			case 'user':
				return UserIcon;
			case 'settings':
			case 'organization':
				return SettingsIcon;
			case 'link':
				return LinkIcon;
			case 'email':
				return MailIcon;
			case 'analytics':
				return FileTextIcon;
			default:
				return ActivityIcon;
		}
	}

	function getActivityIcon(activityType: string) {
		switch (activityType) {
			case 'loan_created':
				return PlusCircleIcon;
			case 'loan_approved':
				return CheckCircleIcon;
			case 'loan_rejected':
				return XCircleIcon;
			case 'loan_disbursed':
				return SendIcon;
			case 'loan_repaid':
				return CheckCircleIcon;
			case 'loan_defaulted':
				return AlertTriangleIcon;
			case 'payment_received':
				return BanknoteIcon;
			case 'customer_created':
				return UserPlusIcon;
			case 'customer_updated':
				return UserIcon;
			case 'customer_blocked':
				return ShieldAlertIcon;
			case 'customer_activated':
				return CheckCircleIcon;
			case 'link_created':
			case 'link_used':
				return LinkIcon;
			case 'email_sent':
				return MailIcon;
			case 'user_login':
				return LogInIcon;
			case 'user_created':
				return UserPlusIcon;
			case 'user_updated':
				return UserIcon;
			case 'settings_updated':
				return SettingsIcon;
			case 'report_generated':
				return DownloadIcon;
			case 'system_action':
				return SettingsIcon;
			default:
				return ActivityIcon;
		}
	}

	function getActivityColor(activityType: string): { bg: string; text: string; border: string } {
		if (activityType.includes('created') || activityType.includes('received')) {
			return {
				bg: 'bg-green-100 dark:bg-green-900/30',
				text: 'text-green-700 dark:text-green-400',
				border: 'border-green-500'
			};
		}
		if (
			activityType.includes('approved') ||
			activityType.includes('activated') ||
			activityType.includes('repaid')
		) {
			return {
				bg: 'bg-blue-100 dark:bg-blue-900/30',
				text: 'text-blue-700 dark:text-blue-400',
				border: 'border-blue-500'
			};
		}
		if (
			activityType.includes('rejected') ||
			activityType.includes('blocked') ||
			activityType.includes('defaulted')
		) {
			return {
				bg: 'bg-red-100 dark:bg-red-900/30',
				text: 'text-red-700 dark:text-red-400',
				border: 'border-red-500'
			};
		}
		if (activityType.includes('updated')) {
			return {
				bg: 'bg-yellow-100 dark:bg-yellow-900/30',
				text: 'text-yellow-700 dark:text-yellow-400',
				border: 'border-yellow-500'
			};
		}
		if (activityType.includes('disbursed') || activityType.includes('sent')) {
			return {
				bg: 'bg-purple-100 dark:bg-purple-900/30',
				text: 'text-purple-700 dark:text-purple-400',
				border: 'border-purple-500'
			};
		}
		if (activityType.includes('login')) {
			return {
				bg: 'bg-indigo-100 dark:bg-indigo-900/30',
				text: 'text-indigo-700 dark:text-indigo-400',
				border: 'border-indigo-500'
			};
		}
		return { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-muted-foreground' };
	}

	function formatActivityType(type: string): string {
		return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
	}

	function getEntityBadgeVariant(
		entityType: string
	): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (entityType) {
			case 'loan':
				return 'default';
			case 'payment':
				return 'default';
			case 'customer':
				return 'secondary';
			case 'user':
				return 'secondary';
			case 'email':
				return 'outline';
			default:
				return 'outline';
		}
	}

	// Group activities by date for timeline view
	function groupActivitiesByDate(activities: typeof data.activities) {
		const groups: Record<string, typeof data.activities> = {};
		for (const activity of activities) {
			const dateKey = formatDate(activity.created);
			if (!groups[dateKey]) {
				groups[dateKey] = [];
			}
			groups[dateKey].push(activity);
		}
		return groups;
	}

	let groupedActivities = $derived(groupActivitiesByDate(activities));
	let hasFilters = $derived(entityFilter || activityFilter);
</script>

<svelte:head>
	<title>Activities | inuaquicklink</title>
	<meta name="description" content="View system activity logs" />
</svelte:head>

<div class="flex flex-col gap-6 py-4 pb-24">
	<!-- Page Header -->
	<div class="flex flex-col gap-1">
		<h1 class="text-2xl font-semibold tracking-tight">Activity Feed</h1>
		<p class="text-sm text-muted-foreground">Real-time system activities and audit trail</p>
	</div>

	<!-- Stats Summary -->
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
		<Card.Root>
			<Card.Content class="p-4">
				<div class="flex items-center gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30"
					>
						<CreditCardIcon class="h-5 w-5 text-blue-600 dark:text-blue-400" />
					</div>
					<div>
						<p class="text-2xl font-bold">
							{activities.filter((a) => a.entity_type === 'loan').length}
						</p>
						<p class="text-xs text-muted-foreground">Loan Activities</p>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content class="p-4">
				<div class="flex items-center gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30"
					>
						<BanknoteIcon class="h-5 w-5 text-green-600 dark:text-green-400" />
					</div>
					<div>
						<p class="text-2xl font-bold">
							{activities.filter((a) => a.entity_type === 'payment').length}
						</p>
						<p class="text-xs text-muted-foreground">Payment Activities</p>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content class="p-4">
				<div class="flex items-center gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30"
					>
						<UsersIcon class="h-5 w-5 text-purple-600 dark:text-purple-400" />
					</div>
					<div>
						<p class="text-2xl font-bold">
							{activities.filter((a) => a.entity_type === 'customer').length}
						</p>
						<p class="text-xs text-muted-foreground">Customer Activities</p>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content class="p-4">
				<div class="flex items-center gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30"
					>
						<MailIcon class="h-5 w-5 text-orange-600 dark:text-orange-400" />
					</div>
					<div>
						<p class="text-2xl font-bold">
							{activities.filter((a) => a.entity_type === 'email').length}
						</p>
						<p class="text-xs text-muted-foreground">Email Activities</p>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Filters -->
	<Card.Root>
		<Card.Content class="p-4">
			<div class="flex flex-wrap items-center gap-4">
				<div class="flex items-center gap-2">
					<FilterIcon class="h-4 w-4 text-muted-foreground" />
					<span class="text-sm font-medium">Filters:</span>
				</div>

				<Select.Root type="single" value={entityFilter} onValueChange={handleEntityFilterChange}>
					<Select.Trigger class="w-40">
						{entityFilter
							? entityFilter.charAt(0).toUpperCase() + entityFilter.slice(1)
							: 'All Entities'}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="">All Entities</Select.Item>
						{#each data.entityTypes as type}
							<Select.Item value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>

				<Select.Root
					type="single"
					value={activityFilter}
					onValueChange={handleActivityFilterChange}
				>
					<Select.Trigger class="w-48">
						{activityFilter ? formatActivityType(activityFilter) : 'All Activity Types'}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="">All Activity Types</Select.Item>
						{#each data.activityTypes as type}
							<Select.Item value={type}>{formatActivityType(type)}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>

				{#if hasFilters}
					<Button variant="ghost" size="sm" onclick={clearFilters}>
						<XIcon class="mr-1 h-4 w-4" />
						Clear Filters
					</Button>
				{/if}

				<div class="ml-auto flex items-center gap-2">
					<span class="text-sm text-muted-foreground">{activities.length} activities</span>
					<Button variant="outline" size="sm" onclick={refreshActivities}>
						<RefreshIcon class="mr-2 h-4 w-4" />
						Refresh
					</Button>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Timeline Activity List -->
	{#if activities.length === 0}
		<Card.Root>
			<Card.Content class="py-16">
				<div class="flex flex-col items-center justify-center text-center">
					<div class="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
						<ActivityIcon class="h-8 w-8 text-muted-foreground" />
					</div>
					<h3 class="mt-4 text-lg font-medium">No activities found</h3>
					<p class="mt-2 max-w-sm text-sm text-muted-foreground">
						{#if hasFilters}
							Try adjusting your filters to see more activities
						{:else}
							Activities will appear here as actions are performed in the system
						{/if}
					</p>
					{#if hasFilters}
						<Button variant="outline" class="mt-4" onclick={clearFilters}>Clear Filters</Button>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="space-y-6">
			{#each Object.entries(groupedActivities) as [date, dateActivities] (date)}
				<div class="relative">
					<!-- Date Header -->
					<div class="sticky top-0 z-10 flex items-center gap-3 bg-background py-2">
						<div class="flex h-8 items-center justify-center rounded-full bg-primary px-3">
							<span class="text-xs font-medium text-primary-foreground">{date}</span>
						</div>
						<Separator class="flex-1" />
						<span class="text-xs text-muted-foreground">{dateActivities.length} activities</span>
					</div>

					<!-- Timeline -->
					<div class="relative ml-4 space-y-1 border-l-2 border-muted pl-6">
						{#each dateActivities as activity (activity.id)}
							{@const ActivityIcon = getActivityIcon(activity.activity_type || '')}
							{@const colors = getActivityColor(activity.activity_type || '')}
							<div class="group relative pb-4 last:pb-0">
								<!-- Timeline dot -->
								<div
									class="absolute -left-9 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background {colors.bg}"
								>
									<ActivityIcon class="h-3 w-3 {colors.text}" />
								</div>

								<!-- Activity Card -->
								<Card.Root
									class="transition-all duration-200 group-hover:border-primary/30 hover:shadow-md"
								>
									<Card.Content class="p-4">
										<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
											<div class="min-w-0 flex-1">
												<!-- Activity Type & Badges -->
												<div class="mb-2 flex flex-wrap items-center gap-2">
													<span class="text-sm font-semibold {colors.text}">
														{formatActivityType(activity.activity_type || 'Unknown')}
													</span>
													{#if activity.entity_type}
														<Badge
															variant={getEntityBadgeVariant(activity.entity_type)}
															class="text-xs"
														>
															{activity.entity_type}
														</Badge>
													{/if}
													{#if activity.is_system}
														<Badge variant="secondary" class="text-xs">
															<SettingsIcon class="mr-1 h-3 w-3" />
															System
														</Badge>
													{/if}
												</div>

												<!-- Description -->
												<p class="text-sm leading-relaxed text-foreground">
													{activity.description}
												</p>

												<!-- Metadata -->
												<div
													class="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground"
												>
													<span
														class="flex items-center gap-1"
														title={formatDateTime(activity.created)}
													>
														<ClockIcon class="h-3 w-3" />
														{formatRelativeTime(activity.created)}
													</span>
													{#if (activity.expand as { user?: { name?: string; email?: string } })?.user}
														{@const expandedUser = (
															activity.expand as { user: { name?: string; email?: string } }
														).user}
														<span class="flex items-center gap-1">
															<UserIcon class="h-3 w-3" />
															{expandedUser.name || expandedUser.email}
														</span>
													{/if}
													{#if activity.ip_address}
														<span class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
															{activity.ip_address}
														</span>
													{/if}
													{#if activity.entity_id}
														<span class="font-mono text-xs text-muted-foreground/70">
															ID: {activity.entity_id.slice(0, 8)}...
														</span>
													{/if}
												</div>
											</div>

											<!-- Time on the right for larger screens -->
											<div class="hidden shrink-0 text-right sm:block">
												<span class="text-xs font-medium text-muted-foreground">
													{formatDateTime(activity.created).split(' ').pop()}
												</span>
											</div>
										</div>
									</Card.Content>
								</Card.Root>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
