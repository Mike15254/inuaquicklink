<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import { session, updateSessionUser, sessionHasPermission } from '$lib/store/session.svelte';
	import { changePassword, updateAvatar, removeAvatar, updateUser } from '$lib/core/users';
	import { pb } from '$lib/infra/db/pb';
	import { toast } from 'svelte-sonner';
	import { Permission } from '$lib/services/roles/permissions';

	import UserIcon from '@lucide/svelte/icons/user';
	import KeyIcon from '@lucide/svelte/icons/key-round';
	import CameraIcon from '@lucide/svelte/icons/camera';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import SaveIcon from '@lucide/svelte/icons/save';
	import XIcon from '@lucide/svelte/icons/x';
	import TrashIcon from '@lucide/svelte/icons/trash-2';

	// Permission check
	let canEdit = $derived(sessionHasPermission(Permission.USERS_UPDATE));

	// ── Personal details ──────────────────────────────────────────────────────
	let isEditingDetails = $state(false);
	let isSavingDetails = $state(false);
	let detailsForm = $state({ name: '' });

	$effect(() => {
		if (session.user) {
			detailsForm.name = session.user.name || '';
		}
	});

	async function handleSaveDetails() {
		if (!session.user) return;
		if (!detailsForm.name.trim()) {
			toast.error('Name cannot be empty');
			return;
		}
		isSavingDetails = true;
		try {
			const permissions = session.permissions || [];
			await updateUser(session.user.id, { name: detailsForm.name.trim() }, session.user.id, permissions);
			await updateSessionUser();
			toast.success('Profile updated');
			isEditingDetails = false;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to update profile');
		} finally {
			isSavingDetails = false;
		}
	}

	function handleCancelDetails() {
		detailsForm.name = session.user?.name || '';
		isEditingDetails = false;
	}

	// ── Avatar ────────────────────────────────────────────────────────────────
	let isUploadingAvatar = $state(false);
	let isDeletingAvatar = $state(false);
	let avatarPreview = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	function getAvatarUrl(): string {
		if (avatarPreview) return avatarPreview;
		const user = session.user;
		if (!user) return '/avatars/default.png';
		if (!user.avatar) return '/avatars/default.png';
		return `${pb.baseUrl}/api/files/users/${user.id}/${user.avatar}`;
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.[0]) return;
		const file = input.files[0];
		avatarPreview = URL.createObjectURL(file);
		uploadAvatar(file);
	}

	async function uploadAvatar(file: File) {
		if (!session.user) return;
		isUploadingAvatar = true;
		try {
			const permissions = session.permissions || [];
			await updateAvatar(session.user.id, file, permissions);
			await updateSessionUser();
			toast.success('Avatar updated');
		} catch (err) {
			avatarPreview = null;
			toast.error(err instanceof Error ? err.message : 'Failed to upload avatar');
		} finally {
			isUploadingAvatar = false;
		}
	}

	async function handleRemoveAvatar() {
		if (!session.user) return;
		isDeletingAvatar = true;
		try {
			const permissions = session.permissions || [];
			await removeAvatar(session.user.id, permissions);
			avatarPreview = null;
			await updateSessionUser();
			toast.success('Avatar removed');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to remove avatar');
		} finally {
			isDeletingAvatar = false;
		}
	}

	// ── Password change ───────────────────────────────────────────────────────
	let isEditingPassword = $state(false);
	let isSavingPassword = $state(false);
	let passwordForm = $state({ currentPassword: '', newPassword: '', confirmPassword: '' });

	function handleCancelPassword() {
		passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
		isEditingPassword = false;
	}

	async function handleSavePassword() {
		if (!session.user) return;
		if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
			toast.error('All password fields are required');
			return;
		}
		if (passwordForm.newPassword !== passwordForm.confirmPassword) {
			toast.error('New passwords do not match');
			return;
		}
		if (passwordForm.newPassword.length < 8) {
			toast.error('Password must be at least 8 characters');
			return;
		}
		isSavingPassword = true;
		try {
			await changePassword(session.user.id, passwordForm.currentPassword, passwordForm.newPassword);
			toast.success('Password changed successfully');
			handleCancelPassword();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to change password');
		} finally {
			isSavingPassword = false;
		}
	}
</script>

<svelte:head>
	<title>My Profile | Inua Quick Link</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4 pb-24">
	<!-- Page Header -->
	<div class="flex flex-col gap-1">
		<h1 class="text-2xl font-semibold tracking-tight">My Profile</h1>
		<p class="text-sm text-muted-foreground">Manage your personal details, avatar, and password</p>
	</div>

	<!-- Avatar Card -->
	<Card.Root>
		<Card.Header>
			<div class="flex items-center gap-2">
				<CameraIcon class="h-5 w-5 text-primary" />
				<Card.Title>Profile Photo</Card.Title>
			</div>
			<Card.Description>Update your avatar shown across the dashboard</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="flex items-center gap-6">
				<div class="relative">
					<Avatar.Root class="size-20 rounded-lg">
						<Avatar.Image src={getAvatarUrl()} alt={session.user?.name || 'Avatar'} />
						<Avatar.Fallback class="rounded-lg text-lg">
							{session.user?.name?.charAt(0)?.toUpperCase() || 'U'}
						</Avatar.Fallback>
					</Avatar.Root>
					{#if isUploadingAvatar}
						<div class="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70">
							<LoaderIcon class="h-5 w-5 animate-spin" />
						</div>
					{/if}
				</div>
				{#if canEdit}
					<div class="flex flex-col gap-2">
						<input
							bind:this={fileInput}
							type="file"
							accept="image/*"
							class="hidden"
							onchange={handleFileSelect}
						/>
						<Button
							variant="outline"
							size="sm"
							onclick={() => fileInput?.click()}
							disabled={isUploadingAvatar || isDeletingAvatar}
						>
							<CameraIcon class="mr-2 h-4 w-4" />
							Upload Photo
						</Button>
						{#if session.user?.avatar}
							<Button
								variant="ghost"
								size="sm"
								onclick={handleRemoveAvatar}
								disabled={isUploadingAvatar || isDeletingAvatar}
								class="text-destructive hover:text-destructive"
							>
								{#if isDeletingAvatar}
									<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
								{:else}
									<TrashIcon class="mr-2 h-4 w-4" />
								{/if}
								Remove
							</Button>
						{/if}
					</div>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Personal Details Card -->
	<Card.Root>
		<Card.Header>
			<div class="flex items-center gap-2">
				<UserIcon class="h-5 w-5 text-primary" />
				<Card.Title>Personal Details</Card.Title>
			</div>
			<Card.Description>Your name and account email</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<Label for="profile-name">Full Name</Label>
					<Input
						id="profile-name"
						placeholder="Your name"
						bind:value={detailsForm.name}
						disabled={!isEditingDetails}
					/>
				</div>
				<div class="space-y-2">
					<Label for="profile-email">Email Address</Label>
					<Input
						id="profile-email"
						type="email"
						value={session.user?.email || ''}
						disabled
						class="text-muted-foreground"
					/>
					<p class="text-xs text-muted-foreground">Email cannot be changed here</p>
				</div>
			</div>
		</Card.Content>
		{#if canEdit}
			<Card.Footer class="flex justify-end gap-2">
				{#if isEditingDetails}
					<Button variant="outline" onclick={handleCancelDetails} disabled={isSavingDetails}>
						<XIcon class="mr-2 h-4 w-4" />
						Cancel
					</Button>
					<Button onclick={handleSaveDetails} disabled={isSavingDetails}>
						{#if isSavingDetails}
							<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
							Saving...
						{:else}
							<SaveIcon class="mr-2 h-4 w-4" />
							Save
						{/if}
					</Button>
				{:else}
					<Button onclick={() => (isEditingDetails = true)}>Edit Details</Button>
				{/if}
			</Card.Footer>
		{/if}
	</Card.Root>

	<!-- Password Card -->
	<Card.Root>
		<Card.Header>
			<div class="flex items-center gap-2">
				<KeyIcon class="h-5 w-5 text-primary" />
				<Card.Title>Change Password</Card.Title>
			</div>
			<Card.Description>Update your login password. Minimum 8 characters.</Card.Description>
		</Card.Header>
		{#if isEditingPassword}
			<Card.Content class="space-y-4">
				<div class="max-w-sm space-y-4">
					<div class="space-y-2">
						<Label for="current-password">Current Password</Label>
						<Input
							id="current-password"
							type="password"
							placeholder="Enter current password"
							bind:value={passwordForm.currentPassword}
						/>
					</div>
					<div class="space-y-2">
						<Label for="new-password">New Password</Label>
						<Input
							id="new-password"
							type="password"
							placeholder="At least 8 characters"
							bind:value={passwordForm.newPassword}
						/>
					</div>
					<div class="space-y-2">
						<Label for="confirm-password">Confirm New Password</Label>
						<Input
							id="confirm-password"
							type="password"
							placeholder="Repeat new password"
							bind:value={passwordForm.confirmPassword}
						/>
					</div>
				</div>
			</Card.Content>
			<Card.Footer class="flex justify-end gap-2">
				<Button variant="outline" onclick={handleCancelPassword} disabled={isSavingPassword}>
					<XIcon class="mr-2 h-4 w-4" />
					Cancel
				</Button>
				<Button onclick={handleSavePassword} disabled={isSavingPassword}>
					{#if isSavingPassword}
						<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
						Saving...
					{:else}
						<SaveIcon class="mr-2 h-4 w-4" />
						Change Password
					{/if}
				</Button>
			</Card.Footer>
		{:else}
			<Card.Footer>
				<Button variant="outline" onclick={() => (isEditingPassword = true)}>
					<KeyIcon class="mr-2 h-4 w-4" />
					Change Password
				</Button>
			</Card.Footer>
		{/if}
	</Card.Root>
</div>
