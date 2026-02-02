/**
 * Document service
 * Handles loan document uploads and management
 */

import { pb, getFileUrl } from '$lib/infra/db/pb';
import {
	Collections,
	LoanDocumentsDocumentTypeOptions,
	type LoanDocumentsResponse
} from '$lib/types';
import { NotFoundError, ValidationError } from '$lib/shared/errors';
import { assertPermission, type UserPermissions } from '$lib/services/roles/permission_checker';
import { Permission } from '$lib/services/roles/permissions';

/**
 * Allowed file types for document uploads
 */
const ALLOWED_MIME_TYPES = [
	'image/jpeg',
	'image/png',
	'image/webp',
	'application/pdf'
];

/**
 * Maximum file size (5MB)
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Document type labels for display
 */
export const DOCUMENT_TYPE_LABELS: Record<LoanDocumentsDocumentTypeOptions, string> = {
	[LoanDocumentsDocumentTypeOptions.national_id_front]: 'National ID (Front)',
	[LoanDocumentsDocumentTypeOptions.national_id_back]: 'National ID (Back)',
	[LoanDocumentsDocumentTypeOptions.passport_photo]: 'Passport Photo',
	[LoanDocumentsDocumentTypeOptions.latest_payslip]: 'Latest Payslip',
	[LoanDocumentsDocumentTypeOptions.previous_payslip]: 'Previous Payslip',
	[LoanDocumentsDocumentTypeOptions.post_dated_cheque]: 'Post-Dated Cheque'
};

/**
 * Required documents for loan application
 */
export const REQUIRED_DOCUMENTS: LoanDocumentsDocumentTypeOptions[] = [
	LoanDocumentsDocumentTypeOptions.national_id_front,
	LoanDocumentsDocumentTypeOptions.national_id_back,
	LoanDocumentsDocumentTypeOptions.passport_photo,
	LoanDocumentsDocumentTypeOptions.latest_payslip,
	LoanDocumentsDocumentTypeOptions.previous_payslip
];

/**
 * Validate file for upload
 */
export function validateDocument(file: File): { valid: boolean; error?: string } {
	if (!file) {
		return { valid: false, error: 'No file provided' };
	}

	if (!ALLOWED_MIME_TYPES.includes(file.type)) {
		return {
			valid: false,
			error: 'Invalid file type. Allowed: JPEG, PNG, WebP, PDF'
		};
	}

	if (file.size > MAX_FILE_SIZE) {
		return {
			valid: false,
			error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`
		};
	}

	return { valid: true };
}

/**
 * Upload document input
 */
export interface UploadDocumentInput {
	loanId: string;
	documentType: LoanDocumentsDocumentTypeOptions;
	file: File;
}

/**
 * Upload a document for a loan
 */
export async function uploadDocument(
	input: UploadDocumentInput
): Promise<LoanDocumentsResponse> {
	// Validate file
	const validation = validateDocument(input.file);
	if (!validation.valid) {
		throw new ValidationError(validation.error || 'Invalid file');
	}

	// Check if document of this type already exists for this loan
	const existing = await getDocumentByType(input.loanId, input.documentType);
	if (existing) {
		// Delete old document
		await pb.collection(Collections.LoanDocuments).delete(existing.id);
	}

	// Create form data for file upload
	const formData = new FormData();
	formData.append('loan', input.loanId);
	formData.append('document_type', input.documentType);
	formData.append('file', input.file);
	formData.append('file_name', input.file.name);
	formData.append('file_size', String(input.file.size));
	formData.append('mime_type', input.file.type);

	const document = await pb
		.collection(Collections.LoanDocuments)
		.create<LoanDocumentsResponse>(formData);

	return document;
}

/**
 * Get document by ID
 */
export async function getDocumentById(documentId: string): Promise<LoanDocumentsResponse> {
	try {
		const document = await pb
			.collection(Collections.LoanDocuments)
			.getOne<LoanDocumentsResponse>(documentId);
		return document;
	} catch {
		throw new NotFoundError('Document', documentId);
	}
}

/**
 * Get document by type for a loan
 */
export async function getDocumentByType(
	loanId: string,
	documentType: LoanDocumentsDocumentTypeOptions
): Promise<LoanDocumentsResponse | null> {
	try {
		const document = await pb
			.collection(Collections.LoanDocuments)
			.getFirstListItem<LoanDocumentsResponse>(
				`loan = "${loanId}" && document_type = "${documentType}"`
			);
		return document;
	} catch {
		return null;
	}
}

/**
 * Get all documents for a loan
 */
export async function getLoanDocuments(loanId: string): Promise<LoanDocumentsResponse[]> {
	return await pb.collection(Collections.LoanDocuments).getFullList<LoanDocumentsResponse>({
		filter: `loan = "${loanId}"`,
		sort: 'document_type'
	});
}

/**
 * Check if loan has all required documents
 */
export async function hasAllRequiredDocuments(loanId: string): Promise<{
	complete: boolean;
	missing: LoanDocumentsDocumentTypeOptions[];
}> {
	const documents = await getLoanDocuments(loanId);
	const uploadedTypes = documents.map((d) => d.document_type);

	const missing = REQUIRED_DOCUMENTS.filter((type) => !uploadedTypes.includes(type));

	return {
		complete: missing.length === 0,
		missing
	};
}

/**
 * Get document file URL
 */
export function getDocumentUrl(
	document: LoanDocumentsResponse,
	thumb?: string
): string {
	if (!document.file) return '';

	return getFileUrl(
		document.collectionName,
		document.id,
		document.file as unknown as string,
		thumb
	);
}

/**
 * Delete document
 */
export async function deleteDocument(
	documentId: string,
	userPermissions: UserPermissions
): Promise<void> {
	assertPermission(userPermissions, Permission.LOANS_UPDATE);

	await pb.collection(Collections.LoanDocuments).delete(documentId);
}

/**
 * Delete all documents for a loan
 */
export async function deleteLoanDocuments(loanId: string): Promise<number> {
	const documents = await getLoanDocuments(loanId);

	for (const doc of documents) {
		await pb.collection(Collections.LoanDocuments).delete(doc.id);
	}

	return documents.length;
}

/**
 * Get document upload status for a loan
 */
export async function getDocumentUploadStatus(loanId: string): Promise<{
	required: LoanDocumentsDocumentTypeOptions[];
	uploaded: LoanDocumentsDocumentTypeOptions[];
	missing: LoanDocumentsDocumentTypeOptions[];
	optional: LoanDocumentsDocumentTypeOptions[];
	uploadedOptional: LoanDocumentsDocumentTypeOptions[];
}> {
	const documents = await getLoanDocuments(loanId);
	const uploadedTypes = documents.map((d) => d.document_type) as LoanDocumentsDocumentTypeOptions[];

	const uploaded = REQUIRED_DOCUMENTS.filter((type) => uploadedTypes.includes(type));
	const missing = REQUIRED_DOCUMENTS.filter((type) => !uploadedTypes.includes(type));

	// Optional documents (not in required list)
	const allTypes = Object.values(LoanDocumentsDocumentTypeOptions);
	const optionalTypes = allTypes.filter((type) => !REQUIRED_DOCUMENTS.includes(type));
	const uploadedOptional = optionalTypes.filter((type) => uploadedTypes.includes(type));

	return {
		required: REQUIRED_DOCUMENTS,
		uploaded,
		missing,
		optional: optionalTypes,
		uploadedOptional
	};
}

/**
 * Upload multiple documents at once
 */
export async function uploadMultipleDocuments(
	loanId: string,
	files: Map<LoanDocumentsDocumentTypeOptions, File>
): Promise<{
	success: LoanDocumentsDocumentTypeOptions[];
	failed: { type: LoanDocumentsDocumentTypeOptions; error: string }[];
}> {
	const success: LoanDocumentsDocumentTypeOptions[] = [];
	const failed: { type: LoanDocumentsDocumentTypeOptions; error: string }[] = [];

	for (const [documentType, file] of files) {
		try {
			await uploadDocument({ loanId, documentType, file });
			success.push(documentType);
		} catch (error) {
			failed.push({
				type: documentType,
				error: error instanceof Error ? error.message : 'Upload failed'
			});
		}
	}

	return { success, failed };
}
