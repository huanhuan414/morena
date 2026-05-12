# A-3 冻结字段字典

## 1. avatar

| 概念 | canonical 字段 | 兼容字段 | 说明 |
| --- | --- | --- | --- |
| 分身ID | `id` | - | UUID 字符串，不允许 `parseInt` |
| 所属用户 | `user_id` | `userId` | 后端存 snake_case，前端读驼峰兼容 |
| 名称 | `name` | - | 分身名称 |
| 头像 | `avatar_url` | `avatarUrl` | 展示头像 |
| 托管状态 | `trust_enabled` | `is_hosted` | 主写入字段为 `trust_enabled`，若表存在 `is_hosted` 同步写入 |
| 托管配置 | `hosting_settings` | `config.hosting_settings` | 页面展示时允许从 `config` 中展开 |

## 2. order

| 概念 | canonical 字段 | 兼容字段 | 说明 |
| --- | --- | --- | --- |
| 订单ID | `id` | `orderId` | 订单主键 |
| 发单用户 | `user_id` | `userId` | 发单方 |
| 标题 | `title` | - | 订单标题 |
| 描述 | `description` | - | 订单描述 |
| 平台 | `platforms` | `platform` | 统一存平台数组 |
| 状态 | `status` | - | 订单状态机口径 |
| 预算 | `budget` | - | 金额 |
| 期望分身数 | `expected_quantity` | `expectedQuantity` / `avatar_count` | 订单需要的分身数 |
| 每个分身数量 | `quantity_per_avatar` | `quantityPerAvatar` | 每个分身产出数量 |

## 3. dispatch

| 概念 | canonical 字段 | 兼容字段 | 说明 |
| --- | --- | --- | --- |
| 派单ID | `id` | `dispatchId` | 派单记录主键 |
| 订单ID | `order_id` | `orderId` | 关联订单 |
| 分身ID | `avatar_id` | `avatarId` | 关联分身 |
| 状态 | `status` | - | `pending/accepted/declined/completed` |
| 平台 | `platform` | - | 当前派单主平台 |

## 4. processing

| 概念 | canonical 字段 | 兼容字段 | 说明 |
| --- | --- | --- | --- |
| 处理请求ID | `id` | `requestId` | content_generation_requests 主键 |
| 订单ID | `order_id` | `orderId` | 关联订单 |
| 分身ID | `avatar_id` | `avatarId` | 关联分身 |
| 状态 | `status` | - | processing canonical 状态 |
| 生成内容 | `content` | `generatedContent.content` | 正文内容 |
| 图片 | `images` | `generatedContent.images` | 图片数组 |
| 视频 | `video_url` | `videoUrl` / `generatedContent.videos` | 视频数组兼容读取 |
| 发布状态 | `publish_status` | `publishStatus` | 平台级发布状态 |
| 发布反馈 | `publish_feedback` | `publishFeedback` | 平台级反馈凭证 |

## 5. publishEvidence

| 概念 | canonical 字段 | 兼容字段 | 说明 |
| --- | --- | --- | --- |
| 平台 | `platform` | - | canonical 平台键 |
| 作品链接 | `link` | `url` | 作品 URL |
| 截图 | `images` | `screenshots` | 截图数组 |
| 提交时间 | `submitTime` | `submittedAt` | 前端展示字段 |
| 操作人 | `operator` | - | 可选 |

## 6. publishMetrics

| 概念 | canonical 字段 | 兼容字段 | 说明 |
| --- | --- | --- | --- |
| 浏览量 | `views` | - | 整数 |
| 点赞 | `likes` | - | 整数 |
| 评论 | `comments` | - | 整数 |
| 分享 | `shares` | - | 整数 |

## 7. 强制规则

- 路由参数统一使用 `avatarId`、`orderId`、`requestId`
- 页面层禁止再用 `id` 代表分身
- `hosting_enabled` 仅历史兼容，不允许继续作为新写入口
- 平台字段统一使用 canonical 平台键
