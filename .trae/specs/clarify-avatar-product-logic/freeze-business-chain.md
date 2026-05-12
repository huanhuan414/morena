# A-1 冻结业务主链

## 1. 结论

### 1.1 单一业务主链

主链固定为：

`分身创建 -> 发单 -> 智能匹配/派单 -> 接单 -> 处理桥 -> 内容生成 -> 发布引导 -> 发布反馈 -> 待验收 -> 验收完成 -> 完结`

### 1.2 单一验收主链

验收主链固定为：

`订单详情 -> 验收页 -> 通过验收 / 驳回修改 -> 完结或回到生成/发布链继续处理`

## 2. 主链页面冻结

| 阶段 | 页面 | 说明 |
| --- | --- | --- |
| 分身创建 | `/pages/avatar/avatar-create/index` | 创建分身 |
| 发单 | `/pages/order/order-create/index` | 创建订单 |
| 派单 | `/pages/order/order-matching/index` | 智能匹配与派单 |
| 接单 | `/pages/pending-order/index` | 分身接单 |
| 处理桥 | `/pages/order/order-processing/index` | 统一链路桥接页 |
| 内容生成 | `/pages/order/order-content-creation/index` | 生成内容 |
| 发布引导 | `/pages/order/order-publish-guide/index` | 指导去平台发布 |
| 发布反馈 | `/pages/order-publish-feedback/index` | 回填发布凭证 |
| 验收 | `/pages/order/order-acceptance/index` | 发单方验收 |
| 完结观察入口 | `/pages/order/order-detail/index` | 查看订单聚合结果 |

## 3. 主链动作冻结

### 3.1 创建与派单

- 用户先创建分身。
- 发单方创建订单。
- 发单后进入智能匹配页完成派单。

### 3.2 接单与处理

- 分身从待接订单页接单。
- 接单后统一进入 `order-processing` 桥接页。
- `order-processing` 只做桥接，不承载第二套业务流程。

### 3.3 生成与发布

- 内容生成统一在 `order-content-creation` 完成。
- 发布前统一走 `order-publish-guide`。
- 发布后统一走 `order-publish-feedback` 提交凭证。

### 3.4 验收与完结

- 发单方统一从订单详情进入验收页。
- 验收通过只走 processing 验收接口。
- 驳回只走 revision 流程。

## 4. 旁路处理规则

### 4.1 允许存在的旁路

- 首页弹窗接单
- 订单广场接单
- 已生成内容列表查看
- 分身商单管理入口

### 4.2 旁路约束

- 所有旁路只允许作为主链入口或观察入口。
- 所有旁路不得形成第二套业务闭环。
- 所有旁路进入处理链时，必须统一导向 `order-processing` 桥接页或主链规定页面。

## 5. 禁止事项

- 禁止在旧页面中保留独立的 `confirm + publish + accept` 闭环。
- 禁止从任意列表页直接形成新的发布反馈主链。
- 禁止订单详情页直接改订单为 `completed`。
- 禁止新增不经过 `order-processing` 或 canonical 主链的处理入口。

## 6. 当前实现要求

- `order-processing` 是桥接页，不是第二套处理页。
- `generated-content`、`order-detail`、`avatar-orders` 等页面的操作入口必须回到统一主链。
- 验收只认 `order-acceptance` 页面和统一验收接口。

## 7. A-1 验收结果

- 已冻结单一业务主链。
- 已冻结单一验收主链。
- 已明确旁路只允许作为入口或观察入口。
- 已明确禁止形成第二套业务闭环。
