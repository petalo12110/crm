import axios from 'axios'

/**
 * Fully separate from lib/axios.ts (the tenant/admin instance) — portal
 * tokens are a different JWT audience entirely (see
 * core/utils::signPortalToken on the backend) and have no refresh-token
 * flow at all (7-day token, "just request a new magic link" instead of
 * silent refresh, since that's simpler and appropriate for how
 * infrequently an external customer logs in). Mixing this with the main
 * `api` instance would risk sending the wrong token to the wrong
 * audience.
 */
export const portalApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1/portal` : '/api/v1/portal',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
})

portalApi.interceptors.request.use(config => {
  const token = localStorage.getItem('portalAccessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

portalApi.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const slug = localStorage.getItem('portalCompanySlug')
      localStorage.removeItem('portalAccessToken')
      localStorage.removeItem('portalCustomer')
      localStorage.removeItem('portalCompanySlug')
      if (slug) window.location.href = `/portal/${slug}/login`
    }
    return Promise.reject(error)
  }
)
