import { api } from '@/lib/axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export const ticketsApi = {
  list: (params: Record<string, unknown>) => api.get('/tickets', { params }).then(r => r.data),
  getById: (id: string) => api.get(`/tickets/${id}`).then(r => r.data.data),
  create: (body: Record<string, unknown>) => api.post('/tickets', body).then(r => r.data.data),
  updateStatus: (id: string, status: string) => api.patch(`/tickets/${id}/status`, { status }),
  reply: (id: string, body: string, isInternal: boolean) =>
    api.post(`/tickets/${id}/replies`, { body, isInternal }),
}

export const TICKETS_KEY = 'tickets'

export function useTickets(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [TICKETS_KEY, 'list', filters],
    queryFn:  () => ticketsApi.list({ ...filters, limit: 100 }),
    // Tickets are a shared queue — multiple agents can change status at
    // once, so poll modestly rather than relying only on the 30s default
    // staleTime + manual navigation to pick up teammates' changes.
    refetchInterval: 30_000,
  })
}

export function useTicket(id: string | undefined) {
  return useQuery({ queryKey: [TICKETS_KEY, id], queryFn: () => ticketsApi.getById(id!), enabled: !!id })
}

export function useCreateTicket() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ticketsApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: [TICKETS_KEY] }) })
}

export function useUpdateTicketStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => ticketsApi.updateStatus(id, status),
    // Previously only invalidated the single-ticket query — resolving a
    // ticket from its detail page wouldn't update the Tickets list at all
    // until the 30s staleTime happened to expire. Invalidate the whole
    // tickets prefix so the list reflects it immediately too.
    onSuccess:  () => qc.invalidateQueries({ queryKey: [TICKETS_KEY] }),
  })
}

export function useReplyToTicket(ticketId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ body, isInternal }: { body: string; isInternal: boolean }) =>
      ticketsApi.reply(ticketId, body, isInternal),
    onSuccess: () => qc.invalidateQueries({ queryKey: [TICKETS_KEY, ticketId] }),
  })
}
