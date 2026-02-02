<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import ScrollingLoader from '$lib/components/ScrollingLoader.svelte';
	import { restoreSession, session } from '$lib/store/session.svelte';
	import { onMount } from 'svelte';

	onMount(() => {
		if (browser) {
			restoreSession();
			if (session.isAuthenticated) {
				goto('/dashboard');
				return;
			}
			goto('/');
		}
	});
</script>

<svelte:head>
	<title>inuaquicklink</title>
	<meta name="description" content="Management System" />
</svelte:head>

<div
	class="relative grid h-full min-h-screen w-full grid-cols-[1fr_2.5rem_auto_2.5rem_1fr] grid-rows-[1fr_1px_auto_1px_1fr] [--pattern-fg:var(--color-gray-950)]/5 dark:[--pattern-fg:var(--color-white)]/10"
>
	<div class="col-start-3 row-start-3 flex max-w-4xl flex-col bg-accent p-2">
		<div class="flex flex-col items-center rounded-xl bg-background p-10 text-sm/2">
			<img src="/comps.svg" alt="load" class="mb-8 w-120 object-contain" />
			<ScrollingLoader />
		</div>
	</div>
	<div
		class="relative -right-px col-start-2 row-span-full row-start-1 border-x border-x-(--pattern-fg) bg-[repeating-linear-gradient(315deg,var(--pattern-fg)_0,var(--pattern-fg)_1px,transparent_0,transparent_50%)] bg-[size:10px_10px] bg-fixed"
	></div>
	<div
		class="relative -left-px col-start-4 row-span-full row-start-1 border-x border-x-(--pattern-fg) bg-[repeating-linear-gradient(315deg,var(--pattern-fg)_0,var(--pattern-fg)_1px,transparent_0,transparent_50%)] bg-[size:10px_10px] bg-fixed"
	></div>
	<div
		class="relative -bottom-px col-span-full col-start-1 row-start-2 h-px bg-(--pattern-fg)"
	></div>
	<div class="relative -top-px col-span-full col-start-1 row-start-4 h-px bg-(--pattern-fg)"></div>
</div>
