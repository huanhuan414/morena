import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import * as crypto from 'crypto'

function normalizeHeaderValue(value: string | string[] | undefined): string | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] || null
  return value
}

function getOrCreateTraceId(request: any): string {
  const existing = request?.traceId
  if (typeof existing === 'string' && existing) return existing

  const traceIdFromHeader =
    normalizeHeaderValue(request?.headers?.['x-trace-id']) ||
    normalizeHeaderValue(request?.headers?.['x-request-id']) ||
    normalizeHeaderValue(request?.headers?.['trace-id']) ||
    normalizeHeaderValue(request?.headers?.['traceid'])

  const traceId = traceIdFromHeader || crypto.randomUUID()
  if (request) request.traceId = traceId
  return traceId
}

function normalizeMessage(value: unknown): string {
  if (typeof value === 'string' && value) return value
  if (Array.isArray(value)) return value.filter(Boolean).join('; ') || 'success'
  if (value != null) return String(value)
  return 'success'
}

function isEnvelopeLike(payload: any): payload is { code?: any; data?: any; message?: any; msg?: any } {
  if (!payload || typeof payload !== 'object') return false
  if (!('code' in payload)) return false
  return 'data' in payload || 'message' in payload || 'msg' in payload
}

@Injectable()
export class SuccessResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp()
    const request = http.getRequest()
    const response = http.getResponse()

    const traceId = getOrCreateTraceId(request)
    const timestamp = Date.now()

    if (!response?.getHeader?.('X-Trace-Id') && !response?.getHeader?.('x-trace-id')) {
      response?.setHeader?.('X-Trace-Id', traceId)
    }

    return next.handle().pipe(
      map((payload: any) => {
        if (response?.headersSent) return payload

        if (payload === response) return payload

        if (payload && typeof payload === 'object' && 'code' in payload && 'message' in payload && 'msg' in payload && 'data' in payload) {
          if (typeof payload.code === 'number' && payload.code >= 400 && payload.code < 600) {
            response.statusCode = payload.code
          }
          return {
            ...payload,
            message: normalizeMessage(payload.message ?? payload.msg),
            msg: normalizeMessage(payload.msg ?? payload.message),
            traceId: payload.traceId || traceId,
            timestamp: payload.timestamp || timestamp,
          }
        }

        if (isEnvelopeLike(payload)) {
          const message = normalizeMessage(payload.message ?? payload.msg)
          const code = typeof payload.code === 'number' ? payload.code : response?.statusCode || 200
          if (typeof code === 'number' && code >= 400 && code < 600) {
            response.statusCode = code
          }
          return {
            code,
            message,
            msg: message,
            data: 'data' in payload ? payload.data : null,
            traceId,
            timestamp,
          }
        }

        const message = 'success'
        return {
          code: response?.statusCode || 200,
          message,
          msg: message,
          data: payload ?? null,
          traceId,
          timestamp,
        }
      }),
    )
  }
}
