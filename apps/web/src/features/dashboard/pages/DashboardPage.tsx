import { BarChart3, Users, Target, Ticket, CheckSquare } from 'lucide-react'
import { PageHeader } from '@/components/layout/Breadcrumb'
import { KpiCard } from '../components/KpiCard'
import { RevenueChart } from '../components/RevenueChart'
import { PipelineChart } from '../components/PipelineChart'
import { TopPerformersTable, RecentActivityFeed } from '../components/ActivityWidgets'
import { useDashboardSummary } from '../hooks/useDashboard'
import { LoadingState } from '@/components/ui/States'
import { formatCurrency } from '@/lib/formatters'
import { useAuth } from '@/context/AuthContext'

export function DashboardPage() {
  const { user } = useAuth()
  const { data: summary, isLoading } = useDashboardSummary()

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={`Welcome back, ${user?.firstName ?? 'there'} 👋`}
        subtitle={summary?.period ? `Showing data for ${summary.period}` : 'Loading…'}
      />

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <KpiCard
              title="Revenue"
              value={formatCurrency(summary?.revenue?.current ?? 0)}
              change={summary?.revenue?.changePercent}
              icon={<BarChart3 className="h-5 w-5" />}
            />
            <KpiCard
              title="Active Leads"
              value={summary?.leads?.open ?? 0}
              subtitle={`${summary?.leads?.wonThisMonth ?? 0} won this month`}
              icon={<Target className="h-5 w-5" />}
            />
            <KpiCard
              title="Open Tickets"
              value={summary?.tickets?.open ?? 0}
              subtitle={`${summary?.tickets?.slaBreached ?? 0} SLA breaches`}
              accent={summary?.tickets?.slaBreached > 0 ? 'danger' : 'default'}
              icon={<Ticket className="h-5 w-5" />}
            />
            <KpiCard
              title="My Tasks"
              value={summary?.tasks?.myOpen ?? 0}
              subtitle={`${summary?.tasks?.myOverdue ?? 0} overdue`}
              accent={summary?.tasks?.myOverdue > 0 ? 'warning' : 'default'}
              icon={<CheckSquare className="h-5 w-5" />}
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <RevenueChart />
            </div>
            <PipelineChart />
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <TopPerformersTable />
            <RecentActivityFeed />
          </div>
        </>
      )}
    </div>
  )
}
