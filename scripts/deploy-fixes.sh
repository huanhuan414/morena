#!/bin/bash
# ============================================================
# 部署脚本：禁用 Cron + 修复 Redis Key + 修复并发超卖
# ============================================================
# 用法：
#   1. 本地执行：bash scripts/deploy-fixes.sh <服务器IP> [SSH端口] [SSH用户]
#   2. 如果没有 SSH 密钥，会提示输入密码
# 
# 示例：
#   bash scripts/deploy-fixes.sh 47.100.50.200
#   bash scripts/deploy-fixes.sh 47.100.50.200 22 root
# ============================================================

set -e

SERVER_IP="${1:?用法: $0 <服务器IP> [SSH端口] [SSH用户]}"
SSH_PORT="${2:-22}"
SSH_USER="${3:-root}"
REMOTE_DIR="/opt/ai-avatar-server"
SSH_CMD="ssh -p ${SSH_PORT} ${SSH_USER}@${SERVER_IP}"
SCP_CMD="scp -P ${SSH_PORT}"

echo "============================================"
echo " 部署修复到远程服务器"
echo " 目标: ${SSH_USER}@${SERVER_IP}:${REMOTE_DIR}"
echo " 修复内容:"
echo "   1. 禁用 order-timeout Cron（改为手动触发）"
echo "   2. 修复 Redis Key 前缀不一致"
echo "   3. 修复并发超卖（Lua原子INCR+幂等回滚）"
echo "============================================"

# 1. 检查本地 dist 是否存在
if [ ! -f "/workspace/projects/server/dist/src/main.js" ]; then
  echo "❌ dist 不存在，先构建..."
  cd /workspace/projects/server && pnpm build
fi

echo ""
echo "✅ dist 已就绪: /workspace/projects/server/dist/"
echo ""

# 2. 上传 dist 文件到远程服务器
echo "📤 上传 dist 文件到远程服务器..."
${SCP_CMD} -r /workspace/projects/server/dist/src ${SSH_USER}@${SERVER_IP}:${REMOTE_DIR}/dist/

# 3. 在远程服务器上执行操作
echo ""
echo "🔧 在远程服务器上执行修复操作..."

${SSH_CMD} << 'REMOTE_SCRIPT'
set -e

cd /opt/ai-avatar-server

echo "1️⃣ 重启后端服务（PM2）..."
if command -v pm2 &> /dev/null; then
  pm2 restart ai-avatar-api 2>/dev/null || pm2 restart all 2>/dev/null || echo "PM2 进程不存在，跳过重启"
elif [ -f "ecosystem.config.js" ]; then
  pm2 start ecosystem.config.js --update-env
else
  echo "⚠️ 未找到 PM2，请手动重启: node dist/src/main.js"
fi

echo ""
echo "2️⃣ 清理 Redis 残留错误计数器..."

# 获取 Redis 连接信息
REDIS_HOST=$(grep REDIS_HOST .env 2>/dev/null | cut -d= -f2 || echo "127.0.0.1")
REDIS_PORT=$(grep REDIS_PORT .env 2>/dev/null | cut -d= -f2 || echo "6379")
REDIS_PASSWORD=$(grep REDIS_PASSWORD .env 2>/dev/null | cut -d= -f2 || echo "")
REDIS_DB=$(grep REDIS_DB .env 2>/dev/null | cut -d= -f2 || echo "0")

REDIS_CLI="redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} -n ${REDIS_DB}"
if [ -n "${REDIS_PASSWORD}" ]; then
  REDIS_CLI="${REDIS_CLI} -a ${REDIS_PASSWORD}"
fi

echo "   扫描残留 key（order:*:accepted 格式，正确的应为 order:accept:count:*）..."

# 查找错误的 key
WRONG_KEYS=$(${REDIS_CLI} KEYS "order:*:accepted" 2>/dev/null | tr -d '"')

if [ -n "${WRONG_KEYS}" ]; then
  WRONG_COUNT=$(echo "${WRONG_KEYS}" | wc -l)
  echo "   发现 ${WRONG_COUNT} 个残留 key:"
  echo "${WRONG_KEYS}" | while read key; do
    val=$(${REDIS_CLI} GET "${key}" 2>/dev/null)
    echo "     ${key} = ${val}"
  done
  
  # 删除残留 key
  echo "${WRONG_KEYS}" | while read key; do
    ${REDIS_CLI} DEL "${key}" 2>/dev/null
  done
  echo "   ✅ 已清理 ${WRONG_COUNT} 个残留 key"
else
  echo "   ✅ 无残留 key"
fi

# 修正负值计数器
echo ""
echo "   检查负值计数器..."
CORRECT_KEYS=$(${REDIS_CLI} KEYS "order:accept:count:*" 2>/dev/null | tr -d '"')
NEGATIVE_COUNT=0

if [ -n "${CORRECT_KEYS}" ]; then
  echo "${CORRECT_KEYS}" | while read key; do
    val=$(${REDIS_CLI} GET "${key}" 2>/dev/null | tr -d '"')
    if [ "${val}" -lt 0 ] 2>/dev/null; then
      ${REDIS_CLI} SET "${key}" "0" EX 604800 2>/dev/null
      echo "     修正: ${key} ${val} → 0"
      NEGATIVE_COUNT=$((NEGATIVE_COUNT + 1))
    fi
  done
fi

if [ "${NEGATIVE_COUNT}" -eq 0 ]; then
  echo "   ✅ 无负值计数器"
fi

echo ""
echo "============================================"
echo " 部署完成！"
echo "============================================"
echo ""
echo "验证步骤："
echo "  1. 检查服务状态: ${REDIS_CLI} ping"
echo "  2. 检查 PM2: pm2 status"
echo "  3. 检查日志: pm2 logs ai-avatar-api --lines 30"
echo "  4. 手动触发超时检查: curl -X POST http://localhost:3000/api/order-dispatch/timeout/check"
echo ""

REMOTE_SCRIPT

echo ""
echo "✅ 部署完成！"
