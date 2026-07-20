import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { PageHeader } from '@/components/layout/Breadcrumb'
import { LoadingState } from '@/components/ui/States'
import { formatCurrency, formatDate } from '@/lib/formatters'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts'

// ── Data hooks ────────────────────────────────────────────────

function useSalesReport(from: string, to: string) {
  return useQuery({
    queryKey: ['reports', 'sales', from, to],
    queryFn:  () => api.get('/dashboard/sales-trend').then(r => r.data.data),
    staleTime: 300_000,
  })
}

function useCustomerReport() {
  return useQuery({
    queryKey: ['reports', 'customers'],
    queryFn:  () => api.get('/customers?limit=100').then(r => r.data),
    staleTime: 120_000,
  })
}

function useTicketReport() {
  return useQuery({
    queryKey: ['reports', 'tickets'],
    queryFn:  () => api.get('/tickets?limit=100').then(r => r.data),
    staleTime: 120_000,
  })
}

function useEmployeePerformance() {
  return useQuery({
    queryKey: ['reports', 'employee-performance'],
    queryFn:  () => api.get('/employees/performance').then(r => r.data.data),
    staleTime: 300_000,
  })
}

// ── Colour helpers ────────────────────────────────────────────

const CHART_COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2']

// ── Sub-reports ───────────────────────────────────────────────

function SalesReport() {
  const { data, isLoading } = useSalesReport('', '')
  if (isLoading) return <LoadingState />

  const totalRevenue  = (data ?? []).reduce((s: number, d: Record<string,unknown>) => s + Number(d.revenue), 0)
  const totalDeals    = (data ?? []).reduce((s: number, d: Record<string,unknown>) => s + Number(d.deals), 0)
  const bestMonth     = [...(data ?? [])].sort((a: Record<string,unknown>, b: Record<string,unknown>) => Number(b.revenue) - Number(a.revenue))[0]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Total Revenue (12 months)" value={formatCurrency(totalRevenue)} />
        <Stat label="Total Deals Closed"        value={String(totalDeals)} />
        <Stat label="Best Month"                value={bestMonth?.month as string ?? '—'} />
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        <h3 className="mb-4 text-sm font-semibold text-text-primary">Monthly Revenue Trend</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false}
              tickFormatter={(v: string) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => `$${(v/1000).toFixed(0)}k`} width={48} />
            <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']}
              contentStyle={{ background: 'rgb(var(--color-surface))', border: '1px solid rgb(var(--color-border))', borderRadius: '6px', fontSize: '12px' }} />
            <Bar dataKey="revenue" fill="#2563EB" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        <h3 className="mb-4 text-sm font-semibold text-text-primary">Deals Closed per Month</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false}
              tickFormatter={(v: string) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: 'rgb(var(--color-surface))', border: '1px solid rgb(var(--color-border))', borderRadius: '6px', fontSize: '12px' }} />
            <Line type="monotone" dataKey="deals" stroke="#16A34A" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function CustomersReport() {
  const { data, isLoading } = useCustomerReport()
  if (isLoading) return <LoadingState />

  const customers = data?.data ?? []
  const byStatus  = customers.reduce((acc: Record<string, number>, c: Record<string,unknown>) => {
    const s = c.status as string
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})
  const byType = customers.reduce((acc: Record<string, number>, c: Record<string,unknown>) => {
    const t = c.customerType as string
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {})

  const statusData = Object.entries(byStatus).map(([name, value]) => ({ name, value }))
  const typeData   = Object.entries(byType).map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Total Customers" value={String(data?.meta?.total ?? customers.length)} />
        <Stat label="Active"          value={String(byStatus['ACTIVE'] ?? 0)} />
        <Stat label="Prospects"       value={String(byStatus['PROSPECT'] ?? 0)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">By Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {statusData.map((_e, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">By Type</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {typeData.map((_e, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border bg-surface-2 text-left text-xs font-medium text-text-secondary">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.slice(0, 20).map((c: Record<string,unknown>) => (
                <tr key={c.id as string} className="hover:bg-surface-2">
                  <td className="px-4 py-3 text-text-primary">{[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}</td>
                  <td className="px-4 py-3 text-text-secondary">{(c.companyName as string) ?? '—'}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">{c.status as string}</span></td>
                  <td className="px-4 py-3 text-text-secondary">{c.customerType as string}</td>
                  <td className="px-4 py-3 text-text-secondary">{formatDate(c.createdAt as string)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function TicketsReport() {
  const { data, isLoading } = useTicketReport()
  if (isLoading) return <LoadingState />

  const tickets   = data?.data ?? []
  const byStatus  = tickets.reduce((acc: Record<string,number>, t: Record<string,unknown>) => { const s = t.status as string; acc[s] = (acc[s]??0)+1; return acc }, {})
  const byPriority= tickets.reduce((acc: Record<string,number>, t: Record<string,unknown>) => { const p = t.priority as string; acc[p] = (acc[p]??0)+1; return acc }, {})
  const breached  = tickets.filter((t: Record<string,unknown>) => t.slaBreached).length

  const statusData   = Object.entries(byStatus).map(([name, value]) => ({ name, value }))
  const priorityData = Object.entries(byPriority).map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total Tickets"   value={String(tickets.length)} />
        <Stat label="Open"            value={String(byStatus['OPEN'] ?? 0)} />
        <Stat label="Resolved"        value={String(byStatus['RESOLVED'] ?? 0)} />
        <Stat label="SLA Breaches"    value={String(breached)} accent={breached > 0 ? 'danger' : 'default'} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">By Status</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={statusData} layout="vertical" margin={{ left: 60 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563EB" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">By Priority</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={priorityData} layout="vertical" margin={{ left: 60 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#D97706" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function EmployeeReport() {
  const { data, isLoading } = useEmployeePerformance()
  if (isLoading) return <LoadingState />
  const perf = data ?? []

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-border bg-surface-2 text-left text-xs font-medium text-text-secondary">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Leads Created</th>
                <th className="px-4 py-3">Leads Won</th>
                <th className="px-4 py-3">Conversion</th>
                <th className="px-4 py-3">Revenue Generated</th>
                <th className="px-4 py-3">Tickets Resolved</th>
                <th className="px-4 py-3">Tasks Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {perf.map((p: Record<string,unknown>, i: number) => {
                const emp = p.employee as Record<string,string> | null
                const cr  = p.conversionRate as number
                return (
                  <tr key={i} className="hover:bg-surface-2">
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-center">{p.leadsCreated as number}</td>
                    <td className="px-4 py-3 text-text-secondary text-center">{p.leadsWon as number}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${cr >= 25 ? 'text-success' : cr >= 10 ? 'text-warning' : 'text-danger'}`}>
                        {cr.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {formatCurrency(p.revenueGenerated as number)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-center">{p.ticketsResolved as number}</td>
                    <td className="px-4 py-3 text-text-secondary text-center">{p.tasksCompleted as number}</td>
                  </tr>
                )
              })}
              {perf.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-text-secondary">No performance data for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Shared stat card ──────────────────────────────────────────

function Stat({ label, value, accent = 'default' }: { label: string; value: string; accent?: 'default' | 'danger' }) {
  return (
    <div className={`rounded-lg border bg-surface p-4 ${accent === 'danger' ? 'border-danger/30' : 'border-border'}`}>
      <p className="text-xs font-medium uppercase text-text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent === 'danger' ? 'text-danger' : 'text-text-primary'}`}>{value}</p>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────

type ReportTab = 'sales' | 'customers' | 'tickets' | 'employees'

const TABS: { key: ReportTab; label: string }[] = [
  { key: 'sales',     label: 'Sales & Revenue' },
  { key: 'customers', label: 'Customers' },
  { key: 'tickets',   label: 'Support Tickets' },
  { key: 'employees', label: 'Employee Performance' },
]

export function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('sales')

  return (
    <div className="space-y-4 p-6">
      <PageHeader title="Reports" subtitle="Analytics and business intelligence" />

      <div className="border-b border-border">
        <nav className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors
                ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div>
        {tab === 'sales'     && <SalesReport />}
        {tab === 'customers' && <CustomersReport />}
        {tab === 'tickets'   && <TicketsReport />}
        {tab === 'employees' && <EmployeeReport />}
      </div>
    </div>
  )
}
