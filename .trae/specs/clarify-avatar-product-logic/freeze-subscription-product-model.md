# 订阅产品模型冻结

## Premise

- 现状：前端订阅页、`subscription` 模块、`payment` 模块与支付说明文档并存，但创建订单入口、支付回调口径、订阅激活时机尚未统一。
- 目标：冻结单一订阅产品模型，明确套餐、权益、订单、支付、激活、续费与失效的 canonical 口径，作为阶段 `F-3/F-4/F-5` 的唯一事实源。

## Constraints

- 禁止同时保留多套“订阅创建/支付创建/支付回调”主链。
- 禁止前端直接推断订阅是否生效，必须以后端订阅状态为准。
- 禁止在业务代码中硬编码套餐文案与权益判断，套餐权益以后端返回为准。
- 质量红线：支付订单、订阅状态、用户权益三者必须可追溯；`pnpm validate` 必须通过。

## Boundaries

- 允许冻结内容：
  - 套餐 canonical 字段
  - 用户订阅 canonical 字段
  - 支付订单 canonical 字段
  - 订阅激活/失效/续费规则
  - 前后端单一接口主链
- 暂不在本文件内解决：
  - 微信支付证书部署细节
  - 生产环境商户配置
  - 自动续费扣款实现

## Endgame

- 验收标准：
  - 前端只认一套订阅查询与支付下单接口
  - 后端只认一套支付订单状态机
  - 用户权益只从“有效订阅”聚合得出
  - 支付成功后订阅激活路径唯一

## 1. 单一业务主链

`选择套餐 -> 查询当前订阅 -> 创建支付订单 -> 调起微信支付 -> 支付回调入库 -> 核销支付订单 -> 激活/续订订阅 -> 刷新用户权益 -> 前端展示最新订阅`

规则：

- 前端套餐页只负责展示套餐、发起支付、刷新结果。
- 支付是否成功，以支付订单状态与后端核销结果为准。
- 订阅是否生效，以 `user_subscriptions` 中“当前有效订阅”聚合结果为准。
- 免费套餐不创建支付订单，只能走“默认权益”口径，不能伪装成已购订阅。

## 2. 套餐 canonical 模型

```ts
interface SubscriptionPlanDto {
  id: string
  tier: 'free' | 'basic' | 'premium' | 'vip'
  name: string
  description: string
  price: number
  durationDays: number
  maxAvatars: number
  canReceiveOrders: boolean
  orderPriority: number
  features: {
    maxFriends: number
    avatarStorageLimit: string
    prioritySupport?: boolean
    advancedAnalytics?: boolean
    personalManager?: boolean
  }
  isActive: boolean
  displayOrder: number
}
```

规则：

- `tier` 是套餐等级 canonical key。
- `price` 单位固定为元；支付订单中再转换为分。
- `durationDays` 为订阅时长唯一事实字段，不再同时维护“月数/天数”双轨。
- 免费版只作为默认权益展示，不进入付费支付链。

## 3. 用户订阅 canonical 模型

```ts
interface UserSubscriptionDto {
  id: string
  userId: string
  planId: string
  tier: 'free' | 'basic' | 'premium' | 'vip'
  status: 'pending_activation' | 'active' | 'expired' | 'cancelled'
  startDate: string
  endDate: string
  paymentOrderId?: string
  paymentMethod?: 'wechat'
  autoRenew: boolean
}
```

规则：

- `active` 表示当前权益有效。
- `expired` 表示到期失效，不代表支付失败。
- `cancelled` 表示取消续费或手动作废，不应再提供权益。
- `pending_activation` 只允许在“支付已创建但未完成核销”阶段短暂存在。

## 4. 支付订单 canonical 模型

```ts
interface PaymentOrderDto {
  id: string
  userId: string
  bizType: 'subscription' | 'order'
  bizId: string
  outTradeNo: string
  amountFen: number
  channel: 'wechat'
  status: 'created' | 'paying' | 'paid' | 'closed' | 'failed' | 'refunded'
  prepayId?: string
  transactionId?: string
  paidAt?: string
}
```

规则：

- `bizType + bizId` 唯一标识支付归属。
- `outTradeNo` 是微信侧唯一流水。
- 只有 `paid` 才允许触发订阅激活。
- `failed/closed` 不得直接激活订阅。

## 5. 权益聚合规则

- 用户默认至少拥有 `free` 权益。
- 若存在有效 `active` 订阅，则以最新未过期的付费订阅覆盖默认权益。
- 分身可创建额度、可接单能力、好友上限等，一律从当前有效订阅聚合结果读取。
- 任何页面禁止自行根据 `planId` 猜测权益。

## 6. 单一接口主链

前端 canonical：

- `GET /api/subscription/plans`
- `GET /api/subscription/user`
- `POST /api/payment/wechat/create`
- `POST /api/payment/wechat/notify`

后端规则：

- 订阅页创建支付时，统一走 `payment` 模块创建支付订单。
- `subscription` 模块负责“查询套餐/查询订阅/激活订阅权益”，不再承担第二套支付下单入口。
- 历史 `POST /api/subscription/create-order`、`POST /api/subscription/payment-callback` 仅可作为兼容别名，最终需内部委托到 canonical 主链。

## 7. 激活与续费规则

- 首购：创建新的 `user_subscriptions` 记录。
- 续费：若当前存在同套餐有效订阅，则按 `endDate` 顺延。
- 升级：默认创建新订阅记录并以最新有效订阅生效，不在当前阶段处理复杂补差价。
- 降级：仅下一周期生效，当前阶段不做即时降级扣减。

## 8. 风险冻结

- 风险 1：前端直接以支付成功 toast 当成订阅激活结果。
  - 约束：必须重新拉取 `GET /api/subscription/user`。
- 风险 2：`subscription` 与 `payment` 模块各自创建订单。
  - 约束：只保留 `payment` 模块创建支付订单。
- 风险 3：支付回调未核销导致订单已付、权益未生效。
  - 约束：支付回调必须更新支付订单状态并触发订阅激活。
- 风险 4：免费套餐误入支付链。
  - 约束：免费版不创建支付订单。
