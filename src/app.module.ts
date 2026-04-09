import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { R2Module } from './r2/r2.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';
import { UserModule } from './user/user.module';
import { PostModule } from './post/post.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    PrismaModule,
    R2Module,
    RedisModule,
    MailModule,
    UserModule,
    PostModule,
  ],
})
export class AppModule {}
