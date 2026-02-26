/**
 * Organization service for fetching and managing organization data
 */

import { pb } from '$lib/infra/db/pb';
import { Collections, type OrganizationResponse } from '$lib/types';
import { NotFoundError, ValidationError } from '$lib/shared/errors';
import { Permission } from '$lib/services/roles/permissions';
import { assertPermission, type UserPermissions } from '$lib/services/roles/permission_checker';
import { logSettingsUpdated } from '$lib/core/activity/activity_service';

/**
 * Update organization input
 */
export interface UpdateOrganizationInput {
	name?: string;
	email?: string;
	phone?: string;
	bank_name?: string;
	bank_account?: string;
	account_number?: string;
	mpesa_paybill?: string;
	notification_email?: string | string[] | null; // JSON field: string or array of emails
	logo?: File | null;
}

/**
 * Cache for organization data to minimize DB hits
 */
const orgCache = new Map<string, { data: OrganizationResponse; timestamp: number }>();
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get organization by code
 * Used during authentication to validate business code
 */
export async function getOrganizationByCode(code: string): Promise<OrganizationResponse> {
	if (!code || typeof code !== 'string') {
		throw new NotFoundError('Organization', 'Invalid code');
	}

	const normalizedCode = code.toLowerCase().trim();

	// Check cache first
	const cached = orgCache.get(normalizedCode);
	if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
		return cached.data;
	}

	try {
		const organization = await pb
			.collection(Collections.Organization)
			.getFirstListItem<OrganizationResponse>(`code = "${normalizedCode}"`);

		// Cache the result
		orgCache.set(normalizedCode, {
			data: organization,
			timestamp: Date.now()
		});

		return organization;
	} catch {
		throw new NotFoundError('Organization', code);
	}
}

/**
 * Get organization by ID
 */
export async function getOrganizationById(id: string): Promise<OrganizationResponse> {
	if (!id) {
		throw new NotFoundError('Organization', 'Invalid ID');
	}

	try {
		const organization = await pb
			.collection(Collections.Organization)
			.getOne<OrganizationResponse>(id);

		return organization;
	} catch {
		throw new NotFoundError('Organization', id);
	}
}

/**
 * Validate that an organization code exists
 */
export async function validateOrgCode(code: string): Promise<boolean> {
	try {
		await getOrganizationByCode(code);
		return true;
	} catch {
		return false;
	}
}

/**
 * Clear organization cache
 */
export function clearOrgCache(): void {
	orgCache.clear();
}

/**
 * Get the first/default organization (for single-tenant scenarios)
 */
export async function getDefaultOrganization(): Promise<OrganizationResponse | null> {
	try {
		const orgs = await pb.collection(Collections.Organization).getList<OrganizationResponse>(1, 1);
		return orgs.items[0] || null;
	} catch {
		return null;
	}
}

/**
 * Update organization details
 */
export async function updateOrganization(
	orgId: string,
	input: UpdateOrganizationInput,
	actorPermissions: UserPermissions,
	actorId: string
): Promise<OrganizationResponse> {
	assertPermission(actorPermissions, Permission.ORGANIZATION_UPDATE);

	if (!orgId) {
		throw new ValidationError('Organization ID is required');
	}

	// Build update data - only include provided fields
	const updateData: Record<string, unknown> = {};
	if (input.name !== undefined) updateData.name = input.name.trim();
	if (input.email !== undefined) updateData.email = input.email.trim();
	if (input.phone !== undefined) updateData.phone = input.phone.trim();
	if (input.bank_name !== undefined) updateData.bank_name = input.bank_name.trim();
	if (input.bank_account !== undefined) updateData.bank_account = input.bank_account.trim();
	if (input.account_number !== undefined) updateData.account_number = input.account_number.trim();
	if (input.mpesa_paybill !== undefined) updateData.mpesa_paybill = input.mpesa_paybill.trim();
	if (input.notification_email !== undefined) {
		// Handle JSON field: can be string, array, or null
		if (Array.isArray(input.notification_email)) {
			// Filter empty emails and trim
			const filtered = input.notification_email
				.map(e => e.trim())
				.filter(e => e.length > 0);
			updateData.notification_email = filtered.length > 0 ? filtered : null;
		} else if (typeof input.notification_email === 'string') {
			const trimmed = input.notification_email.trim();
			updateData.notification_email = trimmed.length > 0 ? trimmed : null;
		} else {
			updateData.notification_email = null;
		}
	}
	if (input.logo !== undefined) updateData.logo = input.logo;

	const organization = await pb.collection(Collections.Organization).update<OrganizationResponse>(orgId, updateData);

	// Clear cache for this org
	clearOrgCache();

	// Log activity
	await logSettingsUpdated(actorId, 'organization', 'organization');

	return organization;
}
