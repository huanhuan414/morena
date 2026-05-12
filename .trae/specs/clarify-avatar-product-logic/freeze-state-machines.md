# A-2 冻结状态机

## 1. 范围

- 订单状态机
- 派单状态机
- processing 状态机
- 发布状态机

## 2. 订单状态机

### 2.1 状态集合

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

### 2.2 转移规则

- `pending_payment -> open | cancelled`
- `open -> pending_dispatch | cancelled`
- `pending_dispatch -> pending_acceptance | cancelled`
- `pending_acceptance -> in_progress | rejected | cancelled`
- `in_progress -> submitted | awaiting_acceptance | revision_requested | cancelled`
- `submitted -> awaiting_acceptance | revision_requested`
- `awaiting_acceptance -> completed | revision_requested`
- `revision_requested -> in_progress`
- `completed` 不再流转
- `cancelled` 不再流转
- `rejected` 不再流转

### 2.3 业务含义

- `pending_payment`：订单已创建但未完成支付
- `open`：订单已可用，等待进入分派
- `pending_dispatch`：等待平台匹配或派单
- `pending_acceptance`：已派单，等待分身接单
- `in_progress`：至少有一个分身已接单并进入处理链
- `submitted`：内容已产出并具备继续发布条件
- `awaiting_acceptance`：发布反馈已提交，等待发单方验收
- `revision_requested`：发单方要求修改，返回继续处理链
- `completed`：所有必需内容验收完成

## 3. 派单状态机

### 3.1 状态集合

- `pending`
- `accepted`
- `declined`
- `completed`

### 3.2 转移规则

- `pending -> accepted | declined`
- `accepted -> completed`
- `declined` 不再流转
- `completed` 不再流转

### 3.3 兼容规则

- 历史 `confirmed` 统一归一到 `accepted`

## 4. Processing 状态机

### 4.1 canonical 状态集合

- `queuing`
- `generating`
- `preview`
- `publishing`
- `published`
- `awaiting_acceptance`
- `completed`
- `failed`

### 4.2 转移规则

- `queuing -> generating | failed`
- `generating -> preview | failed`
- `preview -> publishing | generating | failed`
- `publishing -> published | failed`
- `published -> awaiting_acceptance | failed`
- `awaiting_acceptance -> completed | generating`
- `completed` 不再流转
- `failed -> generating | preview`

### 4.3 历史状态兼容映射

- `pending -> generating`
- `processing -> generating`
- `generating_text -> generating`
- `generating_images -> generating`
- `revision_requested -> preview`
- `feedback_submitted -> awaiting_acceptance`
- `settled -> completed`
- `done -> completed`

## 5. 发布状态机

### 5.1 状态集合

- `manual`
- `success`
- `failed`

### 5.2 含义

- `manual`：需要人工去平台完成发布
- `success`：平台已完成发布动作
- `failed`：平台发布验证失败或发布失败

### 5.3 口径

- `publishStatus.platforms` 只存 canonical 平台键
- `publishStatus.platformStatus[platform].status` 只允许 `manual | success | failed`

## 6. 禁止事项

- 禁止在前端页面新增一套 status 映射表覆盖 canonical 口径
- 禁止后端 service 返回未冻结的新 processing 状态
- 禁止订单状态由多个 service 分别独立推导
- 禁止页面用 `settled/done/feedback_submitted/revision_requested` 作为展示主口径

## 7. 当前开发要求

- 订单聚合以 `OrderService` 为唯一订单状态事实源
- processing 展示只消费 canonical 状态
- 派单状态只允许 `pending/accepted/declined/completed`
