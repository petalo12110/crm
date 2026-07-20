import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { LoadingState } from '@/components/ui/States'
import { formatCurrency } from '@/lib/formatters'
import { useSalesTrend } from '../hooks/useDashboard'

export function RevenueChart() {
  const { data, isLoading } = useSalesTrend()

  if (isLoading) return <div className="flex h-64 items-center justify-center"><LoadingState /></div>

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">Revenue — Last 12 months</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #E2E8F0)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => v.slice(5)}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
            width={45}
          />
          <Tooltip
            formatter={(value: number) => [formatCurrency(value), 'Revenue']}
            labelFormatter={l => `Month: ${l}`}
            contentStyle={{
              background: 'rgb(var(--color-surface))',
              border: '1px solid rgb(var(--color-border))',
              borderRadius: '6px',
              fontSize: '12px',
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#2563EB"
            strokeWidth={2}
            fill="url(#colorRevenue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
