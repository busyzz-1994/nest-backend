import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 响应转换拦截器
 * 自动将返回值包装成统一的信封格式: { code, message, data }
 * 如果返回值已经是信封格式，则直接返回
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        // 如果已经是信封格式（包含 code 字段），直接返回
        if (data && typeof data === 'object' && 'code' in data) {
          return data;
        }

        // 自动包装成信封格式
        return {
          code: response.statusCode,
          message: 'success',
          data,
        };
      }),
    );
  }
}
