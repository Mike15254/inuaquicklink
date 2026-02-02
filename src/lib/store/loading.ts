import { writable } from 'svelte/store';

// Navigation loading state
export const navigationLoading = writable(false);

// Action loading states - track specific actions by ID
export const actionLoading = writable<Record<string, boolean>>({});

// Helper functions for managing action loading states
export function setActionLoading(actionId: string, loading: boolean) {
	actionLoading.update(state => ({
		...state,
		[actionId]: loading
	}));
}

export function clearActionLoading(actionId: string) {
	actionLoading.update(state => {
		const newState = { ...state };
		delete newState[actionId];
		return newState;
	});
}

// Helper to check if any action is loading
export function isAnyActionLoading(actions: string[]) {
	let isLoading = false;
	actionLoading.subscribe(state => {
		isLoading = actions.some(action => state[action]);
	})();
	return isLoading;
}