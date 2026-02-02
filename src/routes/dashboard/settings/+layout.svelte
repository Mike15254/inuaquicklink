<script lang="ts">
	import { page } from '$app/stores';
	import PageNav from '$lib/components/submenu-nav.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
	}
	let { children }: Props = $props();

	let businessCode = 'dashboard';

	let settingsNav = $derived([
		{ title: 'Loan Settings', href: `/${businessCode}/settings` },
		{ title: 'Email', href: `/${businessCode}/settings/email` },
		{ title: 'Notifications', href: `/${businessCode}/settings/notifications` },
		{ title: 'System', href: `/${businessCode}/settings/system` }
	]);
</script>

<svelte:head>
	<title>inuaquicklink | Settings</title>
	<meta name="description" content="Loan and system configuration" />
</svelte:head>

<div class="flex flex-col gap-6 py-4">
	<!-- Page Header -->
	<div class="flex flex-col gap-1">
		<h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
		<p class="text-sm text-muted-foreground">
			Configure loan parameters, notifications, and system settings
		</p>
	</div>

	<div class="flex flex-col lg:flex-row lg:gap-8">
		<aside class="shrink-0 overflow-x-auto lg:w-[180px]">
			<PageNav items={settingsNav} />
		</aside>

		<div class="min-w-0 flex-1">
			{@render children?.()}
		</div>
	</div>
</div>
