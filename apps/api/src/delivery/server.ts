import dns from 'node:dns'
import { createApp } from './app'
import { config }    from '../config/env'
import { log }       from '../config/logger'
import { prisma }    from '../infrastructure/database/prisma'
import { redis }     from '../infrastructure/cache/redis'
import { startWorkers } from '../infrastructure/queue/startWorkers'

// See infrastructure/queue/workers/index.ts for why this matters.
dns.setDefaultResultOrder('ipv4first')

async function bootstrap() {
  log.info('Connecting to database...')
  await prisma.$connect()
  log.info('Database connected')

  log.info('Connecting to Redis...')
  await redis.connect()
  log.info('Redis connected')

  // Runs the email/notification job processors in this same process.
  // Render's free plan doesn't include a Background Worker service type
  // (paid plans do — see render.yaml's crm-worker service, which stays
  // defined for that case), so on free tier there's no separate process
  // to run this in at all. One process doing both HTTP + job processing
  // isn't as clean as two, but it's what's actually available for free.
  const workers = startWorkers()

  const app    = createApp()
  const server = app.listen(config.PORT, () => {
    log.info(`CRM API running on port ${config.PORT}`, { env: config.NODE_ENV })
  })

  const shutdown = async (signal: string) => {
    log.info('Shutdown signal received', { signal })
    server.close(async () => {
      try {
        await workers.close()
        await prisma.$disconnect()
        await redis.quit()
        log.info('Server shut down cleanly')
        process.exit(0)
      } catch (err) {
        log.error('Error during shutdown', { err: String(err) })
        process.exit(1)
      }
    })
    setTimeout(() => { log.error('Forced shutdown after timeout'); process.exit(1) }, 30_000).unref()
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT',  () => shutdown('SIGINT'))
  process.on('uncaughtException',   (err)    => { log.error('Uncaught exception',           { err: String(err) }); process.exit(1) })
  process.on('unhandledRejection',  (reason) => { log.error('Unhandled promise rejection',  { reason: String(reason) }); process.exit(1) })
}

bootstrap().catch(err => { console.error('Fatal startup error:', err); process.exit(1) })
