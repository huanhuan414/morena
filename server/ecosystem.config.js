module.exports = {
  apps: [{
    name: 'morena-api',
    script: 'npx',
    args: 'tsx src/preload-env.ts',
    interpreter: 'none',
    node_args: '--max-old-space-size=1024',  // 设置堆内存为1GB
    max_memory_restart: '1G',  // 内存超过1G自动重启
    env: {
      NODE_ENV: 'production'
    }
  }]
}