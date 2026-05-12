# 阶段 D-1：canonical 平台映射冻结

## Premise

- 现状：前后端已存在多处平台别名映射，但来源分散，包含 `wechat`、`wechat_video`、`wechat_official`、`xhs`、`bili`、`general` 等历史值。
- 目标：冻结一份唯一可执行的 canonical 平台口径，作为接单、内容生成、发布引导、发布反馈、统计展示的统一事实源。

## Constraints

- 禁止继续在业务页面或业务服务中新增一套平台别名表。
- 前后端平台展示名必须复用统一 canonical key。
- `pnpm validate` 必须通过。

## Boundaries

- 允许改动范围：平台映射文档、平台常量、发布处理服务。
- 禁止改动内容：支付、订阅、推荐算法、非发布链路页面。

## Endgame

- 前后端对同一平台只保留一个 canonical key。
- 历史别名只能作为输入兼容层存在，输出必须全部为 canonical key。
- 发布链和统计链不再出现平台字段双轨。

## 1. Canonical Key 集合

- `wechat_mp`
- `wechat_moments`
- `wechat_channel`
- `douyin`
- `xiaohongshu`
- `weibo`
- `bilibili`
- `kuaishou`
- `zhihu`
- `toutiao`

## 2. 历史别名映射

| 输入值 | canonical key | 说明 |
| --- | --- | --- |
| `wechat` | `wechat_channel` | 历史通用微信视频发布口径 |
| `wechat_video` | `wechat_channel` | 历史视频号别名 |
| `wechat_channel` | `wechat_channel` | 已 canonical |
| `wechat_mp` | `wechat_mp` | 已 canonical |
| `wechat_official` | `wechat_mp` | 历史公众号别名 |
| `wechat_moments` | `wechat_moments` | 已 canonical |
| `douyin` | `douyin` | 已 canonical |
| `xhs` | `xiaohongshu` | 小红书缩写别名 |
| `xiaohongshu` | `xiaohongshu` | 已 canonical |
| `weibo` | `weibo` | 已 canonical |
| `bili` | `bilibili` | B 站缩写别名 |
| `bilibili` | `bilibili` | 已 canonical |
| `kuaishou` | `kuaishou` | 已 canonical |
| `zhihu` | `zhihu` | 已 canonical |
| `toutiao` | `toutiao` | 已 canonical |
| `general` | `wechat_channel` | 历史订单通用平台默认映射 |

## 3. 输入输出规则

- 输入兼容：接口入参、数据库历史值、旧页面 query 参数允许携带历史别名。
- 输出冻结：以下位置必须只输出 canonical key：
- `order-processing` 状态接口
- `order-content-creation` 页面平台展示与跳转参数
- `order-publish-feedback` 页面平台列表
- `order-stats` 和订单详情统计展示

## 4. 字段级约束

- 单平台字段：`platform`
- 多平台字段：`platforms`
- 平台状态映射：`publishStatus.platformStatus[canonicalPlatform]`
- 发布反馈映射：`publishFeedback[canonicalPlatform]`

## 5. 代码事实源

- 前端事实源：`src/constants/publish-platform.ts`
- 后端事实源：`server/src/modules/order-processing/order-processing.service.ts`

## 6. 禁止事项

- 禁止新增未登记的 platform key。
- 禁止把 alias 原样写回 `publishStatus` 或 `publishFeedback`。
- 禁止展示层自行硬编码 `平台名 -> 中文名` 第二套表。

## 7. 验收标准

- 所有发布链接口对外返回的 `platform/platforms` 均为 canonical key。
- `publishFeedback` 和 `publishStatus.platformStatus` 的 key 全部为 canonical key。
- 历史别名仅存在于输入兼容和一次性归一化逻辑中。
