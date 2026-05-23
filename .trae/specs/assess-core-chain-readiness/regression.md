# 主链人工回归路径（最小可重复执行）

## 路径 1：登录
- 前置：清空本地 user token
- 操作：进入登录页完成登录
- 验证点
  - 接口：`POST /api/auth/login` 或对应微信登录接口返回 `code=200`，并返回 token
  - 本地：写入 `token` 与 `userInfo`
  - 页面：跳转到首页/分身页不再提示“请先登录”

## 路径 2：下单 → 支付 → 订单详情（发单者视角）
- 操作：创建订单并完成支付
- 验证点
  - 订单详情接口：`GET /api/order/:id` 返回 canonical 字段（camelCase）
  - 订单状态：`orders.status` 为 canonical 值（例如 open / awaiting_acceptance / completed）
  - 订单详情页：仅消费 adapter 输出（不再依赖 `*_id`/`*_at`/`summary_stats` 等历史字段）

## 路径 3：接单 → 生成（接单者/分身视角）
- 操作：在“订单广场/待接订单/通知”任一入口接单
- 验证点
  - 路由：接单成功后统一进入 `/package-order/pages/order-processing/index?orderId=...&avatarId=...&requestId=...`
  - 桥页：根据 `/api/order-processing/status/:identifier` 仲裁跳转到“生成页/发布反馈页/验收页”，且透传 query（至少包含 orderId + requestId）
  - 生成页轮询：优先使用 requestId 轮询（`/api/order-processing/status/:requestId`）

## 路径 4：发布引导 → 发布反馈提交（接单者/分身视角）
- 操作：从生成页进入发布引导页，完成发布后提交发布反馈（截图/链接）
- 验证点
  - 反馈提交接口：`POST /api/order-processing/feedback/:requestId` 返回 `code=200`
  - 回流：发布反馈提交成功后回流到“处理中桥页”（而不是 navigateBack 回到旧页面）

## 路径 5：验收（发单者视角）→ 结算/完成
- 操作：发单者进入验收页，确认验收
- 验证点
  - 验收接口：`PUT /api/order-processing/accept/:requestId` 返回 `code=200`
  - 回流：验收成功后回流到“处理中桥页”
  - 验收页展示：publishFeedback 按平台 map 展示 images/publishUrl，不依赖顶层 `screenshot_urls/link`

## 路径 6：邀请 → 首次创建分身触发奖励（邀请收益）
- 操作：用户 A 邀请用户 B；用户 B 完成注册并首次创建分身
- 验证点
  - referrals：B 对应 referrals 从 `pending` 变为 `completed`
  - earnings：A/B 各产生一条 `type=referral_bonus` 且 `status=settled` 的记录
  - users：A/B balance 与 total_earnings 同步增加（与流水一致）

