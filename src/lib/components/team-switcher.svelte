<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { session } from '$lib/store/session.svelte';
	import { getFileUrl } from '$lib/infra/db/pb';
	import { Collections } from '$lib/types';

	let orgName = $derived(session.organization?.name || 'Inua Quick Link');
	let orgLogo = $derived(
		session.organization?.logo
			? getFileUrl(Collections.Organization, session.organization.id, session.organization.logo)
			: '/favicon.png'
	);
</script>

<Sidebar.Menu>
	<Sidebar.MenuItem>
		<Sidebar.MenuButton
			size="lg"
			class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
		>
			<div
				class="flex aspect-square size-12 items-center justify-center overflow-hidden rounded-lg"
			>
				<img src={orgLogo} alt={orgName} class="h-full w-full object-cover" />
			</div>
			<div class="text-md grid flex-1 text-start leading-tight font-bold">
				<span class=" font-bold">
					{orgName}
				</span>
			</div>
		</Sidebar.MenuButton>
	</Sidebar.MenuItem>
</Sidebar.Menu>
