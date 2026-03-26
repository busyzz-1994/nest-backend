import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      // 已经是我们的信封格式，直接返回
      if (typeof body === 'object' && body !== null && 'code' in body) {
        // 🔥 添加日志：记录请求路径和错误信息
        const logMsg = `[${request.method}] ${request.url} → ${status} ${JSON.stringify(body)}`;
        if (status >= 500) {
          this.logger.error(logMsg);
        } else if (status >= 400) {
          this.logger.warn(logMsg); // 400错误用warn级别，更容易看到
        }

        response.status(status).json(body);
        return;
      }

      // NestJS 内置异常转换为统一格式
      const message =
        typeof body === 'string'
          ? body
          : (body as Record<string, unknown>).message || 'Unknown error';

      // 🔥 添加日志：记录内置异常
      const logMsg = `[${request.method}] ${request.url} → ${status} ${message}`;
      if (status >= 500) {
        this.logger.error(logMsg);
      } else if (status >= 400) {
        this.logger.warn(logMsg);
      }

      response.status(status).json({ code: status, message });
      return;
    }

    // 🔥 这里才记录未知错误（非HTTP异常）
    this.logger.error(
      `[${request.method}] ${request.url} → 未捕获的异常:`,
      exception,
    );
    response.status(500).json({ code: 500, message: '服务器内部错误' });
  }
}
