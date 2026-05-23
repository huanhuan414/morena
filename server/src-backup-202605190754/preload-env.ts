// 确保在所有模块加载之前先加载 .env
// 这是必要的，因为 NestJS 的模块导入链会在 import 时就读取 process.env
import dotenv from 'dotenv';
import path from 'path';

const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server/.env'),
  path.resolve(__dirname, '../.env'),
];

for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    console.log('[preload-env] Successfully loaded .env from:', envPath, 'MYSQL_PORT:', process.env.MYSQL_PORT);
    break;
  }
}

// 然后再加载实际的 main.ts
import './main';
