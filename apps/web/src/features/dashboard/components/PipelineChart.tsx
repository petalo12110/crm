import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { LoadingState } from '@/components/ui/States'
import { formatCurrency } from '@/lib/formatters'
import { usePipelineOverview } from '../hooks/useDashboard'

const STAGE_COLORS: Record<string, string> = {
  NEW:           '#60A5FA',
  CONTACTED:     '#FBBF24',
  QUALIFIED:     '#A78BFA',
  PROPOSAL_SENT: '#FB923C',
  NEGOTIATION:   '#F97316',
  WON:           '#22C55E',
  LOST:          '#F87171',
  ARCHIVED:      '#94A3B8',
}

export function PipelineChart() {
  const { data, isLoading } = usePipelineOverview()

  if (isLoading) return <div className="flex h-48 items-center justify-center"><LoadingState /></div>

  interface PipelineEntry { stage: string; count: number; value: number }
  const chartData: PipelineEntry[] = (data ?? []).map((s: Record<string, unknown>) => ({
    stage: s.stage as string,
    count: (s._count as Record<string,number>)?.stage ?? 0,
    value: Number((s._sum as Record<string,unknown>)?.value ?? 0),
  })).filter((d: PipelineEntry) => d.count > 0)

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">Pipeline by Stage</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #E2E8F0)" vertical={false} />
          <XAxis dataKey="stage" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value: number, name: string) => [
              name === 'value' ? formatCurrency(value) : value,
              name === 'value' ? 'Total value' : 'Count'
            ]}
            contentStyle={{
              background: 'rgb(var(--color-surface))',
              border: '1px solid rgb(var(--color-border))',
              borderRadius: '6px',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((entry: PipelineEntry) => (
              <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] ?? '#94A3B8'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
