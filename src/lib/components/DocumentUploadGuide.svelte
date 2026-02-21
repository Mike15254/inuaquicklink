<script lang="ts">
	import Info from '@lucide/svelte/icons/info';
	import CheckCircle from '@lucide/svelte/icons/check-circle';
	import Camera from '@lucide/svelte/icons/camera';
	import FileText from '@lucide/svelte/icons/file-text';
	
	let showGuide = $state(true);
</script>

{#if showGuide}
	<div class="mb-4 sm:mb-6 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:p-4">
		<div class="flex items-start gap-2 sm:gap-3">
			<Info class="mt-0.5 h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-primary" />
			<div class="flex-1 space-y-2 sm:space-y-3 text-xs sm:text-sm min-w-0">
				<p class="font-medium text-foreground">Quick Upload Tips:</p>
				<ul class="space-y-1.5 sm:space-y-2 text-muted-foreground">
					<li class="flex items-start gap-1.5 sm:gap-2">
						<Camera class="mt-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-primary" />
						<span class="break-words"><strong class="font-semibold">Mobile:</strong> Take photos with camera</span>
					</li>
					<li class="flex items-start gap-1.5 sm:gap-2">
						<FileText class="mt-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-primary" />
						<span class="break-words"><strong class="font-semibold">Size:</strong> Up to 10MB per file</span>
					</li>
					<li class="flex items-start gap-1.5 sm:gap-2">
						<CheckCircle class="mt-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-primary" />
						<span class="break-words"><strong class="font-semibold">Format:</strong> JPEG, PNG, WebP, PDF</span>
					</li>
					<li class="flex items-start gap-1.5 sm:gap-2">
						<CheckCircle class="mt-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-primary" />
						<span class="break-words"><strong class="font-semibold">Tip:</strong> Clear & readable images</span>
					</li>
				</ul>
			</div>
			<button
				type="button"
				onclick={() => (showGuide = false)}
				class="shrink-0 text-xs sm:text-sm text-muted-foreground hover:text-foreground p-1"
				aria-label="Close guide"
			>
				✕
			</button>
		</div>
	</div>
{/if}
