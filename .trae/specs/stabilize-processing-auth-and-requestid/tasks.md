# Tasks

- [x] Task 1: 修复 content_generation_requests 的 user_id 归属写入
  - [x] 在 ContentGenerationService.generateContent 新建记录时写入 user_id（来自 orders.user_id）
  - [x] 在复用/重置记录时若 user_id 为空则补齐
  - [x] 自检：越权访问 order-processing/status 应被拒绝（基于 user_id 生效）

- [x] Task 2: 稳定 acceptOrder 返回 requestId（首个平台）
  - [x] 修改 OrderDispatchService.startContentGeneration：返回 generateContent 的 results，并选取首个平台 requestId
  - [x] 修改 acceptOrder：在本次新接单且未生成记录时 await startContentGeneration 获取 requestId；若已存在则查询并返回
  - [x] 保持“只跟踪首个平台”的口径，不新增前端展示能力

- [x] Task 3: 纠正 recoverStuckGenerations 与视频 poller 的冲突
  - [x] recoverStuckGenerations 排除 generating_video（或排除 seedance_task_id 非空的记录）
  - [x] recoverStuckGenerations 用 SQL 条件筛选（status + updated_at）避免按状态拉全表再在 Node 过滤
  - [x] 对非视频 stuck 记录的终态写入策略与现有业务一致（不引入新状态机大改）

- [x] Task 4: 回归验证与质量门槛
  - [x] pnpm validate 通过
  - [x] 手工回归（最小集合）：
    - [x] A 用户生成记录，B 用户访问 /api/order-processing/status/:id 被拒绝
    - [x] 分身接单响应 requestId 非空，且用该 requestId 查询 status 有结果
    - [x] 视频 generating_video + seedance_task_id 非空时，10 分钟后不会被 recoverStuckGenerations 改成 preview（可通过日志/DB 观察）

# Task Dependencies
- Task 2 depends on Task 1（保证 status 鉴权依赖字段可信）
- Task 3 can be done in parallel with Task 2
