import { z } from 'zod';

export const registerSchema = z.object({
  userName: z
    .string({ error: '用户名不能为空' })
    .min(2, '用户名至少 2 个字符')
    .max(20, '用户名最多 20 个字符'),
  password: z
    .string({ error: '密码不能为空' })
    .min(6, '密码至少 6 个字符')
    .max(50, '密码最多 50 个字符'),
  email: z.string({ error: '邮箱不能为空' }).email('邮箱格式不正确'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string({ error: '邮箱不能为空' }).email('邮箱格式不正确'),
  password: z.string({ error: '密码不能为空' }).min(1, '密码不能为空'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const updateMeSchema = z.object({
  avatarUrl: z.string().url('头像 URL 格式不正确'),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
