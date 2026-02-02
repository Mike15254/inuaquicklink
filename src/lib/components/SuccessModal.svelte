<script lang="ts">
	import CheckCircle from "@lucide/svelte/icons/circle-check";
	import X from "@lucide/svelte/icons/x";

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		title?: string;
		message?: string;
		loanId?: string;
	}

	let {
		isOpen = false,
		onClose,
		title = 'Application Submitted!',
		message = 'Your loan application has been submitted successfully.',
		loanId
	}: Props = $props();

	let copied = $state(false);

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}
</script>

{#if isOpen}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="success-modal-title"
		tabindex="-1"
	>
		<!-- Modal -->
		<div
			class="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-background p-6 shadow-xl transition-all"
			role="document"
		>
			<!-- Close button -->
			<button
				type="button"
				onclick={onClose}
				class="absolute right-4 top-4 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				aria-label="Close"
			>
				<X class="h-5 w-5" />
			</button>

			<!-- Success icon -->
			<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
				<CheckCircle class="h-10 w-10 text-green-600 dark:text-green-400" />
			</div>

			<!-- Title -->
			<h2
				id="success-modal-title"
				class="mt-4 text-center text-xl font-semibold text-foreground"
			>
				{title}
			</h2>

			<!-- Message -->
			<p class="mt-2 text-center text-sm text-muted-foreground">
				{message}
			</p>

			<!-- Close button -->
			<button
				type="button"
				onclick={onClose}
				class="mt-6 w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
			>
				Done
			</button>
		</div>
	</div>
{/if}
