/**
 * Real-time document upload API endpoint
 * Handles immediate file uploads to PocketBase for loan applications
 */

import { pb } from '$lib/infra/db/pb';
import { Collections } from '$lib/types';
import { json, type RequestEvent } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit for user convenience
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

// Map camelCase document keys to snake_case database values
const DOCUMENT_TYPE_MAP: Record<string, string> = {
	nationalIdFront: 'national_id_front',
	nationalIdBack: 'national_id_back',
	passportPhoto: 'passport_photo',
	latestPayslip: 'latest_payslip',
	previousPayslip: 'previous_payslip',
	postDatedCheque: 'post_dated_cheque'
};

export const POST: RequestHandler = async ({ request }: RequestEvent) => {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File;
		const documentKey = formData.get('documentKey') as string;

		// Validation
		if (!file) {
			return json({ success: false, error: 'No file provided' }, { status: 400 });
		}

		if (!documentKey) {
			return json({ success: false, error: 'Document key required' }, { status: 400 });
		}

		// Map to database document type
		const documentType = DOCUMENT_TYPE_MAP[documentKey];
		if (!documentType) {
			return json(
				{
					success: false,
					error: `Invalid document key: ${documentKey}`
				},
				{ status: 400 }
			);
		}

		// File size validation
		if (file.size > MAX_FILE_SIZE) {
			return json(
				{
					success: false,
					error: `File size exceeds 10MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`
				},
				{ status: 400 }
			);
		}

		// File type validation
		if (!ALLOWED_TYPES.includes(file.type)) {
			return json(
				{
					success: false,
					error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`
				},
				{ status: 400 }
			);
		}

		// Create a temporary document record in PocketBase
		// This will be linked to the loan later during submission
		const uploadFormData = new FormData();
		uploadFormData.append('file', file);
		uploadFormData.append('document_type', documentType);
		uploadFormData.append('file_name', file.name);
		uploadFormData.append('file_size', file.size.toString());
		uploadFormData.append('mime_type', file.type);

		// Create record without loan relation (will be set during submission)
		const record = await pb.collection(Collections.LoanDocuments).create(uploadFormData);

		return json({
			success: true,
			documentId: record.id,
			fileName: file.name,
			fileSize: file.size,
			mimeType: file.type
		});
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Upload failed'
			},
			{ status: 500 }
		);
	}
};

// DELETE endpoint for canceling uploads
export const DELETE: RequestHandler = async ({ request }: RequestEvent) => {
	try {
		const { documentId } = await request.json();

		if (!documentId) {
			return json({ success: false, error: 'Document ID required' }, { status: 400 });
		}

		// Delete the temporary document
		// Note: This may fail if document doesn't exist or permissions changed (e.g., already linked to loan)
		// We treat these cases as success since the goal is to remove it from the UI
		try {
			await pb.collection(Collections.LoanDocuments).delete(documentId);
		} catch (deleteError) {
			// console.warn('[upload-document] Delete warning:', deleteError);
			// Don't fail the request - document may already be deleted or linked to a submitted loan
		}

		return json({ success: true });
	} catch (error) {
		// console.error('[upload-document] Delete error:', error);
		// Return success anyway to prevent UI errors on document removal
		return json({ success: true });
	}
};
