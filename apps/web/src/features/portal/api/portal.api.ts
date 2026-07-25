import { portalApi } from '@/lib/portalAxios'

export const portalTicketsApi = {
  list: () => portalApi.get('/tickets').then(r => r.data.data),
  getById: (id: string) => portalApi.get(`/tickets/${id}`).then(r => r.data.data),
  create: (body: { title: string; description?: string; priority?: string }) =>
    portalApi.post('/tickets', body).then(r => r.data.data),
  reply: (id: string, body: string) =>
    portalApi.post(`/tickets/${id}/reply`, { body }).then(r => r.data.data),
}
