import { Request, Response, NextFunction } from 'express'
import { ZodError }                          from 'zod'
import { AppError }                          from '../../core/errors'
import { log }                              from '../../config/logger'

export function errorHandler(
  err:   Error,
  req:   Request,
  res:   Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  log.error(err.message, {
    requestId: req.requestId,
    method:    req.method,
    path:      req.path,
    userId:    req.user?.id,
    companyId: req.user?.companyId,
    stack:     err.stack,
  })

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code:    err.errorCode,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    })
    return
  }

  // Every route calls Schema.parse(req.body) directly with no try/catch,
  // so a failed validation throws a raw ZodError straight into this
  // handler. Without this branch it fell through to the generic 500 below
  // — wrong status code (400, not 500) and Zod's default err.message is
  // the *entire issues array JSON-stringified*, which is what was
  // rendering as an unreadable wall of text on every form in the app, not
  // just password reset.
  if (err instanceof ZodError) {
    const details = err.issues.map(issue => ({
      field:   issue.path.join('.'),
      message: issue.message,
    }))
    res.status(400).json({
      success: false,
      error: {
        code:    'VALIDATION_ERROR',
        message: details[0]?.message ?? 'Validation failed',
        details,
      },
    })
    return
  }

  const prismaErr = err as unknown as { code?: string }

  if (prismaErr.code === 'P2002') {
    res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'A record with this value already exists.' } })
    return
  }

  if (prismaErr.code === 'P2025') {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Record not found.' } })
    return
  }

  res.status(500).json({
    success: false,
    error: {
      code:    'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
    },
  })
}
