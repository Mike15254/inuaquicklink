<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import Upload from '@lucide/svelte/icons/cloud-upload';
	import Camera from '@lucide/svelte/icons/camera';
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
		allowCamera?: boolean; // Allow camera capture on mobile
	}

	let {
		documentKey,
		label,
		accept = 'image/jpeg,image/png,image/webp,application/pdf',
		required = false,
		uploadedDocumentId = null,
		hasSubmitted = false,
		maxSize = 10, // Increased to 10MB for better user experience
		allowCamera = true
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		fileUploaded: { documentId: string; documentKey: string; fileName: string };
		fileRemoved: { documentKey: string; documentId: string };
		uploadError: { error: string; documentKey: string };
	}>();

	let isUploading = $state(false);
	let uploadProgress = $state(0);
	let error = $state('');
	let fileName = $state<string | null>(null);
	let documentId = $state<string | null>(uploadedDocumentId);
	let fileInputRef: HTMLInputElement;
	let abortController: AbortController | null = null;

	// Update documentId when prop changes
	$effect(() => {
		documentId = uploadedDocumentId;
	});

	// Derived state
	let hasFile = $derived(!!documentId);
	let showError = $derived(hasSubmitted && required && !hasFile);

	// Allowed MIME types
	const allowedTypes = accept.split(',').map((t) => t.trim());
	const maxSizeBytes = maxSize * 1024 * 1024;

	/**
	 * Compress image if it's too large
	 * Target: Keep under 2MB for optimal upload speed while maintaining quality
	 */
	async function compressImage(file: File): Promise<File> {
		// Only compress images, not PDFs
		if (!file.type.startsWith('image/')) {
			return file;
		}

		// If file is already small enough, don't compress
		if (file.size <= 2 * 1024 * 1024) {
			return file;
		}

		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				const img = new Image();
				img.onload = () => {
					const canvas = document.createElement('canvas');
					let width = img.width;
					let height = img.height;

					// Calculate scaling to keep under 2MB while maintaining aspect ratio
					// Max dimension: 2048px for high quality
					const maxDimension = 2048;
					if (width > height && width > maxDimension) {
						height = (height * maxDimension) / width;
						width = maxDimension;
					} else if (height > maxDimension) {
						width = (width * maxDimension) / height;
						height = maxDimension;
					}

					canvas.width = width;
					canvas.height = height;

					const ctx = canvas.getContext('2d');
					if (!ctx) {
						resolve(file);
						return;
					}

					ctx.drawImage(img, 0, 0, width, height);

					// Convert to blob with good quality (0.85)
					canvas.toBlob(
						(blob) => {
							if (!blob) {
								resolve(file);
								return;
							}

							// Create new file from compressed blob
							const compressedFile = new File([blob], file.name, {
								type: 'image/jpeg',
								lastModified: Date.now()
							});
							resolve(compressedFile);
						},
						'image/jpeg',
						0.85
					);
				};
				img.onerror = () => resolve(file);
				img.src = e.target?.result as string;
			};
			reader.onerror = () => reject(new Error('Failed to read file'));
			reader.readAsDataURL(file);
		});
	}

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
		let file = target.files?.[0];

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

		const originalSize = file.size;
		fileName = file.name;

		// Compress image if needed
		try {
			file = await compressImage(file);
			if (file.size < originalSize) {
				console.log(
					`Auto-compressed: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(file.size / 1024 / 1024).toFixed(2)}MB`
				);
			}
		} catch (compressionError) {
			console.warn('Compression failed, using original file:', compressionError);
		}

		// Start upload
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
				const response = await fetch('/api/upload-document', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ documentId: removedDocId })
				});

				if (!response.ok) {
					console.error('Failed to delete document from server');
				}
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

<div class="relative w-full max-w-full overflow-hidden">
	<!-- Hidden file input -->
	<input
		type="file"
		bind:this={fileInputRef}
		accept={allowCamera ? `${accept},capture=camera` : accept}
		capture={allowCamera && accept.includes('image') ? 'environment' : undefined}
		onchange={handleFileSelect}
		class="hidden"
		id={documentKey}
	/>

	{#if hasFile && !isUploading}
		<!-- File uploaded state -->
		<div class="relative rounded-lg border border-border bg-accent p-3 sm:p-4 w-full max-w-full overflow-hidden">
			<div class="flex items-start gap-2 sm:gap-3 w-full max-w-full">
				<!-- File icon -->
				<div
					class="flex h-12 w-12 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-md bg-primary/10"
				>
					<FileText class="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
				</div>

				<!-- File info -->
				<div class="min-w-0 flex-1 overflow-hidden">
					<div class="flex items-center gap-1.5 sm:gap-2">
						<Check class="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-green-600" />
						<span class="text-xs sm:text-sm font-medium truncate block">
							{label} uploaded
						</span>
					</div>
					
				</div>

				<!-- Remove button -->
				<button
					type="button"
					onclick={handleRemove}
					class="shrink-0 rounded-full p-1 transition-colors hover:bg-destructive/10"
					aria-label="Remove file"
				>
					<X class="h-4 w-4 sm:h-5 sm:w-5" />
				</button>
			</div>
		</div>
	{:else if isUploading}
		<!-- Uploading state -->
		<div class="rounded-lg border border-primary/30 bg-primary/5 p-3 sm:p-4 w-full max-w-full overflow-hidden">
			<div class="flex items-center gap-2 sm:gap-3 w-full max-w-full">
				<div class="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-md shrink-0">
					<Loader class="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-primary" />
				</div>
				<div class="flex-1 min-w-0 overflow-hidden">
					<div class="flex items-center justify-between gap-2">
						<p class="text-xs sm:text-sm font-medium truncate block">Uploading...</p>
						<button
							type="button"
							onclick={handleCancel}
							class="text-[10px] sm:text-xs text-muted-foreground transition-colors hover:text-destructive shrink-0 whitespace-nowrap"
							aria-label="Cancel upload"
						>
							Cancel
						</button>
					</div>
					<div class="mt-1.5 sm:mt-2 h-1.5 sm:h-2 w-full overflow-hidden rounded-full bg-muted">
						<div
							class="h-full bg-primary transition-all duration-300"
							style="width: {uploadProgress}%"
						></div>
					</div>
					<p class="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-muted-foreground">{uploadProgress}%</p>
				</div>
			</div>
		</div>
	{:else}
		<!-- Upload area -->
		<button
			type="button"
			onclick={triggerFileInput}
			class="w-full rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 p-4 sm:p-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none active:bg-primary/10"
			class:border-red-300={showError}
			class:dark:border-red-700={showError}
		>
			<div class="flex flex-col items-center gap-1.5 sm:gap-2">
				<div class="flex gap-1.5 sm:gap-2">
					<div class="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-primary/10">
						<Upload class="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
					</div>
					{#if allowCamera && accept.includes('image')}
						<div class="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-primary/10">
							<Camera class="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
						</div>
					{/if}
				</div>
				<div class="px-2">
					<p class="text-xs sm:text-sm font-medium text-card-foreground">
						{#if allowCamera && accept.includes('image')}
							Take photo or upload
						{:else}
							Click to upload
						{/if}
					</p>
					<p class="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-muted-foreground">
						JPEG, PNG, WebP or PDF (max {maxSize}MB)
					</p>
					<p class="mt-0.5 text-[10px] sm:text-xs text-muted-foreground/75 hidden sm:block">
						Large images optimized automatically
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
