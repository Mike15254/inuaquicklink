/**
 * Activity logging service
 * All system actions are logged for audit trail
 */

import { pb } from '$lib/infra/db/pb';
import {
	Collections,
	ActivitiesActivityTypeOptions,
	ActivitiesEntityTypeOptions,
	type ActivitiesResponse
} from '$lib/types';

export type ActivityType = ActivitiesActivityTypeOptions;
export type EntityType = ActivitiesEntityTypeOptions;

/**
 * Activity log entry data
 */
export interface ActivityLogData {
	activityType: ActivityType;
	description: string;
	entityType?: EntityType;
	entityId?: string;
	userId?: string;
	ipAddress?: string;
	isSystem?: boolean;
	metadata?: Record<string, unknown>;
}

/**
 * Log an activity to the database
 */
export async function logActivity(data: ActivityLogData): Promise<ActivitiesResponse> {
	const record = await pb.collection(Collections.Activities).create<ActivitiesResponse>({
		activity_type: data.activityType,
		description: data.description,
		entity_type: data.entityType,
		entity_id: data.entityId,
		user: data.userId,
		ip_address: data.ipAddress,
		is_system: data.isSystem || false,
		metadata: data.metadata || null
	});

	return record;
}

/**
 * Log user login activity
 */
export async function logUserLogin(userId: string, ipAddress?: string): Promise<void> {
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.user_login,
		description: 'User logged in',
		entityType: ActivitiesEntityTypeOptions.user,
		entityId: userId,
		userId,
		ipAddress
	});
}

/**
 * Log user creation activity
 */
export async function logUserCreated(
	createdUserId: string,
	createdByUserId: string,
	userName: string
): Promise<void> {
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.user_created,
		description: `User "${userName}" was created`,
		entityType: ActivitiesEntityTypeOptions.user,
		entityId: createdUserId,
		userId: createdByUserId,
		metadata: { createdUserId, userName }
	});
}

/**
 * Log user update activity
 */
export async function logUserUpdated(
	updatedUserId: string,
	updatedByUserId: string,
	changes: Record<string, unknown>
): Promise<void> {
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.user_updated,
		description: 'User profile was updated',
		entityType: ActivitiesEntityTypeOptions.user,
		entityId: updatedUserId,
		userId: updatedByUserId,
		metadata: { changes }
	});
}

/**
 * Log customer creation
 */
export async function logCustomerCreated(
	customerId: string,
	userId: string,
	customerName: string
): Promise<void> {
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.customer_created,
		description: `Customer "${customerName}" was registered`,
		entityType: ActivitiesEntityTypeOptions.customer,
		entityId: customerId,
		userId,
		metadata: { customerName }
	});
}

/**
 * Log customer update
 */
export async function logCustomerUpdated(
	customerId: string,
	userId: string,
	changes: Record<string, unknown>
): Promise<void> {
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.customer_updated,
		description: 'Customer information was updated',
		entityType: ActivitiesEntityTypeOptions.customer,
		entityId: customerId,
		userId,
		metadata: { changes }
	});
}

/**
 * Log customer blocked
 */
export async function logCustomerBlocked(
	customerId: string,
	userId: string,
	reason?: string
): Promise<void> {
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.customer_blocked,
		description: 'Customer was blocked',
		entityType: ActivitiesEntityTypeOptions.customer,
		entityId: customerId,
		userId,
		metadata: { reason }
	});
}

/**
 * Log customer activated
 */
export async function logCustomerActivated(customerId: string, userId: string): Promise<void> {
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.customer_activated,
		description: 'Customer was activated',
		entityType: ActivitiesEntityTypeOptions.customer,
		entityId: customerId,
		userId
	});
}

/**
 * Log loan creation
 */
export async function logLoanCreated(
	loanId: string,
	userId: string,
	loanNumber: string,
	amount: number
): Promise<void> {
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.loan_created,
		description: `Loan ${loanNumber} created for KES ${amount.toLocaleString()}`,
		entityType: ActivitiesEntityTypeOptions.loan,
		entityId: loanId,
		userId,
		metadata: { loanNumber, amount }
	});
}

/**
 * Log loan approval
 */
export async function logLoanApproved(
	loanId: string,
	userId: string,
	loanNumber: string
): Promise<void> {
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.loan_approved,
		description: `Loan ${loanNumber} was approved`,
		entityType: ActivitiesEntityTypeOptions.loan,
		entityId: loanId,
		userId,
		metadata: { loanNumber }
	});
}

/**
 * Log loan rejection
 */
export async function logLoanRejected(
	loanId: string,
	userId: string,
	loanNumber: string,
	reason: string
): Promise<void> {
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.loan_rejected,
		description: `Loan ${loanNumber} was rejected`,
		entityType: ActivitiesEntityTypeOptions.loan,
		entityId: loanId,
		userId,
		metadata: { loanNumber, reason }
	});
}

/**
 * Log loan disbursement
 */
export async function logLoanDisbursed(
	loanId: string,
	userId: string,
	loanNumber: string,
	amount: number
): Promise<void> {
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.loan_disbursed,
		description: `Loan ${loanNumber} disbursed: KES ${amount.toLocaleString()}`,
		entityType: ActivitiesEntityTypeOptions.loan,
		entityId: loanId,
		userId,
		metadata: { loanNumber, amount }
	});
}

/**
 * Log loan repayment (fully paid)
 */
export async function logLoanRepaid(
	loanId: string,
	userId: string,
	loanNumber: string
): Promise<void> {
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.loan_repaid,
		description: `Loan ${loanNumber} fully repaid`,
		entityType: ActivitiesEntityTypeOptions.loan,
		entityId: loanId,
		userId,
		metadata: { loanNumber }
	});
}

/**
 * Log payment received
 */
export async function logPaymentReceived(
	paymentId: string,
	userId: string,
	loanId: string,
	amount: number,
	transactionRef?: string
): Promise<void> {
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.payment_received,
		description: `Payment of KES ${amount.toLocaleString()} received`,
		entityType: ActivitiesEntityTypeOptions.payment,
		entityId: paymentId,
		userId,
		metadata: { loanId, amount, transactionRef }
	});
}

/**
 * Log application link creation
 */
export async function logLinkCreated(
	linkId: string,
	userId: string,
	customerId?: string
): Promise<void> {
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.link_created,
		description: 'Application link was created',
		entityType: ActivitiesEntityTypeOptions.link,
		entityId: linkId,
		userId,
		metadata: { customerId }
	});
}

/**
 * Log application link used
 */
export async function logLinkUsed(linkId: string, ipAddress?: string): Promise<void> {
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.link_used,
		description: 'Application link was used',
		entityType: ActivitiesEntityTypeOptions.link,
		entityId: linkId,
		ipAddress,
		isSystem: true
	});
}

/**
 * Log email sent
 */
export async function logEmailSent(
	emailLogId: string,
	userId: string | undefined,
	recipientEmail: string,
	subject: string,
	isAutomated: boolean = false
): Promise<void> {
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.email_sent,
		description: `Email sent to ${recipientEmail}`,
		entityType: ActivitiesEntityTypeOptions.email,
		entityId: emailLogId,
		userId,
		isSystem: isAutomated,
		metadata: { recipientEmail, subject }
	});
}

/**
 * Log settings update
 */
export async function logSettingsUpdated(
	userId: string,
	settingKey: string,
	category: string
): Promise<void> {
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.settings_updated,
		description: `Setting "${settingKey}" was updated`,
		entityType: ActivitiesEntityTypeOptions.settings,
		entityId: settingKey,
		userId,
		metadata: { category }
	});
}

/**
 * Log system action (automated/cron)
 */
export async function logSystemAction(
	description: string,
	entityType?: EntityType,
	entityId?: string,
	metadata?: Record<string, unknown>
): Promise<void> {
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.system_action,
		description,
		entityType,
		entityId,
		isSystem: true,
		metadata
	});
}

/**
 * Log report generation
 */
export async function logReportGenerated(
	userId: string,
	reportType: string,
	period: string,
	dateRange?: { startDate: string; endDate: string }
): Promise<void> {
	await logActivity({
		activityType: ActivitiesActivityTypeOptions.report_generated,
		description: `${reportType} report generated for ${period}`,
		entityType: ActivitiesEntityTypeOptions.analytics,
		userId,
		metadata: { reportType, period, dateRange }
	});
}

/**
 * Get recent activities
 */
export async function getRecentActivities(
	limit: number = 50,
	filters?: {
		userId?: string;
		entityType?: EntityType;
		entityId?: string;
		activityType?: ActivityType;
	}
): Promise<ActivitiesResponse[]> {
	const filterParts: string[] = [];

	if (filters?.userId) filterParts.push(`user = "${filters.userId}"`);
	if (filters?.entityType) filterParts.push(`entity_type = "${filters.entityType}"`);
	if (filters?.entityId) filterParts.push(`entity_id = "${filters.entityId}"`);
	if (filters?.activityType) filterParts.push(`activity_type = "${filters.activityType}"`);

	const filter = filterParts.length > 0 ? filterParts.join(' && ') : '';

	const result = await pb.collection(Collections.Activities).getList<ActivitiesResponse>(1, limit, {
		filter,
		sort: '-created',
		expand: 'user'
	});

	return result.items;
}

/**
 * Get activities for an entity
 */
export async function getEntityActivities(
	entityType: EntityType,
	entityId: string,
	limit: number = 20
): Promise<ActivitiesResponse[]> {
	return getRecentActivities(limit, { entityType, entityId });
}

/**
 * Get user activities
 */
export async function getUserActivities(
	userId: string,
	limit: number = 20
): Promise<ActivitiesResponse[]> {
	return getRecentActivities(limit, { userId });
}
