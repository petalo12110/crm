import { redis }  from './redis'
import { log }    from '../../config/logger'

export class CacheService {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await redis.get(key)
      return raw ? (JSON.parse(raw) as T) : null
    } catch (err) {
      log.warn('Cache GET error', { key, err: String(err) })
      return null
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const serialised = JSON.stringify(value)
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, serialised)
      } else {
        await redis.set(key, serialised)
      }
    } catch (err) {
      log.warn('Cache SET error', { key, err: String(err) })
    }
  }

  async delete(key: string): Promise<void> {
    try { await redis.del(key) }
    catch (err) { log.warn('Cache DEL error', { key, err: String(err) }) }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) await redis.del(...keys)
    } catch (err) {
      log.warn('Cache pattern invalidation error', { pattern, err: String(err) })
    }
  }

  static key(...parts: (string | number)[]): string {
    return parts.join(':')
  }
}

export const cache = new CacheService()
