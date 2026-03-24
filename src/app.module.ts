import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { R2Module } from './r2/r2.module';
import { UserModule } from './user/user.module';
import { PostModule } from './post/post.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    R2Module,
    UserModule,
    PostModule,
  ],
})
export class AppModule {}
