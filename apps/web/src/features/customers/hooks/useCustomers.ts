import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { customersApi } from '../api/customers.api'
import type { CustomerFormValues } from '../components/CustomerForm'

export const CUSTOMERS_KEY = 'customers'

export function useCustomers(filters: Record<string, unknown>) {
  return useInfiniteQuery({
    queryKey: [CUSTOMERS_KEY, 'list', filters],
    queryFn:  ({ pageParam }) => customersApi.list({ ...filters, cursor: pageParam }),
    getNextPageParam: (page) => (page.meta.hasMore ? page.meta.cursor : undefined),
    initialPageParam: undefined as string | undefined,
    staleTime: 30_000,
  })
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: [CUSTOMERS_KEY, id],
    queryFn:  () => customersApi.getById(id!),
    enabled:  !!id,
  })
}

export function useCustomerTimeline(id: string | undefined) {
  return useInfiniteQuery({
    queryKey: [CUSTOMERS_KEY, id, 'timeline'],
    queryFn:  ({ pageParam }) => customersApi.getTimeline(id!, pageParam),
    getNextPageParam: (page) => (page.meta.hasMore ? page.meta.cursor : undefined),
    initialPageParam: undefined as string | undefined,
    enabled: !!id,
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CustomerFormValues) => customersApi.create(body as unknown as Record<string, unknown>),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [CUSTOMERS_KEY] }),
  })
}

export function useUpdateCustomer(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CustomerFormValues | Record<string, unknown>) => customersApi.update(id, body as unknown as Record<string, unknown>),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: [CUSTOMERS_KEY, id] })
      qc.invalidateQueries({ queryKey: [CUSTOMERS_KEY, 'list'] })
    },
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => customersApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [CUSTOMERS_KEY] }),
  })
}

export function useAddTimelineEntry(customerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => customersApi.addTimelineEntry(customerId, body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [CUSTOMERS_KEY, customerId, 'timeline'] }),
  })
}

export function useSendCustomerEmail(customerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { subject: string; body: string }) => customersApi.sendEmail(customerId, body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [CUSTOMERS_KEY, customerId, 'timeline'] }),
  })
}
