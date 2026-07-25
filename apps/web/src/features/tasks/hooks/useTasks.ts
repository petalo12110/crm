import { api } from '@/lib/axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export const tasksApi = {
  list: (params: Record<string, unknown>) => api.get('/tasks', { params }).then(r => r.data),
  getById: (id: string) => api.get(`/tasks/${id}`).then(r => r.data.data),
  create: (body: Record<string, unknown>) => api.post('/tasks', body).then(r => r.data.data),
  update: (id: string, body: Record<string, unknown>) => api.patch(`/tasks/${id}`, body).then(r => r.data.data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  addComment: (id: string, body: string) => api.post(`/tasks/${id}/comments`, { body }),
  getOverdue: () => api.get('/tasks/overdue').then(r => r.data),
}

export const TASKS_KEY = 'tasks'

export function useTasks(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [TASKS_KEY, 'list', filters],
    queryFn:  () => tasksApi.list({ ...filters, limit: 100 }),
    refetchInterval: 30_000,
  })
}

export function useTask(id: string | undefined) {
  return useQuery({ queryKey: [TASKS_KEY, id], queryFn: () => tasksApi.getById(id!), enabled: !!id })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (body: Record<string,unknown>) => tasksApi.create(body), onSuccess: () => qc.invalidateQueries({ queryKey: [TASKS_KEY] }) })
}

export function useUpdateTask(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => tasksApi.update(id, body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [TASKS_KEY] }),
  })
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => tasksApi.update(id, { status }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [TASKS_KEY] }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => tasksApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: [TASKS_KEY] }) })
}
