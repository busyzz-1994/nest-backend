import { HttpException, HttpStatus, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const errors = result.error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new HttpException(
        { code: 400, message: '参数校验失败', errors },
        HttpStatus.BAD_REQUEST,
      );
    }
    return result.data;
  }
}
