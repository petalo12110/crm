export interface AuthUser {
  id:        string
  email:     string
  firstName: string
  lastName:  string
  role:      string
  /** null for a platform Super Admin — they aren't scoped to any company. */
  companyId: string | null
  avatarUrl: string | null
}

export interface PaginationMeta {
  cursor:  string | null
  hasMore: boolean
  total?:  number
  limit:   number
}

export type UUID        = string
export type ISODate     = string  // YYYY-MM-DD
export type ISODateTime = string  // ISO 8601

declare global {
  namespace Express {
    interface Request {
      user:       AuthUser
      requestId:  string
      companyId:  string | null
    }
  }
}
