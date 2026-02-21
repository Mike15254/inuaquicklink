<script lang="ts">
	import { goto } from '$app/navigation';
	import favicon from '$lib/assets/favicon.png';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { clearSession, session } from '$lib/store/session.svelte';
	import { ModeWatcher, toggleMode } from 'mode-watcher';
	import { pb } from '$lib/infra/db/pb';

	import NotificationIcon from '@lucide/svelte/icons/bell-ring';
	import OrginizationIcon from '@lucide/svelte/icons/building-2';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import Settings2Icon from '@lucide/svelte/icons/settings';
	import SunIcon from '@lucide/svelte/icons/sun';
	import UserIcon from '@lucide/svelte/icons/user';
	import type { LayoutData } from './$types';

	interface Props {
		children?: import('svelte').Snippet;
		data: LayoutData;
	}
	let { children, data }: Props = $props();
	let searchInputValue = $state('');

	import NavBottom from '$lib/components/nav-bottom.svelte';
	import ScrollingLoader from '$lib/components/ScrollingLoader.svelte';
	import { Input } from '$lib/components/ui/input';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { Toaster, toast } from 'svelte-sonner';

	// Check authentication on client side
	$effect(() => {
		if (!session.isLoading && !session.isAuthenticated) {
			goto('/auth');
		}
	});

	function handleLogout() {
		clearSession();
		goto('/auth');
	}

	function handleSearchSubmit() {
		searchInputValue = '';
		toast.info('Coming Soon!');
	}
	function handleClearSearch() {
		searchInputValue = '';
		toast.success('cleared');
	}

	// Mobile navigation handlers
	function handleOrganizationClick() {
		goto('/dashboard/org');
	}

	function handleSettingsClick() {
		goto('/dashboard/settings');
	}

	function handleProfileEdit() {
		goto('/dashboard/profile');
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<ModeWatcher />

{#if session.isLoading}
	<!-- Loading state while session is being restored -->
	<div class="flex h-screen items-center justify-center bg-background">
		<ScrollingLoader />
	</div>
{:else if session.isAuthenticated}
	<Sidebar.Provider>
		<AppSidebar />

		<Sidebar.Inset class="flex h-screen flex-col">
			<div class="scrollbar-thin mt-0 flex min-h-0 flex-1 flex-col">
				<header
					class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
				>
					<div class="flex w-full items-center justify-between">
						<div class="hidden items-center gap-2 px-4 md:flex">
							<Sidebar.Trigger class="" />
							<div></div>
						</div>

						<!-- Mobile User Avatar with Dropdown -->
						<div class="block px-4 md:hidden">
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									<Button variant="ghost" size="sm" class="h-auto p-0">
										<Avatar.Root class="size-9 rounded-lg">
											<Avatar.Image
												src={session.user?.avatar
													? `${pb.baseUrl}/api/files/users/${session.user.id}/${session.user.avatar}`
													: '/avatars/default.png'}
												alt="{session.user?.name || 'User'} profile"
											/>
											<Avatar.Fallback class="rounded-lg"
												>{session.user?.name?.charAt(0)?.toUpperCase() || 'U'}</Avatar.Fallback
											>
										</Avatar.Root>
									</Button>
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="start" side="bottom" class="w-56">
									<DropdownMenu.Label class="font-normal">
										<div class="flex flex-col space-y-1">
											<p class="text-sm leading-none font-medium">{session.user?.name || 'User'}</p>
											<p class="text-xs leading-none text-muted-foreground">
												{session.user?.email || 'user@example.com'}
											</p>
										</div>
									</DropdownMenu.Label>
									<DropdownMenu.Separator />
									<DropdownMenu.Group>
										<DropdownMenu.Item onclick={handleProfileEdit}>
											<UserIcon class="mr-2 h-4 w-4" />
											Edit Profile
										</DropdownMenu.Item>
										<DropdownMenu.Item onclick={toggleMode}>
											<SunIcon
												class="mr-2 h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90"
											/>
											<MoonIcon
												class="absolute ml-2 h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
											/>
											Toggle Theme
										</DropdownMenu.Item>
										<DropdownMenu.Item onclick={handleOrganizationClick}>
											<OrginizationIcon class="mr-2 h-4 w-4" />
											Organization
										</DropdownMenu.Item>
										<DropdownMenu.Item onclick={handleSettingsClick}>
											<Settings2Icon class="mr-2 h-4 w-4" />
											Settings
										</DropdownMenu.Item>
									</DropdownMenu.Group>
									<DropdownMenu.Separator />
									<DropdownMenu.Item onclick={handleLogout}>
										<LogOutIcon class="mr-2 h-4 w-4" />
										Log out
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</div>
						<div class="flex">
							<div class="relative hidden w-full flex-1 md:block">
								<SearchIcon
									class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
								/>
								<Input
									class="pr-20 pl-10"
									placeholder={'Search...'}
									bind:value={searchInputValue}
									onkeydown={(e) => {
										if (e.key === 'Enter') {
											handleSearchSubmit();
										}
									}}
								/>
								<!-- Search and Clear Buttons -->
								{#if searchInputValue.trim()}
									<div class="absolute top-1/2 right-2 flex -translate-y-1/2 gap-1">
										<Button
											size="sm"
											variant="default"
											class="p-2"
											onclick={handleSearchSubmit}
											title="Search"
										>
											Search
										</Button>
										<Button
											size="sm"
											variant="ghost"
											class="p-2"
											onclick={handleClearSearch}
											title="Clear search"
										>
											Clear
										</Button>
									</div>
								{/if}
							</div>
							<div class="flex justify-end px-2 md:px-4">
								<Button variant="outline">
									<NotificationIcon />
								</Button>
							</div>
						</div>
					</div>
				</header>
				<div class="flex flex-1 flex-col overflow-auto bg-background">
					<div class=" h-screen px-4 md:px-4">
						{@render children?.()}
					</div>
					<!-- <div class="z-40 flex-none bg-background px-4 py-2">
						<div class="mb-2 flex w-full flex-row items-center justify-between">
							<div class="flex items-center gap-2 text-xs text-muted-foreground">

								<span class="text-xs">© 2026 ® Inua Quick Link. All rights reserved.</span>
							</div>

							<div class="flex items-center gap-2 text-xs text-muted-foreground">
								<a href="/updates" aria-label="Updates and Release Notes"
									><svg
										xmlns="http://www.w3.org/2000/svg"
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="icon icon-tabler icons-tabler-outline icon-tabler-progress-check text-primary"
										><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
											d="M10 20.777a8.942 8.942 0 0 1 -2.48 -.969"
										/><path d="M14 3.223a9.003 9.003 0 0 1 0 17.554" /><path
											d="M4.579 17.093a8.961 8.961 0 0 1 -1.227 -2.592"
										/><path d="M3.124 10.5c.16 -.95 .468 -1.85 .9 -2.675l.169 -.305" /><path
											d="M6.907 4.579a8.954 8.954 0 0 1 3.093 -1.356"
										/><path d="M9 12l2 2l4 -4" /></svg
									></a
								>
								<span>Version 2.0.11</span>
							</div>
						</div>
					</div> -->
				</div>
			</div>
			<NavBottom />
			<!-- <NavigationLoading /> -->
		</Sidebar.Inset>
	</Sidebar.Provider>
{/if}
<Toaster expand={true} position="top-center" theme="system" />

<style>
	/* Prevent overscroll bounce effect */
	:global(html, body) {
		overscroll-behavior: none;
		height: 100%;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		position: fixed;
		width: 100%;
		overflow: hidden;
	}
</style>
