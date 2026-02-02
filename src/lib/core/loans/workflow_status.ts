/**
 * Loan workflow status utilities
 * Client-safe functions for workflow UI display
 */

import { LoansStatusOptions, type LoansResponse } from '$lib/types';

/**
 * Approve loan input
 */
export interface ApproveLoanInput {
	loanId: string;
	approvedAmount?: number;
	notes?: string;
}

/**
 * Reject loan input
 */
export interface RejectLoanInput {
	loanId: string;
	reason: string;
	notes?: string;
}

/**
 * Disburse loan input
 */
export interface DisburseLoanInput {
	loanId: string;
	notes?: string;
}

/**
 * Record payment input
 */
export interface RecordPaymentInput {
	loanId: string;
	amount: number;
	paymentMethod: string;
	transactionReference?: string;
	notes?: string;
}

/**
 * Waive penalty input
 */
export interface WaivePenaltyInput {
	loanId: string;
	waiveAmount: number;
	reason: string;
}

/**
 * Workflow status info
 */
export interface WorkflowStatusInfo {
	step: number;
	stepName: string;
	canApprove: boolean;
	canReject: boolean;
	canDisburse: boolean;
	canRecordPayment: boolean;
	canWaivePenalty: boolean;
	canMarkDefaulted: boolean;
	isComplete: boolean;
}

/**
 * Get workflow status info for UI display
 */
export function getWorkflowStatus(loan: LoansResponse): WorkflowStatusInfo {
	const status = loan.status as LoansStatusOptions;

	switch (status) {
		case LoansStatusOptions.pending:
			return {
				step: 1,
				stepName: 'Review & Approval',
				canApprove: true,
				canReject: true,
				canDisburse: false,
				canRecordPayment: false,
				canWaivePenalty: false,
				canMarkDefaulted: false,
				isComplete: false
			};
		case LoansStatusOptions.approved:
			return {
				step: 2,
				stepName: 'Disburse Funds',
				canApprove: false,
				canReject: false,
				canDisburse: true,
				canRecordPayment: false,
				canWaivePenalty: false,
				canMarkDefaulted: false,
				isComplete: false
			};
		case LoansStatusOptions.disbursed:
		case LoansStatusOptions.partially_paid:
			return {
				step: 3,
				stepName: 'Active Loan',
				canApprove: false,
				canReject: false,
				canDisburse: false,
				canRecordPayment: true,
				canWaivePenalty: (loan.penalty_amount || 0) > 0,
				canMarkDefaulted: true,
				isComplete: false
			};
		case LoansStatusOptions.repaid:
			return {
				step: 4,
				stepName: 'Completed',
				canApprove: false,
				canReject: false,
				canDisburse: false,
				canRecordPayment: false,
				canWaivePenalty: false,
				canMarkDefaulted: false,
				isComplete: true
			};
		case LoansStatusOptions.defaulted:
			return {
				step: 5,
				stepName: 'Defaulted',
				canApprove: false,
				canReject: false,
				canDisburse: false,
				canRecordPayment: true, // Allow recovery payments
				canWaivePenalty: (loan.penalty_amount || 0) > 0,
				canMarkDefaulted: false,
				isComplete: true
			};
		case LoansStatusOptions.rejected:
			return {
				step: 0,
				stepName: 'Rejected',
				canApprove: false,
				canReject: false,
				canDisburse: false,
				canRecordPayment: false,
				canWaivePenalty: false,
				canMarkDefaulted: false,
				isComplete: true
			};
		default:
			return {
				step: 0,
				stepName: 'Unknown',
				canApprove: false,
				canReject: false,
				canDisburse: false,
				canRecordPayment: false,
				canWaivePenalty: false,
				canMarkDefaulted: false,
				isComplete: false
			};
	}
}
