import express, { Application } from 'express'
import helmet                   from 'helmet'
import cors                     from 'cors'
import compression              from 'compression'
import { requestId }            from './middleware/requestId'
import { requestLogger }        from './middleware/requestLogger'
import { rateLimiter }          from './middleware/rateLimiter'
import { errorHandler }         from './middleware/errorHandler'
import { notFound }             from './middleware/notFound'
import { router }               from './router'
import { config }               from '../config/env'

export function createApp(): Application {
  const app = express()

  // ── Security headers ───────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'"],
        styleSrc:    ["'self'", "'unsafe-inline'"],
        imgSrc:      ["'self'", 'data:', 'blob:'],
        connectSrc:  ["'self'"],
        fontSrc:     ["'self'"],
        objectSrc:   ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }))

  // ── CORS ───────────────────────────────────────────────
  //
  // A compiled Capacitor Android app makes requests from
  // capacitor://localhost or https://localhost (its WebView's origin),
  // not from FRONTEND_URL — a fixed single-origin allowlist would block
  // every request from the native app outright. Origin is checked
  // against a small explicit list instead of reflecting anything back.
  const allowedOrigins = new Set([
    config.FRONTEND_URL,
    'capacitor://localhost',
    'http://localhost',
    'https://localhost',
  ])
  app.use(cors({
    origin: (origin, callback) => {
      // No Origin header at all (native HTTP clients, curl, server-to-
      // server) — nothing to check against, let it through.
      if (!origin || allowedOrigins.has(origin)) return callback(null, true)
      callback(new Error('Not allowed by CORS'))
    },
    credentials:  true,
    methods:      ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders:['Authorization', 'Content-Type', 'X-Request-ID', 'X-Company-ID'],
  }))

  // ── Body parsing & compression ─────────────────────────
  app.use(compression())
  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: true }))

  // ── Observability ──────────────────────────────────────
  app.use(requestId)
  app.use(requestLogger)

  // ── Rate limiting ──────────────────────────────────────
  app.use(rateLimiter)

  // ── Health check (unauthenticated, uncached) ───────────
  app.get('/health', (_req, res) => {
    res.json({
      status:    'ok',
      timestamp: new Date().toISOString(),
      uptime:    Math.floor(process.uptime()),
      version:   process.env.npm_package_version ?? '1.0.0',
    })
  })

  // ── API routes ─────────────────────────────────────────
  app.use('/api/v1', router)

  // ── Error handling ─────────────────────────────────────
  app.use(notFound)
  app.use(errorHandler)

  return app
}
