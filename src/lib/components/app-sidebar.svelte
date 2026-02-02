<script lang="ts" module>
	import ActivityIcon from '@lucide/svelte/icons/chart-spline';
	import LoanIcon from '@lucide/svelte/icons/book-user';
	import OrginizationIcon from '@lucide/svelte/icons/building-2';
	import DashboardIcon from '@lucide/svelte/icons/chart-column-stacked';
	import CrmIcon from '@lucide/svelte/icons/message-square-dot';
	import Settings2Icon from '@lucide/svelte/icons/settings-2';
	import CustomerIcon from '@lucide/svelte/icons/users';

	/**
	 * Generate navigation data with org-specific URLs
	 */
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
				},
				{
					name: 'Settings',
					url: `${baseUrl}/settings`,
					icon: Settings2Icon
				}
			]
		};
	}
</script>

<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import type { ComponentProps } from 'svelte';
	import NavMain from './nav-main.svelte';
	import NavProjects from './nav-projects.svelte';
	import NavUser from './nav-user.svelte';
	import TeamSwitcher from './team-switcher.svelte';
	import { session, getSessionUserAvatar } from '$lib/store/session.svelte';

	let {
		ref = $bindable(null),
		collapsible = 'icon',
		...restProps
	}: ComponentProps<typeof Sidebar.Root> = $props();

	// Generate nav data
	let navData = $derived(getNavData());

	// Get user data from session
	let userData = $derived({
		name: session.user?.name || 'User',
		email: session.user?.email || '',
		avatar: getSessionUserAvatar() || '/avatars/default.png'
	});
</script>

<Sidebar.Root {collapsible} {...restProps}>
	<Sidebar.Header>
		<TeamSwitcher />
	</Sidebar.Header>
	<Sidebar.Content>
		<NavMain items={navData.navMain} />
		<NavProjects projects={navData.projects} />
	</Sidebar.Content>
	<Sidebar.Footer>
		<NavUser user={userData} />
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>
