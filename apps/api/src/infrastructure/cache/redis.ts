import Redis   from 'ioredis'
import { config } from '../../config/env'
import { log }    from '../../config/logger'

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  lazyConnect: true,
})

redis.on('connect', ()    => log.info('Redis connected'))
redis.on('error',   (err) => log.error('Redis error', { err: String(err) }))
redis.on('close',   ()    => log.warn('Redis connection closed'))
