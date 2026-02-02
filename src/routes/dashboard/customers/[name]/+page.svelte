<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { updateCustomer, blockCustomer, activateCustomer } from '$lib/core/customers';
	import { session } from '$lib/store/session.svelte';
	import { formatDate, formatDateTime } from '$lib/shared/date_time';
	import { formatKES } from '$lib/shared/currency';
	import { DOCUMENT_TYPE_LABELS } from '$lib/core/loans/document_service';
	import { pb, getFileUrl } from '$lib/infra/db/pb';
	import { Collections, type LoanDocumentsDocumentTypeOptions } from '$lib/types';
	import type { PageData } from './$types';
	import { toast } from 'svelte-sonner';

	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import UserIcon from '@lucide/svelte/icons/user';
	import PhoneIcon from '@lucide/svelte/icons/phone';
	import MailIcon from '@lucide/svelte/icons/mail';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import BriefcaseIcon from '@lucide/svelte/icons/briefcase';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import ActivityIcon from '@lucide/svelte/icons/activity';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import EditIcon from '@lucide/svelte/icons/pencil';
	import BanknoteIcon from '@lucide/svelte/icons/banknote';
	import ShieldOffIcon from '@lucide/svelte/icons/shield-off';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import XIcon from '@lucide/svelte/icons/x';
	import CheckIcon from '@lucide/svelte/icons/check';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Derived values
	let businessCode = 'dashboard';
	let customer = $derived(data.customer);
	let loans = $derived(data.loans || []);
	let activities = $derived(data.activities || []);
	let documents = $derived(data.documents || []);
	let interactions = $derived(data.interactions || []);
	let passportPhotoDoc = $derived(documents.find((doc) => doc.document_type === 'passport_photo'));

	// Edit mode state
	let isEditing = $state(false);
	let isSaving = $state(false);
	let isBlocking = $state(false);
	let blockReason = $state('');
	let showBlockDialog = $state(false);

	// Edit form state
	let editName = $state('');
	let editEmail = $state('');
	let editPhone = $state('');
	let editEmployerName = $state('');
	let editEmployerBranch = $state('');
	let editResidentialAddress = $state('');
	let editNetSalary = $state('');
	let editNotes = $state('');

	// Initialize edit form
	function startEditing() {
		if (!customer) return;
		editName = customer.name;
		editEmail = customer.email;
		editPhone = customer.phone;
		editEmployerName = customer.employer_name;
		editEmployerBranch = customer.employer_branch;
		editResidentialAddress = customer.residential_address;
		editNetSalary = customer.net_salary?.toString() || '';
		editNotes = customer.notes || '';
		isEditing = true;
	}

	function cancelEditing() {
		isEditing = false;
	}

	async function saveChanges() {
		if (!customer || !session.user) return;

		isSaving = true;
		try {
			const permissions = session.permissions || [];
			await updateCustomer(
				customer.id,
				{
					name: editName,
					email: editEmail,
					phone: editPhone,
					employer_name: editEmployerName,
					employer_branch: editEmployerBranch,
					residential_address: editResidentialAddress,
					net_salary: parseFloat(editNetSalary) || undefined,
					notes: editNotes
				},
				session.user.id,
				permissions
			);
			toast.success('Customer updated successfully');
			isEditing = false;
			// Refresh page data
			goto(`/${businessCode}/customers/${customer.id}`, { invalidateAll: true });
		} catch (error) {
			console.error('Failed to update customer:', error);
			toast.error('Failed to update customer');
		} finally {
			isSaving = false;
		}
	}

	async function handleBlock() {
		if (!customer || !session.user) return;

		isBlocking = true;
		try {
			const permissions = session.permissions || [];
			await blockCustomer(customer.id, session.user.id, blockReason, permissions);
			toast.success('Customer blocked');
			showBlockDialog = false;
			goto(`/${businessCode}/customers/${customer.id}`, { invalidateAll: true });
		} catch (error) {
			console.error('Failed to block customer:', error);
			toast.error('Failed to block customer');
		} finally {
			isBlocking = false;
		}
	}

	async function handleActivate() {
		if (!customer || !session.user) return;

		isBlocking = true;
		try {
			const permissions = session.permissions || [];
			await activateCustomer(customer.id, session.user.id, permissions);
			toast.success('Customer activated');
			goto(`/${businessCode}/customers/${customer.id}`, { invalidateAll: true });
		} catch (error) {
			console.error('Failed to activate customer:', error);
			toast.error('Failed to activate customer');
		} finally {
			isBlocking = false;
		}
	}

	function goBack() {
		goto(`/${businessCode}/customers`);
	}

	function createLoan() {
		// Navigate to loan creation with customer pre-selected
		goto(`/${businessCode}/loans?action=create&customer=${customer?.id}`);
	}

	function openCRM() {
		goto(`/${businessCode}/crm?customer=${customer?.id}`);
	}

	function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'active':
				return 'default';
			case 'blocked':
				return 'destructive';
			case 'pending':
				return 'secondary';
			default:
				return 'outline';
		}
	}

	function getLoanStatusVariant(
		status: string
	): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'disbursed':
			case 'approved':
				return 'default';
			case 'repaid':
				return 'secondary';
			case 'defaulted':
			case 'rejected':
				return 'destructive';
			default:
				return 'outline';
		}
	}

	function getDocumentUrl(doc: { file?: string; id: string; collectionId: string }) {
		if (!doc.file) return '';
		return getFileUrl(Collections.LoanDocuments, doc.id, doc.file);
	}
</script>

<svelte:head>
	<title>{customer?.name || 'Customer'} | inuaquicklink</title>
	<meta name="description" content="Customer details and management" />
</svelte:head>

{#if customer}
	<div class="flex flex-col gap-6 py-4 pb-24">
		<!-- Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="flex items-start gap-4">
				<Button variant="ghost" size="sm" onclick={goBack} class="shrink-0">
					<ArrowLeftIcon class="h-4 w-4" />
				</Button>
				<div class="flex flex-col gap-1">
					<div class="flex items-center gap-2">
						<h1 class="text-2xl font-semibold tracking-tight">{customer.name}</h1>
						<Badge variant={getStatusVariant(customer.status || 'pending')}>
							{customer.status || 'pending'}
						</Badge>
					</div>
					<p class="text-sm text-muted-foreground">
						Customer since {formatDate(customer.created)}
					</p>
				</div>
			</div>

			<!-- Action Buttons -->
			<div class="flex flex-wrap items-center gap-2">
				{#if !isEditing}
					<Button variant="outline" size="sm" onclick={startEditing}>
						<EditIcon class="mr-2 h-4 w-4" />
						Edit Profile
					</Button>
				{/if}
				<Button variant="default" size="sm" onclick={createLoan}>
					<BanknoteIcon class="mr-2 h-4 w-4" />
					Give Loan
				</Button>
				{#if customer.status === 'blocked'}
					<Button variant="outline" size="sm" onclick={handleActivate} disabled={isBlocking}>
						{#if isBlocking}
							<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
						{:else}
							<ShieldCheckIcon class="mr-2 h-4 w-4" />
						{/if}
						Activate
					</Button>
				{:else}
					<Button variant="destructive" size="sm" onclick={() => (showBlockDialog = true)}>
						<ShieldOffIcon class="mr-2 h-4 w-4" />
						Block
					</Button>
				{/if}
			</div>
		</div>

		<!-- Block Dialog -->
		{#if showBlockDialog}
			<Card.Root class="border-destructive">
				<Card.Header>
					<Card.Title class="text-destructive">Block Customer</Card.Title>
					<Card.Description>
						This will prevent the customer from applying for new loans.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="space-y-4">
						<div class="space-y-2">
							<Label for="blockReason">Reason for blocking</Label>
							<Input id="blockReason" placeholder="Enter reason..." bind:value={blockReason} />
						</div>
						<div class="flex gap-2">
							<Button variant="destructive" onclick={handleBlock} disabled={isBlocking}>
								{#if isBlocking}
									<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
								{/if}
								Confirm Block
							</Button>
							<Button variant="outline" onclick={() => (showBlockDialog = false)}>Cancel</Button>
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		{/if}

		<!-- Stats Summary -->
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
			<Card.Root>
				<Card.Content class="pt-4">
					<div class="text-2xl font-bold">{customer.total_loans || 0}</div>
					<p class="text-xs text-muted-foreground">Total Loans</p>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content class="pt-4">
					<div class="text-2xl font-bold">{customer.active_loans || 0}</div>
					<p class="text-xs text-muted-foreground">Active Loans</p>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content class="pt-4">
					<div class="text-2xl font-bold">{formatKES(customer.total_borrowed || 0)}</div>
					<p class="text-xs text-muted-foreground">Total Borrowed</p>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content class="pt-4">
					<div class="text-2xl font-bold">{formatKES(customer.total_repaid || 0)}</div>
					<p class="text-xs text-muted-foreground">Total Repaid</p>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Tabs -->
		<Tabs.Root value="bio" class="w-full">
			<Tabs.List class="grid w-full grid-cols-5">
				<Tabs.Trigger value="bio">
					<UserIcon class="mr-2 hidden h-4 w-4 sm:block" />
					Bio
				</Tabs.Trigger>
				<Tabs.Trigger value="contact">
					<PhoneIcon class="mr-2 hidden h-4 w-4 sm:block" />
					Contact
				</Tabs.Trigger>
				<Tabs.Trigger value="uploads">
					<FileTextIcon class="mr-2 hidden h-4 w-4 sm:block" />
					Uploads
				</Tabs.Trigger>
				<Tabs.Trigger value="events">
					<ActivityIcon class="mr-2 hidden h-4 w-4 sm:block" />
					Events
				</Tabs.Trigger>
				<Tabs.Trigger value="interactions">
					<MessageSquareIcon class="mr-2 hidden h-4 w-4 sm:block" />
					CRM
				</Tabs.Trigger>
			</Tabs.List>

			<!-- Bio Tab -->
			<Tabs.Content value="bio" class="mt-6">
				<Card.Root>
					<Card.Header>
						<Card.Title>Personal Information</Card.Title>
						<Card.Description>Customer bio and identity details</Card.Description>
					</Card.Header>
					<Card.Content>
						{#if isEditing}
							<div class="grid gap-4 sm:grid-cols-2">
								<div class="space-y-2">
									<Label for="editName">Full Name</Label>
									<Input id="editName" bind:value={editName} />
								</div>
								<div class="space-y-2">
									<Label for="editNotes">Notes</Label>
									<Input id="editNotes" bind:value={editNotes} />
								</div>
							</div>
							<div class="mt-4 flex gap-2">
								<Button onclick={saveChanges} disabled={isSaving}>
									{#if isSaving}
										<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
									{:else}
										<CheckIcon class="mr-2 h-4 w-4" />
									{/if}
									Save Changes
								</Button>
								<Button variant="outline" onclick={cancelEditing}>
									<XIcon class="mr-2 h-4 w-4" />
									Cancel
								</Button>
							</div>
						{:else}
							<dl class="grid gap-4 sm:grid-cols-2">
								<data value="Profile Photo">
									{#if passportPhotoDoc}
										<img
											class="h-24 w-24 rounded-full object-cover"
											src={getDocumentUrl(passportPhotoDoc)}
										/>
									{:else}
										<p class="text-sm text-muted-foreground">No passport Photo available</p>
									{/if}
								</data>
								<div>
									<dt class="text-sm font-medium text-muted-foreground">Full Name</dt>
									<dd class="mt-1 text-sm">{customer.name}</dd>
								</div>
								<div>
									<dt class="text-sm font-medium text-muted-foreground">National ID</dt>
									<dd class="mt-1 font-mono text-sm">{customer.national_id}</dd>
								</div>
								<div>
									<dt class="text-sm font-medium text-muted-foreground">KRA PIN</dt>
									<dd class="mt-1 font-mono text-sm">{customer.kra_pin}</dd>
								</div>
								<div>
									<dt class="text-sm font-medium text-muted-foreground">Net Salary</dt>
									<dd class="mt-1 text-sm">{formatKES(customer.net_salary || 0)}</dd>
								</div>
								<div class="sm:col-span-2">
									<dt class="text-sm font-medium text-muted-foreground">Notes</dt>
									<dd class="mt-1 text-sm">{customer.notes || 'No notes'}</dd>
								</div>
							</dl>
						{/if}
					</Card.Content>
				</Card.Root>

				<!-- Employment Info -->
				<Card.Root class="mt-4">
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<BriefcaseIcon class="h-4 w-4" />
							Employment Details
						</Card.Title>
					</Card.Header>
					<Card.Content>
						{#if isEditing}
							<div class="grid gap-4 sm:grid-cols-2">
								<div class="space-y-2">
									<Label for="editEmployerName">Employer Name</Label>
									<Input id="editEmployerName" bind:value={editEmployerName} />
								</div>
								<div class="space-y-2">
									<Label for="editEmployerBranch">Employer Branch</Label>
									<Input id="editEmployerBranch" bind:value={editEmployerBranch} />
								</div>
								<div class="space-y-2">
									<Label for="editNetSalary">Net Salary</Label>
									<Input id="editNetSalary" type="number" bind:value={editNetSalary} />
								</div>
							</div>
						{:else}
							<dl class="grid gap-4 sm:grid-cols-2">
								<div>
									<dt class="text-sm font-medium text-muted-foreground">Employer Name</dt>
									<dd class="mt-1 text-sm">{customer.employer_name}</dd>
								</div>
								<div>
									<dt class="text-sm font-medium text-muted-foreground">Employer Branch</dt>
									<dd class="mt-1 text-sm">{customer.employer_branch}</dd>
								</div>
							</dl>
						{/if}
					</Card.Content>
				</Card.Root>

				<!-- Loans History -->
				<Card.Root class="mt-4">
					<Card.Header>
						<Card.Title>Loan History</Card.Title>
						<Card.Description>All loans for this customer</Card.Description>
					</Card.Header>
					<Card.Content>
						{#if loans.length === 0}
							<p class="text-sm text-muted-foreground">No loans yet</p>
						{:else}
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>Loan #</Table.Head>
										<Table.Head>Amount</Table.Head>
										<Table.Head class="hidden sm:table-cell">Due Date</Table.Head>
										<Table.Head>Status</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each loans as loan (loan.id)}
										<Table.Row
											class="cursor-pointer hover:bg-muted/50"
											onclick={() => goto(`/${businessCode}/loans?id=${loan.id}`)}
										>
											<Table.Cell class="font-mono text-sm">{loan.loan_number}</Table.Cell>
											<Table.Cell>{formatKES(loan.loan_amount)}</Table.Cell>
											<Table.Cell class="hidden sm:table-cell"
												>{formatDate(loan.due_date)}</Table.Cell
											>
											<Table.Cell>
												<Badge variant={getLoanStatusVariant(loan.status)}>
													{loan.status}
												</Badge>
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						{/if}
					</Card.Content>
				</Card.Root>
			</Tabs.Content>

			<!-- Contact Tab -->
			<Tabs.Content value="contact" class="mt-6">
				<Card.Root>
					<Card.Header>
						<Card.Title>Contact Information</Card.Title>
					</Card.Header>
					<Card.Content>
						{#if isEditing}
							<div class="grid gap-4 sm:grid-cols-2">
								<div class="space-y-2">
									<Label for="editEmail">Email</Label>
									<Input id="editEmail" type="email" bind:value={editEmail} />
								</div>
								<div class="space-y-2">
									<Label for="editPhone">Phone</Label>
									<Input id="editPhone" type="tel" bind:value={editPhone} />
								</div>
								<div class="space-y-2 sm:col-span-2">
									<Label for="editResidentialAddress">Residential Address</Label>
									<Input id="editResidentialAddress" bind:value={editResidentialAddress} />
								</div>
							</div>
							<div class="mt-4 flex gap-2">
								<Button onclick={saveChanges} disabled={isSaving}>
									{#if isSaving}
										<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
									{:else}
										<CheckIcon class="mr-2 h-4 w-4" />
									{/if}
									Save Changes
								</Button>
								<Button variant="outline" onclick={cancelEditing}>
									<XIcon class="mr-2 h-4 w-4" />
									Cancel
								</Button>
							</div>
						{:else}
							<dl class="space-y-4">
								<div class="flex items-start gap-3">
									<MailIcon class="mt-0.5 h-5 w-5 text-muted-foreground" />
									<div>
										<dt class="text-sm font-medium text-muted-foreground">Email</dt>
										<dd class="mt-1">
											<a
												href="mailto:{customer.email}"
												class="text-sm text-primary hover:underline"
											>
												{customer.email}
											</a>
										</dd>
									</div>
								</div>
								<div class="flex items-start gap-3">
									<PhoneIcon class="mt-0.5 h-5 w-5 text-muted-foreground" />
									<div>
										<dt class="text-sm font-medium text-muted-foreground">Phone</dt>
										<dd class="mt-1">
											<a href="tel:{customer.phone}" class="text-sm text-primary hover:underline">
												{customer.phone}
											</a>
										</dd>
									</div>
								</div>
								<div class="flex items-start gap-3">
									<MapPinIcon class="mt-0.5 h-5 w-5 text-muted-foreground" />
									<div>
										<dt class="text-sm font-medium text-muted-foreground">Residential Address</dt>
										<dd class="mt-1 text-sm">{customer.residential_address}</dd>
									</div>
								</div>
							</dl>
						{/if}
					</Card.Content>
				</Card.Root>

				<!-- Quick Actions -->
				<Card.Root class="mt-4">
					<Card.Header>
						<Card.Title>Quick Actions</Card.Title>
					</Card.Header>
					<Card.Content>
						<div class="flex flex-wrap gap-2">
							<Button variant="outline" size="sm" onclick={openCRM}>
								<MessageSquareIcon class="mr-2 h-4 w-4" />
								Send Message
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => window.open(`mailto:${customer.email}`)}
							>
								<MailIcon class="mr-2 h-4 w-4" />
								Email Customer
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => window.open(`tel:${customer.phone}`)}
							>
								<PhoneIcon class="mr-2 h-4 w-4" />
								Call Customer
							</Button>
						</div>
					</Card.Content>
				</Card.Root>
			</Tabs.Content>

			<!-- Uploads Tab -->
			<Tabs.Content value="uploads" class="mt-6">
				<Card.Root>
					<Card.Header>
						<Card.Title>Uploaded Documents</Card.Title>
						<Card.Description>Documents submitted with loan applications</Card.Description>
					</Card.Header>
					<Card.Content>
						{#if documents.length === 0}
							<p class="text-sm text-muted-foreground">No documents uploaded</p>
						{:else}
							<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{#each documents as doc (doc.id)}
									<Card.Root class="overflow-hidden">
										<Card.Content class="p-4">
											<div class="flex items-center justify-between">
												<div>
													<p class="text-sm font-medium">
														{DOCUMENT_TYPE_LABELS[
															doc.document_type as LoanDocumentsDocumentTypeOptions
														] || doc.document_type}
													</p>
													<p class="mt-1 text-xs text-muted-foreground">
														{doc.file_name || 'Document'}
													</p>
													<!-- We ned to fetch the docuemnt as image also for display -->

													<img
														class="h-24 w-24 rounded-full object-cover"
														src={getDocumentUrl(doc)}
													/>
												</div>
												<div class="flex gap-1">
													<Button
														variant="ghost"
														size="sm"
														onclick={() => window.open(getDocumentUrl(doc), '_blank')}
													>
														<ExternalLinkIcon class="h-4 w-4" />
													</Button>
													<a
														href={getDocumentUrl(doc)}
														download={doc.file_name}
														class="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
													>
														<DownloadIcon class="h-4 w-4" />
													</a>
												</div>
											</div>
										</Card.Content>
									</Card.Root>
								{/each}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</Tabs.Content>

			<!-- Events Tab -->
			<Tabs.Content value="events" class="mt-6">
				<Card.Root>
					<Card.Header>
						<Card.Title>Activity Timeline</Card.Title>
						<Card.Description>Recent events and activities</Card.Description>
					</Card.Header>
					<Card.Content>
						{#if activities.length === 0}
							<p class="text-sm text-muted-foreground">No activities yet</p>
						{:else}
							<div class="relative">
								<div class="absolute top-2 bottom-2 left-2 w-px bg-border"></div>
								<div class="space-y-4">
									{#each activities as activity (activity.id)}
										<div class="relative pl-8">
											<div class="absolute top-1 left-0 h-4 w-4 rounded-full bg-primary"></div>
											<div class="flex flex-col gap-1">
												<p class="text-sm">{activity.description}</p>
												<p class="text-xs text-muted-foreground">
													{formatDateTime(activity.created)}
												</p>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</Tabs.Content>

			<!-- Interactions Tab -->
			<Tabs.Content value="interactions" class="mt-6">
				<Card.Root>
					<Card.Header>
						<Card.Title>Communication History</Card.Title>
						<Card.Description>Emails and messages sent to this customer</Card.Description>
						<Card.Action>
							<Button size="sm" onclick={openCRM}>
								<MessageSquareIcon class="mr-2 h-4 w-4" />
								New Message
							</Button>
						</Card.Action>
					</Card.Header>
					<Card.Content>
						{#if interactions.length === 0}
							<div class="py-8 text-center">
								<MessageSquareIcon class="mx-auto h-12 w-12 text-muted-foreground/50" />
								<p class="mt-2 text-sm text-muted-foreground">No interactions yet</p>
								<Button variant="outline" size="sm" class="mt-4" onclick={openCRM}>
									Start Communication
								</Button>
							</div>
						{:else}
							<div class="space-y-4">
								{#each interactions as interaction (interaction.id)}
									<div class="rounded-lg border p-4">
										<div class="flex items-start justify-between">
											<div>
												<p class="text-sm font-medium">{interaction.subject || 'Email'}</p>
												<p class="mt-1 text-xs text-muted-foreground">
													{interaction.email_type} • {formatDateTime(interaction.created)}
												</p>
											</div>
											<Badge variant={interaction.status === 'sent' ? 'default' : 'secondary'}>
												{interaction.status}
											</Badge>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</Tabs.Content>
		</Tabs.Root>
	</div>
{:else}
	<!-- Loading State -->
	<div class="flex flex-col gap-6 py-4">
		<Skeleton class="h-8 w-48" />
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
			{#each Array(4) as _}
				<Skeleton class="h-20" />
			{/each}
		</div>
		<Skeleton class="h-64" />
	</div>
{/if}
