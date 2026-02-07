/**
 * Customer service
 * Manages customer records and relationships
 */

import { pb } from '$lib/infra/db/pb';
import { Collections, CustomersStatusOptions, type CustomersResponse } from '$lib/types';
import { NotFoundError, ConflictError, ValidationError } from '$lib/shared/errors';
import {
	validateCustomer,
	normalizeEmail,
	normalizePhone,
	normalizeKraPin
} from '$lib/shared/rules';
import {
	logCustomerCreated,
	logCustomerUpdated,
	logCustomerBlocked,
	logCustomerActivated
} from '$lib/core/activity/activity_service';
import { assertPermission, type UserPermissions } from '$lib/services/roles/permission_checker';
import { Permission } from '$lib/services/roles/permissions';

/**
 * Customer create input
 */
export interface CreateCustomerInput {
	name: string;
	email: string;
	phone: string;
	national_id: string;
	kra_pin: string;
	employer_name: string;
	employer_branch: string;
	residential_address: string;
	net_salary?: number;
	notes?: string;
}

/**
 * Customer update input
 */
export interface UpdateCustomerInput {
	name?: string;
	email?: string;
	phone?: string;
	employer_name?: string;
	employer_branch?: string;
	residential_address?: string;
	net_salary?: number;
	notes?: string;
}

/**
 * Check if customer exists by national ID
 */
export async function getCustomerByNationalId(
	nationalId: string
): Promise<CustomersResponse | null> {
	try {
		const customer = await pb
			.collection(Collections.Customers)
			.getFirstListItem<CustomersResponse>(`national_id = "${nationalId}"`);
		return customer;
	} catch {
		return null;
	}
}

/**
 * Check if customer exists by email
 */
export async function getCustomerByEmail(email: string): Promise<CustomersResponse | null> {
	try {
		const normalizedEmail = normalizeEmail(email);
		const customer = await pb
			.collection(Collections.Customers)
			.getFirstListItem<CustomersResponse>(`email = "${normalizedEmail}"`);
		return customer;
	} catch {
		return null;
	}
}

/**
 * Check if customer exists by phone
 */
export async function getCustomerByPhone(phone: string): Promise<CustomersResponse | null> {
	try {
		const normalizedPhone = normalizePhone(phone);
		const customer = await pb
			.collection(Collections.Customers)
			.getFirstListItem<CustomersResponse>(`phone = "${normalizedPhone}"`);
		return customer;
	} catch {
		return null;
	}
}

/**
 * Find existing customer by matching 2 unique fields
 * Returns customer if 2 or more unique identifiers match (email+phone OR id+phone OR id+email)
 */
export async function findExistingCustomerByMatch(
	nationalId: string,
	email: string,
	phone: string
): Promise<CustomersResponse | null> {
	const normalizedEmail = normalizeEmail(email);
	const normalizedPhone = normalizePhone(phone);
	
	// Try to find customers that match any single field
	const byId = await getCustomerByNationalId(nationalId);
	const byEmail = await getCustomerByEmail(normalizedEmail);
	const byPhone = await getCustomerByPhone(normalizedPhone);
	
	// Check if we have a match on 2 or more fields
	// Priority: If national ID matches, verify with either phone or email
	if (byId) {
		// If national ID matches and phone matches, it's the same customer
		if (byId.phone === normalizedPhone) {
			return byId;
		}
		// If national ID matches and email matches, it's the same customer
		if (byId.email === normalizedEmail) {
			return byId;
		}
	}
	
	// Check if email and phone both match the same customer
	if (byEmail && byPhone && byEmail.id === byPhone.id) {
		return byEmail;
	}
	return null;
}

/**
 * Find existing customer by any identifier (old behavior - kept for backward compatibility)
 */
export async function findExistingCustomer(
	nationalId: string,
	email: string,
	phone: string
): Promise<CustomersResponse | null> {
	// Priority: national ID > email > phone
	let customer = await getCustomerByNationalId(nationalId);
	if (customer) return customer;

	customer = await getCustomerByEmail(email);
	if (customer) return customer;

	customer = await getCustomerByPhone(phone);
	return customer;
}

/**
 * Get customer by ID
 */
export async function getCustomerById(customerId: string): Promise<CustomersResponse> {
	try {
		const customer = await pb
			.collection(Collections.Customers)
			.getOne<CustomersResponse>(customerId);
		return customer;
	} catch (error) {
		throw new NotFoundError('Customer', customerId);
	}
}

/**
 * Create a new customer
 * Note: This function no longer checks for existing customers.
 * Use findExistingCustomerByMatch before calling this function to check for duplicates.
 */
export async function createCustomer(
	input: CreateCustomerInput,
	userId?: string
): Promise<CustomersResponse> {
	// Validate input
	const validation = validateCustomer(input);
	if (!validation.valid) {
		throw new ValidationError(validation.error || 'Invalid customer data');
	}

	const customer = await pb.collection(Collections.Customers).create<CustomersResponse>({
		name: input.name.trim(),
		email: normalizeEmail(input.email),
		phone: normalizePhone(input.phone),
		national_id: input.national_id.trim(),
		kra_pin: normalizeKraPin(input.kra_pin),
		employer_name: input.employer_name.trim(),
		employer_branch: input.employer_branch.trim(),
		residential_address: input.residential_address.trim(),
		net_salary: input.net_salary || 0,
		notes: input.notes?.trim() || '',
		status: CustomersStatusOptions.active,
		total_loans: 0,
		active_loans: 0,
		defaulted_loans: 0,
		total_borrowed: 0,
		total_repaid: 0
	});

	// Log activity
	if (userId) {
		await logCustomerCreated(customer.id, userId, input.name);
	}

	return customer;
}

/**
 * Update customer details
 */
export async function updateCustomer(
	customerId: string,
	input: UpdateCustomerInput,
	userId: string,
	userPermissions: UserPermissions
): Promise<CustomersResponse> {
	assertPermission(userPermissions, Permission.CUSTOMERS_UPDATE);

	const existing = await getCustomerById(customerId);

	// Check email uniqueness if changing
	if (input.email && normalizeEmail(input.email) !== existing.email) {
		const duplicate = await getCustomerByEmail(input.email);
		if (duplicate) {
			throw new ConflictError(`Customer with email '${input.email}' already exists`);
		}
	}

	// Check phone uniqueness if changing
	if (input.phone && normalizePhone(input.phone) !== existing.phone) {
		const duplicate = await getCustomerByPhone(input.phone);
		if (duplicate) {
			throw new ConflictError(`Customer with phone '${input.phone}' already exists`);
		}
	}

	const updateData: Record<string, unknown> = {};
	if (input.name) updateData.name = input.name.trim();
	if (input.email) updateData.email = normalizeEmail(input.email);
	if (input.phone) updateData.phone = normalizePhone(input.phone);
	if (input.employer_name) updateData.employer_name = input.employer_name.trim();
	if (input.employer_branch) updateData.employer_branch = input.employer_branch.trim();
	if (input.residential_address) updateData.residential_address = input.residential_address.trim();
	if (input.net_salary !== undefined) updateData.net_salary = input.net_salary;
	if (input.notes !== undefined) updateData.notes = input.notes?.trim() || '';

	const customer = await pb
		.collection(Collections.Customers)
		.update<CustomersResponse>(customerId, updateData);

	// Log activity
	await logCustomerUpdated(customerId, userId, updateData);

	return customer;
}

/**
 * Block a customer
 */
export async function blockCustomer(
	customerId: string,
	userId: string,
	reason: string,
	userPermissions: UserPermissions
): Promise<CustomersResponse> {
	assertPermission(userPermissions, Permission.CUSTOMERS_UPDATE);

	const customer = await pb
		.collection(Collections.Customers)
		.update<CustomersResponse>(customerId, {
			status: CustomersStatusOptions.blocked,
			notes: reason ? `Blocked: ${reason}` : 'Blocked by admin'
		});

	await logCustomerBlocked(customerId, userId, reason);

	return customer;
}

/**
 * Activate a customer
 */
export async function activateCustomer(
	customerId: string,
	userId: string,
	userPermissions: UserPermissions
): Promise<CustomersResponse> {
	assertPermission(userPermissions, Permission.CUSTOMERS_UPDATE);

	const customer = await pb
		.collection(Collections.Customers)
		.update<CustomersResponse>(customerId, {
			status: CustomersStatusOptions.active
		});

	await logCustomerActivated(customerId, userId);

	return customer;
}

/**
 * Update customer loan statistics
 */
export async function updateCustomerLoanStats(
	customerId: string,
	stats: {
		totalLoans?: number;
		activeLoans?: number;
		defaultedLoans?: number;
		totalBorrowed?: number;
		totalRepaid?: number;
	}
): Promise<CustomersResponse> {
	const updateData: Record<string, unknown> = {};

	if (stats.totalLoans !== undefined) updateData.total_loans = stats.totalLoans;
	if (stats.activeLoans !== undefined) updateData.active_loans = stats.activeLoans;
	if (stats.defaultedLoans !== undefined) updateData.defaulted_loans = stats.defaultedLoans;
	if (stats.totalBorrowed !== undefined) updateData.total_borrowed = stats.totalBorrowed;
	if (stats.totalRepaid !== undefined) updateData.total_repaid = stats.totalRepaid;

	return await pb
		.collection(Collections.Customers)
		.update<CustomersResponse>(customerId, updateData);
}

/**
 * Increment customer loan count
 */
export async function incrementCustomerLoans(
	customerId: string,
	loanAmount: number
): Promise<void> {
	const customer = await getCustomerById(customerId);

	await pb.collection(Collections.Customers).update(customerId, {
		total_loans: (customer.total_loans || 0) + 1,
		active_loans: (customer.active_loans || 0) + 1,
		total_borrowed: (customer.total_borrowed || 0) + loanAmount
	});
}

/**
 * Mark loan as repaid for customer stats
 */
export async function markCustomerLoanRepaid(
	customerId: string,
	amountRepaid: number
): Promise<void> {
	const customer = await getCustomerById(customerId);

	await pb.collection(Collections.Customers).update(customerId, {
		active_loans: Math.max(0, (customer.active_loans || 0) - 1),
		total_repaid: (customer.total_repaid || 0) + amountRepaid
	});
}

/**
 * Mark loan as defaulted for customer stats
 */
export async function markCustomerLoanDefaulted(customerId: string): Promise<void> {
	const customer = await getCustomerById(customerId);

	await pb.collection(Collections.Customers).update(customerId, {
		active_loans: Math.max(0, (customer.active_loans || 0) - 1),
		defaulted_loans: (customer.defaulted_loans || 0) + 1
	});
}

/**
 * Get all customers
 */
export async function getAllCustomers(
	userPermissions: UserPermissions
): Promise<CustomersResponse[]> {
	assertPermission(userPermissions, Permission.CUSTOMERS_VIEW);

	return await pb.collection(Collections.Customers).getFullList<CustomersResponse>({
		sort: '-created'
	});
}

/**
 * Get customers with pagination
 */
export async function getCustomers(
	page: number,
	perPage: number,
	userPermissions: UserPermissions,
	filters?: {
		status?: CustomersStatusOptions;
		search?: string;
	}
): Promise<{ items: CustomersResponse[]; totalItems: number; totalPages: number }> {
	assertPermission(userPermissions, Permission.CUSTOMERS_VIEW);

	const filterParts: string[] = [];

	if (filters?.status) {
		filterParts.push(`status = "${filters.status}"`);
	}

	if (filters?.search) {
		const search = filters.search.trim();
		filterParts.push(
			`(name ~ "${search}" || email ~ "${search}" || phone ~ "${search}" || national_id ~ "${search}")`
		);
	}

	const filter = filterParts.length > 0 ? filterParts.join(' && ') : '';

	const result = await pb
		.collection(Collections.Customers)
		.getList<CustomersResponse>(page, perPage, {
			filter,
			sort: '-created'
		});
	return {
		items: result.items,
		totalItems: result.totalItems,
		totalPages: result.totalPages
	};
}

/**
 * Search customers
 */
export async function searchCustomers(
	query: string,
	userPermissions: UserPermissions,
	limit: number = 20
): Promise<CustomersResponse[]> {
	assertPermission(userPermissions, Permission.CUSTOMERS_VIEW);

	if (!query || query.trim().length < 2) return [];

	const search = query.trim();

	const result = await pb
		.collection(Collections.Customers)
		.getList<CustomersResponse>(1, limit, {
			filter: `name ~ "${search}" || email ~ "${search}" || phone ~ "${search}" || national_id ~ "${search}"`,
			sort: 'name'
		});
	return result.items;
}

/**
 * Get customer statistics
 */
export async function getCustomerStats(userPermissions: UserPermissions): Promise<{
	total: number;
	active: number;
	blocked: number;
	pending: number;
}> {
	assertPermission(userPermissions, Permission.ANALYTICS_VIEW);

	const [total, active, blocked, pending] = await Promise.all([
		pb.collection(Collections.Customers).getList(1, 1),
		pb.collection(Collections.Customers).getList(1, 1, {
			filter: `status = "${CustomersStatusOptions.active}"`
		}),
		pb.collection(Collections.Customers).getList(1, 1, {
			filter: `status = "${CustomersStatusOptions.blocked}"`
		}),
		pb.collection(Collections.Customers).getList(1, 1, {
			filter: `status = "${CustomersStatusOptions.pending}"`
		})
	]);

	return {
		total: total.totalItems,
		active: active.totalItems,
		blocked: blocked.totalItems,
		pending: pending.totalItems
	};
}

/**
 * Delete customer (only if no loans)
 */
export async function deleteCustomer(
	customerId: string,
	userPermissions: UserPermissions
): Promise<void> {
	assertPermission(userPermissions, Permission.CUSTOMERS_DELETE);

	const customer = await getCustomerById(customerId);

	// Check if customer has any loans
	const loans = await pb.collection(Collections.Loans).getList(1, 1, {
		filter: `customer = "${customerId}"`
	});

	if (loans.totalItems > 0) {
		throw new ConflictError('Cannot delete customer with existing loans');
	}

	await pb.collection(Collections.Customers).delete(customerId);
}
