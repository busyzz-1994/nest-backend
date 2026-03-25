import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginInput, RegisterInput } from './schemas/user.schema';

/** 公开字段选择器，排除 password */
const userSelect = {
  id: true,
  userName: true,
  email: true,
  avatarUrl: true,
  createdAt: true,
} as const;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
  }

  async verifyPassword(input: LoginInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user) return null;

    const isMatch = await bcrypt.compare(input.password, user.password);
    if (!isMatch) return null;

    return { id: user.id, userName: user.userName, email: user.email };
  }

  async create(input: RegisterInput) {
    const hashedPassword = await bcrypt.hash(input.password, 10);
    return this.prisma.user.create({
      data: {
        userName: input.userName,
        password: hashedPassword,
        email: input.email,
      },
      select: userSelect,
    });
  }

  async updateAvatarUrl(id: number, avatarUrl: string) {
    return this.prisma.user.update({
      where: { id },
      data: { avatarUrl },
      select: userSelect,
    });
  }

  /** 更新头像（事务内返回旧 URL，避免并发问题） */
  async updateAvatarWithOldUrl(userId: number, newAvatarUrl: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. 读取旧头像（行锁，防止并发更新）
      const oldUser = await tx.user.findUnique({
        where: { id: userId },
        select: { avatarUrl: true },
      });

      // 2. 更新为新头像
      const updated = await tx.user.update({
        where: { id: userId },
        data: { avatarUrl: newAvatarUrl },
        select: userSelect,
      });

      // 3. 返回新用户数据 + 旧 URL（供外部删除文件）
      return {
        user: updated,
        oldAvatarUrl: oldUser?.avatarUrl || null,
      };
    });
  }

  async getList(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: pageSize,
        select: userSelect,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
    return {
      users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
