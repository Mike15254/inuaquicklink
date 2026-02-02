/**
 * Settings service for managing loan and system settings
 */

import { pb } from '$lib/infra/db/pb';
import { Collections, type LoanSettingsResponse } from '$lib/types';
import { NotFoundError, ValidationError } from '$lib/shared/errors';
import { Permission } from '$lib/services/roles/permissions';
import { assertPermission, type UserPermissions } from '$lib/services/roles/permission_checker';
import { logSettingsUpdated } from '$lib/core/activity/activity_service';

/**
 * Loan settings update input
 */
export interface UpdateLoanSettingsInput {
	min_loan_amount?: number;
	max_loan_amount?: number;
	max_loan_percentage?: number;
	interest_rate_15_days?: number;
	interest_rate_30_days?: number;
	processing_fee_rate?: number;
	late_payment_penalty_rate?: number;
	default_days_threshold?: number;
	reminder_days_before_due?: number[];
}

/**
 * Get loan settings (first record or create default)
 */
export async function getLoanSettings(): Promise<LoanSettingsResponse> {
	try {
		const settings = await pb.collection(Collections.LoanSettings).getList<LoanSettingsResponse>(1, 1);
		
		if (settings.items.length === 0) {
			// Create default settings
			return await pb.collection(Collections.LoanSettings).create<LoanSettingsResponse>({
				min_loan_amount: 1000,
				max_loan_amount: 500000,
				max_loan_percentage: 50,
				interest_rate_15_days: 10,
				interest_rate_30_days: 15,
				processing_fee_rate: 3,
				late_payment_penalty_rate: 5,
				default_days_threshold: 30,
				reminder_days_before_due: [7, 3, 1]
			});
		}

		return settings.items[0];
	} catch (error) {
		throw new NotFoundError('LoanSettings', 'default');
	}
}

/**
 * Update loan settings
 */
export async function updateLoanSettings(
	input: UpdateLoanSettingsInput,
	actorId: string,
	actorPermissions: UserPermissions
): Promise<LoanSettingsResponse> {
	assertPermission(actorPermissions, Permission.SETTINGS_UPDATE);

	// Get current settings
	const current = await getLoanSettings();

	// Validate input
	if (input.min_loan_amount !== undefined && input.min_loan_amount < 0) {
		throw new ValidationError('Minimum loan amount cannot be negative');
	}
	if (input.max_loan_amount !== undefined && input.max_loan_amount < 0) {
		throw new ValidationError('Maximum loan amount cannot be negative');
	}
	if (input.min_loan_amount && input.max_loan_amount && input.min_loan_amount > input.max_loan_amount) {
		throw new ValidationError('Minimum loan amount cannot exceed maximum');
	}
	if (input.max_loan_percentage !== undefined && (input.max_loan_percentage < 0 || input.max_loan_percentage > 100)) {
		throw new ValidationError('Max loan percentage must be between 0 and 100');
	}
	if (input.interest_rate_15_days !== undefined && input.interest_rate_15_days < 0) {
		throw new ValidationError('Interest rate cannot be negative');
	}
	if (input.interest_rate_30_days !== undefined && input.interest_rate_30_days < 0) {
		throw new ValidationError('Interest rate cannot be negative');
	}

	const updateData: Record<string, unknown> = {};
	if (input.min_loan_amount !== undefined) updateData.min_loan_amount = input.min_loan_amount;
	if (input.max_loan_amount !== undefined) updateData.max_loan_amount = input.max_loan_amount;
	if (input.max_loan_percentage !== undefined) updateData.max_loan_percentage = input.max_loan_percentage;
	if (input.interest_rate_15_days !== undefined) updateData.interest_rate_15_days = input.interest_rate_15_days;
	if (input.interest_rate_30_days !== undefined) updateData.interest_rate_30_days = input.interest_rate_30_days;
	if (input.processing_fee_rate !== undefined) updateData.processing_fee_rate = input.processing_fee_rate;
	if (input.late_payment_penalty_rate !== undefined) updateData.late_payment_penalty_rate = input.late_payment_penalty_rate;
	if (input.default_days_threshold !== undefined) updateData.default_days_threshold = input.default_days_threshold;
	if (input.reminder_days_before_due !== undefined) updateData.reminder_days_before_due = input.reminder_days_before_due;

	const settings = await pb.collection(Collections.LoanSettings).update<LoanSettingsResponse>(
		current.id,
		updateData
	);

	// Log activity
	await logSettingsUpdated(actorId, 'loan_settings', 'loans');

	return settings;
}
