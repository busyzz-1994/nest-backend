import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.POSTGRES_PRISMA_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 开始初始化数据库...');
  console.log(`📍 当前环境: ${process.env.NODE_ENV || 'development'}`);

  // ========== 所有环境都需要的数据 ==========

  // 创建管理员账户
  const adminEmail = process.env.ADMIN_EMAIL || '';
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const admin = await prisma.user.create({
      data: {
        userName: 'Admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'ADMIN',
        menuPermissions: [], // 管理员不需要这个字段
      },
    });
    console.log('✅ 管理员账户创建成功:', {
      email: admin.email,
      password: '请在生产环境修改默认密码',
    });
  } else {
    console.log('ℹ️  管理员账户已存在');
  }
}

main()
  .catch((e) => {
    console.error('❌ 初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
