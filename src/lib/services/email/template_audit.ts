
import { TEMPLATE_KEYS, compileEmailTemplate } from '$lib/services/email/email_template_service';
import { isSmtpConfigured } from '$lib/services/email/transport';

/**
 * Test script to verify all email templates
 * Usage: Import this function or run it in a suitable environment
 */
export async function testAllEmailTemplates() {
    console.log('Starting Email Template Audit...');
    console.log(`SMTP Configured: ${isSmtpConfigured()}`);

    const results = [];

    // Sample data for testing
    const sampleData = {
        borrower_name: 'John',
        applicant_name: 'John',
        loan_number: 'LN-2023-001',
        loan_amount: '10,000',
        formattedAmount: 'KES 10,000',
        loanPeriodDays: 30,
        applicationDate: '01/01/2023',
        formattedDate: '01/01/2023',
        organizationName: 'Acme Microfinance',
        organizationPhone: '0700000000',
        organizationEmail: 'info@acme.com',

        // Disbursement
        disbursed_amount: '9,500',
        disbursement_date: '02/01/2023',
        disbursement_method: 'M-Pesa',
        loan_term: '30 days',
        interest_amount: '1,500',
        processing_fee: '500',
        total_repayment: '11,500',
        due_date: '01/02/2023',
        payment_instructions: 'Paybill 123456',
        COMPANY_NAME: 'Acme Microfinance',

        // Rejection
        rejection_reason: 'Low credit score',

        // Payment
        payment_amount: '5,000',
        remaining_balance: '6,500',
        transaction_code: 'QWE123RTY',
        payment_date: '15/01/2023',

        // Closure/Default
        closure_reason: 'Paid in full',
        closure_date: '01/02/2023',
        final_status: 'Repaid',

        // Waiver
        waiver_amount: '500',
        new_total_due: '6,000',
        principal_amount: '10,000',
        original_penalty: '500'
    };

    const templates = Object.values(TEMPLATE_KEYS);
    console.log(`Found ${templates.length} templates to test.`);

    for (const key of templates) {
        try {
            console.log(`Testing template: ${key}...`);
            const compiled = await compileEmailTemplate(key, sampleData);

            if (compiled) {
                console.log(`  ✅ [PASS] ${key} - Subject: "${compiled.subject}"`);
                results.push({ key, status: 'PASS', subject: compiled.subject });
            } else {
                console.error(`  ❌ [FAIL] ${key} - Template not found or compile failed`);
                results.push({ key, status: 'FAIL', error: 'Not found' });
            }
        } catch (error) {
            console.error(`  ❌ [ERROR] ${key} - Exception:`, error);
            results.push({ key, status: 'ERROR', error: error instanceof Error ? error.message : 'Unknown' });
        }
    }

    console.log('-----------------------------------');
    console.log(`Audit Complete. Passed: ${results.filter(r => r.status === 'PASS').length}/${results.length}`);

    return results;
}
