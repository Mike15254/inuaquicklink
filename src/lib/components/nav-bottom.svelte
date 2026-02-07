<script lang="ts">
	import { navigating, page } from '$app/stores';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { pb } from '$lib/infra/db/pb';
	import { session } from '$lib/store/session.svelte';
	import { cn } from '$lib/utils';
	import LoanIcon from '@lucide/svelte/icons/book-user';
	import OrginizationIcon from '@lucide/svelte/icons/building-2';
	import DashboardIcon from '@lucide/svelte/icons/chart-column-stacked';
	import ActivityIcon from '@lucide/svelte/icons/chart-spline';
	import Loader2 from '@lucide/svelte/icons/loader';
	import CrmIcon from '@lucide/svelte/icons/message-square-dot';
	import CustomerIcon from '@lucide/svelte/icons/users';
	export function getNavData() {
		const baseUrl = '/dashboard';

		return {
			navMain: [
				{
					title: 'Dashboard',
					url: baseUrl,
					icon: DashboardIcon
				},
				{
					title: 'Customers',
					url: `${baseUrl}/customers`,
					icon: CustomerIcon
				},
				{
					title: 'Loans',
					url: `${baseUrl}/loans`,
					icon: LoanIcon,
					items: [
						{
							title: 'All Loans',
							url: `${baseUrl}/loans`
						},
						{
							title: 'Pending',
							url: `${baseUrl}/loans?status=pending`
						},
						{
							title: 'Active',
							url: `${baseUrl}/loans?status=disbursed`
						},
						{
							title: 'Defaulted',
							url: `${baseUrl}/loans?status=defaulted`
						},
						{
							title: 'Completed',
							url: `${baseUrl}/loans?status=repaid`
						}
					]
				},
				{
					title: 'CRM',
					url: `${baseUrl}/crm`,
					icon: CrmIcon
				}
			],
			projects: [
				{
					name: 'Organization',
					url: `${baseUrl}/org`,
					icon: OrginizationIcon
				},
				{
					name: 'Activities',
					url: `${baseUrl}/activity`,
					icon: ActivityIcon
				}
			]
		};
	}

	let navData = $derived(getNavData());
	let orgLogo = $derived(
		session.organization?.logo
			? pb.files.getURL(session.organization, session.organization.logo)
			: null
	);
</script>

<div
	class="fixed right-0 bottom-0 left-0 z-50 mx-auto my-2 w-3/4 justify-center rounded-2xl bg-primary p-2 md:hidden"
>
	<nav class="mx-2 flex items-center justify-around">
		<!-- Main Navigation Items -->
		{#each navData.navMain as item}
			{@const Icon = item.icon}

			{#if item.items && item.items.length > 0}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						<button
							class={cn(
								'flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-muted',
								$page.url.pathname === item.url ? 'bg-muted text-foreground' : 'text-muted'
							)}
						>
							<Icon class="h-5 w-5" />
						</button>
					</DropdownMenu.Trigger>

					<DropdownMenu.Content side="top" align="center" class="">
						{#each item.items as subItem}
							<DropdownMenu.Item>
								<a href={subItem.url} class="w-full">{subItem.title}</a>
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{:else}
				<a
					href={item.url}
					class={cn(
						'flex flex-col items-center gap-1 rounded-lg px-3 py-3 text-xs font-medium transition-colors hover:bg-muted',
						$page.url.pathname === item.url ? 'bg-muted text-foreground' : 'text-muted'
					)}
				>
					{#if $navigating?.to?.url.pathname === item.url}
						<Loader2 class="h-5 w-5 animate-spin" />
					{:else}
						<Icon class="h-5 w-5" />
					{/if}
				</a>
			{/if}
		{/each}

		<!-- Project Navigation Items (Activities, Settings) -->
		{#each navData.projects as project}
			{@const Icon = project.icon}
			<a
				href={project.url}
				class={cn(
					'flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-muted',
					$page.url.pathname === project.url ? 'bg-muted text-foreground' : 'text-muted'
				)}
			>
				{#if $navigating?.to?.url.pathname === project.url}
					<Loader2 class="h-5 w-5 animate-spin" />
				{:else if project.name === 'Organization' && orgLogo}
					<div class="h-5 w-5 overflow-hidden rounded-full">
						<img src={orgLogo} alt="Org" class="h-full w-full object-cover" />
					</div>
				{:else}
					<Icon class="h-5 w-5" />
				{/if}
			</a>
		{/each}
	</nav>
</div>
