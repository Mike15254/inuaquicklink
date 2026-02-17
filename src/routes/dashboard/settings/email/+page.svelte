<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { updateEmailTemplate } from '$lib/services/email/email_template_data';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';
	import type { EmailTemplatesResponse } from '$lib/types';

	import MailIcon from '@lucide/svelte/icons/mail';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import SaveIcon from '@lucide/svelte/icons/save';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import XIcon from '@lucide/svelte/icons/x';
	import ServerIcon from '@lucide/svelte/icons/server';
	import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
	import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
	import CodeIcon from '@lucide/svelte/icons/code';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import SendIcon from '@lucide/svelte/icons/send';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Template state
	let selectedTemplateId = $state(data.emailTemplates?.[0]?.id || '');
	let selectedTemplate = $derived(data.emailTemplates?.find((t) => t.id === selectedTemplateId));
	let templateForm = $state({
		subject: '',
		body: ''
	});
	let isEditingTemplate = $state(false);
	let isSavingTemplate = $state(false);
	let previewMode = $state(false);
	let showPreviewDialog = $state(false);

	// Sample data for preview
	const sampleData = {
		customer_name: 'John Kamau',
		borrower_name: 'John',
		loan_number: 'LN-20260113-ABC12',
		loan_amount: 'KES 50,000',
		loan_period_days: '14',
		application_date: '13/01/2026',
		due_date: '27/01/2026',
		organization_name: data.organization?.name || 'Your Company',
		organization_phone: data.organization?.phone || '+254 700 000 000',
		organization_email: data.organization?.email || 'info@company.co.ke',
		year: new Date().getFullYear().toString(),
		remaining_balance: 'KES 25,000',
		payment_amount: 'KES 25,000',
		days_overdue: '5',
		penalty_amount: 'KES 1,500',
		total_due: 'KES 51,500',
		transaction_code: 'ABC123XYZ',
		COMPANY_NAME: data.organization?.name || 'Your Company'
	};

	// Template variable definitions
	const templateVariables: Record<
		string,
		{ name: string; description: string; example: string }[]
	> = {
		application_received: [
			{ name: 'customer_name', description: 'Full customer name', example: 'John Kamau' },
			{ name: 'loan_number', description: 'Loan reference number', example: 'LN-20260113-ABC12' },
			{ name: 'loan_amount', description: 'Requested loan amount', example: 'KES 50,000' },
			{ name: 'loan_period_days', description: 'Loan period in days', example: '14' },
			{ name: 'application_date', description: 'Date of application', example: '13/01/2026' },
			{ name: 'organization_name', description: 'Your company name', example: 'Inua Quick Link' },
			{ name: 'organization_phone', description: 'Company phone', example: '+254 700 000 000' },
			{ name: 'organization_email', description: 'Company email', example: 'info@company.co.ke' }
		],
		loan_disbursed: [
			{ name: 'borrower_name', description: 'Customer first name', example: 'John' },
			{
				name: 'disbursement_amount',
				description: 'Amount sent to customer',
				example: 'KES 48,500'
			},
			{ name: 'total_repayment', description: 'Total amount to repay', example: 'KES 55,000' },
			{ name: 'due_date', description: 'Payment due date', example: '27/01/2026' },
			{ name: 'payment_instructions', description: 'How to pay', example: 'Pay via Paybill 123456' }
		],
		payment_received: [
			{ name: 'borrower_name', description: 'Customer first name', example: 'John' },
			{ name: 'payment_amount', description: 'Amount paid', example: 'KES 25,000' },
			{ name: 'remaining_balance', description: 'Outstanding balance', example: 'KES 30,000' },
			{ name: 'transaction_code', description: 'M-Pesa/Bank ref', example: 'ABC123XYZ' }
		],
		overdue_grace_period: [
			{ name: 'borrower_name', description: 'Customer first name', example: 'John' },
			{ name: 'days_overdue', description: 'Days past due date', example: '3' },
			{ name: 'outstanding_amount', description: 'Total owed', example: 'KES 55,000' },
			{ name: 'grace_period_end', description: 'Grace period ends', example: '30/01/2026' }
		],
		penalty_applied: [
			{ name: 'borrower_name', description: 'Customer first name', example: 'John' },
			{ name: 'penalty_amount', description: 'Penalty charged', example: 'KES 2,500' },
			{ name: 'new_total_due', description: 'New total balance', example: 'KES 57,500' }
		]
	};

	// Get variables for selected template
	let currentVariables = $derived(
		templateVariables[selectedTemplate?.template_key || ''] ||
			templateVariables['application_received'] ||
			[]
	);

	/**
	 * Decode HTML entities that may be stored in the database
	 * This handles &lt; &gt; &amp; &quot; &#039; etc.
	 */
	function decodeHtmlEntities(html: string): string {
		if (!html) return '';
		return html
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&amp;/g, '&')
			.replace(/&quot;/g, '"')
			.replace(/&#039;/g, "'")
			.replace(/&#39;/g, "'")
			.replace(/&nbsp;/g, ' ');
	}

	// Compile template with sample data
	function compileWithSampleData(template: string): string {
		// First decode any HTML entities
		let compiled = decodeHtmlEntities(template);

		// Then replace variables
		for (const [key, value] of Object.entries(sampleData)) {
			// Replace {{variable}} and {variable} patterns
			compiled = compiled.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
			compiled = compiled.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
		}
		return compiled;
	}

	// Sync selected template to form
	$effect(() => {
		if (selectedTemplate) {
			templateForm = {
				subject: selectedTemplate.subject,
				// Decode the body when loading from database
				body: decodeHtmlEntities(selectedTemplate.body)
			};
			isEditingTemplate = false;
			previewMode = false;
		}
	});

	async function handleSaveTemplate() {
		if (!selectedTemplate) return;
		isSavingTemplate = true;
		try {
			await updateEmailTemplate(selectedTemplate.id, {
				subject: templateForm.subject,
				body: templateForm.body
			});

			// Update local data
			const index = data.emailTemplates.findIndex((t) => t.id === selectedTemplate.id);
			if (index !== -1) {
				data.emailTemplates[index] = {
					...data.emailTemplates[index],
					subject: templateForm.subject,
					body: templateForm.body
				};
			}

			toast.success('Email template updated successfully');
			isEditingTemplate = false;
		} catch (error) {
			toast.error('Failed to update email template');
		} finally {
			isSavingTemplate = false;
		}
	}

	function cancelEdit() {
		isEditingTemplate = false;
		templateForm.subject = selectedTemplate?.subject || '';
		templateForm.body = selectedTemplate?.body || '';
	}

	function insertVariable(varName: string) {
		if (isEditingTemplate) {
			templateForm.body = templateForm.body + `{{${varName}}}`;
		}
	}
</script>

<div class="flex flex-col gap-6 pb-24">
	<!-- SMTP Status Card -->
	<Card.Root class="border-l-4 border-l-primary bg-linear-to-r from-primary/5 to-transparent">
		<Card.Header class="">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<ServerIcon class="h-5 w-5 text-primary" />
					</div>
					<div>
						<Card.Title class="text-lg">Email Configuration</Card.Title>
					</div>
				</div>
			</div>
		</Card.Header>
	</Card.Root>

	<!-- Email Templates Section -->
	<div class="grid grid-cols-1 gap-6 xl:grid-cols-12">
		<!-- Template List Sidebar -->
		<div class="xl:col-span-3">
			<Card.Root class="h-full">
				<Card.Header class="pb-3">
					<div class="flex items-center gap-2">
						<MailIcon class="h-5 w-5 text-primary" />
						<Card.Title>Email Templates</Card.Title>
					</div>
					<Card.Description>Select a template to view or edit</Card.Description>
				</Card.Header>
				<Card.Content class="max-h-[600px] overflow-y-auto p-2">
					<div class="flex flex-col gap-1">
						{#each data.emailTemplates || [] as template}
							<button
								class="group flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition-all hover:bg-muted/50 {selectedTemplateId ===
								template.id
									? 'border-primary bg-primary/5 ring-1 ring-primary/20'
									: 'border-transparent'}"
								onclick={() => (selectedTemplateId = template.id)}
							>
								<div class="flex items-start justify-between gap-2">
									<span class="text-sm leading-tight font-medium">{template.template_name}</span>
								</div>
							</button>
						{:else}
							<div
								class="flex flex-col items-center justify-center py-8 text-center text-muted-foreground"
							>
								<MailIcon class="h-8 w-8 mb-2 opacity-50" />
								<p class="text-sm">No templates found</p>
								<p class="text-xs">Add templates in PocketBase</p>
							</div>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Template Editor/Preview -->
		<div class="xl:col-span-9">
			{#if selectedTemplate}
				<Card.Root>
					<Card.Header
						class="flex flex-row items-start justify-between gap-4 space-y-0 border-b pb-4"
					>
						<div class="space-y-1">
							<div class="flex items-center gap-2">
								<Card.Title class="text-xl">{selectedTemplate.template_name}</Card.Title>
								<Badge variant="outline" class="font-mono text-[10px]"
									>{selectedTemplate.template_key}</Badge
								>
							</div>
							<Card.Description>
								{#if isEditingTemplate}
									Editing template - make changes and save
								{:else if previewMode}
									Preview with sample data applied
								{:else}
									View the template source or switch to preview
								{/if}
							</Card.Description>
						</div>
						<div class="flex items-center gap-2">
							<!-- View Mode Toggle -->
							<div class="flex items-center rounded-lg border bg-muted/30 p-1">
								<Button
									variant={!previewMode ? 'secondary' : 'ghost'}
									size="sm"
									class="h-8 gap-1.5 px-3"
									onclick={() => (previewMode = false)}
								>
									<CodeIcon class="h-3.5 w-3.5" />
									Source
								</Button>
								<Button
									variant={previewMode ? 'secondary' : 'ghost'}
									size="sm"
									class="h-8 gap-1.5 px-3"
									onclick={() => (previewMode = true)}
								>
									<EyeIcon class="h-3.5 w-3.5" />
									Preview
								</Button>
							</div>
							<!-- Full Preview Button -->
							<Button
								variant="outline"
								size="sm"
								class="gap-1.5"
								onclick={() => (showPreviewDialog = true)}
							>
								<SendIcon class="h-3.5 w-3.5" />
								Full Preview
							</Button>
						</div>
					</Card.Header>

					<Card.Content class="space-y-4 pt-4">
						{#if !previewMode}
							<!-- Edit Mode -->
							<div class="space-y-2">
								<Label for="subject" class="text-sm font-medium">Subject Line</Label>
								<Input
									id="subject"
									bind:value={templateForm.subject}
									disabled={!isEditingTemplate}
									class="font-medium"
									placeholder="Enter email subject..."
								/>
							</div>

							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<Label for="body" class="text-sm font-medium">Email Body (HTML)</Label>
									{#if isEditingTemplate}
										<span class="text-xs text-muted-foreground"
											>Click variables below to insert</span
										>
									{/if}
								</div>
								<textarea
									id="body"
									class="flex min-h-[350px] w-full rounded-lg border border-input bg-muted/30 px-4 py-3 font-mono text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
									bind:value={templateForm.body}
									disabled={!isEditingTemplate}
									placeholder="Enter HTML email body..."
								></textarea>
							</div>
						{:else}
							<!-- Preview Mode -->
							<div class="rounded-lg border bg-white shadow-sm">
								<div class="border-b bg-muted/30 px-4 py-3">
									<div class="flex items-center gap-2 text-sm">
										<span class="text-muted-foreground">Subject:</span>
										<span class="font-medium">{compileWithSampleData(templateForm.subject)}</span>
									</div>
								</div>
								<div class="min-h-[350px] p-4">
									<div class="prose prose-sm max-w-none">
										{@html compileWithSampleData(templateForm.body)}
									</div>
								</div>
							</div>
							<p class="text-center text-xs text-muted-foreground">
								<RefreshCwIcon class="mr-1 inline h-3 w-3" />
								Preview uses sample data. Actual emails will use real customer and loan information.
							</p>
						{/if}
					</Card.Content>

					<Card.Footer class="flex justify-between gap-2 border-t pt-4">
						<div class="text-xs text-muted-foreground">
							Last updated: {new Date(selectedTemplate.updated).toLocaleDateString('en-GB', {
								day: 'numeric',
								month: 'short',
								year: 'numeric',
								hour: '2-digit',
								minute: '2-digit'
							})}
						</div>
						<div class="flex gap-2">
							{#if isEditingTemplate}
								<Button variant="outline" onclick={cancelEdit} disabled={isSavingTemplate}>
									<XIcon class="mr-2 h-4 w-4" />
									Cancel
								</Button>
								<Button onclick={handleSaveTemplate} disabled={isSavingTemplate}>
									{#if isSavingTemplate}
										<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
										Saving...
									{:else}
										<SaveIcon class="mr-2 h-4 w-4" />
										Save Template
									{/if}
								</Button>
							{:else}
								<Button onclick={() => (isEditingTemplate = true)}>
									<PencilIcon class="mr-2 h-4 w-4" />
									Edit Template
								</Button>
							{/if}
						</div>
					</Card.Footer>
				</Card.Root>
			{:else}
				<Card.Root class="flex h-[500px] items-center justify-center">
					<div class="text-center">
						<div
							class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted"
						>
							<MailIcon class="h-8 w-8 text-muted-foreground" />
						</div>
						<h3 class="text-lg font-medium">No Template Selected</h3>
						<p class="mt-1 text-sm text-muted-foreground">
							Select a template from the list to view or edit
						</p>
					</div>
				</Card.Root>
			{/if}
		</div>
	</div>
</div>

<!-- Full Preview Dialog -->
<Dialog.Root bind:open={showPreviewDialog}>
	<Dialog.Content class="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
		<Dialog.Header>
			<Dialog.Title>Email Preview</Dialog.Title>
			<Dialog.Description>
				This is how the email will appear to recipients (with sample data)
			</Dialog.Description>
		</Dialog.Header>
		<div class="flex-1 overflow-auto rounded-lg border bg-white">
			<div class="border-b bg-gray-50 px-6 py-4">
				<div class="space-y-1 text-sm">
					<div class="flex gap-2">
						<span class="w-16 text-gray-500">From:</span>
						<span class="font-medium"
							>{data.organization?.name || 'Your Company'} &lt;{data.organization?.email ||
								'info@company.co.ke'}&gt;</span
						>
					</div>
					<div class="flex gap-2">
						<span class="w-16 text-gray-500">To:</span>
						<span>customer@example.com</span>
					</div>
					<div class="flex gap-2">
						<span class="w-16 text-gray-500">Subject:</span>
						<span class="font-medium">{compileWithSampleData(templateForm.subject)}</span>
					</div>
				</div>
			</div>
			<div class="p-6">
				<div class="prose prose-sm max-w-none">
					{@html compileWithSampleData(templateForm.body)}
				</div>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showPreviewDialog = false)}>Close</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
