/**
 * Email service barrel export
 * 
 * IMPORTANT: This module is safe for browser usage.
 * For sending emails (server-only), import directly from './client.ts' in +page.server.ts files
 */

// Browser-safe exports
export * from './composer';
export * from './logs';

// Re-export types that are safe for client
export type { SendEmailRequest, SendEmailResult } from './client';
export { TEMPLATE_KEYS, type TemplateKey } from './email_template_service';
