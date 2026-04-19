#!/bin/bash

# 加载 .env 文件
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
fi

if [ -f server/.env ]; then
  export $(cat server/.env | grep -v '^#' | grep -v '^$' | xargs)
fi

# 启动开发服务器
PUPPETEER_SKIP_DOWNLOAD=true pnpm exec concurrently \
  --kill-others --kill-signal SIGKILL \
  -n web,server \
  -c blue,green \
  "pnpm dev:web" \
  "pnpm dev:server"
