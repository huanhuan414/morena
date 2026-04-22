# 待接订单接受流程测试文档

## 修复内容

### 1. 后端修复

#### 问题：任务未加入队列
在 `confirmDispatch` 方法中，订单被接受后，状态更新为 `accepted`，但任务没有加入队列，导致任务永远不会被处理。

#### 修复方案：
1. 在 `OrderDispatchService` 中注入 `OrderProcessingService`
2. 在 `confirmDispatch` 方法中调用 `orderProcessingService.enqueueTask(requestId)` 将任务加入队列
3. 在 `OrderProcessingService` 中添加 `enqueueTask` 公共方法

### 2. 前端优化

#### 优化点：
1. 在 `handleAccept` 和 `handleReject` 方法中添加详细的日志
2. 增强错误处理，显示后端返回的详细错误信息
3. 使用 `[PendingOrder]` 前缀统一日志标签

## 测试流程

### 步骤1：创建测试订单

```sql
INSERT INTO orders (id, user_id, title, description, budget, content_type, platforms, target_audience, deadline, status, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '5fb8e360-c034-46f6-9b2d-8b9b4627fe92',
  '测试订单 - 接受流程',
  '这是一个测试订单，用于验证接受订单流程',
  100,
  '图文',
  ARRAY['xiaohongshu'],
  '年轻女性',
  NOW() + INTERVAL '7 days',
  'pending',
  NOW(),
  NOW()
) RETURNING id, title;
```

### 步骤2：创建待接请求

```sql
-- 替换 <ORDER_ID> 为步骤1返回的订单ID
INSERT INTO order_dispatch_requests (id, order_id, avatar_id, user_id, status, score, match_reasons, expires_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '<ORDER_ID>',
  '082ae641-32bc-4614-9f91-e2f3c24986fb',
  '5fb8e360-c034-46f6-9b2d-8b9b4627fe92',
  'pending',
  95,
  '测试匹配',
  NOW() + INTERVAL '24 hours',
  NOW(),
  NOW()
) RETURNING id;
```

### 步骤3：获取待接订单列表

```bash
curl -X GET "http://localhost:3000/api/order-dispatch/pending-requests" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 5fb8e360-c034-46f6-9b2d-8b9b4627fe92"
```

### 步骤4：接受订单

```bash
# 替换 <REQUEST_ID> 为步骤2返回的待接请求ID
curl -X PUT "http://localhost:3000/api/order-dispatch/request/<REQUEST_ID>/confirm" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 5fb8e360-c034-46f6-9b2d-8b9b4627fe92" \
  -d '{"avatarId": "082ae641-32bc-4614-9f91-e2f3c24986fb"}'
```

预期响应：
```json
{
  "code": 200,
  "data": true,
  "message": "确认成功"
}
```

### 步骤5：检查订单处理状态

```bash
# 替换 <REQUEST_ID> 为步骤2返回的待接请求ID
curl -X GET "http://localhost:3000/api/order-processing/status/<REQUEST_ID>"
```

预期响应：
```json
{
  "code": 200,
  "data": {
    "requestId": "<REQUEST_ID>",
    "status": "queuing",  // 或者 "generating"、"preview" 等
    "queuePosition": 0,
    "estimatedTime": 0
  },
  "message": "获取成功"
}
```

### 步骤6：查看后端日志

```bash
tail -f /tmp/coze-logs/dev.log | grep -E "订单分配|TaskQueue|OrderProcessing"
```

预期看到以下日志：
```
[订单分配] 订单 <ORDER_ID> 已接受并加入队列
[TaskQueue] 任务加入队列: { requestId: '<REQUEST_ID>', position: 0, estimatedTime: 0 }
[TaskQueue] 开始执行任务: <REQUEST_ID>
[OrderProcessing] 查询订单状态: { requestId: '<REQUEST_ID>' }
```

## 前端测试流程

### 步骤1：打开待接订单页面

在浏览器中打开：
```
/#/pages/pending-order/index?requestId=<REQUEST_ID>
```

### 步骤2：点击"立即接受订单"按钮

### 步骤3：确认接受

在弹出的确认对话框中点击"确定"

### 步骤4：查看跳转

系统应该：
1. 显示"接受成功"提示
2. 1.5秒后自动跳转到订单处理页面

### 步骤5：查看订单处理页面

跳转到：
```
/#/pages/order-processing/index?requestId=<REQUEST_ID>&avatarId=<AVATAR_ID>&orderId=<ORDER_ID>
```

页面应该显示：
- 排队中/生成中状态
- 进度条
- 最后更新时间

## 常见问题

### 问题1：订单请求不存在或已过期

**原因**：待接请求状态不是 `pending`，或者已过期

**解决方案**：
```sql
-- 检查待接请求状态
SELECT id, status, expires_at FROM order_dispatch_requests WHERE id = '<REQUEST_ID>';

-- 如果状态不是 pending，更新状态
UPDATE order_dispatch_requests SET status = 'pending' WHERE id = '<REQUEST_ID>';

-- 如果已过期，更新过期时间
UPDATE order_dispatch_requests SET expires_at = NOW() + INTERVAL '24 hours' WHERE id = '<REQUEST_ID>';
```

### 问题2：任务没有加入队列

**原因**：后端代码没有正确调用 `enqueueTask` 方法

**解决方案**：
1. 检查后端日志，确认是否看到 `[订单分配] 订单 <ORDER_ID> 已接受并加入队列`
2. 如果没有，检查代码是否正确修改

### 问题3：任务一直在排队中

**原因**：队列系统没有正常处理任务

**解决方案**：
1. 检查队列状态日志：`[TaskQueue] 检查队列`
2. 检查是否有空闲执行槽位
3. 等待30秒让队列自动处理，或者手动触发队列检查

### 问题4：前端显示"接受失败"

**原因**：后端返回错误

**解决方案**：
1. 打开浏览器控制台查看详细错误信息
2. 检查后端日志
3. 查看前端显示的错误提示（应该是后端返回的详细错误）

## 验证清单

- [ ] 后端代码编译通过
- [ ] 前端代码编译通过
- [ ] 接受订单接口返回成功
- [ ] 任务成功加入队列
- [ ] 队列系统正确处理任务
- [ ] 前端正确跳转到订单处理页面
- [ ] 订单处理页面正确显示状态
- [ ] 错误信息正确显示
- [ ] 日志信息完整清晰
