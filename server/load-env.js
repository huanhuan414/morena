const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 读取 .env 文件
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');

  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
      const [key, ...values] = trimmedLine.split('=');
      const value = values.join('=').trim();
      if (key && value) {
        process.env[key] = value;
      }
    }
  });

  console.log(`[load-env] Loaded ${lines.filter(l => l.trim() && !l.trim().startsWith('#')).length} variables from ${envPath}`);
} else {
  console.warn('[load-env] .env file not found:', envPath);
}

// 启动 NestJS，传递命令行参数
const args = process.argv.slice(2);

// 使用 npx 运行 nest
const child = spawn('npx', ['nest', ...args], {
  stdio: 'inherit',
  env: { ...process.env },
  shell: true
});

child.on('error', (err) => {
  console.error('[load-env] Failed to start nest:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
