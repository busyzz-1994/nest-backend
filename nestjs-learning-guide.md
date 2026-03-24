# NestJS 详细学习路线

> 目标：快速上手 + 覆盖核心知识点，适合有 Express 基础的开发者。

---

## 一、学习路线总览

```
阶段1：基础入门（1-2天）
  ↓
阶段2：核心概念（3-5天）
  ↓
阶段3：数据库与ORM（2-3天）
  ↓
阶段4：认证与授权（1-2天）
  ↓
阶段5：高级特性（3-5天）
  ↓
阶段6：测试与部署（2-3天）
  ↓
阶段7：实战项目（持续）
```

---

## 二、各阶段详细内容

### 阶段 1：基础入门（1-2 天）

#### 1.1 环境搭建

```bash
npm i -g @nestjs/cli
nest new my-project
cd my-project && npm run start:dev
```

#### 1.2 项目结构认知

```
src/
├── app.module.ts        # 根模块
├── app.controller.ts    # 控制器
├── app.service.ts       # 服务
├── app.controller.spec.ts # 测试
└── main.ts              # 入口文件（创建应用实例）
```

#### 1.3 必须理解的三个概念

| 概念                   | 职责                     | 装饰器                                  |
| ---------------------- | ------------------------ | --------------------------------------- |
| **Module**             | 组织代码，声明依赖关系   | `@Module()`                             |
| **Controller**         | 处理 HTTP 请求，路由分发 | `@Controller()`, `@Get()`, `@Post()` 等 |
| **Service (Provider)** | 业务逻辑，数据访问       | `@Injectable()`                         |

#### 1.4 第一个 CRUD

```typescript
// cats.controller.ts
@Controller("cats")
export class CatsController {
  constructor(private readonly catsService: CatsService) {}

  @Get()
  findAll(): string {
    return this.catsService.findAll();
  }

  @Post()
  create(@Body() createCatDto: CreateCatDto) {
    return this.catsService.create(createCatDto);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.catsService.findOne(+id);
  }
}
```

---

### 阶段 2：核心概念（3-5 天）⭐ 重中之重

#### 2.1 依赖注入（DI）—— NestJS 的灵魂

```typescript
// NestJS 通过构造函数自动注入依赖
@Injectable()
export class CatsService {
  constructor(private readonly prisma: PrismaService) {}
}

// 自定义 Provider
const providers = [
  { provide: "API_KEY", useValue: "my-api-key" }, // 值提供者
  { provide: CatsService, useClass: MockCatsService }, // 类提供者
  { provide: "CONFIG", useFactory: () => loadConfig() }, // 工厂提供者
  { provide: LoggerService, useExisting: ConsoleLogger }, // 别名提供者
];
```

**重点掌握：**

- 构造函数注入 vs `@Inject()` 装饰器
- Provider 的作用域：`DEFAULT`（单例）、`REQUEST`、`TRANSIENT`
- 循环依赖的处理：`forwardRef()`

#### 2.2 模块系统

```typescript
@Module({
  imports: [DatabaseModule], // 导入其他模块
  controllers: [CatsController], // 注册控制器
  providers: [CatsService], // 注册服务
  exports: [CatsService], // 导出给其他模块使用
})
export class CatsModule {}
```

**重点掌握：**

- 功能模块（Feature Module）
- 共享模块（Shared Module）
- 全局模块（`@Global()`）
- 动态模块（`forRoot()` / `forRootAsync()` 模式）

```typescript
// 动态模块示例
@Module({})
export class DatabaseModule {
  static forRoot(options: DbOptions): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        { provide: "DB_OPTIONS", useValue: options },
        DatabaseService,
      ],
      exports: [DatabaseService],
    };
  }
}
```

#### 2.3 中间件（Middleware）

```typescript
// 函数式中间件
export function logger(req: Request, res: Response, next: NextFunction) {
  console.log(`${req.method} ${req.url}`);
  next();
}

// 类中间件
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(`${req.method} ${req.url}`);
    next();
  }
}

// 注册中间件
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes("cats");
  }
}
```

#### 2.4 管道（Pipes）—— 数据验证与转换

```typescript
// 内置管道
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {}

// 全局验证管道（最常用）
// main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,          // 自动剥离非 DTO 属性
  forbidNonWhitelisted: true,
  transform: true,          // 自动类型转换
}));

// 搭配 class-validator + class-transformer
export class CreateCatDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @Min(0)
  age: number;

  @IsOptional()
  @IsString()
  breed?: string;
}
```

#### 2.5 守卫（Guards）—— 权限控制

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException();

    const payload = this.jwtService.verify(token);
    request.user = payload;
    return true;
  }
}

// 使用
@UseGuards(AuthGuard)
@Get('profile')
getProfile(@Req() req) {
  return req.user;
}
```

#### 2.6 拦截器（Interceptors）

```typescript
// 响应转换拦截器
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({
        code: 200,
        message: "success",
        data,
      })),
    );
  }
}

// 日志拦截器
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    return next
      .handle()
      .pipe(tap(() => console.log(`耗时: ${Date.now() - now}ms`)));
  }
}
```

#### 2.7 异常过滤器（Exception Filters）

```typescript
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    response.status(status).json({
      code: status,
      message: exception.message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

#### 2.8 请求生命周期（执行顺序）⭐

```
客户端请求
  → Middleware（中间件）
    → Guard（守卫）
      → Interceptor（拦截器 - 前）
        → Pipe（管道 - 参数验证/转换）
          → Controller（控制器方法）
            → Service（业务逻辑）
          → Controller 返回
        → Interceptor（拦截器 - 后）
      → Exception Filter（异常过滤器，如有异常）
    → 响应返回客户端
```

---

### 阶段 3：数据库与 ORM（2-3 天）

#### 3.1 Prisma 集成（推荐，你已在用）

```typescript
// prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}

// prisma.module.ts
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

#### 3.2 TypeORM 集成（了解即可）

```typescript
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "postgres",
      host: "localhost",
      port: 5432,
      entities: [User, Post],
      synchronize: true, // 仅开发环境
    }),
  ],
})
export class AppModule {}
```

#### 3.3 数据库相关要点

- 事务处理（Prisma `$transaction`）
- 数据迁移流程
- 软删除策略
- 分页查询封装

---

### 阶段 4：认证与授权（1-2 天）

#### 4.1 Passport + JWT

```bash
npm i @nestjs/passport @nestjs/jwt passport passport-jwt passport-local
```

```typescript
// auth.module.ts
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: "7d" },
    }),
    PassportModule,
  ],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  controllers: [AuthController],
})
export class AuthModule {}

// jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  validate(payload: { sub: number; email: string }) {
    return { userId: payload.sub, email: payload.email };
  }
}
```

#### 4.2 RBAC 角色权限

```typescript
// roles.decorator.ts
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!roles) return true;
    const { user } = context.switchToHttp().getRequest();
    return roles.includes(user.role);
  }
}

// 使用
@Roles('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Delete(':id')
remove(@Param('id') id: string) {}
```

---

### 阶段 5：高级特性（3-5 天）

#### 5.1 配置管理

```typescript
// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        PORT: Joi.number().default(3000),
      }),
    }),
  ],
})
export class AppModule {}

// 使用
constructor(private configService: ConfigService) {
  const port = this.configService.get<number>('PORT');
}
```

#### 5.2 Swagger 文档

```typescript
// main.ts
const config = new DocumentBuilder()
  .setTitle('API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);

// controller 中
@ApiTags('users')
@ApiOperation({ summary: '获取用户列表' })
@ApiResponse({ status: 200, type: [UserEntity] })
@Get()
findAll() {}
```

#### 5.3 文件上传

```typescript
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
uploadFile(@UploadedFile() file: Express.Multer.File) {
  return { filename: file.originalname, size: file.size };
}
```

#### 5.4 WebSocket

```typescript
@WebSocketGateway({ cors: true })
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage("message")
  handleMessage(@MessageBody() data: string): string {
    this.server.emit("message", data);
    return data;
  }
}
```

#### 5.5 任务调度（Cron）

```typescript
@Injectable()
export class TaskService {
  @Cron("0 0 * * *") // 每天午夜
  handleCron() {
    console.log("执行定时任务");
  }

  @Interval(60000) // 每60秒
  handleInterval() {
    console.log("执行周期任务");
  }
}
```

#### 5.6 队列（Bull）

```typescript
// 生产者
@Injectable()
export class EmailService {
  constructor(@InjectQueue("email") private emailQueue: Queue) {}

  async sendEmail(data: EmailDto) {
    await this.emailQueue.add("send", data);
  }
}

// 消费者
@Processor("email")
export class EmailProcessor {
  @Process("send")
  async handleSend(job: Job<EmailDto>) {
    await sendMail(job.data);
  }
}
```

#### 5.7 缓存

```typescript
@Module({
  imports: [
    CacheModule.register({
      store: redisStore,
      host: 'localhost',
      port: 6379,
      ttl: 60,
    }),
  ],
})

// 使用装饰器缓存
@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
@Get()
findAll() {}
```

#### 5.8 微服务（了解）

```typescript
// 支持多种传输层
const app = await NestFactory.createMicroservice(AppModule, {
  transport: Transport.TCP, // TCP
  // transport: Transport.REDIS,  // Redis
  // transport: Transport.KAFKA,  // Kafka
  // transport: Transport.GRPC,   // gRPC
});
```

---

### 阶段 6：测试与部署（2-3 天）

#### 6.1 单元测试

```typescript
describe("CatsService", () => {
  let service: CatsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CatsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(CatsService);
  });

  it("should return all cats", async () => {
    jest.spyOn(prisma.cat, "findMany").mockResolvedValue([]);
    expect(await service.findAll()).toEqual([]);
  });
});
```

#### 6.2 E2E 测试

```typescript
describe("CatsController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it("/cats (GET)", () => {
    return request(app.getHttpServer()).get("/cats").expect(200);
  });
});
```

#### 6.3 部署

- **Docker** 部署（推荐）
- PM2 进程管理
- Vercel / Railway / Fly.io 等 Serverless 平台
- CI/CD：GitHub Actions

---

### 阶段 7：实战项目建议

| 项目             | 涉及知识点                        |
| ---------------- | --------------------------------- |
| RESTful Blog API | CRUD、认证、分页、Prisma、Swagger |
| 实时聊天应用     | WebSocket、Guard、Gateway         |
| 文件管理系统     | 上传/下载、R2/S3、流处理          |
| 电商后台         | RBAC、队列、缓存、事务            |

---

## 三、NestJS vs Express 对比

### 3.1 总体对比

| 维度         | Express               | NestJS                                      |
| ------------ | --------------------- | ------------------------------------------- |
| **定位**     | 轻量级 HTTP 框架      | 企业级全功能框架                            |
| **架构**     | 无约束，自由组织      | 模块化 + 依赖注入，强约束                   |
| **语言**     | JavaScript（可选 TS） | TypeScript 优先（深度集成）                 |
| **学习曲线** | 低，几小时上手        | 中高，需理解 DI、装饰器、模块               |
| **底层引擎** | 自身                  | 默认基于 Express，可切换 Fastify            |
| **设计模式** | 无特定模式            | 借鉴 Angular：Module + Controller + Service |

### 3.2 代码对比

#### 路由定义

```typescript
// ===== Express =====
const router = express.Router();
router.get("/users", getUsers);
router.post("/users", createUser);
router.get("/users/:id", getUser);
app.use("/api", router);

// ===== NestJS =====
@Controller("users")
export class UsersController {
  @Get()
  getUsers() {}

  @Post()
  createUser(@Body() dto: CreateUserDto) {}

  @Get(":id")
  getUser(@Param("id", ParseIntPipe) id: number) {}
}
```

#### 中间件

```typescript
// ===== Express =====
app.use(express.json());
app.use(cookieParser());
app.use("/api", authMiddleware);

// ===== NestJS =====
// main.ts 或 Module.configure()
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes("*");
  }
}
// 同时支持全局：app.use(cookieParser())
```

#### 数据验证

```typescript
// ===== Express（手动 Zod）=====
export const createUser = async (req, res, next) => {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ code: 400, message: '参数错误' });
  }
  // ... 业务逻辑
};

// ===== NestJS（内置 ValidationPipe + class-validator）=====
@Post()
createUser(@Body() dto: CreateUserDto) {
  // 自动验证，失败抛 400，无需手动处理
  return this.usersService.create(dto);
}
```

#### 错误处理

```typescript
// ===== Express =====
// 需要手动将错误传给 next()，统一在最后的 errorHandler 处理
app.use((err, req, res, next) => {
  res.status(500).json({ code: 500, message: "服务器内部错误" });
});

// ===== NestJS =====
// 内置 HttpException 体系 + Exception Filter
throw new NotFoundException("用户不存在");
throw new BadRequestException("参数错误");
// 自定义过滤器可全局注册，自动捕获
```

#### 依赖管理

```typescript
// ===== Express =====
// 手动导入，无依赖注入
import { prisma } from "../db";
export const getUsers = async () => {
  return prisma.user.findMany();
};

// ===== NestJS =====
// IoC 容器自动管理依赖
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {} // 自动注入
  getUsers() {
    return this.prisma.user.findMany();
  }
}
```

### 3.3 功能对比

| 功能          | Express                       | NestJS                                   |
| ------------- | ----------------------------- | ---------------------------------------- |
| **路由**      | 手动注册 `router.get()`       | 装饰器声明 `@Get()`                      |
| **验证**      | 第三方库（Zod/Joi），手动调用 | 内置 `ValidationPipe` + 装饰器，自动验证 |
| **DI**        | ❌ 无                         | ✅ 完整的 IoC 容器                       |
| **模块化**    | 自行组织                      | 强制模块系统 `@Module()`                 |
| **守卫/权限** | 中间件实现                    | 专用 `Guard` 层                          |
| **拦截器**    | 无原生支持                    | `Interceptor`（基于 RxJS）               |
| **Swagger**   | 需手动配置 swagger-jsdoc      | `@nestjs/swagger` 装饰器自动生成         |
| **WebSocket** | 需 socket.io 自行集成         | `@WebSocketGateway` 原生支持             |
| **微服务**    | 无原生支持                    | 内置多种传输层支持                       |
| **定时任务**  | 需 node-cron 等               | `@nestjs/schedule` 装饰器                |
| **队列**      | 需 bull 自行集成              | `@nestjs/bull` 官方集成                  |
| **测试**      | 自行搭建测试环境              | 内置 `@nestjs/testing` 模块              |
| **CLI**       | express-generator（简单）     | `@nestjs/cli`（功能丰富）                |

### 3.4 如何选择？

| 场景                             | 推荐                                              |
| -------------------------------- | ------------------------------------------------- |
| 小型项目 / 快速原型 / API 代理   | **Express** — 轻快灵活                            |
| 中大型项目 / 团队协作            | **NestJS** — 强约束保证代码一致性                 |
| 微服务架构                       | **NestJS** — 内置微服务支持                       |
| 需要 WebSocket / 队列 / 定时任务 | **NestJS** — 官方集成开箱即用                     |
| 追求极致性能                     | Express 或 NestJS + **Fastify** 适配器            |
| 已有大量 Express 中间件生态      | **Express**，或 NestJS（底层兼容 Express 中间件） |

### 3.5 迁移建议（Express → NestJS）

基于你当前的 Express 项目结构，迁移映射关系：

```
Express                          →  NestJS
─────────────────────────────────────────────────
src/controllers/*.ts             →  *.controller.ts（加装饰器）
src/services/*.ts                →  *.service.ts（加 @Injectable）
src/schemas/*.ts (Zod)           →  *.dto.ts（class-validator 或继续用 Zod）
src/routes/*.ts                  →  装饰器路由（无需单独路由文件）
src/middlewares/auth.ts          →  auth.guard.ts（Guard）
src/middlewares/errorHandler.ts  →  http-exception.filter.ts（Filter）
src/db.ts (Prisma)               →  prisma.module.ts + prisma.service.ts
src/app.ts                       →  app.module.ts
```

> **提示**：NestJS 底层默认就是 Express，你现有的 Express 中间件可以直接在 NestJS 中使用，迁移成本可控。

---

## 四、推荐学习资源

| 资源               | 链接                                              |
| ------------------ | ------------------------------------------------- |
| 官方文档（最权威） | https://docs.nestjs.com                           |
| NestJS 中文文档    | https://docs.nestjs.cn                            |
| 官方示例仓库       | https://github.com/nestjs/nest/tree/master/sample |
| NestJS Prisma 教程 | https://docs.nestjs.com/recipes/prisma            |
| Awesome NestJS     | https://github.com/nestjs/awesome-nestjs          |

---

## 五、速查：装饰器大全

```typescript
// 模块
@Module()  @Global()

// 控制器
@Controller()  @Get()  @Post()  @Put()  @Patch()  @Delete()
@Param()  @Query()  @Body()  @Headers()  @Req()  @Res()

// 服务
@Injectable()  @Inject()  @Optional()

// 管道/守卫/拦截器/过滤器
@UsePipes()  @UseGuards()  @UseInterceptors()  @UseFilters()

// 元数据
@SetMetadata()

// Swagger
@ApiTags()  @ApiOperation()  @ApiResponse()  @ApiProperty()  @ApiBearerAuth()
```
