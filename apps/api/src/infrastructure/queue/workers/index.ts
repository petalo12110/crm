import dns from 'node:dns'
import { log }    from '../../../config/logger'
import { prisma } from '../../database/prisma'
import { startWorkers } from '../startWorkers'

export { startWorkers }

// Node 18+ resolves "localhost" to ::1 (IPv6) first by default. Docker
// containers (Mailpit, Postgres, Redis) are commonly only published on the
// IPv4 interface, so without this, connections to "localhost" services can
// fail with ECONNREFUSED even though the exact same host is reachable on
// 127.0.0.1. This makes IPv4 the preferred lookup result for everything
// this process connects to.
dns.setDefaultResultOrder('ipv4first')

// Standalone worker entrypoint — used for local dev (`pnpm worker`) and
// for anyone running Render's actual Background Worker service type (or
// any host that supports a real second process). If you're on Render's
// free plan, this isn't used at all — see server.ts, which runs the same
// startWorkers() embedded in the API process instead, since the free
// plan doesn't offer a Background Worker service to run this as.
const workers = startWorkers()

async function shutdown(signal: string) {
  log.info('Worker shutdown signal received', { signal })
  await workers.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))
process.on('uncaughtException',  err    => { log.error('Worker uncaught exception', { err: String(err) }); process.exit(1) })
process.on('unhandledRejection', reason => { log.error('Worker unhandled rejection', { reason: String(reason) }); process.exit(1) })
