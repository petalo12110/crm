import { api } from '@/lib/axios'

export const customersApi = {
  list: (params: Record<string, unknown>) =>
    api.get('/customers', { params }).then(r => r.data),

  getById: (id: string) =>
    api.get(`/customers/${id}`).then(r => r.data.data),

  create: (body: Record<string, unknown>) =>
    api.post('/customers', body).then(r => r.data.data),

  update: (id: string, body: Record<string, unknown>) =>
    api.patch(`/customers/${id}`, body).then(r => r.data.data),

  delete: (id: string) => api.delete(`/customers/${id}`),

  restore: (id: string) => api.post(`/customers/${id}/restore`),

  sendEmail: (id: string, body: { subject: string; body: string }) =>
    api.post(`/customers/${id}/send-email`, body).then(r => r.data.data),

  getTimeline: (id: string, cursor?: string) =>
    api.get(`/customers/${id}/timeline`, { params: { cursor, limit: 25 } }).then(r => r.data),

  addTimelineEntry: (id: string, body: Record<string, unknown>) =>
    api.post(`/customers/${id}/timeline`, body),

  bulkAssign: (ids: string[], assignedTo: string) =>
    api.post('/customers/bulk/assign', { ids, assignedTo }),

  bulkTag: (ids: string[], tags: string[]) =>
    api.post('/customers/bulk/tag', { ids, tags }),

  importCsv: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    // The shared axios instance defaults to 'Content-Type: application/json',
    // which would silently break a multipart upload. Explicitly clearing it
    // (not just omitting it) makes axios/the browser set the correct
    // 'multipart/form-data; boundary=...' header instead.
    return api.post('/customers/import', formData, {
      headers: { 'Content-Type': undefined },
    }).then(r => r.data.data as { imported: number; failed: number; errors: Array<{ row: number; message: string }> })
  },
}
