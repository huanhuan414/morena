import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

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
        message = responseObj.message || '服务器错误';
        data = responseObj.data || null;
      }

      console.error('[HttpException]', {
        path: request.url,
        method: request.method,
        status,
        message,
        stack: exception.stack
      });

      response.status(status).json({
        code: status,
        data,
        message
      });
      return;
    }

    // 处理普通错误
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof Error ? exception.message : '服务器错误';

    console.error('[UnhandledException]', {
      path: request.url,
      method: request.method,
      status,
      message,
      stack: exception instanceof Error ? exception.stack : undefined
    });

    response.status(status).json({
      code: status,
      data: null,
      message
    });
  }
}
