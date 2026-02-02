/**
 * Roles service for managing roles and their permissions
 */

import { pb } from '$lib/infra/db/pb';
import { Collections, type RolesResponse } from '$lib/types';
import { NotFoundError, ConflictError, ValidationError } from '$lib/shared/errors';
import type { PermissionType } from './permissions';
import { DEFAULT_ROLE_PERMISSIONS, getAllPermissionKeys } from './permissions';

export type RoleWithPermissions = RolesResponse<PermissionType[]>;

/**
 * Get all roles
 */
export async function getAllRoles(): Promise<RoleWithPermissions[]> {
	const records = await pb.collection(Collections.Roles).getFullList<RoleWithPermissions>({
		sort: 'name'
	});
	return records;
}

/**
 * Get role by ID
 */
export async function getRoleById(roleId: string): Promise<RoleWithPermissions> {
	try {
		const role = await pb.collection(Collections.Roles).getOne<RoleWithPermissions>(roleId);
		return role;
	} catch {
		throw new NotFoundError('Role', roleId);
	}
}

/**
 * Get role by name
 */
export async function getRoleByName(name: string): Promise<RoleWithPermissions | null> {
	try {
		const role = await pb.collection(Collections.Roles).getFirstListItem<RoleWithPermissions>(
			`name = "${name}"`
		);
		return role;
	} catch {
		return null;
	}
}

/**
 * Get permissions for a role
 */
export async function getRolePermissions(roleId: string): Promise<PermissionType[]> {
	const role = await getRoleById(roleId);
	return role.permissions || [];
}

/**
 * Create a new role
 */
export async function createRole(
	name: string,
	description: string,
	permissions: PermissionType[]
): Promise<RoleWithPermissions> {
	// Validate name
	if (!name || name.trim().length < 2) {
		throw new ValidationError('Role name must be at least 2 characters', 'name');
	}

	// Check for duplicate name
	const existing = await getRoleByName(name);
	if (existing) {
		throw new ConflictError(`Role with name '${name}' already exists`);
	}

	// Validate permissions are valid
	const validPermissions = getAllPermissionKeys();
	const invalidPerms = permissions.filter((p) => !validPermissions.includes(p));
	if (invalidPerms.length > 0) {
		throw new ValidationError(`Invalid permissions: ${invalidPerms.join(', ')}`, 'permissions');
	}

	const role = await pb.collection(Collections.Roles).create<RoleWithPermissions>({
		name: name.trim(),
		description: description?.trim() || '',
		permissions,
		is_system: false
	});

	return role;
}

/**
 * Update role details
 */
export async function updateRole(
	roleId: string,
	data: {
		name?: string;
		description?: string;
		permissions?: PermissionType[];
	}
): Promise<RoleWithPermissions> {
	const existing = await getRoleById(roleId);

	// Prevent editing system roles
	if (existing.is_system) {
		throw new ValidationError('Cannot modify system roles');
	}

	// Check name uniqueness if changing
	if (data.name && data.name !== existing.name) {
		const duplicate = await getRoleByName(data.name);
		if (duplicate) {
			throw new ConflictError(`Role with name '${data.name}' already exists`);
		}
	}

	// Validate permissions if provided
	if (data.permissions) {
		const validPermissions = getAllPermissionKeys();
		const invalidPerms = data.permissions.filter((p) => !validPermissions.includes(p));
		if (invalidPerms.length > 0) {
			throw new ValidationError(`Invalid permissions: ${invalidPerms.join(', ')}`, 'permissions');
		}
	}

	const role = await pb.collection(Collections.Roles).update<RoleWithPermissions>(roleId, {
		...(data.name && { name: data.name.trim() }),
		...(data.description !== undefined && { description: data.description?.trim() || '' }),
		...(data.permissions && { permissions: data.permissions })
	});

	return role;
}

/**
 * Delete a role (only if not in use and not system role)
 */
export async function deleteRole(roleId: string): Promise<void> {
	const role = await getRoleById(roleId);

	// Prevent deleting system roles
	if (role.is_system) {
		throw new ValidationError('Cannot delete system roles');
	}

	// Check if any users have this role
	const usersWithRole = await pb.collection(Collections.Users).getList(1, 1, {
		filter: `role = "${roleId}"`
	});

	if (usersWithRole.totalItems > 0) {
		throw new ConflictError('Cannot delete role that is assigned to users');
	}

	await pb.collection(Collections.Roles).delete(roleId);
}

/**
 * Seed default roles if they don't exist
 */
export async function seedDefaultRoles(): Promise<void> {
	const roleConfigs = [
		{
			name: 'Admin',
			description: 'Full system access',
			permissions: DEFAULT_ROLE_PERMISSIONS.admin,
			is_system: true
		},
		{
			name: 'Manager',
			description: 'Manage loans, customers, and team',
			permissions: DEFAULT_ROLE_PERMISSIONS.manager,
			is_system: true
		},
		{
			name: 'Loan Officer',
			description: 'Process loans and manage customers',
			permissions: DEFAULT_ROLE_PERMISSIONS.officer,
			is_system: true
		},
		{
			name: 'Viewer',
			description: 'View-only access',
			permissions: DEFAULT_ROLE_PERMISSIONS.viewer,
			is_system: true
		}
	];

	for (const config of roleConfigs) {
		const existing = await getRoleByName(config.name);
		if (!existing) {
			await pb.collection(Collections.Roles).create({
				...config
			});
		}
	}
}

/**
 * Check if a role is a system role
 */
export function isSystemRole(role: RoleWithPermissions): boolean {
	return role.is_system === true;
}

/**
 * Get role count
 */
export async function getRoleCount(): Promise<number> {
	const result = await pb.collection(Collections.Roles).getList(1, 1);
	return result.totalItems;
}
