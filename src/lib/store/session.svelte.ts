/**
 * SIMPLIFIED User session store - works with PocketBase's built-in localStorage auth
 * Only stores organization and permissions in memory for quick access  
 * Uses Svelte 5 runes for reactivity
 */

import type { UsersResponse, RolesResponse, OrganizationResponse } from '$lib/types';
import type { PermissionType } from '$lib/services/roles/permissions';
import {
	hasPermission,
	hasAllPermissions,
	hasAnyPermission,
	createPermissionGuard
} from '$lib/services/roles/permission_checker';
import { getUserAvatarUrl, clearAuth, pb } from '$lib/infra/db/pb';
import { browser } from '$app/environment';
import { Collections } from '$lib/types';

/**
 * User with expanded role and organization type
 */
export type SessionUser = UsersResponse<{ 
	role: RolesResponse<PermissionType[]>;
	organization: OrganizationResponse;
}>;

/**
 * Session state interface
 */
interface SessionState {
	user: SessionUser | null;
	organization: OrganizationResponse | null;
	permissions: PermissionType[];
	isAuthenticated: boolean;
	isLoading: boolean;
}

/**
 * Create the session state with runes
 */
function createSessionState() {
	let user = $state<SessionUser | null>(null);
	let organization = $state<OrganizationResponse | null>(null);
	let permissions = $state<PermissionType[]>([]);
	let isLoading = $state<boolean>(true);

	return {
		get user() {
			return user;
		},
		set user(value: SessionUser | null) {
			user = value;
		},
		get organization() {
			return organization;
		},
		set organization(value: OrganizationResponse | null) {
			organization = value;
		},
		get permissions() {
			return permissions;
		},
		set permissions(value: PermissionType[]) {
			permissions = value;
		},
		get isAuthenticated() {
			return user !== null && pb.authStore.isValid;
		},
		get isLoading() {
			return isLoading;
		},
		set isLoading(value: boolean) {
			isLoading = value;
		},
		get token() {
			return pb.authStore.token;
		}
	};
}

/**
 * Global session state
 */
export const session = createSessionState();

/**
 * Initialize session with user data and organization
 * Called after successful login
 */
export function initSession(
	user: SessionUser,
	organization: OrganizationResponse,
	token: string
): void {
	session.user = user;
	session.organization = organization;
	session.permissions = user?.expand?.role?.permissions || [];
	session.isLoading = false;

	// PocketBase authStore should already be set from login
	// but ensure it's synced
	if (token && user && !pb.authStore.isValid) {
		pb.authStore.save(token, user);
	}

	console.log('[Session] Session initialized:', {
		userId: user.id,
		userName: user.name || user.email,
		orgCode: organization.code,
		permissions: session.permissions.length
	});
}

/**
 * Restore session from PocketBase's localStorage
 * PocketBase automatically restores auth from localStorage on page load
 */
export function restoreSession(): void {
	// Check if PocketBase already has a valid auth state from localStorage
	if (!pb.authStore.isValid || !pb.authStore.record) {
		console.log('[Session] No valid PocketBase auth found in localStorage');
		session.isLoading = false;
		return;
	}

	try {
		const record = pb.authStore.record as any;
		console.log('[Session] Found PocketBase auth, record ID:', record.id);
		
		// Check if we already have the expanded data in the record
		if (record.expand?.role && record.expand?.organization) {
			console.log('[Session] Using expanded data from PocketBase record');
			
			const user = record as SessionUser;
			const organization = user.expand.organization;
			
			if (!organization) {
				console.warn('[Session] User has no organization in expanded data');
				clearSession();
				return;
			}
			
			// Check if user is suspended
			if (user.status === 'suspended') {
				console.warn('[Session] User is suspended');
				clearSession();
				return;
			}

			// Restore session state from the record
			session.user = user;
			session.organization = organization;
			session.permissions = user.expand?.role?.permissions || [];
			session.isLoading = false;

			console.log('[Session] Session restored from PocketBase record:', {
				userId: user.id,
				userName: user.name || user.email,
				orgCode: organization.code,
				permissions: session.permissions.length
			});
		} else {
			// We don't have expanded data - need to fetch it fresh
			// But we'll do this in a non-blocking way
			console.log('[Session] PocketBase record missing expanded data, will fetch on first API call');
			
			// For now, just mark as partially restored
			session.user = record as SessionUser;
			session.isLoading = false;
			
			// Fetch the full data in the background
			fetchExpandedUserData(record.id).catch(err => {
				console.error('[Session] Failed to fetch expanded user data:', err);
				clearSession();
			});
		}
	} catch (error) {
		console.warn('[Session] Error during session restore:', error);
		session.isLoading = false;
	}
}

/**
 * Fetch expanded user data (role and organization)
 */
async function fetchExpandedUserData(userId: string): Promise<void> {
	try {
		console.log('[Session] Fetching expanded user data for:', userId);
		
		const user = await pb.collection(Collections.Users).getOne<SessionUser>(
			userId,
			{ expand: 'role,organization' }
		);

		const organization = user.expand?.organization;
		if (!organization) {
			console.warn('[Session] User has no organization');
			clearSession();
			return;
		}

		// Check if user is suspended
		if (user.status === 'suspended') {
			console.warn('[Session] User is suspended');
			clearSession();
			return;
		}

		// Update session state with fresh data
		session.user = user;
		session.organization = organization;
		session.permissions = user.expand?.role?.permissions || [];

		console.log('[Session] Expanded user data fetched:', {
			userId: user.id,
			orgCode: organization.code,
			permissions: session.permissions.length
		});
	} catch (error) {
		console.error('[Session] Failed to fetch expanded user data:', error);
		// Don't clear session here - might just be a network error
		// The user can still be authenticated
	}
}

/**
 * Clear session (logout)
 */
export function clearSession(): void {
	console.log('[Session] Clearing session');
	
	// Clear PocketBase auth (this also clears localStorage)
	clearAuth();
	
	// Then clear local session state
	session.user = null;
	session.organization = null;
	session.permissions = [];
	session.isLoading = false;
}

/**
 * Update session user (refetches from PocketBase)
 */
export async function updateSessionUser(): Promise<void> {
	if (!session.user) return;

	try {
		const user = await pb.collection(Collections.Users).getOne<SessionUser>(
			session.user.id,
			{ expand: 'role,organization' }
		);
		
		session.user = user;
		session.organization = user.expand?.organization || session.organization;
		session.permissions = user.expand?.role?.permissions || [];
		
		console.log('[Session] User updated');
	} catch (error) {
		console.error('[Session] Failed to update user:', error);
	}
}

/**
 * Update session organization (refetches from PocketBase)
 */
export async function updateSessionOrganization(): Promise<void> {
	if (!session.organization) return;

	try {
		const organization = await pb.collection(Collections.Organization).getOne<OrganizationResponse>(
			session.organization.id
		);
		
		session.organization = organization;
		
		console.log('[Session] Organization updated');
	} catch (error) {
		console.error('[Session] Failed to update organization:', error);
	}
}

/**
 * Set loading state
 */
export function setSessionLoading(loading: boolean): void {
	session.isLoading = loading;
}

/**
 * Get organization code from session
 */
export function getSessionOrgCode(): string | null {
	return session.organization?.code?.trim() || null;
}

/**
 * Check if current user has a permission
 */
export function sessionHasPermission(permission: PermissionType): boolean {
	return hasPermission(session.permissions, permission);
}

/**
 * Check if current user has all permissions
 */
export function sessionHasAllPermissions(perms: PermissionType[]): boolean {
	return hasAllPermissions(session.permissions, perms);
}

/**
 * Check if current user has any of the permissions
 */
export function sessionHasAnyPermission(perms: PermissionType[]): boolean {
	return hasAnyPermission(session.permissions, perms);
}

/**
 * Get permission guard for session
 */
export function getSessionPermissionGuard() {
	return createPermissionGuard(session.permissions);
}

/**
 * Get current user ID
 */
export function getSessionUserId(): string | null {
	return session.user?.id || null;
}

/**
 * Get current user's role name
 */
export function getSessionRoleName(): string | null {
	return session.user?.expand?.role?.name || null;
}

/**
 * Get current user's display name
 */
export function getSessionUserName(): string {
	return session.user?.name || session.user?.email || 'User';
}

/**
 * Get current user's email
 */
export function getSessionUserEmail(): string | null {
	return session.user?.email || null;
}

/**
 * Get current user's avatar URL (if exists)
 */
export function getSessionUserAvatar(): string | null {
	const user = session.user;
	if (!user) return null;
	return getUserAvatarUrl(user.id, user.avatar);
}

/**
 * Backward compatibility - these were removed but keep stubs
 */
export function extendSession(): void {
	// No-op: PocketBase handles token expiry
}

export function sessionNeedsRefresh(): boolean {
	return false; // PocketBase handles token refresh
}

export function getSessionTimeRemaining(): number {
	return 0; // Not tracking this anymore
}
