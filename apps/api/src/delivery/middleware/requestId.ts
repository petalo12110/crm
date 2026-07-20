import { Request, Response, NextFunction } from 'express'
import * as crypto from 'crypto'

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) ?? crypto.randomUUID()
  req.requestId = id
  res.setHeader('X-Request-ID', id)
  next()
}
