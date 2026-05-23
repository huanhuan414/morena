#!/usr/bin/env bash

REMOTE_HOST="${REMOTE_HOST:-YOUR_REMOTE_HOST}"
REMOTE_USER="${REMOTE_USER:-YOUR_REMOTE_USER}"
SSH_PORT="${SSH_PORT:-22}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-16033}"
DB_NAME="${DB_NAME:-mrl}"
DB_USER="${DB_USER:-mrl}"
DB_PASS="${DB_PASS:-YOUR_MYSQL_PASSWORD}"

echo "查询手机号 18708510957 的用户信息和收益数据..."
echo "=================================================="

# 通过 SSH 执行查询
ssh -p "${SSH_PORT}" "${REMOTE_USER}@${REMOTE_HOST}" "mysql -h '${DB_HOST}' -P '${DB_PORT}' -u '${DB_USER}' -p'${DB_PASS}' '${DB_NAME}' <<'SQL'
-- 1. 查询用户基本信息
SELECT 
  id, 
  phone, 
  nickname, 
  balance, 
  total_earnings 
FROM users 
WHERE phone = '18708510957';

-- 2. 查询该用户的所有订单收益明细
SELECT 
  e.id,
  e.order_id,
  e.avatar_id,
  e.amount,
  e.type,
  e.status,
  e.description,
  e.created_at,
  o.title as order_title
FROM earnings e
LEFT JOIN orders o ON e.order_id = o.id
WHERE e.user_id IN (SELECT id FROM users WHERE phone = '18708510957')
  AND e.type = 'order_reward'
ORDER BY e.created_at DESC;

-- 3. 统计该用户的收益汇总
SELECT 
  COUNT(*) as total_earnings_count,
  SUM(CASE WHEN status IN ('settled', 'completed') THEN amount ELSE 0 END) as total_earned,
  SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_earnings,
  COUNT(CASE WHEN type = 'order_reward' THEN 1 END) as order_reward_count,
  SUM(CASE WHEN type = 'order_reward' AND status IN ('settled', 'completed') THEN amount ELSE 0 END) as order_reward_total
FROM earnings
WHERE user_id IN (SELECT id FROM users WHERE phone = '18708510957');
SQL
"

echo "=================================================="
echo "查询完成！"
