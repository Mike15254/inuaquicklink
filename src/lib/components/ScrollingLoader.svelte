<script lang="ts">
	interface Props {
		messages?: string[];
		messageInterval?: number;
	}

	let {
		messages = [
			"Fetching data",
			"Optimizing algorithm",
			"Cleaning up servers",
			"Compiling results",
			"Finalizing output"
		],
		messageInterval = 2000
	}: Props = $props();

	// Calculate total duration based on message count
	let totalDuration = $derived(messageInterval * messages.length);
</script>

	<div class="w-full max-w-md">
		<div class="flex flex-col items-center gap-8">
			<div class="relative h-10 w-full overflow-hidden">
				<div
					class="pointer-events-none absolute left-0 right-0 top-0 z-10 h-3 bg-linear-to-b from-white to-transparent dark:from-slate-800"
				></div>
				<div
					class="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-3 bg-linear-to-t from-white to-transparent dark:from-slate-800"
				></div>

				<div
					class="flex h-full flex-col scroll-animation"
					style:--duration="{totalDuration}ms"
					style:--item-count={messages.length}
				>
					{#each messages as message}
						<div
							class="flex h-10 shrink-0 items-center justify-center px-4 text-sm font-medium text-slate-700 dark:text-slate-300"
						>
							{message}
						</div>
					{/each}
					
					<div
						class="flex h-10 shrink-0 items-center justify-center px-4 text-sm font-medium text-slate-700 dark:text-slate-300"
					>
						{messages[0]}
					</div>
				</div>
		</div>
	</div>
</div>

<style>
	.scroll-animation {
		animation: scroll var(--duration) linear infinite;
	}

	@keyframes scroll {
		0% {
			transform: translateY(0);
		}
		100% {
			transform: translateY(calc(var(--item-count) * -2.5rem));
		}
	}
</style>