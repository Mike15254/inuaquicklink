import type PocketBase from 'pocketbase';
import type { TypedPocketBase } from '$lib/types';

declare global {
	namespace App {
		interface Locals {
			pb: TypedPocketBase;
			user?: any; // PocketBase user record
			token?: string; // Auth token
		}
	}
}

export {};