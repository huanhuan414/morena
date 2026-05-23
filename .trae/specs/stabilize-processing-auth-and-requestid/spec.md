# 订单处理状态链路最小修复 Spec

## Why
当前“接单→生成→查询进度→发布/验收”的主链路存在鉴权缺口与 requestId 不稳定问题，会导致状态命中不确定、跨用户数据泄露风险，以及视频生成状态机互相打架。

## What Changes
- 生成记录写入 user_id：在创建/复用 content_generation_requests 时确保写入并补齐 `user_id`，使订单处理状态查询具备可靠的资源归属校验。
- 稳定 requestId 返回：分身接单接口在返回结果中确保包含“首个平台”的 `requestId`，避免前端 fallback 使用 orderId 查询导致命中不确定。
- 纠正 stuck 恢复逻辑：`recoverStuckGenerations` 不再对 `generating_video`（尤其带 `seedance_task_id`）做 10 分钟置 `preview` 的越权终态；并改为使用 SQL 条件筛选避免全表扫描。
- 降低系统噪音（最小范围）：不在本次变更中调整前端轮询频率与 UI 展示，仅保证后端输出稳定、鉴权正确、状态机一致。

## Impact
- Affected specs: 订单处理状态查询、分身接单返回、内容生成任务治理、鉴权边界
- Affected code:
  - server/src/modules/content-generation/content-generation.service.ts
  - server/src/modules/order-dispatch/order-dispatch.service.ts
  - （尽量不改）server/src/modules/order-processing/order-processing.service.ts
  - server/src/modules/order-processing/order-processing.controller.ts（不改逻辑，仅受鉴权数据影响）

## ADDED Requirements
### Requirement: 生成记录归属写入
系统 SHALL 在创建或复用 `content_generation_requests` 时写入并维护 `user_id`（订单所有者）。

#### Scenario: 新建生成记录
- **WHEN** 系统为 `orderId + avatarId + platform` 创建新的生成记录
- **THEN** 生成记录 `user_id` 等于 `orders.user_id`

#### Scenario: 复用/重试生成记录
- **WHEN** 系统将已有生成记录重置为 `processing` 进入新一轮生成
- **THEN** 若该记录 `user_id` 为空，则补齐为 `orders.user_id`

## MODIFIED Requirements
### Requirement: 订单处理状态查询的访问控制
系统 SHALL 仅允许资源所有者查询其订单处理状态；资源所有者以 `content_generation_requests.user_id` 作为唯一可信来源。

#### Scenario: 正常访问
- **WHEN** 用户查询自己的 `requestId` / `orderId` 对应处理状态
- **THEN** 返回处理状态数据

#### Scenario: 越权访问
- **WHEN** 用户查询不属于自己的 `requestId` / `orderId` 对应处理状态
- **THEN** 返回“无权访问”错误

### Requirement: 分身接单返回稳定 requestId
系统 SHALL 在分身接单成功响应中返回“首个平台”的 `requestId`，且该 requestId 对应的生成记录已存在于数据库（无需等待真实生成完成）。

#### Scenario: 接单成功
- **WHEN** 分身成功接单
- **THEN** 返回 `requestId` 非空，且能通过 `GET /api/order-processing/status/:requestId` 查询到记录

### Requirement: 视频生成状态机一致性
系统 SHALL 仅由视频轮询任务（Seedance poller）推进 `generating_video` 的终态；卡住恢复逻辑不得将仍在生成的视频提前置为 `preview`。

#### Scenario: 视频生成进行中
- **WHEN** 生成记录 `status='generating_video'` 且 `seedance_task_id` 非空
- **THEN** `recoverStuckGenerations` 不得将其更新为 `preview`

## REMOVED Requirements
无
