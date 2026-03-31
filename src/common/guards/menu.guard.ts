import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_MENU_KEY } from '../decorators/require-menu.decorator';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class MenuGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredMenu = this.reflector.getAllAndOverride<string>(
      REQUIRE_MENU_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 如果没有设置 @RequireMenu 装饰器，则允许访问
    if (!requiredMenu) {
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

    // 管理员拥有所有权限
    if (user.role === 'admin') {
      return true;
    }

    // 普通用户检查菜单权限
    if (!user.menuPermissions || !user.menuPermissions.includes(requiredMenu)) {
      throw new ForbiddenException({
        code: 403,
        message: '您没有访问权限',
      });
    }

    return true;
  }
}
