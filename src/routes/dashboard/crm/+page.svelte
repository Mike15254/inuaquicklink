<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import {
		generateOverdueNoticeContent,
		generatePaymentReminderContent,
		type CustomerContext
	} from '$lib/core/crm';
	import { searchCustomers } from '$lib/core/customers';
	import { formatKES } from '$lib/shared/currency';
	import { formatDate, formatDateTime } from '$lib/shared/date_time';
	import { session } from '$lib/store/session.svelte';
	import type { CustomersResponse } from '$lib/types';
	import { toast } from 'svelte-sonner';
	import type { ActionData, PageData } from './$types';

	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import MailIcon from '@lucide/svelte/icons/mail';
	import PhoneIcon from '@lucide/svelte/icons/phone';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SendIcon from '@lucide/svelte/icons/send';
	import UserIcon from '@lucide/svelte/icons/user';
	import UsersIcon from '@lucide/svelte/icons/users';
	import XIcon from '@lucide/svelte/icons/x';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	// Derived values
	let businessCode = 'dashboard';
	let stats = $derived(data.stats);
	let followUpCustomers = $derived(data.followUpCustomers || []);
	let overdueCustomers = $derived(data.overdueCustomers || []);
	let recentEmails = $derived(data.recentEmails || []);

	// Customer search state
	let customerSearchQuery = $state('');
	let customerSearchResults = $state<CustomersResponse[]>([]);
	let isSearching = $state(false);
	let selectedCustomer = $state<CustomersResponse | null>(null);

	// Email compose state
	let showEmailComposer = $state(false);
	let emailSubject = $state('');
	let emailBody = $state('');
	let isSendingEmail = $state(false);

	// Interaction scheduling state
	let showScheduler = $state(false);
	let scheduleType = $state<'call' | 'meeting' | 'email'>('call');
	let scheduleDate = $state('');
	let scheduleTime = $state('');
	let scheduleNotes = $state('');
	let isScheduling = $state(false);

	// Sync selected customer from URL param
	$effect(() => {
		selectedCustomer = data.selectedCustomer || null;
	});

	// Customer search handler
	async function handleCustomerSearch() {
		if (customerSearchQuery.trim().length < 2) {
			customerSearchResults = [];
			return;
		}

		isSearching = true;
		try {
			const permissions = session.permissions || [];
			customerSearchResults = await searchCustomers(customerSearchQuery, permissions, 10);
		} catch (error) {
			console.error('Search failed:', error);
			customerSearchResults = [];
		} finally {
			isSearching = false;
		}
	}

	function selectCustomer(customer: CustomersResponse) {
		selectedCustomer = customer;
		customerSearchQuery = '';
		customerSearchResults = [];
		goto(`/${businessCode}/crm?customer=${customer.id}`, { replaceState: true });
	}

	function clearSelectedCustomer() {
		selectedCustomer = null;
		goto(`/${businessCode}/crm`, { replaceState: true });
	}

	// Email handlers
	function openEmailComposer(template?: 'reminder' | 'overdue' | 'custom') {
		if (!selectedCustomer) {
			toast.error('Please select a customer first');
			return;
		}

		const orgName = session.organization?.name || 'inuaquicklink';
		const orgPhone = session.organization?.phone || '';
		const orgEmail = session.organization?.email || '';

		if (template === 'reminder') {
			const content = generatePaymentReminderContent({
				customerName: selectedCustomer.name,
				organizationName: orgName,
				organizationPhone: orgPhone,
				organizationEmail: orgEmail
			});
			emailSubject = content.subject;
			emailBody = content.body;
		} else if (template === 'overdue') {
			const content = generateOverdueNoticeContent({
				customerName: selectedCustomer.name,
				organizationName: orgName,
				organizationPhone: orgPhone,
				organizationEmail: orgEmail
			});
			emailSubject = content.subject;
			emailBody = content.body;
		} else {
			emailSubject = '';
			emailBody = '';
		}

		showEmailComposer = true;
	}

	// Handle form result for email sending
	$effect(() => {
		if (form) {
			if (form.success) {
				toast.success('Email sent successfully');
				showEmailComposer = false;
				emailSubject = '';
				emailBody = '';
			} else if (form.error) {
				toast.error(form.error || 'Failed to send email');
			}
			isSendingEmail = false;
		}
	});

	function handleEmailSubmit() {
		if (!selectedCustomer || !session.user) {
			toast.error('Please select a customer first');
			return false;
		}

		if (!emailSubject.trim() || !emailBody.trim()) {
			toast.error('Please enter subject and body');
			return false;
		}

		isSendingEmail = true;
		return true;
	}

	// Schedule interaction handler
	function openScheduler() {
		if (!selectedCustomer) {
			toast.error('Please select a customer first');
			return;
		}
		showScheduler = true;
	}

	async function scheduleInteraction() {
		if (!selectedCustomer) return;

		if (!scheduleDate || !scheduleTime) {
			toast.error('Please select date and time');
			return;
		}

		isScheduling = true;
		try {
			// For now, we'll just show a success message
			// In production, this would create a scheduled task or calendar event
			toast.success(
				`${scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1)} scheduled for ${formatDate(scheduleDate)} at ${scheduleTime}`
			);
			showScheduler = false;
			scheduleDate = '';
			scheduleTime = '';
			scheduleNotes = '';
		} catch (error) {
			console.error('Failed to schedule:', error);
			toast.error('Failed to schedule interaction');
		} finally {
			isScheduling = false;
		}
	}

	function viewCustomer(customerId: string) {
		goto(`/${businessCode}/customers/${customerId}`);
	}

	function selectFromFollowUp(context: CustomerContext) {
		selectedCustomer = context.customer;
		goto(`/${businessCode}/crm?customer=${context.customer.id}`, { replaceState: true });
	}
</script>

<svelte:head>
	<title>CRM | inuaquicklink</title>
	<meta name="description" content="Customer relationship management" />
</svelte:head>

<div class="flex flex-col gap-6 py-4 pb-24">
	<!-- Page Header -->
	<div class="flex flex-col gap-1">
		<h1 class="text-2xl font-semibold tracking-tight">CRM</h1>
		<p class="text-sm text-muted-foreground">Manage customer communications and follow-ups</p>
	</div>

	<!-- Stats Cards -->
	<div
		class="grid grid-cols-2 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:grid-cols-4 dark:*:data-[slot=card]:bg-card"
	>
		<Card.Root class="@container/card">
			<Card.Header>
				<Card.Description class="flex items-center gap-2">
					<UsersIcon class="h-4 w-4" />
					Need Follow-up
				</Card.Description>
				<Card.Title class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
					{stats?.customersNeedingFollowUp ?? 0}
				</Card.Title>
			</Card.Header>
		</Card.Root>

		<Card.Root class="@container/card">
			<Card.Header>
				<Card.Description class="flex items-center gap-2 text-destructive">
					<AlertTriangleIcon class="h-4 w-4" />
					Overdue
				</Card.Description>
				<Card.Title
					class="text-2xl font-semibold text-destructive tabular-nums @[250px]/card:text-3xl"
				>
					{stats?.overdueLoansCount ?? 0}
				</Card.Title>
			</Card.Header>
		</Card.Root>

		<Card.Root class="@container/card">
			<Card.Header>
				<Card.Description class="flex items-center gap-2">
					<ClockIcon class="h-4 w-4" />
					Due Soon
				</Card.Description>
				<Card.Title class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
					{stats?.upcomingDueCount ?? 0}
				</Card.Title>
			</Card.Header>
		</Card.Root>

		<Card.Root class="@container/card">
			<Card.Header>
				<Card.Description class="flex items-center gap-2">
					<MailIcon class="h-4 w-4" />
					Active Loans
				</Card.Description>
				<Card.Title class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
					{stats?.totalActiveLoans ?? 0}
				</Card.Title>
			</Card.Header>
		</Card.Root>
	</div>

	<!-- Main Content -->
	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Left Column: Customer Selection & Actions -->
		<div class="space-y-4 lg:col-span-1">
			<!-- Customer Search -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<UserIcon class="h-4 w-4" />
						Select Customer
					</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="space-y-4">
						<div class="relative">
							<SearchIcon
								class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								class="pl-10"
								placeholder="Search by name, email, phone..."
								bind:value={customerSearchQuery}
								oninput={handleCustomerSearch}
							/>
							{#if isSearching}
								<LoaderIcon
									class="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin"
								/>
							{/if}
						</div>

						<!-- Search Results -->
						{#if customerSearchResults.length > 0}
							<div class="max-h-48 overflow-y-auto rounded-lg border">
								{#each customerSearchResults as customer (customer.id)}
									<button
										class="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/50"
										onclick={() => selectCustomer(customer)}
									>
										<div>
											<p class="text-sm font-medium">{customer.name}</p>
											<p class="text-xs text-muted-foreground">{customer.email}</p>
										</div>
										<CheckIcon class="h-4 w-4 text-primary" />
									</button>
								{/each}
							</div>
						{/if}

						<!-- Selected Customer -->
						{#if selectedCustomer}
							<div class="rounded-lg border bg-muted/30 p-4">
								<div class="flex items-start justify-between">
									<div>
										<p class="font-medium">{selectedCustomer.name}</p>
										<p class="text-sm text-muted-foreground">{selectedCustomer.email}</p>
										<p class="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
									</div>
									<Button variant="ghost" size="sm" onclick={clearSelectedCustomer}>
										<XIcon class="h-4 w-4" />
									</Button>
								</div>
								<div class="mt-3 flex gap-2">
									<Button
										size="sm"
										variant="outline"
										onclick={() => viewCustomer(selectedCustomer!.id)}
									>
										<EyeIcon class="mr-2 h-4 w-4" />
										View
									</Button>
								</div>
							</div>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Quick Actions -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Quick Actions</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-2">
					<Button
						variant="default"
						class="w-full justify-start"
						onclick={() => openEmailComposer('custom')}
						disabled={!selectedCustomer}
					>
						<MailIcon class="mr-2 h-4 w-4" />
						Send Email
					</Button>
					<Button
						variant="outline"
						class="w-full justify-start"
						onclick={() => openEmailComposer('reminder')}
						disabled={!selectedCustomer}
					>
						<ClockIcon class="mr-2 h-4 w-4" />
						Payment Reminder
					</Button>
					<Button
						variant="outline"
						class="w-full justify-start text-destructive"
						onclick={() => openEmailComposer('overdue')}
						disabled={!selectedCustomer}
					>
						<AlertTriangleIcon class="mr-2 h-4 w-4" />
						Overdue Notice
					</Button>
					<hr class="my-2" />
					<Button
						variant="secondary"
						class="w-full justify-start"
						onclick={openScheduler}
						disabled={!selectedCustomer}
					>
						<CalendarIcon class="mr-2 h-4 w-4" />
						Schedule Interaction
					</Button>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Right Column: Follow-up Lists & Email History -->
		<div class="space-y-4 lg:col-span-2">
			<Tabs.Root value="followup" class="w-full">
				<Tabs.List class="grid w-full grid-cols-3">
					<Tabs.Trigger value="followup">Follow-up</Tabs.Trigger>
					<Tabs.Trigger value="overdue">Overdue</Tabs.Trigger>
					<Tabs.Trigger value="history">Email History</Tabs.Trigger>
				</Tabs.List>

				<!-- Follow-up Tab -->
				<Tabs.Content value="followup" class="mt-4">
					<Card.Root>
						<Card.Header>
							<Card.Title>Customers Needing Follow-up</Card.Title>
							<Card.Description>Loans due within 7 days or overdue</Card.Description>
						</Card.Header>
						<Card.Content>
							{#if followUpCustomers.length === 0}
								<div class="py-8 text-center">
									<UsersIcon class="mx-auto h-12 w-12 text-muted-foreground/50" />
									<p class="mt-2 text-sm text-muted-foreground">No customers need follow-up</p>
								</div>
							{:else}
								<div class="space-y-3">
									{#each followUpCustomers as context (context.customer.id)}
										<button
											class="w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
											onclick={() => selectFromFollowUp(context)}
										>
											<div class="flex items-start justify-between">
												<div>
													<p class="font-medium">{context.customer.name}</p>
													<p class="text-sm text-muted-foreground">{context.customer.email}</p>
												</div>
												<div class="text-right">
													<Badge
														variant={context.overdueLoans.length > 0 ? 'destructive' : 'secondary'}
													>
														{context.overdueLoans.length > 0 ? 'Overdue' : 'Due Soon'}
													</Badge>
												</div>
											</div>
											<div class="mt-2 text-xs text-muted-foreground">
												{context.activeLoans.length} active loan{context.activeLoans.length !== 1
													? 's'
													: ''}
												{#if context.overdueLoans.length > 0}
													• {context.overdueLoans.length} overdue
												{/if}
											</div>
										</button>
									{/each}
								</div>
							{/if}
						</Card.Content>
					</Card.Root>
				</Tabs.Content>

				<!-- Overdue Tab -->
				<Tabs.Content value="overdue" class="mt-4">
					<Card.Root>
						<Card.Header>
							<Card.Title class="text-destructive">Overdue Customers</Card.Title>
							<Card.Description>Customers with overdue loan payments</Card.Description>
						</Card.Header>
						<Card.Content>
							{#if overdueCustomers.length === 0}
								<div class="py-8 text-center">
									<CheckIcon class="mx-auto h-12 w-12 text-green-500/50" />
									<p class="mt-2 text-sm text-muted-foreground">No overdue customers</p>
								</div>
							{:else}
								<div class="space-y-3">
									{#each overdueCustomers as context (context.customer.id)}
										<button
											class="w-full rounded-lg border border-destructive/20 p-4 text-left transition-colors hover:bg-destructive/5"
											onclick={() => selectFromFollowUp(context)}
										>
											<div class="flex items-start justify-between">
												<div>
													<p class="font-medium">{context.customer.name}</p>
													<p class="text-sm text-muted-foreground">{context.customer.phone}</p>
												</div>
												<Badge variant="destructive">
													{context.overdueLoans.length} overdue
												</Badge>
											</div>
											{#each context.overdueLoans.slice(0, 2) as loan (loan.id)}
												<div class="mt-2 text-xs text-muted-foreground">
													{loan.loan_number} • {formatKES(loan.balance)} balance
												</div>
											{/each}
										</button>
									{/each}
								</div>
							{/if}
						</Card.Content>
					</Card.Root>
				</Tabs.Content>

				<!-- Email History Tab -->
				<Tabs.Content value="history" class="mt-4">
					<Card.Root>
						<Card.Header>
							<Card.Title>Recent Emails</Card.Title>
							<Card.Description>Communication history</Card.Description>
						</Card.Header>
						<Card.Content>
							{#if recentEmails.length === 0}
								<div class="py-8 text-center">
									<MailIcon class="mx-auto h-12 w-12 text-muted-foreground/50" />
									<p class="mt-2 text-sm text-muted-foreground">No emails sent yet</p>
								</div>
							{:else}
								<Table.Root>
									<Table.Header>
										<Table.Row>
											<Table.Head>Recipient</Table.Head>
											<Table.Head class="hidden sm:table-cell">Subject</Table.Head>
											<Table.Head class="hidden md:table-cell">Date</Table.Head>
											<Table.Head>Status</Table.Head>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{#each recentEmails as email (email.id)}
											<Table.Row>
												<Table.Cell class="text-sm font-medium">
													{email.recipient_email}
												</Table.Cell>
												<Table.Cell class="hidden text-sm text-muted-foreground sm:table-cell">
													{email.subject || 'No subject'}
												</Table.Cell>
												<Table.Cell class="hidden text-sm text-muted-foreground md:table-cell">
													{formatDateTime(email.created)}
												</Table.Cell>
												<Table.Cell>
													<Badge
														variant={email.status === 'sent'
															? 'default'
															: email.status === 'failed'
																? 'destructive'
																: 'secondary'}
													>
														{email.status}
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
			</Tabs.Root>
		</div>
	</div>

	<!-- Email Composer Modal -->
	{#if showEmailComposer && selectedCustomer}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
		>
			<Card.Root class="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<MailIcon class="h-5 w-5" />
						Send Email
					</Card.Title>
					<Card.Description>
						To: {selectedCustomer.name} ({selectedCustomer.email})
					</Card.Description>
				</Card.Header>
				<form
					method="POST"
					action="?/sendEmail"
					use:enhance={({ cancel }) => {
						if (!handleEmailSubmit()) {
							cancel();
							return;
						}
						return async ({ update }) => {
							await update();
						};
					}}
				>
					<!-- Hidden fields -->
					<input type="hidden" name="to" value={selectedCustomer.email} />
					<input type="hidden" name="customerId" value={selectedCustomer.id} />
					<input type="hidden" name="sentBy" value={session.user?.id || ''} />
					<input type="hidden" name="html" value={emailBody.replace(/\n/g, '<br>')} />

					<Card.Content class="space-y-4">
						<div class="space-y-2">
							<Label for="emailSubject">Subject</Label>
							<Input
								id="emailSubject"
								name="subject"
								placeholder="Email subject..."
								bind:value={emailSubject}
							/>
						</div>
						<div class="space-y-2">
							<Label for="emailBody">Message</Label>
							<textarea
								id="emailBody"
								class="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
								placeholder="Write your message..."
								bind:value={emailBody}
							></textarea>
						</div>
					</Card.Content>
					<Card.Footer class="flex justify-end gap-2">
						<Button type="button" variant="outline" onclick={() => (showEmailComposer = false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSendingEmail}>
							{#if isSendingEmail}
								<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
							{:else}
								<SendIcon class="mr-2 h-4 w-4" />
							{/if}
							Send Email
						</Button>
					</Card.Footer>
				</form>
			</Card.Root>
		</div>
	{/if}

	<!-- Scheduler Modal -->
	{#if showScheduler && selectedCustomer}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
		>
			<Card.Root class="w-full max-w-md">
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<CalendarIcon class="h-5 w-5" />
						Schedule Interaction
					</Card.Title>
					<Card.Description>
						For: {selectedCustomer.name}
					</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="space-y-2">
						<Label>Interaction Type</Label>
						<Select.Root
							type="single"
							value={scheduleType}
							onValueChange={(v) => {
								if (v) scheduleType = v as 'call' | 'meeting' | 'email';
							}}
						>
							<Select.Trigger class="w-full">
								{scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1)}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="call">
									<PhoneIcon class="mr-2 inline h-4 w-4" />
									Phone Call
								</Select.Item>
								<Select.Item value="meeting">
									<UsersIcon class="mr-2 inline h-4 w-4" />
									Meeting
								</Select.Item>
								<Select.Item value="email">
									<MailIcon class="mr-2 inline h-4 w-4" />
									Email
								</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="scheduleDate">Date</Label>
							<Input
								id="scheduleDate"
								type="date"
								bind:value={scheduleDate}
								min={new Date().toISOString().split('T')[0]}
							/>
						</div>
						<div class="space-y-2">
							<Label for="scheduleTime">Time</Label>
							<Input id="scheduleTime" type="time" bind:value={scheduleTime} />
						</div>
					</div>
					<div class="space-y-2">
						<Label for="scheduleNotes">Notes (optional)</Label>
						<Input id="scheduleNotes" placeholder="Add notes..." bind:value={scheduleNotes} />
					</div>
				</Card.Content>
				<Card.Footer class="flex justify-end gap-2">
					<Button variant="outline" onclick={() => (showScheduler = false)}>Cancel</Button>
					<Button onclick={scheduleInteraction} disabled={isScheduling}>
						{#if isScheduling}
							<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
						{:else}
							<CheckIcon class="mr-2 h-4 w-4" />
						{/if}
						Schedule
					</Button>
				</Card.Footer>
			</Card.Root>
		</div>
	{/if}
</div>
