import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_ROLE_KEY } from '../decorators/require-role.decorator';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) {
      throw new ForbiddenException({
        code: 403,
        message: '未认证的用户',
      });
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException({
        code: 403,
        message: '您没有权限执行此操作',
      });
    }

    return true;
  }
}
