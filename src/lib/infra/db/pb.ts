import PocketBase from 'pocketbase';
import type { TypedPocketBase } from '$lib/types';

const pocketbaseUrl = import.meta.env.VITE_POCKETBASE_URL;

export const pb = new PocketBase(pocketbaseUrl) as TypedPocketBase;

// Disable auto-cancellation to prevent request cancellation on route changes
pb.autoCancellation(false);

/**
 * Check if user is currently authenticated
 */
export function isAuthenticated(): boolean {
	return pb.authStore.isValid;
}

/**
 * Get current auth token
 */
export function getAuthToken(): string | null {
	return pb.authStore.token;
}

/**
 * Clear auth state
 */
export function clearAuth(): void {
	pb.authStore.clear();
}

/**
 * Get file URL from PocketBase
 * @param collectionName - The collection name (e.g., 'users', 'documents')
 * @param recordId - The record ID
 * @param filename - The filename stored in the record
 * @param thumb - Optional thumbnail size (e.g., '100x100')
 */
export function getFileUrl(
	collectionName: string,
	recordId: string,
	filename: string,
	thumb?: string
): string {
	const baseUrl = `${pocketbaseUrl}/api/files/${collectionName}/${recordId}/${filename}`;
	return thumb ? `${baseUrl}?thumb=${thumb}` : baseUrl;
}

/**
 * Get user avatar URL
 */
export function getUserAvatarUrl(userId: string, avatarFilename: string | null | undefined, thumb?: string): string | null {
	if (!avatarFilename) return null;
	return getFileUrl('users', userId, avatarFilename, thumb);
}
