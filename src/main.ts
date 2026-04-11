import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionFilter } from './common/filters/all-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Express } from 'express';

function configureApp(app: NestExpressApplication): void {
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );
}

let cachedApp: Express;

export async function createApp(): Promise<Express> {
  if (cachedApp) return cachedApp;

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  await app.init();
  cachedApp = app.getHttpAdapter().getInstance() as Express;
  return cachedApp;
}

// Vercel 以外的环境（本地开发 & VPS 生产）直接启动
// if (process.env.VERCEL !== '1') {
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`Server running at http://localhost:${port}`);
}
bootstrap();
// }
