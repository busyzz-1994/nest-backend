import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
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
import { MenuGuard } from '../common/guards/menu.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireMenu } from '../common/decorators/require-menu.decorator';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { MENU_KEYS } from '../common/constants/menu.constant';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { R2Service } from '../r2/r2.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { UserService } from './user.service';
import {
  loginSchema,
  registerSchema,
  sendCodeSchema,
  updateMeSchema,
  updateUserPermissionsSchema,
} from './schemas/user.schema';
import type {
  LoginInput,
  RegisterInput,
  SendCodeInput,
  UpdateMeInput,
  UpdateUserPermissionsInput,
} from './schemas/user.schema';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly config: ConfigService,
    private readonly r2: R2Service,
    private readonly redis: RedisService,
    private readonly mail: MailService,
  ) {}

  /* -------- 公开接口 -------- */

  @Post('send-code')
  @HttpCode(200)
  async sendCode(
    @Body(new ZodValidationPipe(sendCodeSchema)) body: SendCodeInput,
  ) {
    // 检查邮箱是否已被注册
    const existing = await this.userService.findByEmail(body.email);
    if (existing) {
      throw new HttpException(
        { code: 409, message: '该邮箱已被注册' },
        HttpStatus.CONFLICT,
      );
    }

    // 60 秒发送冷却
    const cooldownKey = `verify-cooldown:${body.email}`;
    const hasCooldown = await this.redis.exists(cooldownKey);
    if (hasCooldown) {
      throw new HttpException(
        { code: 429, message: '发送太频繁，请 60 秒后重试' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 生成 6 位随机数字验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 存入 Redis，验证码 5 分钟过期，冷却 60 秒
    await this.redis.set(`verify:${body.email}`, code, 300);
    await this.redis.set(cooldownKey, '1', 60);

    // 发送邮件
    await this.mail.sendVerificationCode(body.email, code);

    return { code: 200, message: '验证码已发送' };
  }

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
  ) {
    // 校验验证码
    const storedCode = await this.redis.get(`verify:${body.email}`);
    if (!storedCode || Number(storedCode) !== Number(body.code)) {
      throw new HttpException(
        { code: 400, message: '验证码无效或已过期' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.userService.findByEmail(body.email);
    if (existing) {
      throw new HttpException(
        { code: 409, message: '该邮箱已被注册' },
        HttpStatus.CONFLICT,
      );
    }

    // 验证通过，删除 Redis 中的验证码
    await this.redis.del(`verify:${body.email}`);

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
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        menuPermissions: user.menuPermissions,
      },
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
  @UseGuards(AuthGuard, MenuGuard)
  @RequireMenu(MENU_KEYS.PROFILE)
  async getMe(@CurrentUser() user: JwtPayload) {
    const found = await this.userService.findById(user.userId);
    if (!found) {
      throw new HttpException(
        { code: 404, message: '用户不存在' },
        HttpStatus.NOT_FOUND,
      );
    }
    return found;
  }

  @Patch('me')
  @UseGuards(AuthGuard, MenuGuard)
  @RequireMenu(MENU_KEYS.PROFILE)
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
  @UseGuards(AuthGuard, MenuGuard)
  @RequireMenu(MENU_KEYS.DASHBOARD)
  async getUsers(
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(pageSizeStr || '10', 10) || 10),
    );
    return this.userService.getList(page, pageSize);
  }

  /* -------- 权限管理接口（仅管理员） -------- */

  @Get('permissions/menus')
  @UseGuards(AuthGuard, RoleGuard)
  @RequireRole('admin')
  getAvailableMenus() {
    return [
      {
        key: MENU_KEYS.DASHBOARD,
        name: 'Dashboard',
        description: '仪表盘 - 查看用户列表',
        path: '/dashboard',
      },
      {
        key: MENU_KEYS.POSTS,
        name: '文章管理',
        description: '文章列表 - 查看和管理文章',
        path: '/posts',
      },
      {
        key: MENU_KEYS.PROFILE,
        name: '个人资料',
        description: '个人资料 - 查看和编辑个人信息',
        path: '/profile',
      },
    ];
  }

  @Get(':id/permissions')
  @UseGuards(AuthGuard, RoleGuard)
  @RequireRole('admin')
  async getUserPermissions(@Param('id', ParseIntPipe) id: number) {
    const user = await this.userService.getUserPermissions(id);
    if (!user) {
      throw new HttpException(
        { code: 404, message: '用户不存在' },
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      role: user.role.toLowerCase(),
      menuPermissions: user.menuPermissions,
    };
  }

  @Patch(':id/permissions')
  @UseGuards(AuthGuard, RoleGuard)
  @RequireRole('admin')
  async updateUserPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateUserPermissionsSchema))
    body: UpdateUserPermissionsInput,
  ) {
    const targetUser = await this.userService.findById(id);
    if (!targetUser) {
      throw new HttpException(
        { code: 404, message: '用户不存在' },
        HttpStatus.NOT_FOUND,
      );
    }

    // 不能修改管理员的权限
    if (targetUser.role === 'ADMIN') {
      throw new HttpException(
        { code: 403, message: '不能修改管理员的权限' },
        HttpStatus.FORBIDDEN,
      );
    }

    const updated = await this.userService.updateUserMenuPermissions(
      id,
      body.menuPermissions,
    );

    return {
      code: 200,
      message: '权限更新成功，用户需重新登录生效',
      data: updated,
    };
  }
}
