/**
 * Main library exports
 * Re-exports commonly used modules for convenience
 */

// Database
export { pb, isAuthenticated, getAuthToken, clearAuth, getFileUrl, getUserAvatarUrl } from './infra/db/pb';

// Shared utilities
export * from './shared';

// Types
export * from './types';

// Services
export * from './services/roles';

// Core modules
export * from './core/users';
export * from './core/activity';

// Store
export * from './store';
