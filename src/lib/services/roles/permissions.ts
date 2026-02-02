/**
 * Permission definitions for the loan management system
 * All actions require explicit permission checks
 */

/**
 * Permission categories matching system modules
 */
export const PermissionCategory = {
	USERS: 'users',
	ROLES: 'roles',
	CUSTOMERS: 'customers',
	LOANS: 'loans',
	LINKS: 'links',
	PAYMENTS: 'payments',
	ANALYTICS: 'analytics',
	SETTINGS: 'settings',
	ORGANIZATION: 'organization',
	CRM: 'crm',
	ACTIVITIES: 'activities'
} as const;

export type PermissionCategoryType = (typeof PermissionCategory)[keyof typeof PermissionCategory];

/**
 * Permission actions
 */
export const PermissionAction = {
	VIEW: 'view',
	CREATE: 'create',
	UPDATE: 'update',
	DELETE: 'delete',
	APPROVE: 'approve',
	REJECT: 'reject',
	DISBURSE: 'disburse',
	EXPORT: 'export',
	MANAGE: 'manage'
} as const;

export type PermissionActionType = (typeof PermissionAction)[keyof typeof PermissionAction];

/**
 * All system permissions
 * Format: category.action
 */
export const Permission = {
	// User permissions
	USERS_VIEW: 'users.view',
	USERS_CREATE: 'users.create',
	USERS_UPDATE: 'users.update',
	USERS_DELETE: 'users.delete',
	USERS_MANAGE: 'users.manage',

	// Role permissions
	ROLES_VIEW: 'roles.view',
	ROLES_CREATE: 'roles.create',
	ROLES_UPDATE: 'roles.update',
	ROLES_DELETE: 'roles.delete',
	ROLES_MANAGE: 'roles.manage',

	// Customer permissions
	CUSTOMERS_VIEW: 'customers.view',
	CUSTOMERS_CREATE: 'customers.create',
	CUSTOMERS_UPDATE: 'customers.update',
	CUSTOMERS_DELETE: 'customers.delete',
	CUSTOMERS_EXPORT: 'customers.export',

	// Loan permissions
	LOANS_VIEW: 'loans.view',
	LOANS_CREATE: 'loans.create',
	LOANS_UPDATE: 'loans.update',
	LOANS_APPROVE: 'loans.approve',
	LOANS_REJECT: 'loans.reject',
	LOANS_DISBURSE: 'loans.disburse',
	LOANS_EXPORT: 'loans.export',

	// Application link permissions
	LINKS_VIEW: 'links.view',
	LINKS_CREATE: 'links.create',

	// Payment permissions
	PAYMENTS_VIEW: 'payments.view',
	PAYMENTS_CREATE: 'payments.create',
	PAYMENTS_UPDATE: 'payments.update',
	PAYMENTS_DELETE: 'payments.delete',
	PAYMENTS_EXPORT: 'payments.export',

	// Analytics permissions
	ANALYTICS_VIEW: 'analytics.view',
	ANALYTICS_EXPORT: 'analytics.export',

	// Settings permissions
	SETTINGS_VIEW: 'settings.view',
	SETTINGS_UPDATE: 'settings.update',
	SETTINGS_MANAGE: 'settings.manage',

	// Organization permissions
	ORGANIZATION_VIEW: 'organization.view',
	ORGANIZATION_UPDATE: 'organization.update',
	ORGANIZATION_MANAGE: 'organization.manage',

	// CRM permissions
	CRM_VIEW: 'crm.view',
	CRM_CREATE: 'crm.create',
	CRM_UPDATE: 'crm.update',

	// Activity log permissions
	ACTIVITIES_VIEW: 'activities.view',
	ACTIVITIES_EXPORT: 'activities.export'
} as const;

export type PermissionType = (typeof Permission)[keyof typeof Permission];

/**
 * Permission metadata for UI display
 */
export interface PermissionMeta {
	key: PermissionType;
	label: string;
	description: string;
	category: PermissionCategoryType;
}

/**
 * All permissions with metadata
 */
export const PERMISSION_DEFINITIONS: PermissionMeta[] = [
	// Users
	{
		key: Permission.USERS_VIEW,
		label: 'View Users',
		description: 'View list of system users',
		category: PermissionCategory.USERS
	},
	{
		key: Permission.USERS_CREATE,
		label: 'Create Users',
		description: 'Create new system users',
		category: PermissionCategory.USERS
	},
	{
		key: Permission.USERS_UPDATE,
		label: 'Update Users',
		description: 'Update user details',
		category: PermissionCategory.USERS
	},
	{
		key: Permission.USERS_DELETE,
		label: 'Delete Users',
		description: 'Delete system users',
		category: PermissionCategory.USERS
	},
	{
		key: Permission.USERS_MANAGE,
		label: 'Manage Users',
		description: 'Full user management including status changes',
		category: PermissionCategory.USERS
	},

	// Roles
	{
		key: Permission.ROLES_VIEW,
		label: 'View Roles',
		description: 'View roles and permissions',
		category: PermissionCategory.ROLES
	},
	{
		key: Permission.ROLES_CREATE,
		label: 'Create Roles',
		description: 'Create new roles',
		category: PermissionCategory.ROLES
	},
	{
		key: Permission.ROLES_UPDATE,
		label: 'Update Roles',
		description: 'Update role permissions',
		category: PermissionCategory.ROLES
	},
	{
		key: Permission.ROLES_DELETE,
		label: 'Delete Roles',
		description: 'Delete roles',
		category: PermissionCategory.ROLES
	},
	{
		key: Permission.ROLES_MANAGE,
		label: 'Manage Roles',
		description: 'Full role management',
		category: PermissionCategory.ROLES
	},

	// Customers
	{
		key: Permission.CUSTOMERS_VIEW,
		label: 'View Customers',
		description: 'View customer list and details',
		category: PermissionCategory.CUSTOMERS
	},
	{
		key: Permission.CUSTOMERS_CREATE,
		label: 'Create Customers',
		description: 'Register new customers',
		category: PermissionCategory.CUSTOMERS
	},
	{
		key: Permission.CUSTOMERS_UPDATE,
		label: 'Update Customers',
		description: 'Update customer information',
		category: PermissionCategory.CUSTOMERS
	},
	{
		key: Permission.CUSTOMERS_DELETE,
		label: 'Delete Customers',
		description: 'Delete customer records',
		category: PermissionCategory.CUSTOMERS
	},
	{
		key: Permission.CUSTOMERS_EXPORT,
		label: 'Export Customers',
		description: 'Export customer data',
		category: PermissionCategory.CUSTOMERS
	},

	// Loans
	{
		key: Permission.LOANS_VIEW,
		label: 'View Loans',
		description: 'View loan applications and details',
		category: PermissionCategory.LOANS
	},
	{
		key: Permission.LOANS_CREATE,
		label: 'Create Loans',
		description: 'Create loan applications',
		category: PermissionCategory.LOANS
	},
	{
		key: Permission.LOANS_UPDATE,
		label: 'Update Loans',
		description: 'Update loan details',
		category: PermissionCategory.LOANS
	},
	{
		key: Permission.LOANS_APPROVE,
		label: 'Approve Loans',
		description: 'Approve loan applications',
		category: PermissionCategory.LOANS
	},
	{
		key: Permission.LOANS_REJECT,
		label: 'Reject Loans',
		description: 'Reject loan applications',
		category: PermissionCategory.LOANS
	},
	{
		key: Permission.LOANS_DISBURSE,
		label: 'Disburse Loans',
		description: 'Mark loans as disbursed',
		category: PermissionCategory.LOANS
	},
	{
		key: Permission.LOANS_EXPORT,
		label: 'Export Loans',
		description: 'Export loan data',
		category: PermissionCategory.LOANS
	},

	// Application Links
	{
		key: Permission.LINKS_VIEW,
		label: 'View Application Links',
		description: 'View generated application links',
		category: PermissionCategory.LINKS
	},
	{
		key: Permission.LINKS_CREATE,
		label: 'Create Application Links',
		description: 'Generate new application links for loan applications',
		category: PermissionCategory.LINKS
	},

	// Payments
	{
		key: Permission.PAYMENTS_VIEW,
		label: 'View Payments',
		description: 'View payment records',
		category: PermissionCategory.PAYMENTS
	},
	{
		key: Permission.PAYMENTS_CREATE,
		label: 'Record Payments',
		description: 'Record new payments',
		category: PermissionCategory.PAYMENTS
	},
	{
		key: Permission.PAYMENTS_UPDATE,
		label: 'Update Payments',
		description: 'Update payment records',
		category: PermissionCategory.PAYMENTS
	},
	{
		key: Permission.PAYMENTS_DELETE,
		label: 'Delete Payments',
		description: 'Delete payment records',
		category: PermissionCategory.PAYMENTS
	},
	{
		key: Permission.PAYMENTS_EXPORT,
		label: 'Export Payments',
		description: 'Export payment data',
		category: PermissionCategory.PAYMENTS
	},

	// Analytics
	{
		key: Permission.ANALYTICS_VIEW,
		label: 'View Analytics',
		description: 'View dashboard and reports',
		category: PermissionCategory.ANALYTICS
	},
	{
		key: Permission.ANALYTICS_EXPORT,
		label: 'Export Analytics',
		description: 'Export reports and analytics',
		category: PermissionCategory.ANALYTICS
	},

	// Settings
	{
		key: Permission.SETTINGS_VIEW,
		label: 'View Settings',
		description: 'View system settings',
		category: PermissionCategory.SETTINGS
	},
	{
		key: Permission.SETTINGS_UPDATE,
		label: 'Update Settings',
		description: 'Update system settings',
		category: PermissionCategory.SETTINGS
	},
	{
		key: Permission.SETTINGS_MANAGE,
		label: 'Manage Settings',
		description: 'Full settings management',
		category: PermissionCategory.SETTINGS
	},

	// Organization
	{
		key: Permission.ORGANIZATION_VIEW,
		label: 'View Organization',
		description: 'View organization details',
		category: PermissionCategory.ORGANIZATION
	},
	{
		key: Permission.ORGANIZATION_UPDATE,
		label: 'Update Organization',
		description: 'Update organization details',
		category: PermissionCategory.ORGANIZATION
	},
	{
		key: Permission.ORGANIZATION_MANAGE,
		label: 'Manage Organization',
		description: 'Full organization management',
		category: PermissionCategory.ORGANIZATION
	},

	// CRM
	{
		key: Permission.CRM_VIEW,
		label: 'View CRM',
		description: 'View CRM data',
		category: PermissionCategory.CRM
	},
	{
		key: Permission.CRM_CREATE,
		label: 'Create CRM Entries',
		description: 'Create CRM entries',
		category: PermissionCategory.CRM
	},
	{
		key: Permission.CRM_UPDATE,
		label: 'Update CRM',
		description: 'Update CRM entries',
		category: PermissionCategory.CRM
	},

	// Activities
	{
		key: Permission.ACTIVITIES_VIEW,
		label: 'View Activities',
		description: 'View activity logs',
		category: PermissionCategory.ACTIVITIES
	},
	{
		key: Permission.ACTIVITIES_EXPORT,
		label: 'Export Activities',
		description: 'Export activity logs',
		category: PermissionCategory.ACTIVITIES
	}
];

/**
 * Group permissions by category for UI display
 */
export function getPermissionsByCategory(): Map<PermissionCategoryType, PermissionMeta[]> {
	const grouped = new Map<PermissionCategoryType, PermissionMeta[]>();

	for (const perm of PERMISSION_DEFINITIONS) {
		const existing = grouped.get(perm.category) || [];
		existing.push(perm);
		grouped.set(perm.category, existing);
	}

	return grouped;
}

/**
 * Get all permission keys
 */
export function getAllPermissionKeys(): PermissionType[] {
	return PERMISSION_DEFINITIONS.map((p) => p.key);
}

/**
 * Get permission metadata by key
 */
export function getPermissionMeta(key: PermissionType): PermissionMeta | undefined {
	return PERMISSION_DEFINITIONS.find((p) => p.key === key);
}

/**
 * Default role permission sets
 */
export const DEFAULT_ROLE_PERMISSIONS = {
	admin: getAllPermissionKeys(),
	manager: [
		Permission.USERS_VIEW,
		Permission.CUSTOMERS_VIEW,
		Permission.CUSTOMERS_CREATE,
		Permission.CUSTOMERS_UPDATE,
		Permission.CUSTOMERS_EXPORT,
		Permission.LOANS_VIEW,
		Permission.LOANS_CREATE,
		Permission.LOANS_UPDATE,
		Permission.LOANS_APPROVE,
		Permission.LOANS_REJECT,
		Permission.LOANS_DISBURSE,
		Permission.LOANS_EXPORT,
		Permission.LINKS_VIEW,
		Permission.LINKS_CREATE,
		Permission.PAYMENTS_VIEW,
		Permission.PAYMENTS_CREATE,
		Permission.PAYMENTS_UPDATE,
		Permission.PAYMENTS_EXPORT,
		Permission.ANALYTICS_VIEW,
		Permission.ANALYTICS_EXPORT,
		Permission.CRM_VIEW,
		Permission.CRM_CREATE,
		Permission.CRM_UPDATE,
		Permission.ACTIVITIES_VIEW
	],
	officer: [
		Permission.CUSTOMERS_VIEW,
		Permission.CUSTOMERS_CREATE,
		Permission.CUSTOMERS_UPDATE,
		Permission.LOANS_VIEW,
		Permission.LOANS_CREATE,
		Permission.LOANS_UPDATE,
		Permission.LINKS_VIEW,
		Permission.LINKS_CREATE,
		Permission.PAYMENTS_VIEW,
		Permission.PAYMENTS_CREATE,
		Permission.CRM_VIEW,
		Permission.CRM_CREATE
	],
	viewer: [
		Permission.CUSTOMERS_VIEW,
		Permission.LOANS_VIEW,
		Permission.PAYMENTS_VIEW,
		Permission.ANALYTICS_VIEW,
		Permission.CRM_VIEW
	]
} as const;
