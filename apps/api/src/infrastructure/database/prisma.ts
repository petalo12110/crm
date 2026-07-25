import { PrismaClient } from '@prisma/client'
import { log }          from '../../config/logger'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { emit: 'event', level: 'query'  },
      { emit: 'event', level: 'error'  },
      { emit: 'event', level: 'warn'   },
    ],
  })

if (process.env.NODE_ENV !== 'production') {
  prisma.$on('query' as never, (e: { duration: number; query: string }) => {
    if (e.duration > 200) {
      log.warn('Slow query detected', { duration: e.duration, query: e.query.substring(0, 200) })
    }
  })
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
