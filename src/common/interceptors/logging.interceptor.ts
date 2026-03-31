import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * 日志拦截器
 * 记录所有 HTTP 请求的方法、路径、耗时和状态
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const now = Date.now();

    // 前置：记录请求开始（可选，用于调试）
    // this.logger.debug(`→ ${method} ${url}`);

    return next.handle().pipe(
      tap({
        next: () => {
          // 后置：记录成功响应 + 耗时
          const duration = Date.now() - now;
          this.logger.log(`${method} ${url} - ${duration}ms`);
        },
        error: () => {
          // 后置：记录失败响应 + 耗时（错误详情由 AllExceptionFilter 处理）
          const duration = Date.now() - now;
          this.logger.error(`${method} ${url} - ${duration}ms ✗`);
        },
      }),
    );
  }
}
