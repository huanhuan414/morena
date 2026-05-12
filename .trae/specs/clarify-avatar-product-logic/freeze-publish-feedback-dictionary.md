# 阶段 D-2：发布反馈字段字典冻结

## Premise

- 现状：发布反馈目前以 `publishFeedback[platform]` 形式存储，但字段来源混合了页面输入、验证结果和统计聚合字段，存在口径漂移风险。
- 目标：冻结发布反馈字段字典，明确哪些字段可写、哪些字段只读、哪些字段用于统计聚合。

## Constraints

- 禁止页面继续自由扩展 `publishFeedback` 任意字段。
- 发布反馈字段必须以 canonical 平台 key 分桶。
- `pnpm validate` 必须通过。

## Boundaries

- 允许改动范围：发布反馈文档、发布反馈页面、处理服务、订单聚合服务。
- 禁止改动内容：支付、分身托管、推荐规则、非发布页面。

## Endgame

- `publishFeedback` 成为发布反馈唯一事实结构。
- 前端提交、后端存储、订单统计、验收展示使用同一份字段字典。
- 互动指标字段统一可聚合，不再靠页面临时猜测。

## 1. Canonical 结构

```ts
type PublishFeedbackMap = Record<CanonicalPlatformKey, PublishFeedbackItem>

interface PublishFeedbackItem {
  link?: string
  images?: string[]
  screenshot_urls?: string[]
  image?: string
  submitTime?: string
  submittedAt?: string
  status?: 'manual' | 'submitted' | 'verified' | 'failed'
  note?: string
  metrics?: PublishMetrics
  verified?: boolean
  verifyMessage?: string
  verifyTitle?: string
}

interface PublishMetrics {
  views?: number
  likes?: number
  comments?: number
  shares?: number
}
```

## 2. 写入字段

- 页面允许提交：
- `link`
- `images`
- `screenshot_urls`
- `image`
- `submitTime` 或 `submittedAt`
- `note`
- `metrics.views`
- `metrics.likes`
- `metrics.comments`
- `metrics.shares`

## 3. 验证结果字段

- 平台验证成功或失败后，只允许补充：
- `verified`
- `verifyMessage`
- `verifyTitle`
- `status`

## 4. 聚合字段规则

- 订单统计聚合优先读取 `metrics`。
- 若不存在 `metrics`，允许读取历史平铺字段：
- `views`
- `likes`
- `comments`
- `shares`
- 图片聚合优先级：
- `images`
- `screenshot_urls`
- `image`

## 5. 页面与服务职责

- `order-publish-feedback`：负责采集反馈输入和验证结果。
- `order-processing.service`：负责按 canonical 平台 key 合并反馈。
- `order.service`：负责把反馈聚合成 `posts/postCount/totalViews/totalLikes/totalComments/totalShares`。
- `order-acceptance`：只读展示反馈结果，不再定义第二套字段。

## 6. 兼容规则

- 允许读取历史平铺互动字段，但新写入统一落到 `metrics.*`。
- 允许读取 `submitTime/submittedAt` 双字段，但新写入优先 `submittedAt`。
- 允许读取 `images/screenshot_urls/image` 多来源，但新页面优先写 `images`。

## 7. 禁止事项

- 禁止以非 canonical 平台 key 写入 `publishFeedback`。
- 禁止把页面临时状态对象直接整包写入数据库。
- 禁止在验收页或统计页定义第二套反馈字段字典。

## 8. 验收标准

- `publishFeedback` key 全部为 canonical 平台 key。
- 新提交的互动数据统一可在订单详情 `summary_stats` 中聚合出来。
- 验收页、统计页、反馈页展示同一份反馈结构。
