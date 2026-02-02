/**
 * User management service
 */

import { pb } from '$lib/infra/db/pb';
import { Collections, UsersStatusOptions, type UsersResponse, type RolesResponse } from '$lib/types';
import { NotFoundError, ConflictError, ValidationError } from '$lib/shared/errors';
import { validateUser, normalizeEmail } from '$lib/shared/rules';
import { logUserCreated, logUserUpdated } from '$lib/core/activity/activity_service';
import { assertPermission, type UserPermissions } from '$lib/services/roles/permission_checker';
import { Permission, type PermissionType } from '$lib/services/roles/permissions';
import { getRoleById } from '$lib/services/roles/role_service';
import type { UserWithRole } from './auth_service';

/**
 * Create user input
 */
export interface CreateUserInput {
	name: string;
	email: string;
	password: string;
	roleId: string;
}

/**
 * Update user input
 */
export interface UpdateUserInput {
	name?: string;
	email?: string;
	roleId?: string;
	status?: UsersStatusOptions;
}

/**
 * Get all users
 */
export async function getAllUsers(
	actorPermissions: UserPermissions
): Promise<UserWithRole[]> {
	assertPermission(actorPermissions, Permission.USERS_VIEW);

	const records = await pb.collection(Collections.Users).getFullList<UserWithRole>({
		sort: 'name',
		expand: 'role'
	});
	return records;
}

/**
 * Get user by ID
 */
export async function getUserById(
	userId: string,
	actorPermissions: UserPermissions
): Promise<UserWithRole> {
	assertPermission(actorPermissions, Permission.USERS_VIEW);

	try {
		const user = await pb.collection(Collections.Users).getOne<UserWithRole>(userId, {
			expand: 'role'
		});
		return user;
	} catch {
		throw new NotFoundError('User', userId);
	}
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<UserWithRole | null> {
	try {
		const user = await pb.collection(Collections.Users).getFirstListItem<UserWithRole>(
			`email = "${normalizeEmail(email)}"`,
			{ expand: 'role' }
		);
		return user;
	} catch {
		return null;
	}
}

/**
 * Create a new user
 */
export async function createUser(
	input: CreateUserInput,
	actorId: string,
	actorPermissions: UserPermissions
): Promise<UserWithRole> {
	assertPermission(actorPermissions, Permission.USERS_CREATE);

	// Validate input
	const validation = validateUser(
		{ name: input.name, email: input.email, password: input.password, role: input.roleId },
		true
	);

	if (!validation.valid) {
		throw new ValidationError(validation.error || 'Invalid user data');
	}

	// Check for existing email
	const existing = await getUserByEmail(input.email);
	if (existing) {
		throw new ConflictError(`User with email '${input.email}' already exists`);
	}

	// Verify role exists
	await getRoleById(input.roleId);

	const user = await pb.collection(Collections.Users).create<UserWithRole>({
		name: input.name.trim(),
		email: normalizeEmail(input.email),
		password: input.password,
		passwordConfirm: input.password,
		role: input.roleId,
		status: UsersStatusOptions.active,
		emailVisibility: false
	});

	// Fetch with expanded role
	const userWithRole = await pb.collection(Collections.Users).getOne<UserWithRole>(user.id, {
		expand: 'role'
	});

	// Log activity
	await logUserCreated(user.id, actorId, input.name);

	return userWithRole;
}

/**
 * Update user
 */
export async function updateUser(
	userId: string,
	input: UpdateUserInput,
	actorId: string,
	actorPermissions: UserPermissions
): Promise<UserWithRole> {
	assertPermission(actorPermissions, Permission.USERS_UPDATE);

	// Get existing user
	const existing = await getUserById(userId, actorPermissions);

	// If changing email, check for duplicates
	if (input.email && normalizeEmail(input.email) !== existing.email) {
		const duplicate = await getUserByEmail(input.email);
		if (duplicate) {
			throw new ConflictError(`User with email '${input.email}' already exists`);
		}
	}

	// If changing role, verify it exists
	if (input.roleId) {
		await getRoleById(input.roleId);
	}

	const updateData: Record<string, unknown> = {};
	if (input.name) updateData.name = input.name.trim();
	if (input.email) updateData.email = normalizeEmail(input.email);
	if (input.roleId) updateData.role = input.roleId;
	if (input.status) updateData.status = input.status;

	const user = await pb.collection(Collections.Users).update<UserWithRole>(userId, updateData);

	// Fetch with expanded role
	const userWithRole = await pb.collection(Collections.Users).getOne<UserWithRole>(user.id, {
		expand: 'role'
	});

	// Log activity
	await logUserUpdated(userId, actorId, updateData);

	return userWithRole;
}

/**
 * Suspend a user
 */
export async function suspendUser(
	userId: string,
	actorId: string,
	actorPermissions: UserPermissions
): Promise<UserWithRole> {
	assertPermission(actorPermissions, Permission.USERS_MANAGE);

	return updateUser(
		userId,
		{ status: UsersStatusOptions.suspended },
		actorId,
		actorPermissions
	);
}

/**
 * Activate a user
 */
export async function activateUser(
	userId: string,
	actorId: string,
	actorPermissions: UserPermissions
): Promise<UserWithRole> {
	assertPermission(actorPermissions, Permission.USERS_MANAGE);

	return updateUser(
		userId,
		{ status: UsersStatusOptions.active },
		actorId,
		actorPermissions
	);
}

/**
 * Delete a user
 */
export async function deleteUser(
	userId: string,
	actorPermissions: UserPermissions
): Promise<void> {
	assertPermission(actorPermissions, Permission.USERS_DELETE);

	try {
		await pb.collection(Collections.Users).delete(userId);
	} catch {
		throw new NotFoundError('User', userId);
	}
}

/**
 * Change user password
 */
export async function changePassword(
	userId: string,
	oldPassword: string,
	newPassword: string
): Promise<void> {
	if (!oldPassword || !newPassword) {
		throw new ValidationError('Old and new passwords are required');
	}

	if (newPassword.length < 8) {
		throw new ValidationError('Password must be at least 8 characters');
	}

	await pb.collection(Collections.Users).update(userId, {
		oldPassword,
		password: newPassword,
		passwordConfirm: newPassword
	});
}

/**
 * Update user avatar
 */
export async function updateAvatar(
	userId: string,
	avatar: File,
	actorPermissions: UserPermissions
): Promise<UserWithRole> {
	assertPermission(actorPermissions, Permission.USERS_UPDATE);

	const formData = new FormData();
	formData.append('avatar', avatar);

	const user = await pb.collection(Collections.Users).update<UserWithRole>(userId, formData);

	return await pb.collection(Collections.Users).getOne<UserWithRole>(user.id, {
		expand: 'role'
	});
}

/**
 * Remove user avatar
 */
export async function removeAvatar(
	userId: string,
	actorPermissions: UserPermissions
): Promise<UserWithRole> {
	assertPermission(actorPermissions, Permission.USERS_UPDATE);

	const user = await pb.collection(Collections.Users).update<UserWithRole>(userId, {
		avatar: null
	});

	return await pb.collection(Collections.Users).getOne<UserWithRole>(user.id, {
		expand: 'role'
	});
}

/**
 * Get user count
 */
export async function getUserCount(): Promise<number> {
	const result = await pb.collection(Collections.Users).getList(1, 1);
	return result.totalItems;
}

/**
 * Get active users count
 */
export async function getActiveUserCount(): Promise<number> {
	const result = await pb.collection(Collections.Users).getList(1, 1, {
		filter: `status = "${UsersStatusOptions.active}"`
	});
	return result.totalItems;
}

/**
 * Search users by name or email
 */
export async function searchUsers(
	query: string,
	actorPermissions: UserPermissions
): Promise<UserWithRole[]> {
	assertPermission(actorPermissions, Permission.USERS_VIEW);

	const searchQuery = query.trim().toLowerCase();
	if (!searchQuery) return [];

	const result = await pb.collection(Collections.Users).getList<UserWithRole>(1, 20, {
		filter: `name ~ "${searchQuery}" || email ~ "${searchQuery}"`,
		expand: 'role',
		sort: 'name'
	});

	return result.items;
}
