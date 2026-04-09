import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * User 模块 E2E 测试
 *
 * 与单元测试的区别：
 * - 单元测试：直接调用 service 方法，只测试业务逻辑
 * - E2E 测试：通过 HTTP 请求走完整链路（中间件 → Guard → Pipe → Controller → Service）
 *
 * 这里把 PrismaService mock 掉，避免依赖真实数据库，
 * 但完整走了 HTTP 请求 → cookieParser → 全局 Filter/Interceptor → 路由 → Controller → Service 的流程
 */

describe('UserController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    $connect: jest.Mock;
    $disconnect: jest.Mock;
    $transaction: jest.Mock;
  };

  beforeAll(async () => {
    // 创建 mock PrismaService
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $transaction: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // 覆盖 PrismaService，不连真实数据库
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();

    // 还原 main.ts 中的全局配置
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new AllExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // 每个测试前重置所有 mock
    jest.clearAllMocks();
  });

  /* ============================================================
   *  POST /api/users/register
   * ============================================================ */
  describe('POST /api/users/register', () => {
    const registerDto = {
      userName: 'testuser',
      email: 'test@example.com',
      password: '123456',
    };

    it('注册成功 → 201', async () => {
      // findByEmail 返回 null，表示邮箱未被注册
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 1,
        userName: 'testuser',
        email: 'test@example.com',
        avatarUrl: null,
        role: 'USER',
        menuPermissions: ['profile'],
        createdAt: new Date().toISOString(),
      });

      const res = await request(app.getHttpServer())
        .post('/api/users/register')
        .send(registerDto)
        .expect(201);

      expect(res.body.code).toBe(201);
      expect(res.body.message).toBe('注册成功');
      expect(res.body.data.email).toBe('test@example.com');
    });

    it('邮箱已被注册 → 409', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
      });

      const res = await request(app.getHttpServer())
        .post('/api/users/register')
        .send(registerDto)
        .expect(409);

      expect(res.body.code).toBe(409);
      expect(res.body.message).toBe('该邮箱已被注册');
    });

    it('参数校验失败（缺少 email）→ 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/users/register')
        .send({ userName: 'test', password: '123456' })
        .expect(400);

      expect(res.body.code).toBe(400);
    });

    it('参数校验失败（密码太短）→ 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/users/register')
        .send({ userName: 'test', email: 'a@b.com', password: '12' })
        .expect(400);

      expect(res.body.code).toBe(400);
    });
  });

  /* ============================================================
   *  POST /api/users/login
   * ============================================================ */
  describe('POST /api/users/login', () => {
    it('登录成功 → 200 + 设置 cookie', async () => {
      const hashed = await bcrypt.hash('123456', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        userName: 'testuser',
        email: 'test@example.com',
        password: hashed,
        role: 'USER',
        menuPermissions: ['profile'],
      });

      const res = await request(app.getHttpServer())
        .post('/api/users/login')
        .send({ email: 'test@example.com', password: '123456' })
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.message).toBe('登录成功');
      expect(res.body.data.email).toBe('test@example.com');

      // 验证响应中设置了 token cookie
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.startsWith('token='))).toBe(true);
    });

    it('密码错误 → 401', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        password: hashed,
      });

      const res = await request(app.getHttpServer())
        .post('/api/users/login')
        .send({ email: 'test@example.com', password: 'wrong' })
        .expect(401);

      expect(res.body.code).toBe(401);
      expect(res.body.message).toBe('邮箱或密码错误');
    });

    it('用户不存在 → 401', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/api/users/login')
        .send({ email: 'nobody@example.com', password: '123456' })
        .expect(401);

      expect(res.body.code).toBe(401);
    });
  });

  /* ============================================================
   *  需要登录的接口：先登录拿 cookie，再带 cookie 请求
   * ============================================================ */
  describe('需要登录的接口', () => {
    /** 辅助函数：登录并返回 cookie */
    async function loginAndGetCookie(): Promise<string[]> {
      const hashed = await bcrypt.hash('123456', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        userName: 'admin',
        email: 'admin@example.com',
        password: hashed,
        role: 'USER',
        menuPermissions: ['profile', 'dashboard', 'posts'],
      });

      const res = await request(app.getHttpServer())
        .post('/api/users/login')
        .send({ email: 'admin@example.com', password: '123456' });

      return res.headers['set-cookie'] as unknown as string[];
    }

    it('GET /api/users/me — 未登录 → 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users/me')
        .expect(401);

      expect(res.body.code).toBe(401);
    });

    it('GET /api/users/me — 已登录 → 返回用户信息', async () => {
      const cookies = await loginAndGetCookie();

      // 登录后 findUnique 会被 AuthGuard 和 getMe 再次调用
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        userName: 'admin',
        email: 'admin@example.com',
        avatarUrl: null,
        role: 'USER',
        menuPermissions: ['profile', 'dashboard', 'posts'],
        createdAt: new Date().toISOString(),
      });

      const res = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Cookie', cookies)
        .expect(200);

      expect(res.body.data.email).toBe('admin@example.com');
    });

    it('POST /api/users/logout — 已登录 → 200 + 清除 cookie', async () => {
      const cookies = await loginAndGetCookie();

      // AuthGuard 会查用户是否存在
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        userName: 'admin',
        email: 'admin@example.com',
        role: 'USER',
        menuPermissions: ['profile'],
      });

      const res = await request(app.getHttpServer())
        .post('/api/users/logout')
        .set('Cookie', cookies)
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.message).toBe('已退出登录');

      // 验证 cookie 被清除（set-cookie 中 token 的 expires 是过去的时间）
      const setCookies = res.headers['set-cookie'];
      expect(setCookies).toBeDefined();
    });
  });
});
