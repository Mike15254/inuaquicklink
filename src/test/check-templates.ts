import { pb } from '$lib/infra/db/pb';
import { Collections } from '$lib/types';

const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || "admin@inuaquicklink.com";
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || "2jWsNG9ewHQu4zR";

async function checkTemplates() {
    console.log("Checking DB templates...");
    try {
        console.log(`Authenticating as admin: ${ADMIN_EMAIL}`);
        await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
        console.log("✅ Admin auth successful.");

        // Check if we can list users (sanity check)
        try {
            const users = await pb.collection('users').getList(1, 1);
            console.log(`✅ Can access 'users' collection. Total users: ${users.totalItems}`);
        } catch (e) {
            console.error("❌ Failed to access 'users' collection:", e);
        }

        try {
            const records = await pb.collection(Collections.EmailTemplates).getFullList();
            console.log(`Found ${records.length} templates in DB.`);
            records.forEach(r => console.log(`- ${r.template_key} (Active: ${r.is_active})`));
        } catch (e) {
            console.error("❌ Failed to list templates (EmailTemplates collection might be missing):", e);
        }

    } catch (e) {
        console.error("Auth failed:", e);
    }
}

checkTemplates();
