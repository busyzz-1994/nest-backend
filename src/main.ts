import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionFilter } from './common/filters/all-exception.filter';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Express } from 'express';

let cachedApp: Express;

export async function createApp(): Promise<Express> {
  if (cachedApp) return cachedApp;

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionFilter());

  await app.init();
  cachedApp = app.getHttpAdapter().getInstance() as Express;
  return cachedApp;
}

// 本地开发 & 生产直接启动
if (process.env.NODE_ENV !== 'production') {
  async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new AllExceptionFilter());

    const port = process.env.PORT ?? 4000;
    await app.listen(port);
    console.log(`Server running at http://localhost:${port}`);
  }
  bootstrap();
}
