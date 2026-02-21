<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button/index.js';
	import { sessionHasPermission } from '$lib/store/session.svelte';
	import { Permission } from '$lib/services/roles/permissions';
	import { goto } from '$app/navigation';

	import LinkIcon from '@lucide/svelte/icons/link';

	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	let businessCode = 'dashboard';
	let currentPath = $derived($page.url.pathname);

	// Check if we're on the loan detail page (has an ID after /loans/)
	let isDetailPage = $derived(currentPath.match(/\/loans\/[^/]+$/) !== null);

	let canCreateLoan = $derived(sessionHasPermission(Permission.LOANS_CREATE));
</script>

<svelte:head>
	<title>Loans | Inua Quick Link</title>
	<meta name="description" content="Manage loans and payments" />
</svelte:head>

<div class="flex flex-col gap-4 py-4">
	<!-- Page Header - only show on main loans page -->
	{#if !isDetailPage}
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex flex-col gap-1">
				<h1 class="text-2xl font-semibold tracking-tight">Loans</h1>
				<p class="text-sm text-muted-foreground">
					Manage loan applications, approvals, and payments
				</p>
			</div>
			{#if canCreateLoan}
				<Button
					onclick={() => goto(`/${businessCode}/loans?action=generate-link`)}
					class="w-full sm:w-auto"
				>
					<LinkIcon class="mr-2 h-4 w-4" />
					Generate Application Link
				</Button>
			{/if}
		</div>
	{/if}

	<!-- Page Content -->
	<div class="min-h-[60vh]">
		{@render children?.()}
	</div>
</div>
