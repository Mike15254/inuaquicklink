<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	import BellIcon from '@lucide/svelte/icons/bell';
	import MailIcon from '@lucide/svelte/icons/mail';
	import CheckIcon from '@lucide/svelte/icons/check';
	import XIcon from '@lucide/svelte/icons/x';

	// Notification preferences (would be persisted to settings)
	let paymentReminders = $state(true);
	let overdueAlerts = $state(true);
	let newApplications = $state(true);
	let systemUpdates = $state(false);
</script>

<div class="flex flex-col gap-6 pb-24">
	<!-- System Notifications -->
	<Card.Root>
		<Card.Header>
			<div class="flex items-center gap-2">
				<BellIcon class="h-5 w-5 text-primary" />
				<Card.Title>Notifications</Card.Title>
			</div>
			<Card.Description>Manage system and update notifications</Card.Description>
		</Card.Header>
	</Card.Root>

	<p class="text-sm text-muted-foreground">Note: Notification settings are coming soon.</p>
</div>
