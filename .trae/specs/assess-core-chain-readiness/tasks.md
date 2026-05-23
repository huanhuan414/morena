# Tasks

## Batch A / P0：状态真源与 DTO 契约收口
- [x] Task 1: 冻结核心链路状态边界与唯一维护者
  - [x] SubTask 1.1: 明确 `orders`、`order_dispatch_requests`、`content_generation_requests`、`earnings`、`referrals` 的唯一职责
  - [x] SubTask 1.2: 输出每个状态字段的 canonical 字典，标记保留值、兼容值、废弃值
  - [x] SubTask 1.3: 标注哪些状态只能由同步器/聚合器推进，哪些接口禁止直接写入
- [x] Task 2: 收口主链 DTO 契约
  - [x] SubTask 2.1: 统一订单详情、处理记录、收益记录的返回字段
  - [x] SubTask 2.2: 明确前端允许消费的 canonical 字段，禁止页面继续自行拼装多套口径
  - [x] SubTask 2.3: 为历史兼容字段制定只读兼容策略和下线条件
    - 历史兼容字段只允许在单点 adapter 内只读映射，页面与业务写入统一只读 canonical 字段；当前受控兼容范围包括 `user_id -> userId`、`content_type -> contentType`、`created_at -> createdAt`、`summary_stats -> summaryStats`、`order_id/avatar_id -> orderId/avatarId`、`created_at -> createdAt(收益记录)`、`publish_feedback/link -> publishFeedback.publishUrl`。
    - 页面禁止再新增 `res.data || res.data.data`、`totalPrice`、`effectiveStatus`、按 `avatarStats` 反推 summary 计数等兜底分支；新增兼容映射必须先回写 spec/tasks。
    - 下线条件：后端 `/api/order/:id`、`/api/order-processing/status/:id`、`/api/earnings*` 连续两轮主链回归仅依赖 canonical DTO；仓库内对上述历史字段的直接页面消费 grep 清零；满足后即可删除 adapter 中对应只读映射。

## Batch B / P0：鉴权边界与接口信任链收口
- [x] Task 3: 收口用户端核心接口鉴权
  - [x] SubTask 3.1: 盘点分身、订单、收益相关接口的身份识别方式
  - [x] SubTask 3.2: 移除仅依赖 `x-user-id` 或等价可伪造头信息的放行逻辑
  - [x] SubTask 3.3: 统一未登录、越权、token 失效时的错误响应
  - 已收口：管理端鉴权与失效处理已在 `Task 4` 完成统一入口，跨端会话失效体验按管理端登录页跳转收敛。
- [x] Task 4: 收口管理端鉴权与失效处理
  - [x] SubTask 4.1: 统一管理端 token 校验入口和拦截逻辑
  - [x] SubTask 4.2: 统一管理端登录失效跳转与提示行为
  - [x] SubTask 4.3: 标记允许匿名访问与必须登录访问的接口边界

## Batch C / P0：前端主链跳转与回流收口
- [x] Task 5: 修复分身创建与回流闭环
  - [x] SubTask 5.1: 统一创建成功后的返回入口与刷新机制
  - [x] SubTask 5.2: 明确新建分身定位方式，避免返回后看不到新对象
  - [x] SubTask 5.3: 验证“我的分身 / 分身广场”现有 Tab 行为不回退
- [x] Task 6: 修复接单到生成的单一路径
  - [x] SubTask 6.1: 清理接单后重复跳转、错误路由和缺参跳转
  - [x] SubTask 6.2: 统一桥接页、生成页、处理中页的参数协议
  - [x] SubTask 6.3: 校准状态展示文案，只展示 canonical 主链状态
- [x] Task 7: 修复发布、反馈、验收回流闭环
  - [x] SubTask 7.1: 统一发布引导页和账号绑定页的往返关系
  - [x] SubTask 7.2: 统一反馈页到验收页的入口参数和状态依赖
  - [x] SubTask 7.3: 验证验收完成后的订单完成页、收益页入口不丢上下文

## Batch D / P1：邀请收益与结算一致性收口
- [x] Task 8: 修复邀请收益与订单收益状态口径
  - [x] SubTask 8.1: 统一 `earnings` 中订单收益与邀请收益的状态字典
  - [x] SubTask 8.2: 对齐 `referrals.status` 与收益流水到账口径
  - [x] SubTask 8.3: 统一收益记录页、余额汇总页和统计页的展示文案
- [x] Task 9: 修复邀请奖励触发与结算缺陷
  - [x] SubTask 9.1: 明确首个有效触发条件的服务端判定入口
  - [x] SubTask 9.2: 验证邀请奖励不会重复结算、漏结算或只改余额不写流水
  - [x] SubTask 9.3: 回写本轮未解决的统计残留或历史脏数据问题

## Batch E / P1：核心链路联调与回归基线固化
- [x] Task 10: 建立主链联调脚本与人工回归路径
  - [x] SubTask 10.1: 固化登录、下单支付、接单生成、发布反馈、验收结算、邀请收益 6 条主链回归路径
  - [x] SubTask 10.2: 为每条路径定义接口验证点、页面验证点和状态验证点
  - [x] SubTask 10.3: 形成最小可重复执行的联调步骤或脚本
- [x] Task 11: 回写完成度与残余风险
  - [x] SubTask 11.1: 标记每个任务包的完成状态和验证结果
  - [x] SubTask 11.2: 单独登记 P2 残留项，不混入已完成范围
  - [x] SubTask 11.3: 明确下一轮可以并行推进的任务和仍需串行冻结的任务

## Batch F / P2：低风险残留与兼容层登记
- [x] Task 12: 登记本轮不阻塞上线的兼容与长尾问题
  - [x] SubTask 12.1: 列出低频页面、历史兼容字段、旧状态文案残留
  - [x] SubTask 12.2: 标记每项残留的风险级别、影响范围和建议处理时机
  - [x] SubTask 12.3: 确认这些问题不会阻塞 P0/P1 验收结论

# Task Dependencies
- `Task 2` depends on `Task 1`
- `Task 3` depends on `Task 1`
- `Task 4` depends on `Task 3`
- `Task 5` depends on `Task 2`
- `Task 6` depends on `Task 2`
- `Task 7` depends on `Task 2` and `Task 6`
- `Task 8` depends on `Task 1`
- `Task 9` depends on `Task 8`
- `Task 10` depends on `Task 4`, `Task 5`, `Task 6`, `Task 7`, and `Task 9`
- `Task 11` depends on `Task 10`
- `Task 12` depends on `Task 11`

# Parallelization Notes
- `Task 3` 与 `Task 8` 可在 `Task 1` 完成后并行推进
- `Task 5` 与 `Task 6` 可在 `Task 2` 完成后并行推进
- `Task 7` 必须在 `Task 6` 完成后推进，避免先修发布页再被上游参数改动打回
- `Task 10` 只能在 P0 主链任务完成后执行，否则回归样本不稳定

# Execution Rules
- 每次提交只归属一个任务，不允许跨 Batch 混改
- 每个任务完成后至少执行一次 `pnpm validate`
- 任何新增状态、字段主口径、平台映射或参数协议变化，都必须先回写 spec 再改代码
- 下游实现涉及分身/订单执行细节时，优先引用 `clarify-avatar-product-logic` 已冻结规则，不重复生成第二套定义
