import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { PostService } from './post.service';
import { createPostSchema, updatePostSchema } from './schemas/post.schema';
import type { CreatePostInput, UpdatePostInput } from './schemas/post.schema';

const postIdPipe = new ParseIntPipe({
  exceptionFactory: () =>
    new HttpException(
      { code: 400, message: '无效的文章 ID' },
      HttpStatus.BAD_REQUEST,
    ),
});

@Controller('posts')
@UseGuards(AuthGuard)
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createPostSchema)) body: CreatePostInput,
  ) {
    const post = await this.postService.create(user.userId, body);
    return { code: 201, message: '发布成功', data: post };
  }

  @Get()
  @HttpCode(200)
  async getList(
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(pageSizeStr || '10', 10) || 10),
    );
    const data = await this.postService.getList(page, pageSize);
    return { code: 200, message: 'ok', data };
  }

  @Get(':id')
  async findOne(@Param('id', postIdPipe) id: number) {
    const post = await this.postService.findById(id);
    if (!post) {
      throw new HttpException(
        { code: 404, message: '文章不存在' },
        HttpStatus.NOT_FOUND,
      );
    }
    return { code: 200, message: 'ok', data: post };
  }

  @Patch(':id')
  async update(
    @Param('id', postIdPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(updatePostSchema)) body: UpdatePostInput,
  ) {
    const result = await this.postService.update(id, user.userId, body);
    if (result === 'not_found') {
      throw new HttpException(
        { code: 404, message: '文章不存在' },
        HttpStatus.NOT_FOUND,
      );
    }
    if (result === 'forbidden') {
      throw new HttpException(
        { code: 403, message: '无权操作' },
        HttpStatus.FORBIDDEN,
      );
    }
    return { code: 200, message: '更新成功', data: result };
  }

  @Delete(':id')
  async remove(
    @Param('id', postIdPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.postService.delete(id, user.userId);
    if (result === 'not_found') {
      throw new HttpException(
        { code: 404, message: '文章不存在' },
        HttpStatus.NOT_FOUND,
      );
    }
    if (result === 'forbidden') {
      throw new HttpException(
        { code: 403, message: '无权操作' },
        HttpStatus.FORBIDDEN,
      );
    }
    return { code: 200, message: '删除成功' };
  }
}
