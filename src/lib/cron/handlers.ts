/**
 * Cron job handlers
 * These are the actual job implementations that process loan lifecycle automation
 */

import { pb } from '$lib/infra/db/pb';
import {
	Collections,
	LoansStatusOptions,
	ApplicationLinksStatusOptions,
	ActivitiesEntityTypeOptions,
	type LoansResponse,
	type CustomersResponse,
	type OrganizationResponse,
	type LoanSettingsResponse
} from '$lib/types';
import { todayISO, addDays, calculateDaysOverdue, formatDate } from '$lib/shared/date_time';
import { formatKES } from '$lib/shared/currency';
import { sendTemplateEmail, TEMPLATE_KEYS } from '$lib/services/email/email_template_service';
import { logSystemAction } from '$lib/core/activity/activity_service';
import type { CronJobResult } from './jobs';
import {
	calculatePenalty,
	isInGracePeriod,
	isInPenaltyPeriod,
	shouldBeDefaulted,
	calculateGracePeriodEndDate,
	DEFAULT_LOAN_SETTINGS,
	type LoanCalculationSettings
} from '$lib/core/loans/loan_calculations';

/**
 * Type for loans with customer expansion
 */
type LoanWithCustomer = LoansResponse<unknown, { customer?: CustomersResponse }>;

/**
 * Get organization settings for emails
 */
async function getOrganization(): Promise<OrganizationResponse | null> {
	try {
		const orgs = await pb.collection(Collections.Organization).getFullList<OrganizationResponse>();
		return orgs[0] || null;
	} catch {
		return null;
	}
}

/**
 * Get loan settings from database, with defaults
 */
async function getLoanSettings(): Promise<LoanCalculationSettings> {
	try {
		const settings = await pb
			.collection(Collections.LoanSettings)
			.getFullList<LoanSettingsResponse>();
		const dbSettings = settings[0];

		if (dbSettings) {
			return {
				interestRate15Days: dbSettings.interest_rate_15_days ?? DEFAULT_LOAN_SETTINGS.interestRate15Days,
				interestRate30Days: dbSettings.interest_rate_30_days ?? DEFAULT_LOAN_SETTINGS.interestRate30Days,
				processingFeeRate: dbSettings.processing_fee_rate ?? DEFAULT_LOAN_SETTINGS.processingFeeRate,
				penaltyRate: dbSettings.penalty_rate ?? dbSettings.late_payment_penalty_rate ?? DEFAULT_LOAN_SETTINGS.penaltyRate,
				gracePeriodDays: dbSettings.grace_period_days ?? DEFAULT_LOAN_SETTINGS.gracePeriodDays,
				penaltyPeriodDays: dbSettings.penalty_period_days ?? DEFAULT_LOAN_SETTINGS.penaltyPeriodDays,
				maxLoanPercentage: dbSettings.max_loan_percentage ?? DEFAULT_LOAN_SETTINGS.maxLoanPercentage,
				minLoanAmount: dbSettings.min_loan_amount ?? DEFAULT_LOAN_SETTINGS.minLoanAmount,
				maxLoanAmount: dbSettings.max_loan_amount ?? DEFAULT_LOAN_SETTINGS.maxLoanAmount
			};
		}
		return DEFAULT_LOAN_SETTINGS;
	} catch {
		return DEFAULT_LOAN_SETTINGS;
	}
}

/**
 * Get loan's settings snapshot or fall back to current settings
 */
function getLoanSettingsFromSnapshot(loan: LoansResponse, defaultSettings: LoanCalculationSettings): LoanCalculationSettings {
	const snapshot = loan.settings_snapshot as Record<string, unknown> | null;
	if (!snapshot) return defaultSettings;

	return {
		interestRate15Days: (snapshot.interest_rate_15_days as number) ?? defaultSettings.interestRate15Days,
		interestRate30Days: (snapshot.interest_rate_30_days as number) ?? defaultSettings.interestRate30Days,
		processingFeeRate: (snapshot.processing_fee_rate as number) ?? defaultSettings.processingFeeRate,
		penaltyRate: (snapshot.penalty_rate as number) ?? defaultSettings.penaltyRate,
		gracePeriodDays: (snapshot.grace_period_days as number) ?? defaultSettings.gracePeriodDays,
		penaltyPeriodDays: (snapshot.penalty_period_days as number) ?? defaultSettings.penaltyPeriodDays,
		maxLoanPercentage: (snapshot.max_loan_percentage as number) ?? defaultSettings.maxLoanPercentage,
		minLoanAmount: (snapshot.min_loan_amount as number) ?? defaultSettings.minLoanAmount,
		maxLoanAmount: (snapshot.max_loan_amount as number) ?? defaultSettings.maxLoanAmount
	};
}

/**
 * Payment Reminder Job Handler
 * Sends reminders for loans due within 3/2/1/0 days
 */
export async function runPaymentReminderJob(): Promise<CronJobResult> {
	const startTime = Date.now();
	const errors: string[] = [];
	let processedCount = 0;

	try {
		const today = new Date();
		const todayStr = todayISO();

		// Active loan statuses that should receive reminders
		const activeStatuses = [
			LoansStatusOptions.disbursed,
			LoansStatusOptions.active,
			LoansStatusOptions.partially_paid
		];
		const statusFilter = activeStatuses.map(s => `status = "${s}"`).join(' || ');

		// Get all active loans
		const activeLoans = await pb
			.collection(Collections.Loans)
			.getFullList<LoanWithCustomer>({
				filter: `(${statusFilter})`,
				expand: 'customer'
			});

		for (const loan of activeLoans) {
			try {
				const dueDate = new Date(loan.due_date);
				const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

				// Send reminder based on days until due
				let reminderType: string | null = null;
				if (daysDiff === 3) reminderType = 'payment_reminder_3_days';
				else if (daysDiff === 2) reminderType = 'payment_reminder_2_days';
				else if (daysDiff === 1) reminderType = 'payment_reminder_1_day';
				else if (daysDiff === 0) reminderType = 'payment_due_today';

				if (reminderType) {
					const customer = loan.expand?.customer as CustomersResponse | undefined;
					const organization = await getOrganization();

					// Send email
					await sendTemplateEmail(
						reminderType,
						customer?.email || '',
						{
							borrower_name: customer?.name.split(' ')[0] || 'Customer',
							due_date: formatDate(loan.due_date),
							amount_due: formatKES(loan.balance || 0),
							balance_remaining: formatKES(loan.balance || 0),
							payment_instructions: `Pay via Paybill ${organization?.mpesa_paybill || '123456'}, Account Number ${organization?.account_number || 'Your ID'}`,
							COMPANY_NAME: organization?.name
						},
						{
							customerId: customer?.id,
							loanId: loan.id,
							isAutomated: true
						}
					);

					await logSystemAction(
						`Payment reminder (${reminderType}) sent for loan ${loan.loan_number}${customer ? ` to ${customer.email}` : ''}`,
						ActivitiesEntityTypeOptions.loan,
						loan.id,
						{ customerId: customer?.id, dueDate: loan.due_date, reminderType, daysUntilDue: daysDiff }
					);

					processedCount++;
				}
			} catch (error) {
				errors.push(`Failed to process loan ${loan.id}: ${error}`);
			}
		}

		if (processedCount > 0) {
			await logSystemAction(
				`Payment reminder job completed: ${processedCount} reminders queued`,
				ActivitiesEntityTypeOptions.system
			);
		}
	} catch (error) {
		errors.push(`Job failed: ${error}`);
	}

	return {
		success: errors.length === 0,
		processedCount,
		errors,
		duration: Date.now() - startTime
	};
}

/**
 * Overdue Check Job Handler
 * Identifies overdue loans and transitions them to overdue status
 * Handles grace period logic
 */
export async function runOverdueCheckJob(): Promise<CronJobResult> {
	const startTime = Date.now();
	const errors: string[] = [];
	let processedCount = 0;

	try {
		const today = todayISO();
		const settings = await getLoanSettings();

		// Find loans past due date that are still in active status
		const activeStatuses = [
			LoansStatusOptions.disbursed,
			LoansStatusOptions.active,
			LoansStatusOptions.partially_paid
		];
		const statusFilter = activeStatuses.map(s => `status = "${s}"`).join(' || ');

		const overdueLoans = await pb.collection(Collections.Loans).getFullList<LoanWithCustomer>({
			filter: `(${statusFilter}) && due_date < "${today}"`,
			expand: 'customer'
		});

		for (const loan of overdueLoans) {
			try {
				const loanSettings = getLoanSettingsFromSnapshot(loan, settings);
				const daysOverdue = calculateDaysOverdue(loan.due_date);

				// Calculate grace period end date if not set
				const gracePeriodEndDate = loan.grace_period_end_date
					? new Date(loan.grace_period_end_date)
					: calculateGracePeriodEndDate(new Date(loan.due_date), loanSettings);

				const updateData: Partial<LoansResponse> = {
					days_overdue: daysOverdue
				};

				// Set grace period end date if not already set
				if (!loan.grace_period_end_date) {
					updateData.grace_period_end_date = gracePeriodEndDate.toISOString();
				}

				// If still in grace period, mark as overdue but no penalty yet
				if (isInGracePeriod(daysOverdue, loanSettings) && loan.status !== LoansStatusOptions.overdue) {
					updateData.status = LoansStatusOptions.overdue;

					const customer = loan.expand?.customer as CustomersResponse | undefined;
					const organization = await getOrganization();

					// Send Overdue Grace Period Email
					await sendTemplateEmail(
						TEMPLATE_KEYS.OVERDUE_GRACE_PERIOD,
						customer?.email || '',
						{
							borrower_name: customer?.name.split(' ')[0] || 'Customer',
							days_overdue: daysOverdue,
							grace_period_remaining: loanSettings.gracePeriodDays - daysOverdue,
							amount_due: formatKES(loan.balance || 0),
							balance_remaining: formatKES(loan.balance || 0),
							payment_instructions: `Pay via Paybill ${organization?.mpesa_paybill || '123456'}, Account Number ${organization?.account_number || 'Your ID'}`,
							COMPANY_NAME: organization?.name
						},
						{
							customerId: customer?.id,
							loanId: loan.id,
							isAutomated: true
						}
					);

					await logSystemAction(
						`Loan ${loan.loan_number} marked as overdue (grace period: ${loanSettings.gracePeriodDays - daysOverdue} days remaining)`,
						ActivitiesEntityTypeOptions.loan,
						loan.id,
						{ customerId: customer?.id, daysOverdue, gracePeriodRemaining: loanSettings.gracePeriodDays - daysOverdue }
					);
				}

				await pb.collection(Collections.Loans).update(loan.id, updateData);
				processedCount++;
			} catch (error) {
				errors.push(`Failed to process loan ${loan.id}: ${error}`);
			}
		}

		if (processedCount > 0) {
			await logSystemAction(
				`Overdue check completed: ${processedCount} loans processed`,
				ActivitiesEntityTypeOptions.system
			);
		}
	} catch (error) {
		errors.push(`Job failed: ${error}`);
	}

	return {
		success: errors.length === 0,
		processedCount,
		errors,
		duration: Date.now() - startTime
	};
}

/**
 * Penalty Calculation Job Handler
 * Applies ONE-TIME penalty after grace period ends
 * Transitions loans from overdue to penalty_accruing
 */
export async function runPenaltyCalculationJob(): Promise<CronJobResult> {
	const startTime = Date.now();
	const errors: string[] = [];
	let processedCount = 0;

	try {
		const settings = await getLoanSettings();
		const today = todayISO();

		// Find overdue loans that might need penalty applied
		const overdueLoans = await pb.collection(Collections.Loans).getFullList<LoanWithCustomer>({
			filter: `(status = "${LoansStatusOptions.overdue}" || status = "${LoansStatusOptions.disbursed}" || status = "${LoansStatusOptions.partially_paid}") && due_date < "${today}"`,
			expand: 'customer'
		});

		for (const loan of overdueLoans) {
			try {
				const loanSettings = getLoanSettingsFromSnapshot(loan, settings);
				const daysOverdue = calculateDaysOverdue(loan.due_date);

				// Check if grace period has ended and penalty not yet applied
				if (isInPenaltyPeriod(daysOverdue, loanSettings) && loan.status !== LoansStatusOptions.penalty_accruing) {
					// Calculate ONE-TIME penalty
					const penalty = calculatePenalty(loan.total_repayment || 0, daysOverdue, loanSettings);

					// Only apply if penalty wasn't already applied (check if penalty_start_date is set)
					if (!loan.penalty_start_date && penalty > 0) {
						const newBalance = (loan.balance || 0) + penalty;

						await pb.collection(Collections.Loans).update(loan.id, {
							status: LoansStatusOptions.penalty_accruing,
							penalty_amount: penalty,
							balance: newBalance,
							penalty_start_date: new Date().toISOString(),
							days_overdue: daysOverdue
						});

						const customer = loan.expand?.customer as CustomersResponse | undefined;
						const organization = await getOrganization();

						// Send Penalty Applied Email
						await sendTemplateEmail(
							TEMPLATE_KEYS.PENALTY_APPLIED,
							customer?.email || '',
							{
								borrower_name: customer?.name.split(' ')[0] || 'Customer',
								days_overdue: daysOverdue,
								penalty_amount: formatKES(penalty),
								new_total_due: formatKES(newBalance),
								principal_amount: formatKES(loan.loan_amount || 0),
								interest_amount: formatKES(loan.interest_amount || 0),
								processing_fee: formatKES(loan.processing_fee || 0),
								payment_instructions: `Pay via Paybill ${organization?.mpesa_paybill || '123456'}, Account Number ${organization?.account_number || 'Your ID'}`,
								COMPANY_NAME: organization?.name
							},
							{
								customerId: customer?.id,
								loanId: loan.id,
								isAutomated: true
							}
						);

						await logSystemAction(
							`Penalty applied to loan ${loan.loan_number}: ${penalty} (grace period ended)`,
							ActivitiesEntityTypeOptions.loan,
							loan.id,
							{
								customerId: customer?.id,
								daysOverdue,
								penaltyAmount: penalty,
								newBalance,
								penaltyRate: loanSettings.penaltyRate
							}
						);

						processedCount++;
					}
				} else if (loan.status === LoansStatusOptions.penalty_accruing) {
					// Just update days overdue, penalty is ONE-TIME (already applied)
					await pb.collection(Collections.Loans).update(loan.id, {
						days_overdue: daysOverdue
					});
				}
			} catch (error) {
				errors.push(`Failed to calculate penalty for loan ${loan.id}: ${error}`);
			}
		}

		if (processedCount > 0) {
			await logSystemAction(
				`Penalty calculation completed: ${processedCount} penalties applied`,
				ActivitiesEntityTypeOptions.system
			);
		}
	} catch (error) {
		errors.push(`Job failed: ${error}`);
	}

	return {
		success: errors.length === 0,
		processedCount,
		errors,
		duration: Date.now() - startTime
	};
}

/**
 * Default Check Job Handler
 * Marks loans as defaulted when penalty period ends
 */
export async function runDefaultCheckJob(): Promise<CronJobResult> {
	const startTime = Date.now();
	const errors: string[] = [];
	let processedCount = 0;

	try {
		const settings = await getLoanSettings();

		// Find loans in penalty_accruing status
		const penaltyLoans = await pb.collection(Collections.Loans).getFullList<LoanWithCustomer>({
			filter: `status = "${LoansStatusOptions.penalty_accruing}"`,
			expand: 'customer'
		});

		for (const loan of penaltyLoans) {
			try {
				const loanSettings = getLoanSettingsFromSnapshot(loan, settings);
				const daysOverdue = calculateDaysOverdue(loan.due_date);

				if (shouldBeDefaulted(daysOverdue, loanSettings)) {
					await pb.collection(Collections.Loans).update(loan.id, {
						status: LoansStatusOptions.defaulted,
						default_date: new Date().toISOString(),
						days_overdue: daysOverdue
					});

					// Update customer stats
					const customer = loan.expand?.customer as CustomersResponse | undefined;
					if (customer) {
						await pb.collection(Collections.Customers).update(customer.id, {
							active_loans: Math.max(0, (customer.active_loans || 0) - 1),
							defaulted_loans: (customer.defaulted_loans || 0) + 1
						});
					}

					const organization = await getOrganization();

					// Send Defaulted Email
					await sendTemplateEmail(
						TEMPLATE_KEYS.LOAN_DEFAULTED,
						customer?.email || '',
						{
							borrower_name: customer?.name.split(' ')[0] || 'Customer',
							total_outstanding: formatKES(loan.balance || 0),
							default_date: formatDate(new Date().toISOString()),
							days_overdue: daysOverdue,
							payment_instructions: `Pay via Paybill ${organization?.mpesa_paybill || '123456'}, Account Number ${organization?.account_number || 'Your ID'}`,
							COMPANY_NAME: organization?.name
						},
						{
							customerId: customer?.id,
							loanId: loan.id,
							isAutomated: true
						}
					);

					await logSystemAction(
						`Loan ${loan.loan_number} marked as defaulted after ${daysOverdue} days`,
						ActivitiesEntityTypeOptions.loan,
						loan.id,
						{ customerId: customer?.id, daysOverdue, balance: loan.balance }
					);

					processedCount++;
				}
			} catch (error) {
				errors.push(`Failed to process loan ${loan.id}: ${error}`);
			}
		}

		if (processedCount > 0) {
			await logSystemAction(
				`Default check completed: ${processedCount} loans marked as defaulted`,
				ActivitiesEntityTypeOptions.system
			);
		}
	} catch (error) {
		errors.push(`Job failed: ${error}`);
	}

	return {
		success: errors.length === 0,
		processedCount,
		errors,
		duration: Date.now() - startTime
	};
}

/**
 * Link Expiry Check Job Handler
 * Marks expired application links
 */
export async function runLinkExpiryCheckJob(): Promise<CronJobResult> {
	const startTime = Date.now();
	const errors: string[] = [];
	let processedCount = 0;

	try {
		const now = new Date().toISOString();

		// Find unused links that have expired
		const expiredLinks = await pb.collection(Collections.ApplicationLinks).getFullList({
			filter: `status = "${ApplicationLinksStatusOptions.unused}" && expires_at < "${now}"`
		});

		for (const link of expiredLinks) {
			try {
				await pb.collection(Collections.ApplicationLinks).update(link.id, {
					status: ApplicationLinksStatusOptions.expired
				});
				processedCount++;
			} catch (error) {
				errors.push(`Failed to expire link ${link.id}: ${error}`);
			}
		}

		if (processedCount > 0) {
			await logSystemAction(`Link expiry check: ${processedCount} links expired`, ActivitiesEntityTypeOptions.system);
		}
	} catch (error) {
		errors.push(`Job failed: ${error}`);
	}

	return {
		success: errors.length === 0,
		processedCount,
		errors,
		duration: Date.now() - startTime
	};
}

/**
 * System Cleanup Job Handler
 * Cleans up old data
 */
export async function runSystemCleanupJob(): Promise<CronJobResult> {
	const startTime = Date.now();
	const errors: string[] = [];
	let processedCount = 0;

	try {
		// Clean up old expired links (older than 30 days)
		const thirtyDaysAgo = addDays(new Date(), -30).toISOString();

		const oldExpiredLinks = await pb.collection(Collections.ApplicationLinks).getFullList({
			filter: `status = "${ApplicationLinksStatusOptions.expired}" && created < "${thirtyDaysAgo}"`
		});

		for (const link of oldExpiredLinks) {
			try {
				// Only delete if not associated with a loan
				if (!link.loan) {
					await pb.collection(Collections.ApplicationLinks).delete(link.id);
					processedCount++;
				}
			} catch (error) {
				errors.push(`Failed to delete link ${link.id}: ${error}`);
			}
		}

		await logSystemAction(`System cleanup completed: ${processedCount} items cleaned`, ActivitiesEntityTypeOptions.system);
	} catch (error) {
		errors.push(`Job failed: ${error}`);
	}

	return {
		success: errors.length === 0,
		processedCount,
		errors,
		duration: Date.now() - startTime
	};
}

/**
 * Run a specific cron job by ID
 */
export async function runCronJob(jobId: string): Promise<CronJobResult> {
	switch (jobId) {
		case 'payment_reminder':
			return runPaymentReminderJob();
		case 'overdue_check':
			return runOverdueCheckJob();
		case 'penalty_calculation':
			return runPenaltyCalculationJob();
		case 'default_check':
			return runDefaultCheckJob();
		case 'link_expiry_check':
			return runLinkExpiryCheckJob();
		case 'system_cleanup':
			return runSystemCleanupJob();
		default:
			return {
				success: false,
				processedCount: 0,
				errors: [`Unknown job ID: ${jobId}`],
				duration: 0
			};
	}
}
