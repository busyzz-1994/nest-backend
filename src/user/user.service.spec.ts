import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 创建一个 mock 的 PrismaService
 * 把 prisma.user 上的方法都替换成 jest.fn()
 */
const mockPrismaService = () => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('UserService', () => {
  let service: UserService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useFactory: mockPrismaService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /* ---------- findByEmail ---------- */
  describe('findByEmail', () => {
    it('应该根据邮箱查找用户', async () => {
      const mockUser = { id: 1, email: 'test@example.com', userName: 'test' };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toEqual(mockUser);
    });

    it('用户不存在时应返回 null', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('none@example.com');
      expect(result).toBeNull();
    });
  });

  /* ---------- findById ---------- */
  describe('findById', () => {
    it('应该根据 ID 查找用户（不包含 password）', async () => {
      const mockUser = {
        id: 1,
        userName: 'test',
        email: 'test@example.com',
        avatarUrl: null,
        role: 'USER',
        menuPermissions: ['profile'],
        createdAt: new Date(),
      };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById(1);

      const callArgs = prisma.user.findUnique.mock.calls[0][0];
      expect(callArgs.where).toEqual({ id: 1 });
      // select 中不应包含 password
      expect(callArgs.select).not.toHaveProperty('password');
      expect(callArgs.select.id).toBe(true);
      expect(callArgs.select.email).toBe(true);
      expect(result).toEqual(mockUser);
    });
  });

  /* ---------- verifyPassword ---------- */
  describe('verifyPassword', () => {
    it('密码正确时应返回用户信息', async () => {
      const hashed = await bcrypt.hash('123456', 10);
      const mockUser = {
        id: 1,
        userName: 'test',
        email: 'test@example.com',
        password: hashed,
        role: 'USER',
        menuPermissions: ['profile'],
      };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.verifyPassword({
        email: 'test@example.com',
        password: '123456',
      });

      expect(result).toEqual({
        id: 1,
        userName: 'test',
        email: 'test@example.com',
        role: 'user',
        menuPermissions: ['profile'],
      });
    });

    it('密码错误时应返回 null', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        password: hashed,
      });

      const result = await service.verifyPassword({
        email: 'test@example.com',
        password: 'wrong',
      });

      expect(result).toBeNull();
    });

    it('用户不存在时应返回 null', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.verifyPassword({
        email: 'none@example.com',
        password: '123456',
      });

      expect(result).toBeNull();
    });
  });

  /* ---------- create ---------- */
  describe('create', () => {
    it('应该创建用户并返回（密码已哈希）', async () => {
      const input = {
        userName: 'newuser',
        email: 'new@example.com',
        password: '123456',
        code: '123456',
      };
      const mockCreated = {
        id: 2,
        userName: 'newuser',
        email: 'new@example.com',
        avatarUrl: null,
        role: 'USER',
        menuPermissions: ['profile'],
        createdAt: new Date(),
      };
      prisma.user.create.mockResolvedValue(mockCreated);

      const result = await service.create(input);

      // 验证调用了 prisma.user.create，且密码已被哈希（不是明文）
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userName: 'newuser',
            email: 'new@example.com',
            password: expect.not.stringMatching(/^123456$/), // 不应是明文
          }),
        }),
      );
      expect(result).toEqual(mockCreated);
    });
  });

  /* ---------- getList ---------- */
  describe('getList', () => {
    it('应该返回分页列表', async () => {
      const mockUsers = [
        { id: 1, userName: 'a', email: 'a@test.com' },
        { id: 2, userName: 'b', email: 'b@test.com' },
      ];
      prisma.user.findMany.mockResolvedValue(mockUsers);
      prisma.user.count.mockResolvedValue(10);

      const result = await service.getList(1, 2);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 2 }),
      );
      expect(result).toEqual({
        users: mockUsers,
        total: 10,
        page: 1,
        pageSize: 2,
        totalPages: 5,
      });
    });
  });
});
