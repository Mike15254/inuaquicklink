<script lang="ts">
	import { page } from '$app/stores';
</script>

<svelte:head>
	<title>Page Not Found</title>
	<meta name="description" content="The page you're looking for doesn't exist." />
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center px-4">
	<div class="text-center">
		<!-- 404 Number -->
		<h1 class="text-[120px] leading-none font-bold text-primary sm:text-[180px] md:text-[220px]">
			{$page.status}
		</h1>

		<!-- Message -->
		<h2 class="mt-4 text-2xl font-semibold text-gray-900 sm:text-3xl">
			{#if $page.status === 404}
				Page not found
			{:else}
				Something went wrong
			{/if}
		</h2>

		<p class="my-14 max-w-md text-base text-zinc-500">
			{#if $page.status === 502}
				Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't
				exist.
			{:else}
				{$page.error?.message || 'An unexpected error occurred.'}
			{/if}
		</p>

		<!-- Back Home Button -->
		<a
			href="/"
			class="mt-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary px-6 py-3 font-medium text-background transition-transform duration-300 hover:scale-105"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="m12 19-7-7 7-7" />
				<path d="M19 12H5" />
			</svg>
			Back to Home
		</a>
	</div>
</div>
