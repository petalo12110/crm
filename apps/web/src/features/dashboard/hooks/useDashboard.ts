import { api } from '@/lib/axios'
import { useQuery } from '@tanstack/react-query'

export const dashboardApi = {
  getSummary:    ()  => api.get('/dashboard/summary').then(r => r.data.data),
  getSalesTrend: ()  => api.get('/dashboard/sales-trend').then(r => r.data.data),
  getPipeline:   ()  => api.get('/dashboard/pipeline').then(r => r.data.data),
  getTopPerformers: () => api.get('/dashboard/top-performers').then(r => r.data.data),
  getRecentActivity:() => api.get('/dashboard/recent-activity').then(r => r.data.data),
}

export function useDashboardSummary() {
  return useQuery({ queryKey: ['dashboard', 'summary'], queryFn: dashboardApi.getSummary, staleTime: 60_000 })
}
export function useSalesTrend() {
  return useQuery({ queryKey: ['dashboard', 'sales-trend'], queryFn: dashboardApi.getSalesTrend, staleTime: 300_000 })
}
export function usePipelineOverview() {
  return useQuery({ queryKey: ['dashboard', 'pipeline'], queryFn: dashboardApi.getPipeline, staleTime: 60_000 })
}
export function useTopPerformers() {
  return useQuery({ queryKey: ['dashboard', 'top-performers'], queryFn: dashboardApi.getTopPerformers, staleTime: 300_000 })
}
export function useRecentActivity() {
  return useQuery({ queryKey: ['dashboard', 'activity'], queryFn: dashboardApi.getRecentActivity, staleTime: 30_000 })
}
