import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class AuthGuard implements CanActivate {
  /** 用户存在性缓存，TTL 5 分钟 */
  private userCache = new Map<number, { exists: boolean; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token: string | undefined = request.cookies?.token;

    if (!token) {
      throw new HttpException(
        { code: 401, message: '未登录或登录已过期' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    try {
      const payload = jwt.verify(
        token,
        this.config.get<string>('JWT_SECRET')!,
      ) as JwtPayload;

      const exists = await this.checkUserExists(payload.userId);
      if (!exists) {
        throw new HttpException(
          { code: 401, message: '用户不存在或已被删除' },
          HttpStatus.UNAUTHORIZED,
        );
      }

      request.user = payload;
      return true;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        { code: 401, message: '未登录或登录已过期' },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  /* ---------- 缓存逻辑 ---------- */

  private async checkUserExists(userId: number): Promise<boolean> {
    const now = Date.now();
    const cached = this.userCache.get(userId);

    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.exists;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    const exists = !!user;
    this.userCache.set(userId, { exists, timestamp: now });

    if (!exists) {
      setTimeout(() => this.userCache.delete(userId), 30_000);
    }

    return exists;
  }

  /** 清除指定用户的认证缓存 */
  clearUserCache(userId: number) {
    this.userCache.delete(userId);
  }
}
