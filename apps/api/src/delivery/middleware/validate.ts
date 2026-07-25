import { Request, Response, NextFunction, RequestHandler } from 'express'
import { ZodSchema, ZodError } from 'zod'
import { ValidationError }     from '../../core/errors'

type ValidationTarget = 'body' | 'query' | 'params'

export function validate(
  schema: ZodSchema,
  target: ValidationTarget = 'body'
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target])
    if (result.success) {
      (req as unknown as Record<string, unknown>)[target] = result.data
      return next()
    }

    const details = (result.error as ZodError).issues.map(issue => ({
      field:   issue.path.join('.') || undefined,
      message: issue.message,
    }))

    next(new ValidationError('Request validation failed', details))
  }
}
