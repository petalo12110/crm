import { api } from '@/lib/axios'

export const leadsApi = {
  list: (params: Record<string, unknown>) =>
    api.get('/leads', { params }).then(r => r.data),

  getById: (id: string) => api.get(`/leads/${id}`).then(r => r.data.data),

  create: (body: Record<string, unknown>) =>
    api.post('/leads', body).then(r => r.data.data),

  update: (id: string, body: Record<string, unknown>) =>
    api.patch(`/leads/${id}`, body).then(r => r.data.data),

  transitionStage: (id: string, stage: string, note?: string) =>
    api.patch(`/leads/${id}/stage`, { stage, note }).then(r => r.data.data),

  delete: (id: string) => api.delete(`/leads/${id}`),

  getPipeline: () => api.get('/leads/pipeline').then(r => r.data.data),

  convert: (id: string, body: Record<string, unknown>) =>
    api.post(`/leads/${id}/convert`, body).then(r => r.data.data),
}
