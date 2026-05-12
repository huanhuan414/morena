# A-5 冻结导航与回流矩阵

## 1. 事实源

- 页面注册唯一事实源：`src/app.config.ts`
- 处理链唯一桥接页：`/pages/order/order-processing/index`

## 2. 主链导航矩阵

| 来源页 | 目标页 | 必填参数 | 说明 |
| --- | --- | --- | --- |
| `avatar-create` | `avatar-manage` | - | 创建成功后回到我的分身 |
| `order-create` | `order-matching` | `orderId` | 发单后进入智能匹配 |
| `order-matching` | `pending-order` | - | 分身在待接订单接单 |
| `pending-order` | `order-processing` | `orderId`, `avatarId`, `requestId?` | 接单后统一进入桥接页 |
| `generated-content` | `order-processing` | `orderId`, `avatarId?`, `requestId?` | 已生成内容统一回桥接页 |
| `order-detail` | `order-processing` | `orderId`, `avatarId`, `requestId` | 查看分身反馈统一回桥接页 |
| `order-processing` | `order-content-creation` | `orderId`, `avatarId?`, `requestId?` | 生成链入口 |
| `order-content-creation` | `order-publish-guide` | `orderId`, `avatarId`, `requestId` | 生成完成后发布 |
| `order-publish-guide` | `order-publish-feedback` | `orderId`, `avatarId`, `requestId` | 发布后提交反馈 |
| `order-detail` | `order-acceptance` | `orderId` | 发单方发起验收 |

## 3. 回流矩阵

| 页面 | 完成动作 | 回流页 | 回流要求 |
| --- | --- | --- | --- |
| `avatar-create` | 创建成功 | `avatar-manage` | 触发重新加载 |
| `order-publish-feedback` | 提交反馈成功 | 来源链路页 | 至少刷新处理状态或订单详情 |
| `order-acceptance` | 验收通过/驳回 | `order-detail` | 刷新订单聚合数据 |
| `order-processing` | 桥接完成 | 不保留 | 只做 redirect/replace |

## 4. 参数矩阵

### 4.1 分身链

- 分身主页：`avatarId`
- 分身好友页：`avatarId`
- 分身商单页：`avatarId`

### 4.2 订单链

- 订单详情：`orderId`
- 验收页：`orderId`
- 处理桥：`orderId`，建议同时带 `avatarId`、`requestId`
- 内容生成页：`orderId`，建议同时带 `avatarId`、`requestId`
- 发布反馈页：`requestId`，建议同时带 `orderId`、`avatarId`

## 5. 禁止事项

- 禁止非 Tab 页使用 `switchTab`
- 禁止用 `id` 作为分身路由参数
- 禁止绕过 `order-processing` 新增第二套处理链入口
- 禁止列表页直接形成新的“发布 -> 反馈 -> 验收”主链

## 6. 当前开发要求

- 所有观察入口回到主链时统一走 `order-processing`
- 所有分身详情跳转统一用 `avatarId`
- 所有页面路径以 `src/app.config.ts` 为准
