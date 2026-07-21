import { z } from 'zod'
import * as dotenv from 'dotenv'
import * as path   from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const EnvSchema = z.object({
  NODE_ENV:   z.enum(['development','test','production']).default('development'),
  PORT:       z.coerce.number().default(3000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL:    z.string().min(1, 'REDIS_URL is required'),

  JWT_SECRET:          z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  ACCESS_TOKEN_TTL:    z.coerce.number().default(900),
  REFRESH_TOKEN_TTL:   z.coerce.number().default(604800),

  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes)').optional(),

  STORAGE_PROVIDER:   z.enum(['local','s3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./uploads'),
  S3_BUCKET:    z.string().optional(),
  S3_REGION:    z.string().optional(),
  S3_ACCESS_KEY:z.string().optional(),
  S3_SECRET_KEY:z.string().optional(),

  FRONTEND_URL:       z.string().default('http://localhost:5173'),
  MAX_FILE_SIZE_MB:   z.coerce.number().default(25),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM:z.string().default('noreply@crm.local'),

  SWAGGER_ENABLED: z.coerce.boolean().default(true),
  LOG_LEVEL: z.enum(['error','warn','info','debug']).default('info'),

  BCRYPT_ROUNDS:       z.coerce.number().min(10).max(14).default(12),
  MAX_LOGIN_ATTEMPTS:  z.coerce.number().default(5),
  LOCKOUT_MINUTES:     z.coerce.number().default(15),
})

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌  Environment variable validation failed:')
  parsed.error.issues.forEach(i => console.error(` • ${i.path.join('.')}: ${i.message}`))
  process.exit(1)
}

export const config = parsed.data
export type Config  = typeof config
