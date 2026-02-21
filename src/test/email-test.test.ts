import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { pb } from '$lib/infra/db/pb';
import { TEMPLATE_KEYS, sendTemplateEmail } from '$lib/services/email/email_template_service';
import { isSmtpConfigured } from '$lib/services/email/transport';

// Configuration
const TARGET_EMAIL = "mike8max10@gmail.com";
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || "admin@Inua Quick Link.com";
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || "2jWsNG9ewHQu4zR";

describe("Email Template Tests", () => {
    beforeAll(async () => {
        console.log("🚀 Starting Email Templates Test Script");
        console.log(`📧 Target Email: ${TARGET_EMAIL}`);
        console.log(`🔌 SMTP Configured: ${isSmtpConfigured()}`);

        // Authenticate if credentials are provided
        if (ADMIN_EMAIL && ADMIN_PASSWORD) {
            try {
                console.log("🔐 Authenticating as admin...");
                await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
                console.log("✅ Authenticated successfully.");
            } catch (e) {
                console.error("❌ Authentication failed:", e);
                console.warn("⚠️ Proceeding without auth (might fail if templates are protected)...");
            }
        } else {
            console.warn("⚠️ No ADMIN_EMAIL/ADMIN_PASSWORD found in env. Proceeding without auth.");
        }
    });

    afterAll(() => {
        pb.authStore.clear();
    });

    // Sample Data
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const past = new Date();
    past.setDate(past.getDate() - 5);

    // Comprehensive sample data covering all template requirements
    const sampleData = {
        // Base Vars
        customerName: 'Mike Max',
        organizationName: 'Inua Quick Link',
        organizationPhone: '0700000000',
        organizationEmail: 'info@Inua Quick Link.co.ke',
        year: now.getFullYear().toString(),

        // Application
        loanNumber: 'LN-TEST-001',
        loanAmount: 10000,
        loanPeriod: 30,
        applicationDate: now,

        // Success/Disbursed
        interestRate: 0.15, // 15%
        processingFee: 500,
        disbursementAmount: 9500,
        totalRepayment: 11500,
        dueDate: future,
        disbursementMethod: 'mpesa',

        // Disbursement Details
        mpesaPaybill: '123456',
        bankAccount: '1234567890',
        bankName: 'Equity Bank',

        // Rejection
        rejectionReason: 'Credit score criteria not met',

        // Repayment / Reminder
        amountPaid: 5000,
        balance: 6500,
        daysUntilDue: 5,

        // Overdue / Default
        penaltyAmount: 500,
        daysOverdue: 15,
        totalOwed: 12000,

        // Grace Period
        graceDaysRemaining: 3,
        gracePeriodEnd: future,

        // Fallback/Legacy keys just in case
        formattedAmount: 'KES 10,000',
        formattedDate: now.toLocaleDateString('en-GB'),

        // Template compatibility keys (DB templates use different keys than code)
        COMPANY_NAME: 'Inua Quick Link',
        applicant_name: 'Mike Max',
        borrower_name: 'Mike Max',
        application_id: 'LN-TEST-001',
        submission_date: now.toLocaleDateString('en-GB'),
        balance_remaining: 'KES 6,500',
        due_date: future.toLocaleDateString('en-GB'),
        payment_instructions: 'Paybill: 123456, Account: LN-TEST-001',

        // Disbursement specific
        disbursed_amount: 'KES 9,500',
        disbursement_date: now.toLocaleDateString('en-GB'),
        disbursement_method: 'M-Pesa',
        loan_term: '30 days',
        // Payment Received specific
        payment_amount: 'KES 5,000',
        payment_date: now.toLocaleDateString('en-GB'),
        transaction_code: 'QHS1234567',
        remaining_balance: 'KES 1,500',

        // Loan Term (already defined above)
        // loan_term: '30 days',


        // Ensure all amounts are formatted with KES
        interest_amount: 'KES 1,500',
        processing_fee: 'KES 500',
        total_repayment: 'KES 11,500',

        // Add duplicate keys for safety if templates use different naming conventions
        total_owed: 'KES 12,000',
        amount_paid: 'KES 5,000',
        penalty_amount: 'KES 500',
        days_overdue: '15'
    };

    const templates = Object.values(TEMPLATE_KEYS);
    console.log(`\n📋 Found ${templates.length} templates to test.`);

    for (const key of templates) {
        test(`should send template: ${key}`, async () => {
            console.log(`\n📨 Sending template: ${key}...`);
            try {
                const result = await sendTemplateEmail(
                    key,
                    TARGET_EMAIL,
                    sampleData,
                    {
                        // customerId: 'TEST_CUSTOMER_ID',
                        // loanId: 'TEST_LOAN_ID',
                        // sentBy: 'TEST_SCRIPT',
                        isAutomated: false
                    }
                );

                if (result.success) {
                    console.log(`✅ Sent ${key} successfully.`);
                } else {
                    console.error(`❌ Failed to send ${key}: ${result.error}`);
                }

                expect(result.success).toBe(true);
            } catch (error) {
                console.error(`❌ Exception sending ${key}:`, error);
                throw error;
            }

            // Small delay to prevent rate limiting or overwhelming the server
            await new Promise(r => setTimeout(r, 500));
        }, 30000); // 30s timeout per test
    }
});
