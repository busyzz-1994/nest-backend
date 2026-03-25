import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { R2Service } from '../r2/r2.service';
import { UserService } from './user.service';
import {
  loginSchema,
  registerSchema,
  updateMeSchema,
} from './schemas/user.schema';
import type {
  LoginInput,
  RegisterInput,
  UpdateMeInput,
} from './schemas/user.schema';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly config: ConfigService,
    private readonly r2: R2Service,
  ) {}

  /* -------- 公开接口 -------- */

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
  ) {
    const existing = await this.userService.findByEmail(body.email);
    if (existing) {
      throw new HttpException(
        { code: 409, message: '该邮箱已被注册' },
        HttpStatus.CONFLICT,
      );
    }
    const user = await this.userService.create(body);
    return { code: 201, message: '注册成功', data: user };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.userService.verifyPassword(body);
    if (!user) {
      throw new HttpException(
        { code: 401, message: '邮箱或密码错误' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      this.config.get<string>('JWT_SECRET')!,
      {
        expiresIn: (this.config.get('JWT_EXPIRES_IN') ||
          '7d') as jwt.SignOptions['expiresIn'],
      },
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { code: 200, message: '登录成功', data: user };
  }

  /* -------- 需要登录 -------- */

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token');
    return { code: 200, message: '已退出登录' };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@CurrentUser() user: JwtPayload) {
    const found = await this.userService.findById(user.userId);
    if (!found) {
      throw new HttpException(
        { code: 404, message: '用户不存在' },
        HttpStatus.NOT_FOUND,
      );
    }
    return { code: 200, message: 'ok', data: found };
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  async updateMe(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(updateMeSchema)) body: UpdateMeInput,
  ) {
    // 1️⃣ 数据库事务：原子性读取旧值 + 更新新值
    const { user: updated, oldAvatarUrl } =
      await this.userService.updateAvatarWithOldUrl(
        user.userId,
        body.avatarUrl,
      );

    // 2️⃣ 事务提交后，异步删除旧文件（fire-and-forget + 错误日志）
    if (oldAvatarUrl?.startsWith(this.r2.publicUrl)) {
      const oldKey = oldAvatarUrl.replace(`${this.r2.publicUrl}/`, '');
      this.r2.deleteObject(oldKey).catch((err) => {
        // 记录孤立文件，定期清理任务会重试
        console.error(`[Orphan File] Failed to delete: ${oldKey}`, err);
      });
    }

    return { code: 200, message: '头像更新成功', data: updated };
  }

  @Get()
  @UseGuards(AuthGuard)
  async getUsers(
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(pageSizeStr || '10', 10) || 10),
    );
    const data = await this.userService.getList(page, pageSize);
    return { code: 200, message: 'ok', data };
  }
}
