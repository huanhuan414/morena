# 数据 / 接口 / 状态机统一基线

## 目标

这份文档用于统一当前项目在以下 4 个维度上的“事实基线”：

- 数据库主路径
- 核心接口契约
- 主业务数据模型
- 订单履约状态机

文档重点覆盖 6 条主链：

- 用户
- 分身
- 订单
- 派单
- 内容生成
- 收益 / 支付

本文件描述的是“当前运行时代码实际依赖的基线”，不是理想模型，也不是历史 SQL 的完整汇总。

## 1. 当前结论

### 1.1 数据库主路径

当前后端运行时主路径是 **MySQL + 自定义 MysqlClient / mysql2 Pool**。

直接证据：

- `getMySQLClient()` / `getPool()` 被 `auth`、`avatar`、`order`、`order-dispatch`、`content-generation`、`earnings`、`user-stats` 等核心服务直接调用。
- `shared/schema.ts` 是 Drizzle 的 PostgreSQL schema，`supabase-client.ts` 是 Supabase client，但两者没有进入核心业务主调用链。

结论：

- `server/src/storage/database/mysql-client.ts` 是运行时事实主线。
- `server/src/storage/database/shared/schema.ts` 和 `server/src/storage/database/supabase-client.ts` 当前应视为旁路线 / 迁移遗留 / 实验代码，而不是生产主模型。

### 1.2 MySQL 也存在多份 schema 并存

仓库中至少存在以下几套定义：

- `server/init_database.sql`
- `server/init_database_fix.sql`
- `server/init_database_supplement.sql`
- `server/src/storage/database/schema/schema.sql`
- `mysql-schema.sql`

这些定义并不完全一致，主要体现在：

- `users` 同时出现 `avatar_url` / `avatar`、`experience` / `exp`、`current_balance` / `balance`
- `orders` 的状态集合、金额字段、时间字段命名不完全一致
- `content_generation_requests` 在不同定义里字段丰富度不同
- `earnings` / `withdrawals` 的字段与服务代码使用方式并不完全一致

结论：

- 当前项目不是“一个事实 schema + 多份迁移”，而是“多份历史 schema 并存，运行时代码靠兼容适配”。

### 1.3 接口层已经形成统一包裹格式

绝大多数接口返回结构接近：

```ts
{
  code: number
  msg?: string
  message?: string
  data: any
}
```

但仍存在以下不统一：

- `msg` 与 `message` 混用
- 某些服务返回 snake_case 风格，某些经 `MysqlClient` 转成 camelCase
- 同一资源在不同接口下返回的字段并不完全一致

### 1.4 状态机已存在，但没有单一真源

当前订单履约相关状态同时散落在：

- `server/src/modules/order/order.service.ts`
- `server/src/modules/order/order-status.ts`
- `server/src/modules/order-dispatch/order-dispatch.service.ts`
- `server/src/modules/order-dispatch/order-timeout.service.ts`
- `server/src/modules/content-generation/content-generation.service.ts`
- `server/src/modules/content-generation/content-generation.controller.ts`

结论：

- 已经有状态机雏形
- 但“状态定义”和“状态写入逻辑”还没有完全收敛到单一真源

## 2. 事实模型总览

### 2.1 用户 User

当前运行时代码实际依赖的关键字段：

| 字段 | 来源 | 用途 |
| --- | --- | --- |
| `id` | `users` | 用户主键 |
| `phone` | `users` | 手机号登录 |
| `openid` | `users` | 微信登录 / 支付 |
| `nickname` | `users` | 用户展示名 |
| `avatar` / `avatar_url` | `users` | 头像展示，定义存在漂移 |
| `referral_code` / `referralCode` | `users` | 邀请体系 |
| `balance` / `current_balance` | `users` | 提现可用余额，定义存在漂移 |
| `frozen_balance` | `users` | 提现冻结余额 |
| `total_earnings` | `users` | 累计收益 |

接口主入口：

- `POST /api/auth/phone-login`
- `POST /api/auth/wechat-login`
- `POST /api/auth/wechat-phone-login`
- `GET /api/auth/me`

运行时判断：

- 登录态以 `token + userInfo + X-User-Id` 为主
- 用户信息既被前端 store 使用，也被支付、收益、转介链路依赖

### 2.2 分身 Avatar

当前运行时代码实际依赖的关键字段：

| 字段 | 来源 | 用途 |
| --- | --- | --- |
| `id` | `avatars` | 分身主键 |
| `user_id` | `avatars` | 分身归属用户 |
| `name` | `avatars` | 展示名 |
| `description` | `avatars` | 描述 |
| `avatar_url` | `avatars` | 头像 |
| `personality` | `avatars` | 人设 JSON / 文本 |
| `skills` | `avatars` | 旧技能字段 |
| `content_styles` | `avatars` | 内容风格，部分 schema 未定义 |
| `niche_tags` | `avatars` | 细分领域，部分 schema 未定义 |
| `voice_id` | `avatars` | 声音能力 |
| `status` | `avatars` | `active` / `training` 等 |
| `is_hosted` | `avatars` | 托管开关主字段 |
| `trust_enabled` | `avatars` | 托管兼容字段，部分代码兼容 |
| `hosting_enabled` | `avatars` | 托管兼容字段，部分代码兼容 |

关联表：

- `avatar_skills`
- `avatar_memories`
- `avatar_accounts`
- `avatar_notifications`
- `avatar_friends`

接口主入口：

- `POST /api/avatar`
- `GET /api/avatar`
- `GET /api/avatar/list`
- `GET /api/avatar/:id`
- `PUT /api/avatar/:id`
- `GET /api/avatar/:id/skills`
- `GET /api/avatar/:id/memories`
- `PUT /api/avatar/:id/trust`

运行时判断：

- `AvatarService` 已经通过 `INFORMATION_SCHEMA` 查列名做兼容，说明 `avatars` 表并非强一致 schema

### 2.3 订单 Order

当前运行时代码实际依赖的关键字段：

| 字段 | 来源 | 用途 |
| --- | --- | --- |
| `id` | `orders` | 订单主键 |
| `user_id` | `orders` | 发单用户 |
| `title` | `orders` | 标题 |
| `description` | `orders` | 描述 |
| `content_type` | `orders` | 内容类型 |
| `platforms` | `orders` | 目标平台 JSON |
| `requirements` | `orders` | 需求 JSON |
| `budget` | `orders` | 预算 |
| `status` | `orders` | 订单状态 |
| `expected_quantity` | `orders` | 期望分身数 |
| `avatar_count` | `orders` | 分身数量 |
| `quantity_per_avatar` | `orders` | 单分身产出数 |
| `is_paid` | `orders` | 是否支付 |
| `target_audience` | `orders` | 目标受众 |
| `priority` | `orders` | 优先级 |
| `preferred_styles` | `orders` | 偏好风格 |
| `industry_tags` | `orders` | 行业标签 |
| `deadline_at` / `deadline` | `orders` | 截止时间，命名存在漂移 |
| `content_deadline_at` | `orders` | 内容完成时限 |
| `completed_at` | `orders` | 完成时间 |

接口主入口：

- `POST /api/order`
- `GET /api/order/open`
- `GET /api/order/list`
- `GET /api/order/:id`
- `POST /api/order/:id/cancel`
- `POST /api/order/:id/repay`

### 2.4 派单 Dispatch

主表：`order_dispatch_requests`

当前运行时代码实际依赖的关键字段：

| 字段 | 来源 | 用途 |
| --- | --- | --- |
| `id` | `order_dispatch_requests` | 分发请求主键 |
| `order_id` | `order_dispatch_requests` | 订单 ID |
| `avatar_id` | `order_dispatch_requests` | 分身 ID |
| `user_id` | `order_dispatch_requests` | 分身所属用户 |
| `platform` | `order_dispatch_requests` | 分配方式或平台 |
| `status` | `order_dispatch_requests` | 派单状态 |
| `expires_at` | `order_dispatch_requests` | 接单超时 |
| `responded_at` | `order_dispatch_requests` | 响应时间 |
| `reject_reason` | `order_dispatch_requests` | 拒单原因 |

接口主入口：

- `GET /api/order-dispatch/pending-requests`
- `POST /api/order-dispatch/:id/dispatch`
- `POST /api/order-dispatch/avatar/:avatarId/accept/:orderId`
- `PUT /api/order-dispatch/request/:requestId/confirm`
- `PUT /api/order-dispatch/request/:requestId/reject`
- `GET /api/order-dispatch/recommend/:orderId`

### 2.5 内容生成 ContentGeneration

主表：`content_generation_requests`

当前运行时代码实际依赖的关键字段：

| 字段 | 来源 | 用途 |
| --- | --- | --- |
| `id` | `content_generation_requests` | 生成请求主键 |
| `order_id` | `content_generation_requests` | 关联订单 |
| `avatar_id` | `content_generation_requests` | 关联分身 |
| `platform` | `content_generation_requests` | 目标平台 |
| `platforms` | `content_generation_requests` | 平台列表，部分逻辑兼容 |
| `status` | `content_generation_requests` | 生成状态 |
| `content_type` | `content_generation_requests` | 内容类型 |
| `content_quantity` | `content_generation_requests` | 内容数量 |
| `content` | `content_generation_requests` | 生成文案 |
| `images` | `content_generation_requests` | 图片 URL JSON |
| `video_url` / `videoUrl` | `content_generation_requests` | 视频 URL |
| `publish_status` | `content_generation_requests` | 发布状态详情 |
| `publish_feedback` | `content_generation_requests` | 发布反馈 |
| `verification_status` | `content_generation_requests` | 发布校验状态，部分逻辑使用 |
| `seedance_task_id` | `content_generation_requests` | 视频生成异步任务 ID |
| `error` | `content_generation_requests` | 失败原因 |

接口主入口：

- `POST /api/content-generation/generate`
- `POST /api/content-generation/retry/:requestId`
- `GET /api/content-generation/content/:contentId`
- `GET /api/content-generation/content-images/:contentId`
- `GET /api/content-generation/request/:requestId/avatar/:avatarId`

### 2.6 收益 / 支付

收益主表：`earnings`

关键字段：

| 字段 | 来源 | 用途 |
| --- | --- | --- |
| `id` | `earnings` | 收益主键 |
| `user_id` | `earnings` | 所属用户 |
| `avatar_id` | `earnings` | 关联分身 |
| `order_id` | `earnings` | 关联订单 |
| `type` | `earnings` | 收益类型 |
| `amount` | `earnings` | 金额 |
| `status` | `earnings` | 收益状态 |
| `description` | `earnings` | 描述 |

支付主表：

- `payment_orders`
- `order_payments`
- `payment_orders` 当前在 `WechatPayService` 中被直接写入

提现主表：

- `withdrawals`

接口主入口：

- `GET /api/earnings/overview`
- `GET /api/earnings`
- `POST /api/earnings/withdraw`
- `POST /api/payment/wechat/create`
- `POST /api/payment/wechat/notify`
- `GET /api/payment/order/:orderId/status`

## 3. 当前接口基线

## 3.1 统一封装模式

当前接口基本采用：

```ts
type ApiEnvelope<T> = {
  code: number
  data: T
  msg?: string
  message?: string
}
```

建议后续统一为：

```ts
type ApiResponse<T> = {
  code: number
  message: string
  data: T
}
```

但本轮基线阶段先不改接口，只记录现状。

## 3.2 当前接口层问题

- `msg` / `message` 混用
- 部分控制器返回 `code: 200` 即使内部逻辑失败，实际错误塞进 `message`
- 业务对象字段返回同时存在 camelCase / snake_case
- 部分页面对 `res.data.data` 的依赖很强，前后端是耦合的

## 4. 当前状态机基线

## 4.1 订单状态 OrderStatus

当前相对完整的一套状态定义来自 `order-status.ts`：

- `pending_payment`
- `open`
- `pending_dispatch`
- `pending_acceptance`
- `in_progress`
- `submitted`
- `awaiting_acceptance`
- `revision_requested`
- `completed`
- `cancelled`
- `rejected`

但运行时代码里还能看到额外状态：

- `pending`
- `created`
- `assigned`
- `accepted`
- `auto_cancelled`
- `expired`
- `publish_failed`

结论：

- 当前订单状态集合在“类型定义层”和“服务层 SQL 过滤条件”里并不一致

## 4.2 派单状态 DispatchStatus

当前主集合：

- `pending`
- `accepted`
- `rejected`
- `cancelled`
- `completed`
- `settled`
- `done`

兼容映射：

- `confirmed -> accepted`
- `expired -> cancelled`
- `declined -> rejected`

实际运行中还出现：

- `expired`
- `feedback_submitted`

说明：

- 派单状态与内容状态、验收状态有交叉污染

## 4.3 内容生成状态 FulfillmentStatus

当前可归一化到的主集合：

- `queuing`
- `generating`
- `preview`
- `publishing`
- `published`
- `awaiting_acceptance`
- `revision_requested`
- `settled`
- `failed`
- `partial_failed`

底层细粒度运行状态还包括：

- `pending`
- `processing`
- `generating_text`
- `generating_images`
- `generating_video`
- `feedback_submitted`
- `done`
- `completed`

说明：

- `content_generation_requests.status` 现在同时承担“任务执行阶段”和“业务履约阶段”两层语义

## 4.4 收益状态

当前代码主要使用：

- `pending`
- `settled`
- `completed`

说明：

- `settled` 与 `completed` 在收益域被并行当作“已入账”
- 后续需要统一其中一个为真源状态

## 4.5 当前订单履约链路推导

基于当前代码，可还原的主路径大致为：

```text
pending_payment
-> open
-> pending_dispatch
-> pending_acceptance
-> in_progress
-> submitted
-> awaiting_acceptance
-> completed
```

补充分支：

- 任意节点可能进入 `cancelled`
- `awaiting_acceptance -> revision_requested -> in_progress`
- 支付失败或超时可能进入 `auto_cancelled`
- 发布校验失败可能进入 `publish_failed`

## 5. 关键不一致点

### 5.1 用户模型不一致

- `users.avatar` vs `users.avatar_url`
- `users.balance` vs `users.current_balance`
- `users.exp` vs `users.experience`

### 5.2 分身模型不一致

- `is_hosted` / `trust_enabled` / `hosting_enabled`
- `skills` 既有旧 JSON 字段，也有 `avatar_skills` 关系表
- `content_styles` / `niche_tags` 被服务依赖，但不保证所有 schema 都存在

### 5.3 订单模型不一致

- `deadline` / `deadline_at`
- `priority` 有时是数值，有时是字符串
- `status` 在控制器、服务、定时任务之间集合不一致

### 5.4 内容生成模型不一致

- `video_url` / `videoUrl`
- `platform` / `platforms`
- `status` 同时承载执行态和业务态

### 5.5 收益 / 支付模型不一致

- `subscription_plans` 在部分代码中使用 `plan_id`，部分 SQL 定义中主键是 `id`
- `withdrawals` 表结构与 `EarningsService.requestWithdrawal()` 插入字段并不严格一致

## 6. 本轮建议的“事实真源”

在不做数据库迁移的前提下，建议先把事实真源统一成：

- 运行时数据库真源：MySQL
- 用户余额真源：`users.balance` / `users.frozen_balance`
- 分身托管真源：`avatars.is_hosted`
- 分身技能真源：`avatar_skills` 为主，`avatars.skills` 为兼容读取
- 订单状态真源：`order-status.ts`
- 内容履约状态真源：`order-status.ts` 中的 `FulfillmentStatus`
- 收益入账真源：`earnings.status = settled`

## 7. 后续改造顺序建议

建议严格按以下顺序进行：

1. 定义类型真源
- 为用户、分身、订单、派单、内容、收益定义服务层 DTO / Model

2. 收口状态机
- 把订单、派单、内容状态归并到单一状态模块

3. 收口数据访问
- 明确哪些字段是兼容读取
- 明确哪些字段禁止继续新增使用

4. 收口接口
- 统一 `message`
- 统一 `data`
- 统一关键资源返回字段命名

5. 最后再考虑 schema 清理或迁移
- 在类型层和服务层稳定前，不建议直接推数据库迁移

## 8. 当前最适合立刻修的点

### 8.1 可立即修

- 为这 6 个主域补共享类型定义
- 给状态机建立单一模块入口
- 把兼容字段映射显式化
- 给控制器返回值做统一 envelope 类型

### 8.2 暂不建议立刻修

- 直接删除 Supabase / Drizzle 相关代码
- 直接做全库字段重命名
- 一次性把所有 SQL 文件合并
- 在没有回归保护的前提下统一改所有状态值
