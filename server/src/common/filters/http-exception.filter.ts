import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
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
  if (Array.isArray(value)) return value.filter(Boolean).join('; ') || '服务器错误'
  if (value != null) return String(value)
  return '服务器错误'
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = getOrCreateTraceId(request)
    const timestamp = Date.now()

    if (!(response as any)?.getHeader?.('X-Trace-Id') && !(response as any)?.getHeader?.('x-trace-id')) {
      ;(response as any)?.setHeader?.('X-Trace-Id', traceId)
    }

    // 处理 HTTP 异常
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message = '服务器错误';
      let data = null;

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = normalizeMessage(responseObj.message ?? responseObj.msg);
        data = responseObj.data || null;
      }

      console.error('[HttpException]', {
        path: request.url,
        method: request.method,
        status,
        message,
        traceId,
        stack: exception.stack
      });

      response.status(status).json({
        code: status,
        data,
        message,
        msg: message,
        traceId,
        timestamp
      });
      return;
    }

    // 处理普通错误
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const message = '服务器内部错误'

    console.error('[UnhandledException]', {
      path: request.url,
      method: request.method,
      status,
      message,
      traceId,
      stack: exception instanceof Error ? exception.stack : undefined
    });

    response.status(status).json({
      code: status,
      data: null,
      message,
      msg: message,
      traceId,
      timestamp
    });
  }
}
