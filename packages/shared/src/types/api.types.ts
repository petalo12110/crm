export interface ApiResponse<T> {
  success: true
  data: T
  meta?: Record<string, unknown>
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
    details?: Array<{ field?: string; message: string }>
  }
}

export interface PaginatedResponse<T> {
  success: true
  data: T[]
  meta: {
    cursor:  string | null
    hasMore: boolean
    total:   number
    limit:   number
  }
}

export interface AuthUser {
  id:        string
  email:     string
  firstName: string
  lastName:  string
  role:      string
  companyId: string
  avatarUrl: string | null
}
