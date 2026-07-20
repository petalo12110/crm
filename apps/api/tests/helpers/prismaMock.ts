import { vi } from 'vitest'

// Replace the prisma singleton with a mock before any module imports it
vi.mock('../../src/infrastructure/database/prisma', () => ({
  prisma: {
    user:           { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    customer:       { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    lead:           { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    ticket:         { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    task:           { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    companyMember:  { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    refreshToken:   { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    passwordResetToken: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    auditLog:       { create: vi.fn() },
    notification:   { create: vi.fn() },
    timelineEntry:  { create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    leadStageHistory: { create: vi.fn() },
    opportunity:    { create: vi.fn(), update: vi.fn(), aggregate: vi.fn() },
    $transaction:   vi.fn(async (ops: unknown[]) => Promise.all(ops)),
    $connect:       vi.fn(),
    $disconnect:    vi.fn(),
  },
}))
