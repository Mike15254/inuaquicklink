<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	import InfoIcon from '@lucide/svelte/icons/info';
</script>

<div class="flex flex-col gap-6 pb-24">
	<!-- System Info -->
	<Card.Root>
		<Card.Header>
			<div class="flex items-center gap-2">
				<InfoIcon class="h-5 w-5 text-primary" />
				<Card.Title>System Information</Card.Title>
			</div>
			<Card.Description>Current system status and version information</Card.Description>
		</Card.Header>
		<Card.Content>
			<dl class="grid gap-4 sm:grid-cols-3">
				<div class="space-y-1">
					<dt class="text-sm font-medium text-muted-foreground">Version</dt>
					<dd class="text-sm">2.0.11</dd>
				</div>
				<div class="space-y-1">
					<dt class="text-sm font-medium text-muted-foreground">Last Updated</dt>
					<dd class="text-sm">Today</dd>
				</div>
				<div class="space-y-1">
					<dt class="text-sm font-medium text-muted-foreground">Status</dt>
					<dd class="flex items-center gap-2 text-sm">
						<span class="h-2 w-2 rounded-full bg-green-500"></span>
						All systems operational
					</dd>
				</div>
			</dl>
		</Card.Content>
	</Card.Root>
</div>
