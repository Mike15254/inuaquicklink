/**
 * Permission checking utilities
 * Used to verify user has required permissions for actions
 */

import { ForbiddenError, UnauthorizedError } from '$lib/shared/errors';
import type { PermissionType } from './permissions';

/**
 * User permissions data structure stored in role
 */
export type UserPermissions = PermissionType[];

/**
 * Check if user has a specific permission
 */
export function hasPermission(userPermissions: UserPermissions, permission: PermissionType): boolean {
	return userPermissions.includes(permission);
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(
	userPermissions: UserPermissions,
	permissions: PermissionType[]
): boolean {
	return permissions.every((p) => userPermissions.includes(p));
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(
	userPermissions: UserPermissions,
	permissions: PermissionType[]
): boolean {
	return permissions.some((p) => userPermissions.includes(p));
}

/**
 * Assert user has permission, throw ForbiddenError if not
 */
export function assertPermission(
	userPermissions: UserPermissions | undefined,
	permission: PermissionType
): void {
	if (!userPermissions) {
		throw new UnauthorizedError('User permissions not loaded');
	}

	if (!hasPermission(userPermissions, permission)) {
		throw new ForbiddenError(
			`You do not have permission to perform this action`,
			permission
		);
	}
}

/**
 * Assert user has all permissions, throw ForbiddenError if not
 */
export function assertAllPermissions(
	userPermissions: UserPermissions | undefined,
	permissions: PermissionType[]
): void {
	if (!userPermissions) {
		throw new UnauthorizedError('User permissions not loaded');
	}

	const missing = permissions.filter((p) => !userPermissions.includes(p));
	if (missing.length > 0) {
		throw new ForbiddenError(
			`Missing required permissions: ${missing.join(', ')}`,
			missing[0]
		);
	}
}

/**
 * Assert user has any of the permissions, throw ForbiddenError if none
 */
export function assertAnyPermission(
	userPermissions: UserPermissions | undefined,
	permissions: PermissionType[]
): void {
	if (!userPermissions) {
		throw new UnauthorizedError('User permissions not loaded');
	}

	if (!hasAnyPermission(userPermissions, permissions)) {
		throw new ForbiddenError(
			`Requires one of: ${permissions.join(', ')}`,
			permissions[0]
		);
	}
}

/**
 * Filter list of permissions to only those user has
 */
export function filterPermissions(
	userPermissions: UserPermissions,
	permissions: PermissionType[]
): PermissionType[] {
	return permissions.filter((p) => userPermissions.includes(p));
}

/**
 * Get missing permissions from a required list
 */
export function getMissingPermissions(
	userPermissions: UserPermissions,
	requiredPermissions: PermissionType[]
): PermissionType[] {
	return requiredPermissions.filter((p) => !userPermissions.includes(p));
}

/**
 * Create a permission guard function for reuse
 */
export function createPermissionGuard(permissions: UserPermissions) {
	return {
		has: (permission: PermissionType) => hasPermission(permissions, permission),
		hasAll: (perms: PermissionType[]) => hasAllPermissions(permissions, perms),
		hasAny: (perms: PermissionType[]) => hasAnyPermission(permissions, perms),
		assert: (permission: PermissionType) => assertPermission(permissions, permission),
		assertAll: (perms: PermissionType[]) => assertAllPermissions(permissions, perms),
		assertAny: (perms: PermissionType[]) => assertAnyPermission(permissions, perms)
	};
}
