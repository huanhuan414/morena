#!/bin/bash

# API 测试脚本
# 测试所有后端接口

BASE_URL="https://mrlweb.51webjs.com/api"
TEST_USER_ID="test_user_$(date +%s)"
TEST_PHONE="139$(date +%H%M%S | tail -c 8)"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 计数器
PASS=0
FAIL=0

# 测试函数
test_api() {
    local name="$1"
    local method="$2"
    local url="$3"
    local data="$4"
    local expected_code="$5"
    
    echo -n "[$method] $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_code" ] || [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}PASS${NC} (HTTP $http_code)"
        ((PASS++))
        return 0
    else
        echo -e "${RED}FAIL${NC} (HTTP $http_code)"
        echo "  Response: $body" | head -5
        ((FAIL++))
        return 1
    fi
}

# 测试函数 - 检查返回码
test_api_code() {
    local name="$1"
    local method="$2"
    local url="$3"
    local data="$4"
    local expected_code="$5"
    
    echo -n "[$method] $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    # 检查是否包含成功标志
    if echo "$body" | grep -q '"code":200' || echo "$body" | grep -q '"code":201' || echo "$body" | grep -q '"status":"success"' || [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}PASS${NC} (HTTP $http_code)"
        ((PASS++))
        return 0
    else
        echo -e "${RED}FAIL${NC} (HTTP $http_code)"
        echo "  Response: $body" | head -3
        ((FAIL++))
        return 1
    fi
}

echo "========================================"
echo "   后端 API 完整测试"
echo "========================================"
echo ""

# ========== 1. 健康检查 ==========
echo -e "${YELLOW}=== 1. 健康检查 ===${NC}"
test_api "Health Check" GET "$BASE_URL/health" "" "200"
echo ""

# ========== 2. 认证模块 ==========
echo -e "${YELLOW}=== 2. 认证模块 (Auth) ===${NC}"
test_api_code "发送验证码" POST "$BASE_URL/auth/send-code" '{"phone":"'$TEST_PHONE'"}' "200"
test_api_code "手机号登录" POST "$BASE_URL/auth/phone-login" '{"phone":"'$TEST_PHONE'","code":"123456"}' "200"
test_api_code "获取当前用户" GET "$BASE_URL/auth/me" "" "200"
echo ""

# ========== 3. 收益模块 ==========
echo -e "${YELLOW}=== 3. 收益模块 (Earnings) ===${NC}"
test_api_code "收益概览" GET "$BASE_URL/earnings/overview?userId=$TEST_USER_ID" "" "200"
test_api_code "收益列表" GET "$BASE_URL/earnings?userId=$TEST_USER_ID" "" "200"
test_api_code "收益排行榜" GET "$BASE_URL/earnings/leaderboard" "" "200"
test_api_code "申请提现" POST "$BASE_URL/earnings/withdraw" '{"userId":"'$TEST_USER_ID'","amount":100}' "200"
echo ""

# ========== 4. 社交模块 ==========
echo -e "${YELLOW}=== 4. 社交模块 (Social) ===${NC}"
test_api_code "总统计" GET "$BASE_URL/social/total-stats" "" "200"
test_api_code "今日统计" GET "$BASE_URL/social/today-stats" "" "200"
test_api_code "帖子列表" GET "$BASE_URL/social/posts" "" "200"
test_api_code "所有帖子" GET "$BASE_URL/social/all-posts" "" "200"
test_api_code "推荐帖子" GET "$BASE_URL/social/related-posts" "" "200"
echo ""

# ========== 5. 推荐模块 ==========
echo -e "${YELLOW}=== 5. 推荐模块 (Recommendation) ===${NC}"
test_api_code "推荐列表" GET "$BASE_URL/recommendation/list" "" "200"
test_api_code "获取推荐" POST "$BASE_URL/recommendation/recommendations" '{"userId":"'$TEST_USER_ID'"}' "200"
echo ""

# ========== 6. 用户模块 ==========
echo -e "${YELLOW}=== 6. 用户模块 (User) ===${NC}"
test_api_code "用户资料" GET "$BASE_URL/user/profile?userId=$TEST_USER_ID" "" "200"
test_api_code "用户统计" GET "$BASE_URL/user/stats?userId=$TEST_USER_ID" "" "200"
test_api_code "学习进度" GET "$BASE_URL/user/learning-progress?userId=$TEST_USER_ID" "" "200"
test_api_code "安全状态" GET "$BASE_URL/user/security-status?userId=$TEST_USER_ID" "" "200"
echo ""

# ========== 7. 订阅模块 ==========
echo -e "${YELLOW}=== 7. 订阅模块 (Subscription) ===${NC}"
test_api_code "订阅计划" GET "$BASE_URL/subscription/plans" "" "200"
test_api_code "用户订阅" GET "$BASE_URL/subscription/user?userId=$TEST_USER_ID" "" "200"
test_api_code "检查创建分身" GET "$BASE_URL/subscription/check/create-avatar?userId=$TEST_USER_ID" "" "200"
test_api_code "检查接单" GET "$BASE_URL/subscription/check/receive-orders/test?userId=$TEST_USER_ID" "" "200"
echo ""

# ========== 8. 通知模块 ==========
echo -e "${YELLOW}=== 8. 通知模块 (Notification) ===${NC}"
test_api_code "通知列表" GET "$BASE_URL/notifications?userId=$TEST_USER_ID" "" "200"
test_api_code "未读数量" GET "$BASE_URL/notifications/unread-count?userId=$TEST_USER_ID" "" "200"
test_api_code "通知设置" GET "$BASE_URL/notifications/settings?userId=$TEST_USER_ID" "" "200"
echo ""

# ========== 9. 分身模块 ==========
echo -e "${YELLOW}=== 9. 分身模块 (Avatar) ===${NC}"
test_api_code "分身列表" GET "$BASE_URL/avatar/list?userId=$TEST_USER_ID" "" "200"
test_api_code "分身搜索" GET "$BASE_URL/avatar/search?q=test" "" "200"
test_api_code "分身详情" GET "$BASE_URL/avatar/test123" "" "200"
echo ""

# ========== 10. 对话模块 ==========
echo -e "${YELLOW}=== 10. 对话模块 (Chat) ===${NC}"
test_api_code "对话列表" GET "$BASE_URL/chat/conversations?userId=$TEST_USER_ID" "" "200"
test_api_code "创建对话" POST "$BASE_URL/chat/conversation" '{"userId":"'$TEST_USER_ID'","avatarId":"test123"}' "200"
echo ""

# ========== 11. 任务模块 ==========
echo -e "${YELLOW}=== 11. 任务模块 (Task) ===${NC}"
test_api_code "任务列表" GET "$BASE_URL/tasks?userId=$TEST_USER_ID" "" "200"
test_api_code "任务统计" GET "$BASE_URL/tasks/stats?userId=$TEST_USER_ID" "" "200"
echo ""

# ========== 12. 订单模块 ==========
echo -e "${YELLOW}=== 12. 订单模块 (Order) ===${NC}"
test_api_code "订单列表" GET "$BASE_URL/order/list?userId=$TEST_USER_ID" "" "200"
test_api_code "进行中订单" GET "$BASE_URL/order/open?userId=$TEST_USER_ID" "" "200"
test_api_code "订单统计" GET "$BASE_URL/order/stats?userId=$TEST_USER_ID" "" "200"
test_api_code "订单详情" GET "$BASE_URL/order/test123" "" "200"
echo ""

# ========== 13. 订单派发模块 ==========
echo -e "${YELLOW}=== 13. 订单派发模块 (Order-Dispatch) ===${NC}"
test_api_code "派发进度" GET "$BASE_URL/order-dispatch/test123/progress" "" "200"
test_api_code "派发状态" GET "$BASE_URL/order-dispatch/test123/status" "" "200"
test_api_code "待处理请求" GET "$BASE_URL/order-dispatch/pending-requests" "" "200"
echo ""

# ========== 14. 订单处理模块 ==========
echo -e "${YELLOW}=== 14. 订单处理模块 (Order-Processing) ===${NC}"
test_api_code "处理状态" GET "$BASE_URL/order-processing/status/test123" "" "200"
test_api_code "订单作品" GET "$BASE_URL/order-processing/works/test123" "" "200"
echo ""

# ========== 15. 内容生成模块 ==========
echo -e "${YELLOW}=== 15. 内容生成模块 (Content-Generation) ===${NC}"
test_api_code "生成内容" POST "$BASE_URL/content-generation/generate" '{"userId":"'$TEST_USER_ID'","avatarId":"test123","content":"test"}' "200"
echo ""

# ========== 16. 掌纹模块 ==========
echo -e "${YELLOW}=== 16. 掌纹模块 (Palm-Reading) ===${NC}"
test_api_code "掌纹历史" GET "$BASE_URL/palm-reading/history?userId=$TEST_USER_ID" "" "200"
echo ""

# ========== 17. 微信支付模块 ==========
echo -e "${YELLOW}=== 17. 微信支付模块 (Payment) ===${NC}"
test_api_code "创建支付" POST "$BASE_URL/payment/wechat/create" '{"userId":"'$TEST_USER_ID'","planId":"test"}' "200"
echo ""

# ========== 18. 推荐人模块 ==========
echo -e "${YELLOW}=== 18. 推荐人模块 (Referral) ===${NC}"
test_api_code "推荐码" GET "$BASE_URL/referral/code?userId=$TEST_USER_ID" "" "200"
test_api_code "推荐统计" GET "$BASE_URL/referral/stats?userId=$TEST_USER_ID" "" "200"
test_api_code "推荐列表" GET "$BASE_URL/referral/list?userId=$TEST_USER_ID" "" "200"
test_api_code "使用推荐码" POST "$BASE_URL/referral/use" '{"userId":"'$TEST_USER_ID'","code":"TEST123"}' "200"
echo ""

# ========== 19. 媒体模块 ==========
echo -e "${YELLOW}=== 19. 媒体模块 (Media) ===${NC}"
test_api_code "签名URL" GET "$BASE_URL/media/sign-url?url=test" "" "200"
echo ""

# ========== 20. 上传模块 ==========
echo -e "${YELLOW}=== 20. 上传模块 (Upload) ===${NC}"
echo "  [POST] 图片上传 (跳过，需要文件)"
echo "  [POST] 音频上传 (跳过，需要文件)"
echo "  [POST] 视频上传 (跳过，需要文件)"
echo ""

# ========== 21. ASR 模块 ==========
echo -e "${YELLOW}=== 21. ASR 模块 (ASR) ===${NC}"
echo "  [POST] 语音识别 (跳过，需要音频文件)"
echo ""

# ========== 22. 音频模块 ==========
echo -e "${YELLOW}=== 22. 音频模块 (Audio) ===${NC}"
echo "  [POST] 音频处理 (跳过，需要音频文件)"
echo ""

# ========== 23. 视觉模块 ==========
echo -e "${YELLOW}=== 23. 视觉模块 (Vision) ===${NC}"
echo "  [POST] 图片分析 (跳过，需要图片文件)"
echo ""

# ========== 24. TikHub 模块 ==========
echo -e "${YELLOW}=== 24. TikHub 模块 ===${NC}"
test_api_code "抖音用户信息" POST "$BASE_URL/tikhub/douyin/user-info" '{"uid":"test"}' "200"
test_api_code "小红书用户信息" POST "$BASE_URL/tikhub/xiaohongshu/user-info" '{"uid":"test"}' "200"
echo ""

# ========== 25. Agent 模块 ==========
echo -e "${YELLOW}=== 25. Agent 模块 ===${NC}"
test_api_code "Agent工具" GET "$BASE_URL/agent/tools" "" "200"
test_api_code "平台配置" GET "$BASE_URL/agent/platform-configs" "" "200"
echo ""

# ========== 26. Admin 模块 ==========
echo -e "${YELLOW}=== 26. Admin 模块 ===${NC}"
test_api_code "Admin登录" POST "$BASE_URL/admin/login" '{"username":"admin","password":"admin"}' "200"
test_api_code "仪表盘统计" GET "$BASE_URL/admin/dashboard/stats" "" "200"
test_api_code "用户列表" GET "$BASE_URL/admin/users" "" "200"
test_api_code "分身列表" GET "$BASE_URL/admin/avatars" "" "200"
test_api_code "订单列表" GET "$BASE_URL/admin/orders" "" "200"
test_api_code "技能列表" GET "$BASE_URL/admin/skills" "" "200"
test_api_code "帖子列表" GET "$BASE_URL/admin/posts" "" "200"
test_api_code "财务统计" GET "$BASE_URL/admin/finance/stats" "" "200"
test_api_code "推荐统计" GET "$BASE_URL/admin/referral/stats" "" "200"
echo ""

# ========== 总结 ==========
echo "========================================"
echo "   测试结果总结"
echo "========================================"
echo -e "${GREEN}通过: $PASS${NC}"
echo -e "${RED}失败: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}所有测试通过！${NC}"
    exit 0
else
    echo -e "${YELLOW}有 $FAIL 个测试失败，请检查！${NC}"
    exit 1
fi
