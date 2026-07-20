import bcrypt    from 'bcryptjs'
import jwt        from 'jsonwebtoken'
import * as crypto from 'crypto'
import { config }  from '../../config/env'
import { ForbiddenError } from '../errors'

/**
 * Narrows AuthUser.companyId (string | null) to string. Every route that
 * calls this is already gated by authorize() with a role list that never
 * includes SUPER_ADMIN — the only role whose token carries a null
 * companyId — so the guard below should never actually throw in
 * practice. It exists so that invariant is enforced explicitly and
 * type-checked, rather than silently passing null through to a repo/
 * Prisma call as if it were a real company id.
 */
export function requireCompanyId(user: { companyId: string | null }): string {
  if (!user.companyId) {
    throw new ForbiddenError('This action requires company context')
  }
  return user.companyId
}

// ── Password hashing ───────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, config.BCRYPT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

// ── JWT ────────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub:       string  // user ID
  /** null for a Super Admin token — not scoped to any company. */
  companyId: string | null
  role:      string
  email:     string
  jti:       string  // unique token ID
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'jti'>): string {
  return jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    config.JWT_SECRET,
    { expiresIn: config.ACCESS_TOKEN_TTL, algorithm: 'HS256' }
  )
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.JWT_SECRET) as AccessTokenPayload
}

// ── Customer portal JWT ─────────────────────────────────────
//
// Deliberately separate sign/verify functions rather than reusing
// signAccessToken with a different payload shape. The `audience` claim is
// checked by jwt.verify itself (not just a field we could forget to
// check downstream) — a portal token literally cannot be accepted by
// verifyAccessToken and an employee/admin token cannot be accepted by
// verifyPortalToken, even though both happen to use the same JWT_SECRET.

export interface PortalTokenPayload {
  sub:        string  // customer ID
  companyId:  string
  jti:        string
}

const PORTAL_AUDIENCE = 'customer-portal'

export function signPortalToken(payload: Omit<PortalTokenPayload, 'jti'>): string {
  return jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    config.JWT_SECRET,
    { expiresIn: '7d', algorithm: 'HS256', audience: PORTAL_AUDIENCE }
  )
}

export function verifyPortalToken(token: string): PortalTokenPayload {
  return jwt.verify(token, config.JWT_SECRET, { audience: PORTAL_AUDIENCE }) as PortalTokenPayload
}

// ── Secure random tokens ───────────────────────────────────

/** Generates a cryptographically secure URL-safe random token */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

/** SHA-256 hash of a token (for safe database storage) */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// ── AES-256-GCM encryption for sensitive fields ────────────

const ALGO        = 'aes-256-gcm'
const IV_LENGTH   = 12
const TAG_LENGTH  = 16

function getEncryptionKey(): Buffer {
  if (!config.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is not configured')
  }
  return Buffer.from(config.ENCRYPTION_KEY, 'hex')
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv  = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  // Format: iv(12) + tag(16) + ciphertext — all base64-encoded
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decrypt(ciphertext: string): string {
  const key   = getEncryptionKey()
  const data  = Buffer.from(ciphertext, 'base64')
  const iv    = data.slice(0, IV_LENGTH)
  const tag   = data.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const enc   = data.slice(IV_LENGTH + TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(enc).toString('utf8') + decipher.final('utf8')
}

// ── Misc ───────────────────────────────────────────────────

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100)
}

/** Format ticket number with zero-padding */
export function formatTicketNumber(seq: number): string {
  return `TKT-${String(seq).padStart(6, '0')}`
}
