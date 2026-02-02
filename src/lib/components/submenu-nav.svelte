<script lang="ts">
	import { page } from '$app/stores';
	import { cn } from '$lib/utils';
	import { buttonVariants } from '$lib/components/ui/button';

	// The items you want to display (e.g., the loan filters)
	export let items: { title: string; href: string }[] = [];
	
    // Optional: Add a title for the desktop sidebar (e.g. "Loan Options")
    export let title: string = "";

	$: isActive = (path: string) => {
        // Exact match usually better for sub-navs, or use startsWith if needed
		return $page.url.pathname === path;
	};
</script>

<nav class="flex space-x-2 overscroll-y-none  md:border-r md:border-b-0 border-b lg:flex-col lg:space-x-0 lg:space-y-1  pb-2 lg:pb-0">
    {#if title}
        <h4 class="hidden lg:block mb-4 text-sm font-semibold text-muted-foreground tracking-tight px-4">
            {title}
        </h4>
    {/if}

	{#each items as item}
		<a
			href={item.href}
			class={cn(
				buttonVariants({ variant: "ghost" }),
				isActive(item.href)
					? "bg-muted hover:bg-muted"
					: "hover:bg-transparent hover:underline",
				"justify-start whitespace-nowrap"
			)}
		>
			{item.title}
		</a>
	{/each}
</nav>