import { prisma } from './prisma'
import type { PrismaClient } from '@prisma/client'

export abstract class BaseRepository {
  protected db: PrismaClient = prisma

  /** Builds a where clause that always scopes to company and excludes soft-deleted */
  protected scopeToCompany(
    companyId: string,
    extra: Record<string, unknown> = {}
  ): Record<string, unknown> {
    return { companyId, deletedAt: null, ...extra }
  }

  /** Converts a base64 cursor string back to a UUID */
  protected decodeCursor(cursor: string): string {
    return Buffer.from(cursor, 'base64url').toString('utf8')
  }

  /** Converts a UUID to a base64 cursor string */
  protected encodeCursor(id: string): string {
    return Buffer.from(id, 'utf8').toString('base64url')
  }

  /**
   * Builds Prisma pagination args from an optional cursor. Explicitly
   * typed as one consistent shape (cursor/skip always present as
   * optional keys) rather than a union of two different-shaped objects
   * ({take} vs {take,cursor,skip}) — spreading a union return type into
   * Prisma's findMany args broke overload resolution ("Type '{id:string}'
   * is not assignable to type 'undefined'"), since Prisma's own types
   * expect cursor/skip as consistently-optional, not conditionally
   * absent.
   */
  protected buildCursorArgs(cursor?: string, limit = 25): { take: number; cursor?: { id: string }; skip?: number } {
    const take = limit + 1  // fetch one extra to detect hasMore
    if (!cursor) return { take }
    return {
      take,
      cursor: { id: this.decodeCursor(cursor) },
      skip:   1,
    }
  }

  /** Slices the extra item off and returns pagination metadata */
  protected buildPageResult<T extends { id: string }>(items: T[], limit: number) {
    const hasMore = items.length > limit
    const data    = hasMore ? items.slice(0, limit) : items
    const cursor  = hasMore ? this.encodeCursor(data[data.length - 1].id) : null
    return { data, meta: { cursor, hasMore, limit } }
  }
}
