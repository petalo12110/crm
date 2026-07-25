// One-time bootstrap for a production Super Admin account.
//
// Unlike prisma/seed.ts (dev-only — creates a demo company + fake data),
// this creates ONLY a single Super Admin user, safe to run against a real
// production database. It's idempotent: running it again with the same
// email just reports the account already exists rather than erroring or
// creating a duplicate.
//
// Usage (from apps/api, or via Render's Shell tab against the deployed
// service so it uses the real DATABASE_URL):
//
//   SUPERADMIN_EMAIL=you@yourdomain.com \
//   SUPERADMIN_PASSWORD='a-real-strong-password' \
//   SUPERADMIN_FIRST_NAME=Your \
//   SUPERADMIN_LAST_NAME=Name \
//   pnpm exec tsx src/prisma/bootstrap-admin.ts
//
// Do not commit real credentials anywhere — pass them as env vars on the
// command line (or Render's Shell) only, never in a file.

import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../core/utils/index'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.SUPERADMIN_EMAIL
  const password = process.env.SUPERADMIN_PASSWORD
  const firstName = process.env.SUPERADMIN_FIRST_NAME
  const lastName = process.env.SUPERADMIN_LAST_NAME

  if (!email || !password || !firstName || !lastName) {
    console.error(
      'Missing required env vars. Set SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, ' +
      'SUPERADMIN_FIRST_NAME, and SUPERADMIN_LAST_NAME before running this script.'
    )
    process.exit(1)
  }

  if (password.length < 12) {
    console.error('SUPERADMIN_PASSWORD must be at least 12 characters.')
    process.exit(1)
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`A user with email "${email}" already exists (id: ${existing.id}).`)
    if (existing.isSuperAdmin) {
      console.log('That account is already a Super Admin — nothing to do.')
    } else {
      console.log(
        'That account exists but is NOT a Super Admin. This script only ' +
        'creates new accounts; promote an existing user manually if needed.'
      )
    }
    return
  }

  const passwordHash = await hashPassword(password)

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      isSuperAdmin: true,
      emailVerifiedAt: new Date(),
    },
  })

  console.log(`Super Admin created: ${user.email} (id: ${user.id})`)
  console.log('Log in at POST /api/v1/auth/admin/login — no Company ID needed.')
}

main()
  .catch(err => {
    console.error('Bootstrap failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
