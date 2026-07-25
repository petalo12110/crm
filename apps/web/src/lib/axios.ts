import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

// In the browser (dev or a normal web deployment), relative '/api/v1'
// works fine — Vite's dev proxy or the production server handles it.
// A compiled Capacitor app has no dev server and no same-origin server at
// all (it loads from a bundled local origin), so it needs an absolute URL
// pointing at wherever the real API is reachable — set VITE_API_URL at
// build time for that case (see README-ANDROID.md).
const baseURL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1` : '/api/v1'

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let isRefreshing = false
let pendingQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = []

const processQueue = (error: unknown, token: string | null) => {
  pendingQueue.forEach(p => (error ? p.reject(error) : p.resolve(token!)))
  pendingQueue = []
}

api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined

    if (error.response?.status !== 401 || !original || original._retry || original.url?.includes('/auth/login')) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: token => {
            original.headers.Authorization = `Bearer ${token}`
            resolve(api(original))
          },
          reject,
        })
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) throw new Error('No refresh token')

      const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken })
      const { accessToken, refreshToken: newRefresh } = data.data

      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', newRefresh)
      processQueue(null, accessToken)

      original.headers.Authorization = `Bearer ${accessToken}`
      return api(original)
    } catch (err) {
      processQueue(err, null)
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('companyId')
      const wasAdmin = localStorage.getItem('authMode') === 'admin'
      localStorage.removeItem('authMode')
      window.location.href = wasAdmin ? '/admin/login' : '/login'
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  }
)
