<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import type { AnalyticsData, TimePeriod, Transaction } from '$lib/core/analytics';
	import { exportPLStatementToCSV, getPLStatement } from '$lib/core/analytics';
	import { formatKES, formatKESCompact } from '$lib/shared/currency';
	import { formatDate } from '$lib/shared/date_time';
	import { session, sessionHasPermission } from '$lib/store/session.svelte';
	import { scaleUtc, scaleBand } from 'd3-scale';
	import { curveMonotoneX } from 'd3-shape';
	import { Permission } from '$lib/services/roles/permissions';
	import LinkIcon from '@lucide/svelte/icons/link';

	import {
		Area,
		AreaChart,
		ChartClipPath,
		PieChart,
		Chart,
		Svg,
		Axis,
		Highlight,
		Points,
		LinearGradient
	} from 'layerchart';
	import ChartContainer from '$lib/components/ui/chart/chart-container.svelte';
	import ChartTooltip from '$lib/components/ui/chart/chart-tooltip.svelte';
	import type { ChartConfig } from '$lib/components/ui/chart/chart-utils.js';
	import { cubicInOut } from 'svelte/easing';
	import type { PageData } from './$types';

	// Icons
	import ActivityIcon from '@lucide/svelte/icons/activity';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import BanknoteIcon from '@lucide/svelte/icons/banknote';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import UsersIcon from '@lucide/svelte/icons/users';
	import WalletIcon from '@lucide/svelte/icons/wallet';
	import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// State
	let isDownloading = $state(false);

	// Derived from data
	let selectedPeriod = $derived<TimePeriod>(data.period || 'month');
	let analytics = $derived<AnalyticsData | null>(data.analytics);
	let businessCode = 'dashboard';
	let orgName = $derived(session.organization?.name || 'Dashboard');

	// Chart configs
	const cashFlowChartConfig: ChartConfig = {
		collected: { label: 'Money In', color: 'var(--chart-2)' },
		disbursed: { label: 'Money Out', color: 'var(--chart-1)' }
	};

	const pieChartConfig: ChartConfig = {
		pending: { label: 'Pending', color: 'var(--chart-4)' },
		approved: { label: 'Approved', color: 'var(--chart-3)' },
		disbursed: { label: 'Active', color: 'var(--chart-1)' },
		partially_paid: { label: 'Partial', color: 'var(--chart-5)' },
		repaid: { label: 'Repaid', color: 'var(--chart-2)' },
		defaulted: { label: 'Defaulted', color: 'var(--destructive)' },
		rejected: { label: 'Rejected', color: 'var(--muted-foreground)' }
	};

	const profitChartConfig: ChartConfig = {
		profit: { label: 'Net Profit', color: 'var(--chart-3)' }
	};

	// Period options
	const periodOptions = [
		{ value: 'today', label: 'Today' },
		{ value: 'week', label: 'Last 7 Days' },
		{ value: 'month', label: 'Last 30 Days' }
	];

	// Handle period change
	function handlePeriodChange(value: string | undefined) {
		if (value) {
			goto(`/${businessCode}?period=${value}`);
		}
	}

	// Navigate functions
	function goToLoans() {
		goto(`/${businessCode}/loans`);
	}

	function goToCustomers() {
		goto(`/${businessCode}/customers`);
	}

	function goToActivity() {
		goto(`/${businessCode}/activity`);
	}

	// Format helpers
	function formatPercentage(value: number): string {
		return `${value.toFixed(1)}%`;
	}

	function getPeriodLabel(period: TimePeriod): string {
		const labels: Record<TimePeriod, string> = {
			today: 'Today',
			week: 'This Week',
			month: 'This Month',
			custom: 'Custom Period'
		};
		return labels[period];
	}

	// Transaction type badge variant
	function getTransactionBadge(type: Transaction['type']): { variant: any; label: string } {
		const badges = {
			payment: { variant: 'default', label: 'Payment' },
			disbursement: { variant: 'destructive', label: 'Disbursed' },
			penalty: { variant: 'outline', label: 'Penalty' },
			fee: { variant: 'secondary', label: 'Fee' },
			interest: { variant: 'secondary', label: 'Interest' }
		};
		return badges[type] || { variant: 'outline', label: type };
	}

	// Cash Flow Chart Data
	let cashFlowData = $derived(
		analytics?.dailyBreakdown.map((d) => ({
			date: new Date(d.date),
			collected: d.collected,
			disbursed: d.disbursed
		})) || []
	);

	// Profit Trend Chart Data (Full Width)
	let profitChartData = $derived(
		analytics?.trends.profitTrend.map((d) => ({
			label: d.label,
			date: new Date(d.label),
			value: d.value
		})) || []
	);

	// Pie Chart Data & Config
	let activeStatus = $state<string>('');

	let pieData = $derived(
		analytics?.loanStatusDistribution
			.map((item) => ({
				status: item.status,
				count: item.count,
				color: getStatusColor(item.status)
			}))
			.sort((a, b) => b.count - a.count) || []
	);

	let activeIndex = $derived(
		activeStatus ? pieData.findIndex((d) => d.status === activeStatus) : 0
	);

	// Update active status when data loads
	$effect(() => {
		if (pieData.length > 0 && !activeStatus) {
			activeStatus = pieData[0].status;
		}
	});

	// CSV Download
	async function downloadPL() {
		if (!analytics) return;
		isDownloading = true;
		try {
			const plStatement = await getPLStatement(selectedPeriod);
			const csv = exportPLStatementToCSV(plStatement);
			const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
			const link = document.createElement('a');
			const url = URL.createObjectURL(blob);
			link.setAttribute('href', url);
			link.setAttribute('download', `P&L_Statement_${selectedPeriod}.csv`);
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		} finally {
			isDownloading = false;
		}
	}

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			pending: 'var(--chart-4)',
			approved: 'var(--chart-3)',
			disbursed: 'var(--chart-1)',
			partially_paid: 'var(--chart-5)',
			repaid: 'var(--chart-2)',
			defaulted: 'var(--destructive)',
			rejected: 'var(--muted-foreground)'
		};
		return colors[status] || 'var(--muted-foreground)';
	}

	function getStatusLabel(status: string): string {
		const labels: Record<string, string> = {
			pending: 'Pending',
			approved: 'Approved',
			disbursed: 'Active',
			partially_paid: 'Partial',
			repaid: 'Repaid',
			defaulted: 'Defaulted',
			rejected: 'Rejected'
		};
		return labels[status] || status;
	}
	let canCreateLoan = $derived(sessionHasPermission(Permission.LOANS_CREATE));
</script>

<svelte:head>
	<title>Dashboard | {orgName}</title>
	<meta name="description" content="Business analytics dashboard" />
</svelte:head>

<div class="flex flex-col gap-6 py-4 pb-24">
	<!-- Page Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex flex-col gap-1">
			<p class="text-md text-muted-foreground">
				Financial overview for {getPeriodLabel(selectedPeriod).toLowerCase()}
			</p>
		</div>

		<div class="flex flex-row gap-2">
			{#if canCreateLoan}
				<Button onclick={() => goto(`/${businessCode}/loans?action=generate-link`)}>
					<LinkIcon class="h-4 w-4" />
					
				</Button>
			{/if}
			<Select.Root type="single" value={selectedPeriod} onValueChange={handlePeriodChange}>
				<Select.Trigger class="w-40">
					<CalendarIcon class="mr-2 h-4 w-4" />
					{periodOptions.find((p) => p.value === selectedPeriod)?.label || 'Select Period'}
				</Select.Trigger>
				<Select.Content>
					{#each periodOptions as option}
						<Select.Item value={option.value}>{option.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	</div>

	{#if data.isLoading || !analytics}
		<!-- Loading State -->
		<div class="grid gap-4">
			<Skeleton class="h-96 w-full" />
		</div>
	{:else}
		<!-- Two Column Layout -->
		<div class="md:grid lg:grid gap-4 lg:grid-cols-3">
			<!-- Left Column (2/3) -->
			<div class="space-y-6 lg:col-span-2">
				<!-- Top 3 Cards -->
				<div class="grid gap-4 md:grid-cols-3 grid-cols-2">
					<!-- Total Disbursed -->
					<Card.Root>
						<Card.Header class="flex flex-row items-center justify-between">
							<Card.Description class="text-xs font-medium">Total Disbursed</Card.Description>
							<BanknoteIcon class="h-4 w-4 text-chart-1" />
						</Card.Header>
						<Card.Content>
							<div class="text-2xl font-bold">
								{formatKESCompact(analytics.summary.totalDisbursed)}
							</div>
							<p class="text-xs text-muted-foreground">
								{analytics.summary.activeLoansCount} active loans
							</p>
						</Card.Content>
					</Card.Root>

					<!-- Total Collected -->
					<Card.Root>
						<Card.Header class="flex flex-row items-center justify-between">
							<Card.Description class="text-xs font-medium">Total Collected</Card.Description>
							<WalletIcon class="h-4 w-4 text-chart-2" />
						</Card.Header>
						<Card.Content>
							<div class="text-2xl font-bold text-green-600">
								{formatKESCompact(analytics.summary.totalCollected)}
							</div>
							<p class="text-xs text-muted-foreground">
								{analytics.summary.repaidLoansCount} loans repaid
							</p>
						</Card.Content>
					</Card.Root>

					<!-- Outstanding -->
					<Card.Root>
						<Card.Header class="flex flex-row items-center justify-between">
							<Card.Description class="text-xs font-medium">Outstanding</Card.Description>
							<AlertCircleIcon class="h-4 w-4 text-orange-500" />
						</Card.Header>
						<Card.Content>
							<div class="text-2xl font-bold text-orange-600">
								{formatKESCompact(analytics.summary.totalOutstanding)}
							</div>
							<p class="text-xs text-muted-foreground">
								{analytics.summary.overdueLoansCount} overdue
							</p>
						</Card.Content>
					</Card.Root>
				</div>

				<!-- Cash Flow Chart -->
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<TrendingUpIcon class="h-5 w-5" />
							Money In vs Money Out
						</Card.Title>
					</Card.Header>
					<Card.Content>
						{#if cashFlowData.length > 0}
							<ChartContainer config={cashFlowChartConfig} class="h-70 w-full">
								<AreaChart
									data={cashFlowData}
									x="date"
									xScale={scaleUtc()}
									yPadding={[0, 25]}
									axis="x"
									series={[
										{
											key: 'collected',
											label: 'Money In',
											color: cashFlowChartConfig.collected.color
										},
										{
											key: 'disbursed',
											label: 'Money Out',
											color: cashFlowChartConfig.disbursed.color
										}
									]}
									seriesLayout="stack"
									props={{
										area: {
											curve: curveMonotoneX,
											'fill-opacity': 0.4,
											line: { class: 'stroke-1' },
											motion: 'tween'
										},
										xAxis: {
											format: (v) =>
												new Date(v).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })
										},
										yAxis: { format: (v) => formatKESCompact(v) }
									}}
								>
									{#snippet tooltip()}
										<ChartTooltip
											labelFormatter={(v) => {
												return new Date(v).toLocaleDateString('en-KE', {
													month: 'long',
													day: 'numeric'
												});
											}}
											indicator="dot"
										/>
									{/snippet}
									{#snippet marks({ series, getAreaProps })}
										{#each series as s, i (s.key)}
											<LinearGradient
												stops={[
													s.color ?? '',
													'color-mix(in lch, ' + s.color + ' 10%, transparent)'
												]}
												vertical
											>
												{#snippet children({ gradient })}
													<Area {...getAreaProps(s, i)} fill={gradient} />
												{/snippet}
											</LinearGradient>
										{/each}
									{/snippet}
								</AreaChart>
							</ChartContainer>
						{:else}
							<div class="flex h-80 items-center justify-center text-muted-foreground">
								No data available
							</div>
						{/if}
					</Card.Content>
				</Card.Root>

				<!-- Transaction History Table -->
				<div>
					<h1 class="text-lg py-2 font-bold">Recent Transactions</h1>

				
						{#if analytics.recentTransactions.length > 0}
							<div class="rounded-md border">
								<Table.Root>
									<Table.Header>
										<Table.Row>
											<Table.Head>Customer</Table.Head>
											<Table.Head class="hidden md:table-cell">Date</Table.Head>
											<Table.Head class="">Amount</Table.Head>
											<Table.Head class="">Recorder By</Table.Head>

											<Table.Head class="">Type</Table.Head>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{#each analytics.recentTransactions as transaction}
											{@const badge = getTransactionBadge(transaction.type)}
											<Table.Row>
												<Table.Cell class="">
													<div class="flex flex-col text-xs">
														<div class="flex items-center gap-2">
															<!-- <img
																src={transaction.customerPhotoUrl}
																alt=""
																class="h-6 w-6 rounded-full"
															/> -->
															<span>{transaction.customerName}</span>
														</div>

														<span class="font-mono text-xs text-muted-foreground md:hidden">
															{formatDate(transaction.date)}
														</span>
													</div>
												</Table.Cell>
												<Table.Cell class="hidden font-mono text-xs md:table-cell">
													{formatDate(transaction.date)}
												</Table.Cell>
												<Table.Cell class="text-right text-xs">
													<div class="flex gap-1">
														{#if transaction.type === 'payment'}
															<ArrowDownIcon class="h-3 w-3 text-green-600" />
														{:else}
															<ArrowUpIcon class="h-3 w-3 text-red-600" />
														{/if}
														<span
															class={transaction.type === 'payment'
																? 'text-green-600'
																: 'text-red-600'}
														>
															{formatKES(transaction.amount)}
														</span>
													</div>
												</Table.Cell>
												<Table.Cell class="text-xs">
													{transaction.recorderName}
												</Table.Cell>

												<Table.Cell class="text-xs">
													<Badge variant={badge.variant}>{badge.label}</Badge>
												</Table.Cell>
											</Table.Row>
										{/each}
									</Table.Body>
								</Table.Root>
							</div>
						{:else}
							<div class="flex h-40 items-center justify-center text-muted-foreground">
								No transactions in this period
							</div>
						{/if}
				</div>

			</div>

			<!-- Right Column (1/3) -->
			<div class="space-y-4">
				<!-- Loan Status Distribution Chart -->
				<Card.Root class="flex flex-col">
					<Card.Header class="items-center pb-0">
						<Card.Title>Loan Status</Card.Title>
						<Card.Description>Distribution by count</Card.Description>
					</Card.Header>
					<Card.Content class="flex-1 pb-0">
						<div class="mx-auto">
							{#if pieData.length > 0}
								<ChartContainer config={pieChartConfig}>
									<PieChart
										data={pieData}
										key="status"
										value="count"
										label={(d) => getStatusLabel(d.status)}
										cRange={pieData.map((d) => d.color)}
										props={{
											pie: {
												motion: 'tween'
											}
										}}
									>
										{#snippet tooltip()}
											<ChartTooltip hideLabel labelFormatter={(v) => getStatusLabel(v)} />
										{/snippet}
									</PieChart>
								</ChartContainer>
							{:else}
								<div class="flex h-48 items-center justify-center text-sm text-muted-foreground">
									No data available
								</div>
							{/if}
						</div>
					</Card.Content>
					<Card.Footer class="flex-col gap-2 pt-4 text-sm">
						<div class="flex items-center gap-2 leading-none font-medium">
							Total Loans: {analytics?.summary.activeLoansCount +
								analytics?.summary.repaidLoansCount +
								analytics?.summary.overdueLoansCount}
							<TrendingUpIcon class="h-4 w-4" />
						</div>
						<div class="leading-none text-muted-foreground">Showing total loan distribution</div>
					</Card.Footer>
				</Card.Root>
				<!-- P&L Summary with CSV Download -->
				<Card.Root>
					<Card.Header class="flex flex-row items-center justify-between">
						<div class="space-y-1.5">
							<Card.Title>P&L Summary</Card.Title>
							<Card.Description>Profit and loss</Card.Description>
						</div>
						<Button variant="outline" size="icon" onclick={downloadPL} disabled={isDownloading}>
							<DownloadIcon class="h-4 w-4" />
						</Button>
					</Card.Header>
					<Card.Content>
						<div class="space-y-4">
							<div class="space-y-2">
								<h4 class="text-sm font-medium text-green-600">Revenue</h4>
								<div class="space-y-1">
									<div class="flex justify-between text-sm">
										<span class="text-muted-foreground">Interest</span>
										<span class="font-medium"
											>{formatKES(analytics.profitability.interestIncome)}</span
										>
									</div>
									<div class="flex justify-between text-sm">
										<span class="text-muted-foreground">Fees</span>
										<span class="font-medium">{formatKES(analytics.profitability.feeIncome)}</span>
									</div>
									<div class="flex justify-between text-sm">
										<span class="text-muted-foreground">Penalties</span>
										<span class="font-medium"
											>{formatKES(analytics.profitability.penaltyIncome)}</span
										>
									</div>
									<div class="flex justify-between border-t pt-1 text-sm font-semibold">
										<span>Total</span>
										<span class="text-green-600"
											>{formatKES(analytics.profitability.grossRevenue)}</span
										>
									</div>
								</div>
							</div>

							<div class="space-y-2">
								<h4 class="text-sm font-medium text-red-600">Outflows</h4>
								<div class="flex justify-between text-sm">
									<span class="text-muted-foreground">Disbursed</span>
									<span class="font-medium"
										>{formatKES(analytics.profitability.totalDisbursed)}</span
									>
								</div>
							</div>

							<div class="border-t pt-2">
								<div class="flex justify-between text-base font-bold">
									<span>Net Income</span>
									<span
										class={analytics.profitability.netIncome >= 0
											? 'text-green-600'
											: 'text-red-600'}
									>
										{formatKES(analytics.profitability.netIncome)}
									</span>
								</div>
								<div class="flex justify-between text-sm text-muted-foreground">
									<span>Margin</span>
									<span>{formatPercentage(analytics.profitability.profitMargin)}</span>
								</div>
							</div>
						</div>
					</Card.Content>
				</Card.Root>

				<!-- Additional Metrics -->
				<Card.Root>
					<Card.Header class="pb-2">
						<Card.Description class="text-xs">Interest Earned</Card.Description>
					</Card.Header>
					<Card.Content>
						<div class="text-xl font-bold">{formatKES(analytics.summary.totalInterestEarned)}</div>
					</Card.Content>
				</Card.Root>
				<div class="grid w-full grid-cols-2 gap-2">
					<Card.Root>
						<Card.Header class="pb-2">
							<Card.Description class="text-xs">Processing Fees</Card.Description>
						</Card.Header>
						<Card.Content>
							<div class="text-xl font-bold">{formatKES(analytics.summary.totalFeesCollected)}</div>
						</Card.Content>
					</Card.Root>

					<Card.Root>
						<Card.Header class="pb-2">
							<Card.Description class="text-xs">Collection Rate</Card.Description>
						</Card.Header>
						<Card.Content>
							<div class="text-xl font-bold">
								{formatPercentage(analytics.summary.collectionRate)}
							</div>
						</Card.Content>
					</Card.Root>
				</div>
			</div>
		</div>

		<!-- Full Width Bottom Section -->
		<div class="space-y-6">
			<!-- Profit Trend Chart -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<TrendingUpIcon class="h-5 w-5" />
						Profit Trend
					</Card.Title>
					<Card.Description>Net profit over time (collections - disbursements)</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if profitChartData.length > 0}
						<ChartContainer config={profitChartConfig} class="h-70 w-full">
							<Chart
								data={profitChartData}
								x="label"
								xScale={scaleBand().padding(0.1)}
								y="value"
								yNice
								padding={{ left: 48, bottom: 36, right: 16, top: 16 }}
								tooltip={{ mode: 'band' }}
							>
								<Svg>
									<Axis placement="left" grid format={(v) => formatKESCompact(v)} />
									<Axis placement="bottom" />
									<Area line={{ class: 'stroke-chart-3 stroke-2' }} class="fill-chart-3/20" />
									<Points class="fill-chart-3 stroke-background" />
									<Highlight points lines />
								</Svg>
								<ChartTooltip labelFormatter={(value) => `${value}`} indicator="line" />
							</Chart>
						</ChartContainer>
					{:else}
						<div class="flex h-70 items-center justify-center text-muted-foreground">
							No data available
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Quick Actions -->
			<div class="grid gap-4 md:grid-cols-3">
				<Card.Root class="cursor-pointer transition-colors hover:bg-muted/50" onclick={goToLoans}>
					<Card.Header class="flex flex-row items-center gap-4">
						<div class="rounded-lg bg-chart-1/10 p-3">
							<BanknoteIcon class="h-6 w-6 text-chart-1" />
						</div>
						<div class="flex-1">
							<Card.Title class="text-base">Manage Loans</Card.Title>
							<Card.Description>View and manage all loans</Card.Description>
						</div>
						<ArrowRightIcon class="h-5 w-5 text-muted-foreground" />
					</Card.Header>
				</Card.Root>

				<Card.Root
					class="cursor-pointer transition-colors hover:bg-muted/50"
					onclick={goToCustomers}
				>
					<Card.Header class="flex flex-row items-center gap-4">
						<div class="rounded-lg bg-chart-2/10 p-3">
							<UsersIcon class="h-6 w-6 text-chart-2" />
						</div>
						<div class="flex-1">
							<Card.Title class="text-base">Customers</Card.Title>
							<Card.Description>View customer portfolio</Card.Description>
						</div>
						<ArrowRightIcon class="h-5 w-5 text-muted-foreground" />
					</Card.Header>
				</Card.Root>

				<Card.Root
					class="cursor-pointer transition-colors hover:bg-muted/50"
					onclick={goToActivity}
				>
					<Card.Header class="flex flex-row items-center gap-4">
						<div class="rounded-lg bg-chart-3/10 p-3">
							<ActivityIcon class="h-6 w-6 text-chart-3" />
						</div>
						<div class="flex-1">
							<Card.Title class="text-base">Activity Log</Card.Title>
							<Card.Description>View recent activities</Card.Description>
						</div>
						<ArrowRightIcon class="h-5 w-5 text-muted-foreground" />
					</Card.Header>
				</Card.Root>
			</div>
		</div>
	{/if}
</div>
