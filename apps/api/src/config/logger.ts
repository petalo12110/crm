import winston from 'winston'
import { config } from './env'

const { combine, timestamp, json, colorize, simple, errors } = winston.format

const devFormat  = combine(colorize(), simple(), errors({ stack: true }))
const prodFormat = combine(timestamp(), errors({ stack: true }), json())

export const logger = winston.createLogger({
  level:      config.LOG_LEVEL,
  format:     config.NODE_ENV === 'production' ? prodFormat : devFormat,
  defaultMeta:{ service: 'crm-api' },
  transports: [
    new winston.transports.Console(),
    ...(config.NODE_ENV === 'production'
      ? [
          new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
          new winston.transports.File({ filename: 'logs/combined.log' }),
        ]
      : []),
  ],
})

// Extend logger with typed structured logging helpers
export const log = {
  info:  (msg: string, meta?: Record<string, unknown>) => logger.info(msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => logger.warn(msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => logger.error(msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => logger.debug(msg, meta),
  http:  (msg: string, meta?: Record<string, unknown>) => logger.http(msg, meta),
}
