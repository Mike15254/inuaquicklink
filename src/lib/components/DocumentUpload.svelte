<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import Upload from '@lucide/svelte/icons/cloud-upload';
	import AlertCircle from '@lucide/svelte/icons/badge-alert';
	import FileText from '@lucide/svelte/icons/file';
	import Loader from '@lucide/svelte/icons/loader-circle';
	import { createEventDispatcher } from 'svelte';

	interface Props {
		documentKey: string;
		label: string;
		accept?: string;
		required?: boolean;
		uploadedDocumentId?: string | null;
		hasSubmitted?: boolean;
		maxSize?: number; // in MB
	}

	let {
		documentKey,
		label,
		accept = 'image/jpeg,image/png,image/webp,application/pdf',
		required = false,
		uploadedDocumentId = null,
		hasSubmitted = false,
		maxSize = 3 // Reduced from 5MB to 3MB
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		fileUploaded: { documentId: string; documentKey: string; fileName: string };
		fileRemoved: { documentKey: string; documentId: string };
		uploadError: { error: string; documentKey: string };
	}>();

	let isUploading = $state(false);
	let uploadProgress = $state(0);
	let error = $state('');
	let previewUrl = $state<string | null>(null);
	let fileName = $state<string | null>(null);
	let documentId = $state<string | null>(uploadedDocumentId);
	let fileInputRef: HTMLInputElement;
	let abortController: AbortController | null = null;

	// Update documentId when prop changes
	$effect(() => {
		documentId = uploadedDocumentId;
	});

	// Derived state
	let hasFile = $derived(!!documentId || !!previewUrl);
	let isImage = $derived(previewUrl?.startsWith('data:image'));
	let showError = $derived(hasSubmitted && required && !hasFile);

	// Allowed MIME types
	const allowedTypes = accept.split(',').map((t) => t.trim());
	const maxSizeBytes = maxSize * 1024 * 1024;

	function validateFile(file: File): string | null {
		if (!allowedTypes.some((type) => file.type.match(type.replace('*', '.*')))) {
			return `Invalid file type. Allowed: ${accept.replace(/image\//g, '').replace(/application\//g, '')}`;
		}

		if (file.size > maxSizeBytes) {
			const sizeMB = (file.size / 1024 / 1024).toFixed(2);
			return `File too large (${sizeMB}MB). Max: ${maxSize}MB`;
		}

		return null;
	}

	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) return;

		// Reset state
		error = '';
		uploadProgress = 0;

		// Validate file
		const validationError = validateFile(file);
		if (validationError) {
			error = validationError;
			dispatch('uploadError', { error: validationError, documentKey });
			return;
		}

		// Create preview for images
		if (file.type.startsWith('image/')) {
			const reader = new FileReader();
			reader.onload = (e) => {
				previewUrl = e.target?.result as string;
			};
			reader.readAsDataURL(file);
		} else {
			previewUrl = null;
		}

		fileName = file.name;
		isUploading = true;

		// Create abort controller for cancellation
		abortController = new AbortController();

		try {
			// Create FormData for real-time upload
			const formData = new FormData();
			formData.append('file', file);
			formData.append('documentKey', documentKey);

			// Simulate progress for better UX
			const progressInterval = setInterval(() => {
				uploadProgress = Math.min(uploadProgress + 8, 85);
			}, 150);

			// Upload to PocketBase immediately
			const response = await fetch('/api/upload-document', {
				method: 'POST',
				body: formData,
				signal: abortController.signal
			});

			clearInterval(progressInterval);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Upload failed');
			}

			const result = await response.json();
			uploadProgress = 100;

			// Store the document ID
			documentId = result.documentId;

			setTimeout(() => {
				isUploading = false;
				dispatch('fileUploaded', {
					documentId: result.documentId,
					documentKey,
					fileName: result.fileName
				});
			}, 300);
		} catch (err) {
			isUploading = false;

			if (err instanceof Error && err.name === 'AbortError') {
				error = 'Upload cancelled';
			} else {
				error = err instanceof Error ? err.message : 'Upload failed. Please try again.';
			}

			dispatch('uploadError', { error, documentKey });
			previewUrl = null;
			fileName = null;
		} finally {
			abortController = null;
		}
	}

	async function handleRemove() {
		// Cancel ongoing upload if any
		if (isUploading && abortController) {
			abortController.abort();
			isUploading = false;
		}

		const removedDocId = documentId;

		// Reset UI state immediately
		previewUrl = null;
		fileName = null;
		error = '';
		uploadProgress = 0;
		documentId = null;

		// Reset file input
		if (fileInputRef) {
			fileInputRef.value = '';
		}

		// Delete from server if document was uploaded
		if (removedDocId) {
			try {
				await fetch('/api/upload-document', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ documentId: removedDocId })
				});
			} catch (err) {
				console.error('Failed to delete document:', err);
			}

			dispatch('fileRemoved', { documentKey, documentId: removedDocId });
		} else {
			dispatch('fileRemoved', { documentKey, documentId: '' });
		}
	}

	function handleCancel() {
		if (abortController) {
			abortController.abort();
		}
	}

	function triggerFileInput() {
		fileInputRef?.click();
	}
</script>

<div class="relative">
	<!-- Hidden file input -->
	<input
		type="file"
		bind:this={fileInputRef}
		{accept}
		onchange={handleFileSelect}
		class="hidden"
		id={documentKey}
	/>

	{#if hasFile && !isUploading}
		<!-- File uploaded state -->
		<div class="relative rounded-lg border border-border bg-accent p-4">
			<div class="flex items-start gap-3">
				<!-- Preview or icon -->
				{#if isImage && previewUrl}
					<div class="relative h-16 w-16 shrink-0 overflow-hidden rounded-md">
						<img src={previewUrl} alt={label} class="h-full w-full object-cover" />
					</div>
				{:else}
					<div
						class="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-accent-foreground"
					>
						<FileText class="h-8 w-8 " />
					</div>
				{/if}

				<!-- File info -->
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<Check class="h-4 w-4 shrink-0 " />
						<span class="text-sm font-medium">
							{label} uploaded
						</span>
					</div>
					{#if fileName}
						<p class="mt-1 truncate text-xs">
							{fileName}
						</p>
					{/if}
				</div>

				<!-- Remove button -->
				<button
					type="button"
					onclick={handleRemove}
					class="shrink-0 rounded-full p-1 transition-colors"
					aria-label="Remove file"
				>
					<X class="h-5 w-5" />
				</button>
			</div>
		</div>
	{:else if isUploading}
		<!-- Uploading state -->
		<div class="rounded-lg border border-primary/30 bg-primary/5 p-4">
			<div class="flex items-center gap-3">
				<div class="flex h-12 w-12 items-center justify-center rounded-md">
					<Loader class="h-6 w-6 animate-spin text-primary" />
				</div>
				<div class="flex-1">
					<div class="flex items-center justify-between">
						<p class="text-sm font-medium">Uploading...</p>
						<button
							type="button"
							onclick={handleCancel}
							class="text-xs text-muted-foreground transition-colors hover:text-destructive"
							aria-label="Cancel upload"
						>
							Cancel
						</button>
					</div>
					<div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
						<div
							class="h-full bg-primary transition-all duration-300"
							style="width: {uploadProgress}%"
						></div>
					</div>
					<p class="mt-1 text-xs text-muted-foreground">{uploadProgress}%</p>
				</div>
			</div>
		</div>
	{:else}
		<!-- Upload area -->
		<button
			type="button"
			onclick={triggerFileInput}
			class="w-full rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 p-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
			class:border-red-300={showError}
			class:dark:border-red-700={showError}
		>
			<div class="flex flex-col items-center gap-2">
				<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
					<Upload class="h-6 w-6 text-primary" />
				</div>
				<div>
					<p class="text-sm font-medium text-card-foreground">
						Click to upload {label.toLowerCase()}
					</p>
					<p class="mt-1 text-xs text-muted-foreground">
						JPEG, PNG, WebP or PDF (max {maxSize}MB)
					</p>
				</div>
			</div>
		</button>
	{/if}

	<!-- Error message -->
	{#if error}
		<div class="mt-2 flex items-center gap-1 text-sm text-destructive">
			<AlertCircle class="h-4 w-4 shrink-0" />
			<span>{error}</span>
		</div>
	{/if}
</div>
