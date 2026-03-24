import { z } from 'zod';

export const createPostSchema = z.object({
  title: z
    .string({ error: '标题不能为空' })
    .min(1, '标题不能为空')
    .max(100, '标题最多 100 个字符'),
  content: z.string().optional(),
  published: z.boolean().optional().default(false),
});

export const updatePostSchema = z.object({
  title: z
    .string()
    .min(1, '标题不能为空')
    .max(100, '标题最多 100 个字符')
    .optional(),
  content: z.string().optional(),
  published: z.boolean().optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
