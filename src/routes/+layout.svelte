<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.png';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}

<style>
	/* Prevent overscroll bounce effect */
	:global(html, body) {
		overscroll-behavior: none;
		height: 100%;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		position: fixed;
		width: 100%;
		overflow: hidden;
	}
</style>
