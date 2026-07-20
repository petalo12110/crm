import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leadsApi } from '../api/leads.api'

export const LEADS_KEY = 'leads'

export function useLeads(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [LEADS_KEY, 'list', filters],
    queryFn:  () => leadsApi.list({ ...filters, limit: 100 }),
  })
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: [LEADS_KEY, id],
    queryFn:  () => leadsApi.getById(id!),
    enabled:  !!id,
  })
}

export function usePipeline() {
  return useQuery({
    queryKey: [LEADS_KEY, 'pipeline'],
    queryFn:  leadsApi.getPipeline,
  })
}

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => leadsApi.create(body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [LEADS_KEY] }),
  })
}

export function useUpdateLead(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => leadsApi.update(id, body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [LEADS_KEY] }),
  })
}

export function useTransitionStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stage, note }: { id: string; stage: string; note?: string }) =>
      leadsApi.transitionStage(id, stage, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: [LEADS_KEY] }),
  })
}

export function useDeleteLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => leadsApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [LEADS_KEY] }),
  })
}
