import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      // 已经是我们的信封格式，直接返回
      if (typeof body === 'object' && body !== null && 'code' in body) {
        response.status(status).json(body);
        return;
      }

      // NestJS 内置异常转换为统一格式
      const message =
        typeof body === 'string'
          ? body
          : (body as Record<string, unknown>).message || 'Unknown error';
      response.status(status).json({ code: status, message });
      return;
    }

    this.logger.error(exception);
    response.status(500).json({ code: 500, message: '服务器内部错误' });
  }
}
