import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostInput } from './schemas/post.schema';

@Injectable()
export class PostService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, input: CreatePostInput) {
    return this.prisma.post.create({
      data: {
        title: input.title,
        content: input.content,
        published: input.published ?? false,
        userId,
      },
      select: {
        id: true,
        title: true,
        content: true,
        published: true,
        createdAt: true,
      },
    });
  }

  async getList(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          content: true,
          published: true,
          createdAt: true,
          updatedAt: true,
          userId: true,
          user: { select: { id: true, userName: true } },
        },
      }),
      this.prisma.post.count(),
    ]);
    return {
      posts,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findById(postId: number) {
    return this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        content: true,
        published: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        user: { select: { id: true, userName: true } },
      },
    });
  }

  async delete(
    postId: number,
    userId: number,
  ): Promise<'not_found' | 'forbidden' | 'ok'> {
    const deleted = await this.prisma.post.deleteMany({
      where: { id: postId, userId },
    });
    if (deleted.count > 0) return 'ok';
    // 区分「不存在」和「无权限」
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });
    return post ? 'forbidden' : 'not_found';
  }

  async update(
    postId: number,
    userId: number,
    input: Partial<CreatePostInput>,
  ): Promise<'not_found' | 'forbidden' | object> {
    const updated = await this.prisma.post.updateMany({
      where: { id: postId, userId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.content !== undefined && { content: input.content }),
        ...(input.published !== undefined && { published: input.published }),
      },
    });
    if (updated.count > 0) {
      return this.prisma.post.findUnique({
        where: { id: postId },
        select: {
          id: true,
          title: true,
          content: true,
          published: true,
          createdAt: true,
          updatedAt: true,
        },
      }) as Promise<object>;
    }
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });
    return post ? 'forbidden' : 'not_found';
  }
}
