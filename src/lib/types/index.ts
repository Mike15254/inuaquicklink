import type PocketBase from 'pocketbase';
import type { RecordService } from 'pocketbase';

export enum Collections {
	Authorigins = '_authOrigins',
	Externalauths = '_externalAuths',
	Mfas = '_mfas',
	Otps = '_otps',
	Superusers = '_superusers',
	Activities = 'activities',
	ApplicationLinks = 'application_links',
	CronJobs = 'cron_jobs',
	Customers = 'customers',
	EmailLogs = 'email_logs',
	EmailTemplates = 'EmailTemplates',
	LoanDocuments = 'loan_documents',
	LoanSettings = 'loan_settings',
	Loans = 'loans',
	Organization = 'organization',
	Payments = 'payments',
	Roles = 'roles',
	SystemSettings = 'system_settings',
	Users = 'users'
}

// Alias types for improved usability
export type IsoDateString = string;
export type IsoAutoDateString = string & { readonly autodate: unique symbol };
export type RecordIdString = string;
export type FileNameString = string & { readonly filename: unique symbol };
export type HTMLString = string;

type ExpandType<T> = unknown extends T
	? T extends unknown
	? { expand?: unknown }
	: { expand: T }
	: { expand: T };

// System fields
export type BaseSystemFields<T = unknown> = {
	id: RecordIdString;
	collectionId: string;
	collectionName: Collections;
} & ExpandType<T>;

export type AuthSystemFields<T = unknown> = {
	email: string;
	emailVisibility: boolean;
	username: string;
	verified: boolean;
} & BaseSystemFields<T>;

// Record types for each collection

export type AuthoriginsRecord = {
	collectionRef: string;
	created: IsoAutoDateString;
	fingerprint: string;
	id: string;
	recordRef: string;
	updated: IsoAutoDateString;
};

export type ExternalauthsRecord = {
	collectionRef: string;
	created: IsoAutoDateString;
	id: string;
	provider: string;
	providerId: string;
	recordRef: string;
	updated: IsoAutoDateString;
};

export type MfasRecord = {
	collectionRef: string;
	created: IsoAutoDateString;
	id: string;
	method: string;
	recordRef: string;
	updated: IsoAutoDateString;
};

export type OtpsRecord = {
	collectionRef: string;
	created: IsoAutoDateString;
	id: string;
	password: string;
	recordRef: string;
	sentTo?: string;
	updated: IsoAutoDateString;
};

export type SuperusersRecord = {
	created: IsoAutoDateString;
	email: string;
	emailVisibility?: boolean;
	id: string;
	password: string;
	tokenKey: string;
	updated: IsoAutoDateString;
	verified?: boolean;
};

export enum ActivitiesActivityTypeOptions {
	'loan_created' = 'loan_created',
	'loan_approved' = 'loan_approved',
	'loan_rejected' = 'loan_rejected',
	'loan_disbursed' = 'loan_disbursed',
	'loan_repaid' = 'loan_repaid',
	'loan_updated' = 'loan_updated',
	'loan_defaulted' = 'loan_defaulted',
	'loan_closed' = 'loan_closed',
	'penalty_waived' = 'penalty_waived',
	'payment_received' = 'payment_received',
	'customer_created' = 'customer_created',
	'customer_updated' = 'customer_updated',
	'customer_blocked' = 'customer_blocked',
	'customer_activated' = 'customer_activated',
	'link_created' = 'link_created',
	'link_used' = 'link_used',
	'email_sent' = 'email_sent',
	'user_login' = 'user_login',
	'user_created' = 'user_created',
	'user_updated' = 'user_updated',
	'settings_updated' = 'settings_updated',
	'report_generated' = 'report_generated',
	'system_action' = 'system_action'
}

export enum ActivitiesEntityTypeOptions {
	'loan' = 'loan',
	'customer' = 'customer',
	'payment' = 'payment',
	'user' = 'user',
	'link' = 'link',
	'email' = 'email',
	'organization' = 'organization',
	'settings' = 'settings',
	'analytics' = 'analytics',
	'system' = 'system'
}
export type ActivitiesRecord<Tmetadata = unknown> = {
	activity_type?: ActivitiesActivityTypeOptions;
	created: IsoAutoDateString;
	description: string;
	entity_id?: string;
	entity_type?: ActivitiesEntityTypeOptions;
	id: string;
	ip_address?: string;
	is_system?: boolean;
	metadata?: null | Tmetadata;
	updated: IsoAutoDateString;
	user?: RecordIdString;
};

export enum ApplicationLinksStatusOptions {
	'unused' = 'unused',
	'used' = 'used',
	'expired' = 'expired'
}
export type ApplicationLinksRecord = {
	created: IsoAutoDateString;
	created_by?: RecordIdString;
	customer?: RecordIdString;
	expires_at: IsoDateString;
	id: string;
	ip_address?: string;
	loan?: RecordIdString;
	status: ApplicationLinksStatusOptions;
	token: string;
	updated: IsoAutoDateString;
	used_at?: IsoDateString;
	user_agent?: string;
};

export enum CronJobsJobTypeOptions {
	'payment_reminder' = 'payment_reminder',
	'overdue_check' = 'overdue_check',
	'penalty_calculation' = 'penalty_calculation',
	'link_expiry_check' = 'link_expiry_check',
	'system_cleanup' = 'system_cleanup'
}

export enum CronJobsStatusOptions {
	'active' = 'active',
	'paused' = 'paused',
	'failed' = 'failed'
}
export type CronJobsRecord<Tlast_result = unknown> = {
	created: IsoAutoDateString;
	error_message?: string;
	id: string;
	job_name: string;
	job_type?: CronJobsJobTypeOptions;
	last_result?: null | Tlast_result;
	last_run: IsoAutoDateString;
	next_run: IsoAutoDateString;
	run_count?: number;
	status: CronJobsStatusOptions;
	updated: IsoAutoDateString;
};

export enum CustomersStatusOptions {
	'pending' = 'pending',
	'active' = 'active',
	'blocked' = 'blocked'
}
export type CustomersRecord = {
	active_loans?: number;
	created: IsoAutoDateString;
	defaulted_loans?: number;
	email: string;
	employer_branch: string;
	employer_name: string;
	id: string;
	kra_pin: string;
	name: string;
	national_id: string;
	net_salary?: number;
	notes?: string;
	phone: string;
	residential_address: string;
	status?: CustomersStatusOptions;
	total_borrowed?: number;
	total_loans?: number;
	total_repaid?: number;
	updated: IsoAutoDateString;
};

export enum EmailLogsEmailTypeOptions {
	'application_received' = 'application_received',
	'loan_approved' = 'loan_approved',
	'loan_rejected' = 'loan_rejected',
	'loan_disbursed' = 'loan_disbursed',
	'payment_reminder' = 'payment_reminder',
	'payment_reminder_3_days' = 'payment_reminder_3_days',
	'payment_reminder_2_days' = 'payment_reminder_2_days',
	'payment_reminder_1_day' = 'payment_reminder_1_day',
	'payment_due_today' = 'payment_due_today',
	'payment_received' = 'payment_received',
	'overdue_notice' = 'overdue_notice',
	'grace_period_reminder' = 'grace_period_reminder',
	'penalty_applied' = 'penalty_applied',
	'penalty_reminder' = 'penalty_reminder',
	'loan_defaulted' = 'loan_defaulted',
	'loan_fully_paid' = 'loan_fully_paid',
	'penalty_waiver' = 'penalty_waiver',
	'loan_closed' = 'loan_closed',
	'auth_otp' = 'auth_otp',
	'custom' = 'custom'
}

export enum EmailLogsStatusOptions {
	'pending' = 'pending',
	'sent' = 'sent',
	'failed' = 'failed'
}
export type EmailLogsRecord = {
	body: HTMLString;
	created: IsoAutoDateString;
	customer?: RecordIdString;
	email_type?: EmailLogsEmailTypeOptions;
	error_message?: string;
	id: string;
	is_automated?: boolean;
	loan?: RecordIdString;
	recipient_email: string;
	sent_at: IsoAutoDateString;
	sent_by?: RecordIdString;
	status: EmailLogsStatusOptions;
	subject?: string;
	updated: IsoAutoDateString;
};

export type EmailTemplatesRecord<Tvariables = unknown> = {
	id: string;
	template_name: string;
	template_key: string;
	subject: string;
	body: HTMLString;
	variables?: null | Tvariables;
	is_active?: boolean;
	created: IsoAutoDateString;
	updated: IsoAutoDateString;
};

export enum LoanDocumentsDocumentTypeOptions {
	'national_id_front' = 'national_id_front',
	'national_id_back' = 'national_id_back',
	'passport_photo' = 'passport_photo',
	'latest_payslip' = 'latest_payslip',
	'previous_payslip' = 'previous_payslip',
	'post_dated_cheque' = 'post_dated_cheque'
}
export type LoanDocumentsRecord = {
	created: IsoAutoDateString;
	document_type?: LoanDocumentsDocumentTypeOptions;
	file?: FileNameString;
	file_name?: string;
	file_size?: number;
	id: string;
	loan?: RecordIdString;
	mime_type?: string;
	updated: IsoAutoDateString;
};

export type LoanSettingsRecord<Treminder_days_before_due = unknown> = {
	created: IsoAutoDateString;
	default_days_threshold?: number;
	id: string;
	interest_rate_15_days?: number;
	interest_rate_30_days?: number;
	late_payment_penalty_rate?: number;
	penalty_rate?: number;
	grace_period_days?: number;
	penalty_period_days?: number;
	max_loan_amount?: number;
	max_loan_percentage?: number;
	min_loan_amount?: number;
	processing_fee_rate?: number;
	reminder_days_before_due?: null | Treminder_days_before_due;
	updated: IsoAutoDateString;
};

export enum LoansLoanPurposeOptions {
	'emergency' = 'emergency',
	'medical' = 'medical',
	'education' = 'education',
	'business' = 'business',
	'personal' = 'personal',
	'other' = 'other'
}

export enum LoansDisbursementMethodOptions {
	'mpesa' = 'mpesa',
	'bank_transfer' = 'bank_transfer'
}

export enum LoansStatusOptions {
	'pending' = 'pending',
	'approved' = 'approved',
	'rejected' = 'rejected',
	'disbursed' = 'disbursed',
	'active' = 'active',
	'overdue' = 'overdue',
	'penalty_accruing' = 'penalty_accruing',
	'repaid' = 'repaid',
	'defaulted' = 'defaulted',
	'partially_paid' = 'partially_paid',
	'closed' = 'closed'
}
export type LoansRecord<Tsettings_snapshot = unknown> = {
	account_name?: string;
	amount_paid?: number;
	application_date?: IsoDateString;
	application_link: RecordIdString;
	approved_at: IsoAutoDateString;
	approved_by?: RecordIdString;
	balance?: number;
	bank_account?: string;
	bank_name?: string;
	created: IsoAutoDateString;
	customer: RecordIdString;
	days_overdue?: number;
	digital_signature?: string;
	disbursed_by?: RecordIdString;
	disbursement_amount?: number;
	disbursement_date: IsoAutoDateString;
	disbursement_method?: LoansDisbursementMethodOptions;
	due_date: IsoDateString;
	grace_period_end_date?: IsoDateString;
	penalty_start_date?: IsoDateString;
	default_date?: IsoDateString;
	closure_date?: IsoDateString;
	waiver_date?: IsoDateString;
	waiver_amount?: number;
	closure_reason?: string;
	settings_snapshot?: null | Tsettings_snapshot;
	id: string;
	interest_amount?: number;
	interest_rate?: number;
	loan_amount?: number;
	loan_number: string;
	loan_period_days?: number;
	loan_purpose?: LoansLoanPurposeOptions;
	mpesa_number?: string;
	notes?: string;
	penalty_amount?: number;
	processing_fee?: number;
	rejected_at: IsoAutoDateString;
	rejected_by?: RecordIdString;
	rejection_reason?: string;
	repayment_date: IsoAutoDateString;
	status?: LoansStatusOptions;
	total_repayment?: number;
	updated: IsoAutoDateString;
};

export type OrganizationRecord = {
	account_number?: string;
	bank_account?: string;
	bank_name?: string;
	created: IsoAutoDateString;
	email: string;
	id: string;
	logo?: FileNameString;
	mpesa_paybill?: string;
	notification_email?: string;
	code: string
	name: string;
	phone: string;
	updated: IsoAutoDateString;
};

export enum PaymentsPaymentMethodOptions {
	'mpesa' = 'mpesa',
	'bank_transfer' = 'bank_transfer',
	'cash' = 'cash',
	'cheque' = 'cheque'
}
export type PaymentsRecord = {
	amount?: number;
	created: IsoAutoDateString;
	customer?: RecordIdString;
	id: string;
	loan?: RecordIdString;
	notes?: string;
	payment_date: IsoAutoDateString;
	payment_method?: PaymentsPaymentMethodOptions;
	recorded_by?: RecordIdString;
	transaction_reference?: string;
	updated: IsoAutoDateString;
};

export type RolesRecord<Tpermissions = unknown> = {
	created: IsoAutoDateString;
	description?: string;
	id: string;
	is_system?: boolean;
	name: string;
	permissions: null | Tpermissions;
	updated: IsoAutoDateString;
};

export enum SystemSettingsCategoryOptions {
	'general' = 'general',
	'email' = 'email',
	'notifications' = 'notifications',
	'cron' = 'cron',
	'security' = 'security',
	'features' = 'features'
}
export type SystemSettingsRecord<Tvalue = unknown> = {
	category?: SystemSettingsCategoryOptions;
	created: IsoAutoDateString;
	description?: string;
	id: string;
	is_public?: boolean;
	key: string;
	updated: IsoAutoDateString;
	value?: null | Tvalue;
};

export enum UsersStatusOptions {
	'active' = 'active',
	'suspended' = 'suspended'
}
export type UsersRecord = {
	avatar?: FileNameString;
	created: IsoAutoDateString;
	email: string;
	emailVisibility?: boolean;
	id: string;
	name?: string;
	organization: RecordIdString;
	password: string;
	role: RecordIdString;
	status?: UsersStatusOptions;
	tokenKey: string;
	updated: IsoAutoDateString;
	verified?: boolean;
};

// Response types include system fields and match responses from the PocketBase API
export type AuthoriginsResponse<Texpand = unknown> = Required<AuthoriginsRecord> &
	BaseSystemFields<Texpand>;
export type ExternalauthsResponse<Texpand = unknown> = Required<ExternalauthsRecord> &
	BaseSystemFields<Texpand>;
export type MfasResponse<Texpand = unknown> = Required<MfasRecord> & BaseSystemFields<Texpand>;
export type OtpsResponse<Texpand = unknown> = Required<OtpsRecord> & BaseSystemFields<Texpand>;
export type SuperusersResponse<Texpand = unknown> = Required<SuperusersRecord> &
	AuthSystemFields<Texpand>;
export type ActivitiesResponse<Tmetadata = unknown, Texpand = unknown> = Required<
	ActivitiesRecord<Tmetadata>
> &
	BaseSystemFields<Texpand>;
export type ApplicationLinksResponse<Texpand = unknown> = Required<ApplicationLinksRecord> &
	BaseSystemFields<Texpand>;
export type CronJobsResponse<Tlast_result = unknown, Texpand = unknown> = Required<
	CronJobsRecord<Tlast_result>
> &
	BaseSystemFields<Texpand>;
export type CustomersResponse<Texpand = unknown> = Required<CustomersRecord> &
	BaseSystemFields<Texpand>;
export type EmailLogsResponse<Texpand = unknown> = Required<EmailLogsRecord> &
	BaseSystemFields<Texpand>;
export type EmailTemplatesResponse<Tvariables = unknown, Texpand = unknown> = Required<EmailTemplatesRecord<Tvariables>> &
	BaseSystemFields<Texpand>;
export type LoanDocumentsResponse<Texpand = unknown> = Required<LoanDocumentsRecord> &
	BaseSystemFields<Texpand>;
export type LoanSettingsResponse<Treminder_days_before_due = unknown, Texpand = unknown> = Required<
	LoanSettingsRecord<Treminder_days_before_due>
> &
	BaseSystemFields<Texpand>;
export type LoansResponse<Tsettings_snapshot = unknown, Texpand = unknown> = Required<LoansRecord<Tsettings_snapshot>> & BaseSystemFields<Texpand>;
export type OrganizationResponse<Texpand = unknown> = Required<OrganizationRecord> &
	BaseSystemFields<Texpand>;
export type PaymentsResponse<Texpand = unknown> = Required<PaymentsRecord> &
	BaseSystemFields<Texpand>;
export type RolesResponse<Tpermissions = unknown, Texpand = unknown> = Required<
	RolesRecord<Tpermissions>
> &
	BaseSystemFields<Texpand>;
export type SystemSettingsResponse<Tvalue = unknown, Texpand = unknown> = Required<
	SystemSettingsRecord<Tvalue>
> &
	BaseSystemFields<Texpand>;
export type UsersResponse<Texpand = unknown> = Required<UsersRecord> & AuthSystemFields<Texpand>;

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	_authOrigins: AuthoriginsRecord;
	_externalAuths: ExternalauthsRecord;
	_mfas: MfasRecord;
	_otps: OtpsRecord;
	_superusers: SuperusersRecord;
	activities: ActivitiesRecord;
	application_links: ApplicationLinksRecord;
	cron_jobs: CronJobsRecord;
	customers: CustomersRecord;
	email_logs: EmailLogsRecord;
	email_templates: EmailTemplatesRecord;
	loan_documents: LoanDocumentsRecord;
	loan_settings: LoanSettingsRecord;
	loans: LoansRecord;
	organization: OrganizationRecord;
	payments: PaymentsRecord;
	roles: RolesRecord;
	system_settings: SystemSettingsRecord;
	users: UsersRecord;
};

export type CollectionResponses = {
	_authOrigins: AuthoriginsResponse;
	_externalAuths: ExternalauthsResponse;
	_mfas: MfasResponse;
	_otps: OtpsResponse;
	_superusers: SuperusersResponse;
	activities: ActivitiesResponse;
	application_links: ApplicationLinksResponse;
	cron_jobs: CronJobsResponse;
	customers: CustomersResponse;
	email_logs: EmailLogsResponse;
	email_templates: EmailTemplatesResponse;
	loan_documents: LoanDocumentsResponse;
	loan_settings: LoanSettingsResponse;
	loans: LoansResponse;
	organization: OrganizationResponse;
	payments: PaymentsResponse;
	roles: RolesResponse;
	system_settings: SystemSettingsResponse;
	users: UsersResponse;
};

// Utility types for create/update operations

type ProcessCreateAndUpdateFields<T> = Omit<
	{
		// Omit AutoDate fields
		[K in keyof T as Extract<T[K], IsoAutoDateString> extends never
		? K
		: never]: // Convert FileNameString to File
		T[K] extends infer U
		? U extends FileNameString | FileNameString[]
		? U extends any[]
		? File[]
		: File
		: U
		: never;
	},
	'id'
>;

// Create type for Auth collections
export type CreateAuth<T> = {
	id?: RecordIdString;
	email: string;
	emailVisibility?: boolean;
	password: string;
	passwordConfirm: string;
	verified?: boolean;
} & ProcessCreateAndUpdateFields<T>;

// Create type for Base collections
export type CreateBase<T> = {
	id?: RecordIdString;
} & ProcessCreateAndUpdateFields<T>;

// Update type for Auth collections
export type UpdateAuth<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof AuthSystemFields>
> & {
	email?: string;
	emailVisibility?: boolean;
	oldPassword?: string;
	password?: string;
	passwordConfirm?: string;
	verified?: boolean;
};

// Update type for Base collections
export type UpdateBase<T> = Partial<Omit<ProcessCreateAndUpdateFields<T>, keyof BaseSystemFields>>;

// Get the correct create type for any collection
export type Create<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
	? CreateAuth<CollectionRecords[T]>
	: CreateBase<CollectionRecords[T]>;

// Get the correct update type for any collection
export type Update<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
	? UpdateAuth<CollectionRecords[T]>
	: UpdateBase<CollectionRecords[T]>;
export type TypedPocketBase = {
	collection<T extends keyof CollectionResponses>(
		idOrName: T
	): RecordService<CollectionResponses[T]>;
} & PocketBase;
