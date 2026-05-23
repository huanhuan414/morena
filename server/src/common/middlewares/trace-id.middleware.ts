import type { NextFunction, Request, Response } from 'express'
import * as crypto from 'crypto'

function normalizeHeaderValue(value: string | string[] | undefined): string | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] || null
  return value
}

function getHeaderTraceId(req: Request): string | null {
  return (
    normalizeHeaderValue(req.headers['x-trace-id']) ||
    normalizeHeaderValue(req.headers['x-request-id']) ||
    normalizeHeaderValue(req.headers['trace-id']) ||
    normalizeHeaderValue(req.headers['traceid'])
  )
}

export function traceIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const existing = (req as any)?.traceId
  const traceId =
    (typeof existing === 'string' && existing) || getHeaderTraceId(req) || crypto.randomUUID()

  ;(req as any).traceId = traceId

  if (!res.getHeader('X-Trace-Id') && !res.getHeader('x-trace-id')) {
    res.setHeader('X-Trace-Id', traceId)
  }

  next()
}
