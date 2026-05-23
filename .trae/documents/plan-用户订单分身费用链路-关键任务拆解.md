# 用户 / 订单 / 分身 / 费用链路：关键任务拆解（可执行、可验收）

## Summary
- 目标：把“用户身份 → 分身 → 发单/支付 → 派单/接单 → 履约/验收 → 结算/提现/订阅权益”全链路的关键问题，整理为可执行、可验收的任务清单，并为每条任务补齐：需求说明、架构师关注点、开发落地步骤、验收标准。
- 优先级口径：线上风险优先（资金/支付/结算一致性、状态越界写入、关键字段错写、数据错乱）。
- 验收粒度：接口级验收（API 输入输出 + DB 断言），必要时补充最小场景回归用例。

## Premise / Constraints / Boundaries / Endgame
### Premise
- 当前主链路已贯通，但存在多状态源并存、状态字典不一致、服务边界被绕过、结算对账分裂等系统性问题，导致线上风险（资金/订单状态/收益一致性）与体验问题（列表不出、验收返工语义混乱）并发。

### Constraints
- 最小改动优先：以“收敛口径 + 修正边界”优先于大规模重构。
- 不引入新依赖、不做无关格式化/重排。
- 风险控制：每个任务必须具备可回滚策略与数据修复方案（必要时提供一次性脚本/SQL）。

### Boundaries
- 本计划覆盖：后端服务逻辑 + DB 约束/数据修复 + 关键接口回归 + 运维/监控/Runbook。
- 本计划不覆盖：业务功能扩展（新玩法/新页面），除非与风险修复强绑定。

### Endgame
- 单一状态口径可追溯：订单/派单/履约/收益的 canonical 状态与写入边界清晰、可自动校验。
- 资金链路可对账：支付→订单→收益→余额/流水→提现闭环一致，异常可定位可回滚。
- 线上数据可治理：脏数据有识别口径、修复脚本、与持续预防（约束/代码检查）。

## Current State Analysis（基于代码现状）
### 1) 状态口径分裂 + 越界写入
- Canonical 字典已在 [order-status.ts](file:///Users/aiden/Projects/morena/server/src/modules/order/order-status.ts) 定义，但多个模块仍在直接写 `orders.status` 或使用非 canonical 值，导致聚合推导、列表过滤、通知触发不稳定。
- 代表性越界点：
  - 派单接单成功后直接 `UPDATE orders.status='in_progress'`（绕过 OrderService 校验/通知）[order-dispatch.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order-dispatch/order-dispatch.service.ts)
  - 订单聚合 `syncOrderStatusByContent` 直接 UPDATE（绕过转移校验）[order.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order/order.service.ts)

### 2) 支付回调可靠性风险
- 微信支付回调对 raw body 的依赖不明确，若被 JSON 化会导致签名校验失败，表现为“支付成功但订单未激活”[payment.controller.ts](file:///Users/aiden/Projects/morena/server/src/modules/payment/payment.controller.ts)。

### 3) 派单关键字段错写
- 一键派单插入 `order_dispatch_requests.user_id` 时存在把手机号写入 user_id 的风险（应为用户 UUID）[order-dispatch.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order-dispatch/order-dispatch.service.ts)。

### 4) 返工 vs 拒绝语义混乱
- 履约返工应为 `revision_requested`，但存在写成 `rejected` 的路径，导致聚合推导与报表/体验错位[order-processing.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order-processing/order-processing.service.ts)。

### 5) 结算链路分裂、对账困难
- 结算存在两套实现：OrderService.triggerSettlement（含 remainder 处理）与 OrderProcessingService 直接写 settled 并加余额，导致收益状态边界失效、分钱不一致、审计困难[order.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order/order.service.ts)、[order-processing.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order-processing/order-processing.service.ts)。

### 6) 订阅 plan 主键/字段名不一致 + 权益放开
- subscription_plans 关联键与 checkSubscriptionStatus 字段使用不一致，可能导致订阅状态判断失真；同时权限校验被硬编码放开，产品预期与真实行为偏离[subscription.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/subscription/subscription.service.ts)。

## Proposed Changes：关键 Tasks（需求 / 架构师 / 开发 / 验收）

### T01｜建立“状态单一真值表”与写入边界守卫（基础治理任务）
**需求（What/Why）**
- 统一 `orders.status / order_dispatch_requests.status / content_generation_requests.status / earnings.status` 的 canonical 值、兼容映射、允许转移与写入者边界，避免模块各写各的导致线上不可控。

**架构师关注点**
- 目标不是“删兼容”，而是“所有写入都过同一扇门”：状态变更走 owner service（OrderService / OrderDispatchService / OrderProcessingService / EarningService）。
- 增加可观测性：任何非 canonical 写入都应被记录与阻断（可先告警后阻断）。

**开发落地（How）**
- 影响文件（核心）：
  - [order-status.ts](file:///Users/aiden/Projects/morena/server/src/modules/order/order-status.ts)：补齐字典/兼容映射、明确 deprecated 列表（现有基础上完善）
  - [order.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order/order.service.ts)：所有 orders.status 更新必须走 `updateOrderStatus()`
  - [order-dispatch.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order-dispatch/order-dispatch.service.ts)：禁止直写 orders.status
  - [order-processing.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order-processing/order-processing.service.ts)：禁止直写 orders.status（通过 OrderService 接口）
- 交付物：
  - 一张“真值表”文档（在本 plan 后续附录落地或单独 md）：
    - canonical 值
    - 允许来源（兼容值 → canonical）
    - 允许去向（转移图）
    - owner（唯一写入者）
    - 当前越界写入点（文件/函数）

**验收（接口级）**
- 给定一组 status 输入（包含兼容值），normalize/derive 的输出符合真值表。
- 任何绕过 owner 的 `UPDATE ... status=` 在代码层被替换为 service 调用（通过 grep 检查 + 关键用例跑通）。

---

### T02｜消除 orders.status 越界写入：统一走 OrderService.updateOrderStatus
**需求**
- 修复派单/聚合等模块直接 UPDATE orders.status 的行为，确保转移校验、通知、幂等逻辑集中在 OrderService。

**架构师关注点**
- 状态变更要幂等：重复触发不应抖动；并发下保证最终一致性（谁是权威写入者）。
- 保留 sync 的“读取推导”能力，但把“写回”改为走受控入口（避免非法转移）。

**开发落地**
- 影响文件：
  - [order-dispatch.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order-dispatch/order-dispatch.service.ts)：把“接单满员→in_progress”改为调用 OrderService（或暴露受控方法）
  - [order.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order/order.service.ts)：`syncOrderStatusByContent` 不再直写，改为 `updateOrderStatus` 并校验允许转移
- 兼容策略：
  - 若 derive 出来的 nextStatus 不在允许转移内：记录告警并跳过写入（避免把线上脏状态进一步污染）。

**验收**
- 构造订单在不同阶段（open/pending_dispatch/pending_acceptance/in_progress/submitted/awaiting_acceptance）下的推导写回：不会出现非法转移写入。
- 派单接单达到 requiredCount 时，订单状态通过 OrderService 正确进入 `in_progress`，且通知逻辑触发一次。

---

### T03｜支付回调可靠性：确保微信 notify 使用 raw body 校验签名并幂等落单
**需求**
- 防止支付成功但订单未激活；避免重复回调导致重复更新/重复记账。

**架构师关注点**
- 支付回调是资金链路入口：必须具备幂等键（transactionId/outTradeNo）与严格验签、严格状态机（pending→paid）。
- 可观测性：验签失败、订单不存在、金额不匹配必须可追踪。

**开发落地**
- 影响文件：
  - [payment.controller.ts](file:///Users/aiden/Projects/morena/server/src/modules/payment/payment.controller.ts)：确保获取到原始 XML（raw body），避免 JSON stringify 破坏签名输入
  - [wechat-pay.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/payment/wechat-pay.service.ts)：幂等处理（已 paid 则直接返回 success），并校验金额/商户号/订单号一致
  - Nest 全局 body parser 配置入口（定位 `main.ts` 或相关 middleware 配置）：为特定 route 保留 raw body
- 运维落地：
  - 增加回调错误日志聚合与告警（例如：连续验签失败、订单未匹配）
  - 增加支付对账脚本入口（根据 payment_orders 扫描 pending 超时单）

**验收**
- 用固定样例 XML（含签名）回放：验签通过并正确落库 `payment_orders.status=paid`、订单进入 open/pending_dispatch。
- 重放同一通知 3 次：结果幂等（无重复更新、无重复结算副作用）。

---

### T04｜派单关键字段纠正：order_dispatch_requests.user_id 必须写用户 UUID
**需求**
- 修复一键派单等路径把手机号写入 user_id 导致的“订单归属/收益归属/列表查询”错位。

**架构师关注点**
- 数据模型一致性：user_id 永远是 users.id（UUID）；手机号只能在 phone 字段。
- 对存量脏数据给出识别与修复策略（否则上线后仍持续污染）。

**开发落地**
- 影响文件：
  - [order-dispatch.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order-dispatch/order-dispatch.service.ts)：插入派单记录时强制使用 avatar.user_id（或 join users 取 id）
  - DB：必要时增加约束/索引辅助识别（例如 user_id 格式校验做不到可先用离线校验）
- 数据修复：
  - 输出 SQL：找出 user_id 非 UUID 且可通过 avatars.phone/users.phone 映射回用户的记录，并修复为 users.id

**验收**
- 插入派单记录后：user_id 可 join users 表且不为空。
- 数据修复 SQL 在预览环境跑完后：派单记录 user_id 全部满足 UUID 格式（或至少可 join users）。

---

### T05｜返工语义统一：revision_requested 不得写成 rejected
**需求**
- 修复履约返工路径误写 rejected，避免“需修改”被当成“失败/拒绝”，影响订单状态推导与结算触发。

**架构师关注点**
- 返工是“继续履约”的中间态，不应触发终态（rejected/cancelled）副作用（例如结算、终止派单）。
- 需要明确：驳回(rejected)的定义（是分身拒单？还是产出失败？还是平台审核失败？）。

**开发落地**
- 影响文件：
  - [order-processing.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order-processing/order-processing.service.ts)：把 requestRevision() 的状态写入改为 `revision_requested`，并调整派单侧状态（必要时新增“等待修改”字段或复用 dispatch status）
  - [order-status.ts](file:///Users/aiden/Projects/morena/server/src/modules/order/order-status.ts)：确保 derive 规则对 revision_requested 生效且优先级正确

**验收**
- 调用“申请修改”接口后：
  - content_generation_requests.status = revision_requested
  - orders.status 推导/同步进入 revision_requested
  - 相关列表（发单方/接单方）可区分“返工”与“拒绝”

---

### T06｜结算链路收敛：仅保留一套 settlement 流程（含 remainder 分摊与幂等）
**需求**
- 避免“订单完成但未结算/重复结算/分钱不一致”，统一收益状态机与余额变更口径。

**架构师关注点**
- 结算必须满足：
  - 幂等：同一 orderId + avatarId 只能结算一次
  - 可审计：收益明细与余额变更应可追溯
  - 一致性：参与者集合与订单完成条件一致
- 明确“完成”的权威条件：由派单 completed + 履约 settled 决定，而不是多个地方各算一遍。

**开发落地**
- 影响文件：
  - [order.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order/order.service.ts)：启用/完善 `triggerSettlement()` 作为唯一入口（包含 remainder 分摊逻辑）
  - [order-processing.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order-processing/order-processing.service.ts)：移除/替换“直接写 settled + 加余额”的路径，改为调用 EarningService 或 OrderService 的结算入口
  - [earning.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/earning/earning.service.ts)：提供“创建 pending → settle → 入账”的原子流程，确保事务一致性
- DB 约束建议：
  - `earnings` 增加唯一约束（例如 `(order_id, avatar_id, type)`）防止重复入账（需要评估现有数据是否允许）

**验收**
- 对同一订单重复触发结算 3 次：earnings 不重复、余额不重复增长。
- 结算金额总和 = 订单预算（允许最后一单承担 remainder 或按规则分摊一致）。

---

### T07｜资金流水补齐：余额变更必须落 transactions（最小可审计闭环）
**需求**
- 当前直接改 users.balance/frozen_balance 会让财务审计与用户流水对不上；需要在入账/冻结/解冻/提现确认时写 transactions。

**架构师关注点**
- transactions 是审计账本：写入必须与余额变更同事务（或可回放重建）。
- 字段设计需能支持：来源单据（orderId/paymentOrderId/withdrawalId）、方向（in/out）、前后余额（可选）。

**开发落地**
- 影响文件：
  - [earning.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/earning/earning.service.ts)：在 settleEarning、requestWithdrawal、confirmWithdrawal、rejectWithdrawal 等路径写 transactions
  - 可能涉及的提现/结算调用点（同上）
- DB：确认 [order_tables.sql](file:///Users/aiden/Projects/morena/server/src/storage/database/schema/order_tables.sql) 中 transactions 字段是否满足需求；不足则补 migration

**验收**
- 任意一次入账/提现确认后：
  - users.balance/frozen_balance 变化可由 transactions 汇总解释（至少在接口级能对上）
  - 同一业务动作只产生一次流水（幂等）

---

### T08｜订阅计划与状态字段修复：plan_id 统一、到期判断正确、权益策略可配置
**需求**
- 修复 subscription_plans 键使用混乱、checkSubscriptionStatus 字段名错误导致的订阅失真；并把“测试阶段放开权益”改为可配置开关，避免产品预期错位。

**架构师关注点**
- 订阅是商业策略核心：必须保证 plan 选择、激活、查询、到期判断一致；且权益校验必须可灰度。

**开发落地**
- 影响文件：
  - [subscription.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/subscription/subscription.service.ts)：
    - `checkSubscriptionStatus` 使用 `subscription.endDate`（现状用 end_date）并返回正确 planId
    - `checkPermission` 把“放开”改为受环境变量/配置控制（例如 `SUBSCRIPTION_ENFORCE=true/false`）
  - [payment.controller.ts](file:///Users/aiden/Projects/morena/server/src/modules/payment/payment.controller.ts)：确认创建订阅支付时 plan 的查找键与激活一致
- 运维落地：
  - 提供开关策略：默认线上可先不强制（false），但能一键开启并可回滚

**验收**
- 对一个 active 订阅用户：接口返回 is_active 正确、expires_at 正确递增、plan 信息可查。
- 开关开启后：超出分身数量/无接单权限的用户被接口拒绝（返回明确 reason）。

---

### T09｜数据修复与防再污染（一次性修复 + 持续防护）
**需求**
- 针对已存在的脏数据（错误 status、错误 user_id、孤儿派单等），提供可执行 SQL/脚本修复，并在代码/DB 层持续防护。

**架构师关注点**
- 数据修复必须“可重复执行、可回滚、可审计”：先标记/备份，再修复。
- 防护优先级：关键唯一索引 > 代码幂等 > 定时校验任务。

**开发落地**
- 修复内容（最小集）：
  - 派单重复/超卖：对 `(order_id, avatar_id)` 去重并加唯一索引（需评估线上数据）[order_tables.sql](file:///Users/aiden/Projects/morena/server/src/storage/database/schema/order_tables.sql)
  - 非 canonical 状态值：统一映射到 canonical（按 [order-status.ts](file:///Users/aiden/Projects/morena/server/src/modules/order/order-status.ts) compatibility）
  - user_id 非 UUID：回填为 users.id（见 T04）
- 运维：
  - 提供执行顺序、备份策略、执行后抽样校验 SQL

**验收**
- 修复前后对比报表（接口级）：脏数据数量归零/显著下降；关键 join 查询不再出现空关联。

---

### T10｜运维与可观测性：关键链路告警 + Runbook（支付/结算/状态异常）
**需求**
- 把高风险点纳入监控/告警与 SOP：支付回调失败、pending 超时、重复结算、状态非法转移、生成任务卡死等。

**架构师关注点**
- “发现问题”比“事后修”更重要：需要最小可用的指标与告警阈值。

**开发落地**
- 后端日志标准化（不记录敏感信息）：关键事件输出统一字段（orderId/userId/paymentOrderId/status/from/to）
- 运行手册：
  - 如何判断支付回调失败
  - 如何重放/补偿支付
  - 如何定位未结算订单
  - 如何执行数据修复脚本与回滚
- 可能触点：
  - PM2 日志聚合与关键关键字告警（结合现有部署方式）

**验收**
- 人工触发一条“验签失败/非法状态写入”的模拟：日志可定位，Runbook 可执行并产出预期修复动作。

## Assumptions & Decisions（已锁定）
- 范围：全链路 + 运维。
- 优先级：线上风险优先。
- 验收粒度：接口级验收。

## Verification（执行阶段统一验收套路）
- 针对每个 Task：
  - 提供 1–3 条接口级用例（请求示例 + 预期响应 + 预期 DB 断言）
  - 对关键资金链路（T03/T06/T07）增加幂等性回放用例
- 统一回归集（最小集）：
  - 下单→支付→订单 open
  - 派单→接单满员→订单 in_progress
  - 提交→验收/返工→状态推导
  - 完成→结算→余额/流水一致→提现

## Execution Order（建议实施顺序）
1) T03 支付回调可靠性（资金入口）
2) T06 结算链路收敛 + T07 流水补齐（资金出口）
3) T02 orders.status 越界写入收口 + T01 真值表/边界守卫（系统性稳定）
4) T04 派单 user_id 修复 + T09 数据修复与防再污染（存量治理）
5) T05 返工语义统一（避免错误终态副作用）
6) T08 订阅键/到期/权益开关（商业策略可控）
7) T10 监控告警与 Runbook（长期防复发）

