/**
 * Email settings page data loader
 * Fetches email templates and organization data for preview
 */

import type { PageLoad } from './$types';
import { browser } from '$app/environment';
import { getAllEmailTemplates } from '$lib/services/email/email_template_data';
import { pb } from '$lib/infra/db/pb';
import { Collections, type OrganizationResponse } from '$lib/types';

export const load: PageLoad = async () => {
	if (!browser) {
		return {
			emailTemplates: [],
			organization: null
		};
	}

	try {
		const [emailTemplates, orgs] = await Promise.all([
			getAllEmailTemplates(),
			pb.collection(Collections.Organization).getList<OrganizationResponse>(1, 1)
		]);
		
		return { 
			emailTemplates, 
			organization: orgs.items[0] || null 
		};
	} catch (error) {
		console.error('Failed to load email settings:', error);
		return { emailTemplates: [], organization: null };
	}
};
