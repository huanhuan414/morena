# 支付状态机冻结

## Premise

- 现状：支付订单已存在 `payment_orders` 表与 `payment` 模块，但支付状态、订阅激活时机、回调核销动作尚未冻结成单一口径。
- 目标：冻结支付订单 canonical 状态机和状态迁移规则，明确“什么时候能激活订阅、什么时候只能提示支付中或失败”。

## Constraints

- 禁止支付成功与订阅激活并行由前端和后端各自判断。
- 禁止同一支付订单出现多次激活订阅。
- 禁止支付回调只回 200 不落库。
- 质量红线：支付状态迁移必须幂等；`pnpm validate` 必须通过。

## Boundaries

- 允许冻结内容：
  - 支付订单状态集合
  - 状态迁移图
  - 触发器与幂等约束
  - 订阅激活触发条件
- 暂不处理：
  - 退款业务细则
  - 自动续费二次扣款
  - 多支付渠道扩展

## Endgame

- 验收标准：
  - 任何支付订单只有一个 canonical 状态
  - 微信支付回调可幂等重放
  - 订阅激活只由 `paid` 状态迁移触发

## 1. canonical 状态集合

```ts
type PaymentOrderStatus =
  | 'created'
  | 'paying'
  | 'paid'
  | 'closed'
  | 'failed'
  | 'refunded'
```

定义：

- `created`：支付订单已创建，尚未调起支付。
- `paying`：已返回支付参数，等待用户完成支付。
- `paid`：已收到可信支付成功结果，可进入业务核销。
- `closed`：用户取消、超时关闭或商户主动关闭。
- `failed`：下单失败或核销失败。
- `refunded`：已退款。

## 2. 状态迁移

```text
created -> paying
created -> failed
paying -> paid
paying -> closed
paying -> failed
paid -> refunded
```

禁止迁移：

- `created -> paid` 由前端直接写入
- `closed -> paid`
- `failed -> paid`
- `refunded -> active subscription`

## 3. 事件触发器

- 创建支付订单成功：`created`
- 生成并返回支付参数成功：`paying`
- 微信支付回调校验通过：`paid`
- 用户主动取消 / 超时关闭：`closed`
- 微信下单失败 / 回调校验失败：`failed`
- 退款成功：`refunded`

## 4. 订阅激活触发规则

- 仅当：
  - `bizType = subscription`
  - 支付订单状态从 `paying -> paid`
  - 且该 `outTradeNo` 未被核销过
- 才允许触发：
  - 写入/更新 `user_subscriptions`
  - 更新用户权益字段
  - 记录支付成功时间与流水号

幂等要求：

- 同一个 `outTradeNo` 二次回调不得重复创建订阅。
- 同一个支付订单若已是 `paid`，再次回调只返回成功，不重复业务激活。

## 5. 查询口径冻结

前端允许展示的支付结果：

- `created/payng`：支付中
- `paid`：支付成功
- `closed`：已取消
- `failed`：支付失败
- `refunded`：已退款

禁止：

- 直接根据 `prepayId` 是否存在判断支付成功
- 直接根据 `requestPayment.success` 认为权益已激活

## 6. 回调处理链

`微信通知 -> 验签 -> 定位 payment_order -> 幂等检查 -> 更新状态为 paid -> 触发 subscription.activate -> 返回成功`

异常链：

- 验签失败：记录日志，返回失败，不更新状态
- 订单不存在：记录异常，返回失败
- 已处理过：返回成功，避免微信重复重试

## 7. 兼容策略

- 历史 `pending` 支付状态统一映射为 `created`
- 历史 `success` 统一映射为 `paid`
- 历史 `cancelled` 统一映射为 `closed`

## 8. 风险冻结

- 风险 1：前端支付成功但回调没打通。
  - 处理：支付页必须轮询或回拉订阅状态，不能本地宣告开通。
- 风险 2：支付回调重复触发导致重复续费。
  - 处理：按 `outTradeNo` 和当前状态幂等保护。
- 风险 3：下单成功但未把订单状态推进到 `paying`。
  - 处理：返回支付参数前必须持久化订单。
