<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { session, updateSessionOrganization } from '$lib/store/session.svelte';
	import { updateOrganization } from '$lib/core/org';
	import { createUser, suspendUser, activateUser } from '$lib/core/users';
	import { getFileUrl } from '$lib/infra/db/pb';
	import { formatDate } from '$lib/shared/date_time';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';
	import type { RoleWithPermissions } from '$lib/services/roles/role_service';
	import { getPermissionMeta } from '$lib/services/roles/permissions';
	import { Collections } from '$lib/types';

	import BuildingIcon from '@lucide/svelte/icons/building-2';
	import MailIcon from '@lucide/svelte/icons/mail';
	import PhoneIcon from '@lucide/svelte/icons/phone';
	import BankIcon from '@lucide/svelte/icons/landmark';
	import SaveIcon from '@lucide/svelte/icons/save';
	import BellIcon from '@lucide/svelte/icons/bell';
	import CameraIcon from '@lucide/svelte/icons/camera';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import UsersIcon from '@lucide/svelte/icons/users';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import UserIcon from '@lucide/svelte/icons/user';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let businessCode = 'dashboard';
	let activeTab = $state('profile');

	// Show all users including the current user
	let users = $derived(data.users || []);

	let roles = $derived<RoleWithPermissions[]>(data.roles || []);

	let directorRole = $derived(roles.find((r) => r.name.toLowerCase() === 'director'));
	let isCurrentUserDirector = $derived(
		directorRole && session.user?.expand?.role?.id === directorRole.id
	);

	// Sync tab from page data
	$effect(() => {
		activeTab = data.tab || 'profile';
	});

	// Profile form state
	let isEditingProfile = $state(false);
	let isSavingProfile = $state(false);
	let profileForm = $state({
		name: '',
		email: '',
		phone: '',
		bank_name: '',
		bank_account: '',
		account_number: '',
		mpesa_paybill: '',
		notification_email: ''
	});

	// New user dialog state
	let showAddUserDialog = $state(false);
	let isCreatingUser = $state(false);
	let newUserForm = $state({
		name: '',
		email: '',
		password: '',
		roleId: ''
	});

	// Sync profile form from session
	$effect(() => {
		if (session.organization) {
			profileForm = {
				name: session.organization.name || '',
				email: session.organization.email || '',
				phone: session.organization.phone || '',
				bank_name: session.organization.bank_name || '',
				bank_account: session.organization.bank_account || '',
				account_number: session.organization.account_number || '',
				mpesa_paybill: session.organization.mpesa_paybill || '',
				notification_email: session.organization.notification_email || ''
			};
		}
	});

	// Logo upload state (standalone — not coupled to main form save)
	let isUploadingLogo = $state(false);
	let isRemovingLogo = $state(false);
	let logoPreview = $state<string | null>(null);
	let logoFileInput = $state<HTMLInputElement | null>(null);

	let orgLogoUrl = $derived(
		logoPreview ??
		(session.organization?.logo
			? getFileUrl(Collections.Organization, session.organization.id, session.organization.logo)
			: null)
	);

	function handleLogoFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.[0]) return;
		const file = input.files[0];
		logoPreview = URL.createObjectURL(file);
		uploadLogo(file);
	}

	async function uploadLogo(file: File) {
		if (!session.organization) return;
		isUploadingLogo = true;
		try {
			const permissions = session.permissions || [];
			const actorId = session.user?.id || '';
			await updateOrganization(
				session.organization.id,
				{ logo: file },
				permissions,
				actorId
			);
			await updateSessionOrganization();
			toast.success('Logo updated');
		} catch (err) {
			logoPreview = null;
			toast.error(err instanceof Error ? err.message : 'Failed to upload logo');
		} finally {
			isUploadingLogo = false;
		}
	}

	async function handleRemoveLogo() {
		if (!session.organization) return;
		isRemovingLogo = true;
		try {
			const permissions = session.permissions || [];
			const actorId = session.user?.id || '';
			await updateOrganization(
				session.organization.id,
				{ logo: null },
				permissions,
				actorId
			);
			logoPreview = null;
			await updateSessionOrganization();
			toast.success('Logo removed');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to remove logo');
		} finally {
			isRemovingLogo = false;
		}
	}

	function handleTabChange(value: string) {
		if (value === activeTab) return;
		activeTab = value;
		goto(`/${businessCode}/org?tab=${value}`, { replaceState: true });
	}

	async function handleSaveProfile() {
		if (!session.organization) return;

		isSavingProfile = true;
		try {
			const permissions = session.permissions || [];
			const actorId = session.user?.id || '';
			await updateOrganization(session.organization.id, profileForm, permissions, actorId);
			toast.success('Organization updated successfully');
			isEditingProfile = false;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to update';
			toast.error(message);
		} finally {
			isSavingProfile = false;
		}
	}

	function handleCancelProfile() {
		if (session.organization) {
			profileForm = {
				name: session.organization.name || '',
				email: session.organization.email || '',
				phone: session.organization.phone || '',
				bank_name: session.organization.bank_name || '',
				bank_account: session.organization.bank_account || '',
				account_number: session.organization.account_number || '',
				mpesa_paybill: session.organization.mpesa_paybill || '',
				notification_email: session.organization.notification_email || ''
			};
		}
		isEditingProfile = false;
	}

	async function handleCreateUser() {
		if (!newUserForm.name || !newUserForm.email || !newUserForm.password || !newUserForm.roleId) {
			toast.error('Please fill in all required fields');
			return;
		}

		isCreatingUser = true;
		try {
			const permissions = session.permissions || [];
			const actorId = session.user?.id || '';
			await createUser(newUserForm, actorId, permissions);
			toast.success('User created successfully');
			showAddUserDialog = false;
			newUserForm = { name: '', email: '', password: '', roleId: '' };
			goto(`/${businessCode}/org?tab=team`, { invalidateAll: true });
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to create user';
			toast.error(message);
		} finally {
			isCreatingUser = false;
		}
	}

	async function handleToggleUserStatus(userId: string, currentStatus: string) {
		try {
			const permissions = session.permissions || [];
			const actorId = session.user?.id || '';

			// Director check
			const targetUser = users.find((u) => u.id === userId);
			const isTargetDirector = targetUser?.role === directorRole?.id;

			if (isCurrentUserDirector && isTargetDirector) {
				toast.error('Directors cannot suspend other directors');
				return;
			}

			if (currentStatus === 'active') {
				await suspendUser(userId, actorId, permissions);
				toast.success('User suspended');
			} else {
				await activateUser(userId, actorId, permissions);
				toast.success('User activated');
			}
			goto(`/${businessCode}/org?tab=team`, { invalidateAll: true });
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to update user';
			toast.error(message);
		}
	}

	function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' {
		return status === 'active' ? 'default' : 'destructive';
	}

	function getRoleName(roleId: string): string {
		const role = roles.find((r) => r.id === roleId);
		return role?.name || 'Unknown';
	}

	let expandedRolePermissions = $state<string[]>([]);
	function toggleRolePermissions(roleId: string) {
		if (expandedRolePermissions.includes(roleId)) {
			expandedRolePermissions = expandedRolePermissions.filter((id) => id !== roleId);
		} else {
			expandedRolePermissions = [...expandedRolePermissions, roleId];
		}
	}

	function getPermissionLabel(perm: string) {
		// @ts-ignore
		return getPermissionMeta(perm)?.label || perm;
	}
</script>

<svelte:head>
	<title>Organization | Inua Quick Link</title>
	<meta name="description" content="Manage your organization profile and team" />
</svelte:head>

<div class="flex flex-col gap-6 py-4 pb-24">
	<!-- Page Header -->
	<div class="flex flex-col gap-1">
		<h1 class="text-2xl font-semibold tracking-tight">Organization</h1>
		<p class="text-sm text-muted-foreground">
			Manage your organization profile, team members, and roles
		</p>
	</div>

	<!-- Tabs -->
	<Tabs.Root value={activeTab} onValueChange={handleTabChange}>
		<Tabs.List>
			<Tabs.Trigger value="profile" class="gap-2">
				<BuildingIcon class="h-4 w-4" />
				Profile
			</Tabs.Trigger>
			<Tabs.Trigger value="team" class="gap-2">
				<UsersIcon class="h-4 w-4" />
				Team
			</Tabs.Trigger>
			<Tabs.Trigger value="roles" class="gap-2">
				<ShieldIcon class="h-4 w-4" />
				Roles
			</Tabs.Trigger>
		</Tabs.List>
		<div class="">
			<!-- Profile Tab -->
			<Tabs.Content value="profile" class="mt-6 space-y-6">
				<Card.Root>
					<Card.Header>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<BuildingIcon class="h-5 w-5 text-primary" />
								<Card.Title>Organization Profile</Card.Title>
							</div>
							{#if session.organization?.code}
								<Badge variant="secondary">{session.organization.code}</Badge>
							{/if}
						</div>
						<Card.Description>Basic information and contact details</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-6">
						<!-- Logo Section -->
						<div class="space-y-2">
							<Label>Organization Logo</Label>
							<div class="flex items-center gap-6">
								<div class="relative h-20 w-20 overflow-hidden rounded-lg border bg-muted">
									{#if orgLogoUrl}
										<img
											src={orgLogoUrl}
											alt="Organization Logo"
											class="h-full w-full object-cover"
										/>
									{:else}
										<div class="flex h-full w-full items-center justify-center">
											<BuildingIcon class="h-8 w-8 text-muted-foreground/50" />
										</div>
									{/if}
									{#if isUploadingLogo || isRemovingLogo}
										<div class="absolute inset-0 flex items-center justify-center bg-background/70">
											<LoaderIcon class="h-5 w-5 animate-spin" />
										</div>
									{/if}
								</div>
								<div class="flex flex-col gap-2">
									<input
										bind:this={logoFileInput}
										type="file"
										accept="image/*"
										class="hidden"
										onchange={handleLogoFileSelect}
									/>
									<Button
										variant="outline"
										size="sm"
										onclick={() => logoFileInput?.click()}
										disabled={isUploadingLogo || isRemovingLogo}
									>
										<CameraIcon class="mr-2 h-4 w-4" />
										Upload Logo
									</Button>
									{#if session.organization?.logo || logoPreview}
										<Button
											variant="ghost"
											size="sm"
											onclick={handleRemoveLogo}
											disabled={isUploadingLogo || isRemovingLogo}
											class="text-destructive hover:text-destructive"
										>
											<TrashIcon class="mr-2 h-4 w-4" />
											Remove
										</Button>
									{/if}
								</div>
							</div>
						</div>
						<div class="grid gap-4 sm:grid-cols-2">
							<div class="space-y-2">
								<Label for="org-name">Organization Name</Label>
								<Input
									id="org-name"
									placeholder="Organization name"
									bind:value={profileForm.name}
									disabled={!isEditingProfile}
								/>
							</div>
							<div class="space-y-2">
								<Label for="org-email">Email Address</Label>
								<div class="relative">
									<MailIcon
										class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
									/>
									<Input
										id="org-email"
										type="email"
										class="pl-10"
										placeholder="contact@example.com"
										bind:value={profileForm.email}
										disabled={!isEditingProfile}
									/>
								</div>
							</div>
							<div class="space-y-2">
								<Label for="org-phone">Phone Number</Label>
								<div class="relative">
									<PhoneIcon
										class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
									/>
									<Input
										id="org-phone"
										class="pl-10"
										placeholder="+254 700 000 000"
										bind:value={profileForm.phone}
										disabled={!isEditingProfile}
									/>
								</div>
							</div>
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<div class="flex items-center gap-2">
							<BankIcon class="h-5 w-5 text-primary" />
							<Card.Title>Banking & Payment</Card.Title>
						</div>
						<Card.Description
							>Bank account and M-Pesa details for receiving payments</Card.Description
						>
					</Card.Header>
					<Card.Content class="space-y-6">
						<div class="grid gap-4 sm:grid-cols-2">
							<div class="space-y-2">
								<Label for="bank-name">Bank Name</Label>
								<Input
									id="bank-name"
									placeholder="e.g., Equity Bank"
									bind:value={profileForm.bank_name}
									disabled={!isEditingProfile}
								/>
							</div>
							<div class="space-y-2">
								<Label for="bank-account">Account Name</Label>
								<Input
									id="bank-account"
									placeholder="Account holder name"
									bind:value={profileForm.bank_account}
									disabled={!isEditingProfile}
								/>
							</div>
							<div class="space-y-2">
								<Label for="account-number">Account Number</Label>
								<Input
									id="account-number"
									placeholder="0123456789"
									bind:value={profileForm.account_number}
									disabled={!isEditingProfile}
								/>
							</div>
							<div class="space-y-2">
								<Label for="mpesa-paybill">M-Pesa Paybill</Label>
								<Input
									id="mpesa-paybill"
									placeholder="123456"
									bind:value={profileForm.mpesa_paybill}
									disabled={!isEditingProfile}
								/>
							</div>
						</div>
					</Card.Content>					</Card.Root>

					<Card.Root>
						<Card.Header>
							<div class="flex items-center gap-2">
								<BellIcon class="h-5 w-5 text-primary" />
								<Card.Title>Notifications</Card.Title>
							</div>
							<Card.Description>Email address that receives system notifications (loan events, alerts, daily summaries).
								Leave empty to use the main organization email.</Card.Description>
						</Card.Header>
						<Card.Content>
							<div class="max-w-sm space-y-2">
								<Label for="notification-email">Notification Email</Label>
								<div class="relative">
									<MailIcon
										class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
									/>
									<Input
										id="notification-email"
										type="email"
										class="pl-10"
										placeholder={session.organization?.email || 'notifications@example.com'}
										bind:value={profileForm.notification_email}
										disabled={!isEditingProfile}
									/>
								</div>
								{#if !isEditingProfile && !session.organization?.notification_email}
									<p class="text-xs text-muted-foreground">Using fallback: {session.organization?.email}</p>
								{/if}
							</div>
						</Card.Content>
					<Card.Footer class="flex justify-end gap-2">
						{#if isEditingProfile}
							<Button variant="outline" onclick={handleCancelProfile} disabled={isSavingProfile}>
								Cancel
							</Button>
							<Button onclick={handleSaveProfile} disabled={isSavingProfile}>
								{#if isSavingProfile}
									<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
									Saving...
								{:else}
									<SaveIcon class="mr-2 h-4 w-4" />
									Save Changes
								{/if}
							</Button>
						{:else}
							<Button onclick={() => (isEditingProfile = true)}>Edit Details</Button>
						{/if}
					</Card.Footer>
				</Card.Root>
			</Tabs.Content>

			<!-- Team Tab -->
			<Tabs.Content value="team" class="mt-6 space-y-6">
				<div class="flex items-center justify-between">
					<div>
						<h3 class="text-lg font-medium">Team Members</h3>
						<p class="text-sm text-muted-foreground">
							Manage users who have access to this organization
						</p>
					</div>
					<Button onclick={() => (showAddUserDialog = true)}>
						<UserPlusIcon class="mr-2 h-4 w-4" />
						Add User
					</Button>
				</div>

				<div class="rounded-lg border bg-card">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Name</Table.Head>
								<Table.Head class="hidden sm:table-cell">Email</Table.Head>
								<Table.Head>Role</Table.Head>
								<Table.Head>Status</Table.Head>
								<Table.Head class="hidden md:table-cell">Joined</Table.Head>
								<Table.Head class="text-right">Actions</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#if users.length === 0}
								<Table.Row>
									<Table.Cell colspan={6} class="h-24 text-center text-muted-foreground">
										No team members yet
									</Table.Cell>
								</Table.Row>
							{:else}
								{#each users as user (user.id)}
									<Table.Row>
										<Table.Cell class="font-medium">
											<div class="flex items-center gap-2">
												<div class="relative h-8 w-8 overflow-hidden rounded-full bg-muted">
													{#if user.avatar}
														<img
															src={getFileUrl(Collections.Users, user.id, user.avatar)}
															alt={user.name}
															class="h-full w-full object-cover"
														/>
													{:else}
														<div class="flex h-full w-full items-center justify-center">
															<UserIcon class="h-4 w-4 text-muted-foreground" />
														</div>
													{/if}
												</div>
												{user.name || 'Unnamed'}
											</div>
										</Table.Cell>
										<Table.Cell class="hidden text-muted-foreground sm:table-cell">
											{user.email}
										</Table.Cell>
										<Table.Cell>
											<Badge variant="outline">{getRoleName(user.role)}</Badge>
										</Table.Cell>
										<Table.Cell>
											<Badge variant={getStatusVariant(user.status || 'active')}>
												{user.status || 'active'}
											</Badge>
										</Table.Cell>
										<Table.Cell class="hidden text-muted-foreground md:table-cell">
											{formatDate(user.created)}
										</Table.Cell>
										<Table.Cell class="text-right">
											<Button
												size="sm"
												variant="ghost"
												disabled={isCurrentUserDirector && user.role === directorRole?.id}
												onclick={() => handleToggleUserStatus(user.id, user.status || 'active')}
											>
												{user.status === 'active' ? 'Suspend' : 'Activate'}
											</Button>
										</Table.Cell>
									</Table.Row>
								{/each}
							{/if}
						</Table.Body>
					</Table.Root>
				</div>
			</Tabs.Content>

			<!-- Roles Tab -->
			<Tabs.Content value="roles" class="mt-6 space-y-6">
				<div class="flex items-center justify-between">
					<div>
						<h3 class="text-lg font-medium">Roles & Permissions</h3>
						<p class="text-sm text-muted-foreground">View system roles and their permissions</p>
					</div>
				</div>

				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each roles as role (role.id)}
						<Card.Root>
							<Card.Header>
								<div class="flex items-center justify-between">
									<Card.Title class="text-base">{role.name}</Card.Title>
									{#if role.is_system}
										<Badge variant="secondary">System</Badge>
									{/if}
								</div>
								<Card.Description>{role.description || 'No description'}</Card.Description>
							</Card.Header>
							<Card.Content>
								<div class="flex flex-wrap gap-1">
									{#if role.permissions && role.permissions.length > 0}
										{@const isExpanded = expandedRolePermissions.includes(role.id)}
										{#if isExpanded}
											{#each role.permissions as perm}
												<Badge variant="outline" class="text-xs">{getPermissionLabel(perm)}</Badge>
											{/each}
											<Button
												variant="ghost"
												size="sm"
												class="h-5 text-xs"
												onclick={() => toggleRolePermissions(role.id)}
											>
												Show less
											</Button>
										{:else}
											{#each role.permissions.slice(0, 5) as perm}
												<Badge variant="outline" class="text-xs">{getPermissionLabel(perm)}</Badge>
											{/each}
											{#if role.permissions.length > 5}
												<Button
													variant="ghost"
													size="sm"
													class="h-5 text-xs"
													onclick={() => toggleRolePermissions(role.id)}
												>
													+{role.permissions.length - 5} more
												</Button>
											{/if}
										{/if}
									{:else}
										<span class="text-sm text-muted-foreground">No permissions</span>
									{/if}
								</div>
							</Card.Content>
						</Card.Root>
					{/each}
				</div>
			</Tabs.Content>
		</div>
	</Tabs.Root>
</div>

<!-- Add User Dialog -->
<Dialog.Root bind:open={showAddUserDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Add Team Member</Dialog.Title>
			<Dialog.Description>Create a new user account for your organization</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4 py-4">
			<div class="space-y-2">
				<Label for="new-user-name">Full Name</Label>
				<Input id="new-user-name" placeholder="John Doe" bind:value={newUserForm.name} />
			</div>
			<div class="space-y-2">
				<Label for="new-user-email">Email Address</Label>
				<Input
					id="new-user-email"
					type="email"
					placeholder="john@example.com"
					bind:value={newUserForm.email}
				/>
			</div>
			<div class="space-y-2">
				<Label for="new-user-password">Password</Label>
				<Input
					id="new-user-password"
					type="password"
					placeholder="Minimum 8 characters"
					bind:value={newUserForm.password}
				/>
			</div>
			<div class="space-y-2">
				<Label for="new-user-role">Role</Label>
				<Select.Root type="single" bind:value={newUserForm.roleId}>
					<Select.Trigger class="w-full">
						{roles.find((r) => r.id === newUserForm.roleId)?.name || 'Select a role'}
					</Select.Trigger>
					<Select.Content>
						{#each roles as role (role.id)}
							<Select.Item value={role.id}>{role.name}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</div>
		<Dialog.Footer>
			<Button
				variant="outline"
				onclick={() => (showAddUserDialog = false)}
				disabled={isCreatingUser}
			>
				Cancel
			</Button>
			<Button onclick={handleCreateUser} disabled={isCreatingUser}>
				{#if isCreatingUser}
					<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
					Creating...
				{:else}
					Create User
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
