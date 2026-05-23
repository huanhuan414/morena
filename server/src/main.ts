import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import * as express from 'express';
import { HttpStatusInterceptor } from '@/interceptors/http-status.interceptor';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { SuccessResponseInterceptor } from '@/interceptors/success-response.interceptor'
import { traceIdMiddleware } from '@/common/middlewares/trace-id.middleware'
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载 .env 文件 — 优先从 cwd（PM2 设定）查找，再从 __dirname 向上查找
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
]
let envLoaded = false
for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath })
  if (!result.error) {
    console.log('[main.ts] Successfully loaded .env file from:', envPath);
    envLoaded = true
    break
  }
}
if (!envLoaded) {
  console.warn('[main.ts] Warning: Failed to load .env file from any path');
}

function parsePort(): number {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('-p');
  if (portIndex !== -1 && args[portIndex + 1]) {
    const port = parseInt(args[portIndex + 1], 10);
    if (!isNaN(port) && port > 0 && port < 65536) {
      return port;
    }
  }
  return 3000;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // 🔴 修复：增加 HTTP 超时时间到 15 分钟，避免视频生成超时
    logger: ['error', 'warn', 'log'],
    rawBody: true
  });

  // 🔴 修复：设置 HTTP 服务器超时时间为 15 分钟
  const httpServer = app.getHttpServer();
  httpServer.setTimeout(15 * 60 * 1000); // 15 分钟
  httpServer.keepAliveTimeout = 15 * 60 * 1000; // 15 分钟
  httpServer.headersTimeout = 16 * 60 * 1000; // 16 分钟（略大于 keepAliveTimeout）

  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.use(traceIdMiddleware)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  // 微信支付V2回调使用XML格式，需要text/xml解析
  app.use(
    '/api/payment/wechat/notify',
    express.text({
      type: ['text/xml', 'application/xml', '*/xml'],
      limit: '1mb',
      verify: (req: any, _res: any, buf: Buffer) => {
        req.rawBody = buf;
      },
    }),
  );

  // 🔴 添加静态文件服务，用于本地存储的文件访问
  // 🔴 修复：确保路径指向项目根目录的 uploads 文件夹
  const projectRoot = process.cwd().includes('server') ? path.join(process.cwd(), '..') : process.cwd()
  app.use('/uploads', express.static(path.join(projectRoot, 'uploads')));

  // 全局拦截器：统一将 POST 请求的 201 状态码改为 200
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new HttpStatusInterceptor(), new SuccessResponseInterceptor());
  // 1. 开启优雅关闭 Hooks (关键!)
  app.enableShutdownHooks();

  // 2. 解析端口
  const port = parsePort();
  try {
    await app.listen(port);
    console.log(`Server running on http://localhost:${port}`);
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ 端口 ${port} 被占用! 请运行 'npx kill-port ${port}' 然后重试。`);
      process.exit(1);
    } else {
      throw err;
    }
  }
  console.log(`Application is running on: http://localhost:3000`);
}
bootstrap();
