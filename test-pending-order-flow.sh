#!/bin/bash

# 待接订单接受流程测试脚本

set -e

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
USER_ID="5fb8e360-c034-46f6-9b2d-8b9b4627fe92"
AVATAR_ID="082ae641-32bc-4614-9f91-e2f3c24986fb"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}待接订单接受流程测试${NC}"
echo -e "${GREEN}========================================${NC}"

# 步骤1：创建测试订单
echo -e "\n${YELLOW}步骤1：创建测试订单${NC}"
ORDER_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/orders" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_ID" \
  -d '{
    "title": "测试订单 - 接受流程",
    "description": "这是一个测试订单，用于验证接受订单流程",
    "budget": 100,
    "content_type": "图文",
    "platforms": ["xiaohongshu"],
    "target_audience": "年轻女性",
    "deadline": "'$(date -u -d '+7 days' '+%Y-%m-%dT%H:%M:%SZ')'"
  }')

echo "订单创建响应: $ORDER_RESPONSE"

ORDER_ID=$(echo $ORDER_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$ORDER_ID" ]; then
  echo -e "${RED}订单创建失败${NC}"
  exit 1
fi

echo -e "${GREEN}✓ 订单创建成功，ID: $ORDER_ID${NC}"

# 步骤2：手动创建待接请求
echo -e "\n${YELLOW}步骤2：创建待接请求${NC}"
REQUEST_UUID=$(cat /proc/sys/kernel/random/uuid || python3 -c "import uuid; print(uuid.uuid4())")

psql "$DATABASE_URL" -c "INSERT INTO order_dispatch_requests (id, order_id, avatar_id, user_id, status, score, match_reasons, expires_at, created_at, updated_at)
VALUES ('$REQUEST_UUID', '$ORDER_ID', '$AVATAR_ID', '$USER_ID', 'pending', 95, '测试匹配', NOW() + INTERVAL '24 hours', NOW(), NOW());"

echo -e "${GREEN}✓ 待接请求创建成功，ID: $REQUEST_UUID${NC}"

# 步骤3：获取待接订单列表
echo -e "\n${YELLOW}步骤3：获取待接订单列表${NC}"
PENDING_RESPONSE=$(curl -s -X GET "http://localhost:3000/api/order-dispatch/pending-requests" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_ID")

echo "待接订单列表: $PENDING_RESPONSE"

# 步骤4：接受订单
echo -e "\n${YELLOW}步骤4：接受订单${NC}"
ACCEPT_RESPONSE=$(curl -s -X PUT "http://localhost:3000/api/order-dispatch/request/$REQUEST_UUID/confirm" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_ID" \
  -d "{\"avatarId\": \"$AVATAR_ID\"}")

echo "接受订单响应: $ACCEPT_RESPONSE"

ACCEPT_CODE=$(echo $ACCEPT_RESPONSE | grep -o '"code":[0-9]*' | cut -d':' -f2)

if [ "$ACCEPT_CODE" != "200" ]; then
  echo -e "${RED}✗ 接受订单失败${NC}"
  exit 1
fi

echo -e "${GREEN}✓ 接受订单成功${NC}"

# 步骤5：等待几秒
echo -e "\n${YELLOW}等待5秒...${NC}"
sleep 5

# 步骤6：检查订单处理状态
echo -e "\n${YELLOW}步骤5：检查订单处理状态${NC}"
STATUS_RESPONSE=$(curl -s -X GET "http://localhost:3000/api/order-processing/status/$REQUEST_UUID")

echo "订单处理状态: $STATUS_RESPONSE"

STATUS=$(echo $STATUS_RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

echo -e "${GREEN}✓ 当前状态: $STATUS${NC}"

# 步骤7：查看后端日志
echo -e "\n${YELLOW}步骤6：查看后端日志${NC}"
echo "最近的相关日志："
tail -n 100 /tmp/coze-logs/dev.log 2>/dev/null | grep -E "订单分配|TaskQueue|OrderProcessing" | tail -10

# 步骤8：清理测试数据
echo -e "\n${YELLOW}步骤7：清理测试数据${NC}"
psql "$DATABASE_URL" -c "DELETE FROM order_dispatch_requests WHERE id = '$REQUEST_UUID';"
psql "$DATABASE_URL" -c "DELETE FROM orders WHERE id = '$ORDER_ID';"
echo -e "${GREEN}✓ 测试数据已清理${NC}"

# 总结
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}测试完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\n测试结果："
echo -e "订单ID: $ORDER_ID"
echo -e "请求ID: $REQUEST_UUID"
echo -e "当前状态: $STATUS"
echo -e "\n前端访问链接："
echo -e "待接订单页面: /#/pages/pending-order/index?requestId=$REQUEST_UUID"
echo -e "订单处理页面: /#/pages/order-processing/index?requestId=$REQUEST_UUID&avatarId=$AVATAR_ID&orderId=$ORDER_ID"
