# 全链路性能与并发治理计划（前端 + 后端 + 数据库）

## Premise
- 现状：前端存在轮询/分页/输入联动带来的高频请求与竞态；后端部分“查询接口”返回体过大、存在 `SELECT *`、以及读接口中夹带写放大；数据库层存在缺索引与不可索引过滤（如 `LIKE '%"platform"%`）风险点。
- 目标：把“请求风暴、并发叠加、竞态覆盖、响应体过大、慢 SQL/全表扫描、上传内存峰值”系统性收敛到可控范围，并形成可复用的治理基线。

## Constraints
- 不引入重量级新依赖；允许新增少量轻量工具函数/拦截器/SQL hotfix。
- 允许改动前端 + 后端 + 数据库（用户已确认允许新增索引/SQL 迁移）。
- 允许加入“仅 dev 可开关”的请求性能采样（用户已确认）。
- 质量红线：每个阶段至少跑一次 `pnpm validate`；避免无关格式化/重排。

## Boundaries
- 允许改动范围（按里程碑逐步推进，每次 1–3 个文件 + 1 个 SQL 文件）：
  - 前端：`src/network.ts`、轮询/生成/支付相关页面与 hooks（见下方清单）
  - 后端：`server/src/modules/order-processing/*`、`server/src/modules/order/*`、`server/src/modules/content-generation/*`、`server/src/modules/ai-skill/*`、`server/src/modules/upload/*`
  - DB：`server/src/storage/database/schema/migrations/*.sql` 追加 hotfix
- 禁止事项：
  - 不做“无目标的大重构”（例如全量替换请求库/全量改路由）
  - 不默认启用生产级采样与 debug 日志

## Endgame（验收标准）
- 前端：轮询接口做到“同 identifier 单飞”；列表/搜索/触底不再出现并发叠加；关键写接口（支付/生成/派单）具备按钮单飞锁。
- 后端：轮询接口提供“轻量视图”避免返回正文/大量资源；消除 `SELECT *` 带来的大字段读 IO；读接口不再在主路径执行写库；慢 SQL 命中索引。
- DB：核心查询（open orders、status/cron 扫描）具备匹配索引；平台过滤不再依赖 `%LIKE%` 导致全表扫描。
- 可观测：dev 可开关输出 Top 慢请求/Top 高频/同 key 并发峰值，为后续迭代提供数据。

---

## Current State Analysis（已定位问题点）

### 前端（请求触发/并发/竞态）
- 轮询密集且可能重复：
  - 订单生成页 `2s` 轮询 `/api/order-processing/status/:id`，无 `dedupKey`（现状代码示例见 [order-content-creation](file:///Users/aiden/Projects/morena/src/package-order/pages/order-content-creation/index.tsx#L257-L291)）。
  - 多个页面都在读同一类 status（order-completed、order-acceptance-feedback、order-publish-feedback 等），存在“同 requestId 多处轮询/重复拉取”可能。
- 昂贵操作易被重复触发：
  - 支付重试 `/api/order/:id/repay`、生成重试 `/api/content-generation/retry/:id`、技能生成 `/api/ai-skill/generate`（静态扫描已定位调用点）。
- 扇出并发：
  - mind-chat 对每个 avatar 拉 skills，已改为有限并发池（正向）。

### 后端（返回体/读写放大/慢查询）
- `/api/order-processing/status/:id`：
  - 返回体可能包含正文、images/videos 等，轮询时带宽与序列化开销巨大。
  - 读路径包含“卡住检测并 UPDATE”写库（见 [order-processing.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order-processing/order-processing.service.ts#L492-L523)），轮询越频繁写放大越严重。
- `/api/order/open`：
  - 平台过滤使用 `o.platforms LIKE '%"xx"%' OR o.platform = ?`（见 [order.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order/order.service.ts#L641-L650)），`%LIKE%` 基本不可索引，叠加 `COUNT(*)` 易慢。
- `content-generation`：
  - `getContentById` 与 `getHistory` 使用 `SELECT *`（见 [content-generation.controller.ts](file:///Users/aiden/Projects/morena/server/src/modules/content-generation/content-generation.controller.ts#L290-L297) 与 [content-generation.controller.ts](file:///Users/aiden/Projects/morena/server/src/modules/content-generation/content-generation.controller.ts#L397-L414)），会把大字段（content/images/metadata 等）一并读出；history 还会原样返回，存在体积与匿名边界风险。
- `ai-skill`：
  - 存在硬编码密钥回退值（见 [ai-skill.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/ai-skill/ai-skill.service.ts#L19-L22)），属于高危安全问题（同时也会阻断上线治理）。

### DB（索引/扫描）
- open orders：`is_paid + status + priority + created_at` 排序过滤组合需要联合索引支撑；平台过滤需要可索引字段。
- content_generation_requests：cron/轮询常按 `status + seedance_task_id + updated_at` 查，需要联合索引以避免全表扫描。

---

## Proposed Changes（系统性优化方案，按里程碑拆解）

### Milestone 0：Dev 可开关的请求性能采样（先拿数据，再精准打点）

**目标**
- 在 dev 环境下输出：
  - Top 慢请求（p50/p95/最大耗时）
  - Top 高频 endpoint
  - 同 dedupKey 的并发峰值、复用次数
  - 响应体粗略大小（可用 `JSON.stringify(res.data).length` 近似，设上限避免卡顿）

**改动文件**
- 前端：[network.ts](file:///Users/aiden/Projects/morena/src/network.ts)（已有 dedup 机制，适合在这里做采样聚合与开关）

**实现要点**
- 通过 `Taro.getStorageSync('__net_debug__') === '1'` 或编译常量控制开关。
- 采样数据仅留内存（Map 统计），每 N 次请求打印一次摘要，避免刷屏。

**验收**
- 打开开关后能看到摘要；关闭后零输出、零额外序列化开销。

---

### Milestone 1：前端“轮询/昂贵操作”单飞治理（把高频和高成本先收口）

**1.1 轮询统一：同 identifier 单飞**
- 目标：`/api/order-processing/status/:id`、`/api/ai/status/:requestId` 这类轮询，做到同 identifier 只有一个 inflight（其它订阅者复用），避免多页面/重进叠加。
- 改动建议：
  - 在 `src/network.ts` 之上新增一个轻量 `pollingManager`（文件可选：`src/utils/polling.ts` 或就地在相关页面内封装），对 key（例如 `order-processing-status:${id}`）维护：
    - inflight Promise
    - lastResult + lastAt（可选，短 TTL 只用于同一轮询 tick 内复用，不是缓存产品语义）
    - subscriptions 计数，最后一个订阅取消时停止定时器
- 优先落地点（文件）：
  - [order-content-creation](file:///Users/aiden/Projects/morena/src/package-order/pages/order-content-creation/index.tsx)（2s轮询，且打印全量 JSON，需减压）
  - [order-create](file:///Users/aiden/Projects/morena/src/package-order/pages/order-create/index.tsx)（AI status 轮询）
  - 其它 status 消费页（order-completed、order-acceptance-feedback、order-publish-feedback 等）

**1.2 昂贵/副作用操作：按钮单飞锁 + dedupKey（只对“连点同动作”去重）**
- 目标：repay/retry/generate/dispatch-all/trust-all 等，防连点、避免多任务并行。
- 策略：
  - UI 层：禁用按钮/显示 loading
  - 逻辑层：按 actionKey 单飞（例如 `repay:${orderId}`）
  - Network 层：可选 `dedupKey`（只复用“同动作同参数”的并发请求）
- 优先落地点（文件）：
  - `order-detail`、`order-create`（repay）
  - `order-content-creation`、`generated-content`（retry）
  - `order-matching`（dispatch-all）
  - 首页 `avatar/trust/all`

**验收**
- 快速连点不会触发多次请求；页面离开后轮询停止；同 id 多处轮询不会并发叠加。

---

### Milestone 2：后端“轮询接口轻量化 + 去写放大”（配合前端降频才有乘数效应）

**2.1 order-processing/status 提供 lite 视图**
- 目标：轮询只拿 `status/progress/error/updatedAt`，正文与资源按需拉取（或只在终态拉取一次）。
- 改动文件：
  - [order-processing.controller.ts](file:///Users/aiden/Projects/morena/server/src/modules/order-processing/order-processing.controller.ts)
  - [order-processing.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order-processing/order-processing.service.ts)
- 实现方案（决定性细节）：
  - `GET /status/:id?view=lite`：
    - service 返回裁剪后的对象（不包含 `generatedContent.content/images/videos`）
  - 前端轮询改用 `view=lite`；仅在终态或用户进入详情页时请求 full

**2.2 把“卡住检测 UPDATE”移出读路径**
- 现状：轮询读接口内执行 UPDATE（见 [order-processing.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order-processing/order-processing.service.ts#L501-L523)）。
- 方案：
  - 保留读接口纯读：只计算并返回 “suspectedStuck=true + stuckElapsed”
  - 新增/复用定时任务（如每 1-5 分钟跑一次）统一标记 stuck（批量更新，带 where 条件下推）

**验收**
- 轮询响应体显著缩小；轮询不再引入写放大；服务端 CPU/DB 写入明显下降。

---

### Milestone 3：open orders 平台过滤与索引体系（解决可预期的慢 SQL）

**3.1 DB 侧：提供可索引的主平台字段**
- 问题：`platforms LIKE '%"xx"%'` 无法用索引。
- 推荐方案（最小侵入）：
  - 新增生成列 `primary_platform`（从 `platforms` JSON 取 `$[0]`，fallback `platform`）
  - 为 `primary_platform` 建索引
- SQL 文件：
  - 新增 `server/src/storage/database/schema/migrations/2026-xx-xx_hotfix_orders_primary_platform_index.sql`

**3.2 后端 SQL 改造**
- 改动文件：
  - [order.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/order/order.service.ts#L633-L707)
- 改造点：
  - 平台过滤改为 `o.primary_platform = ? OR o.platform = ?`（或仅 primary_platform）
  - 增加联合索引建议：
    - `(is_paid, status, priority, created_at)`
    - `(primary_platform, is_paid, status, priority, created_at)`（视数据分布决定）

**验收**
- explain 走索引；COUNT(*) 不再全表扫描；翻页耗时稳定。

---

### Milestone 4：content-generation 的“字段白名单 + 匿名边界 + 体积控制”

**4.1 把 SELECT * 改为必要列**
- 改动文件：
  - [content-generation.controller.ts](file:///Users/aiden/Projects/morena/server/src/modules/content-generation/content-generation.controller.ts#L290-L367)
- 目标：
  - `getContentById` 只 select 需要的字段（id/avatar_id/order_id/content/images/video_url/platform/platforms/status/content_type/created_at/updated_at）

**4.2 history/avatar 接口改为白名单返回 + 分页**
- 现状：`SELECT * ... LIMIT 50` 且原样返回 rows（见 [content-generation.controller.ts](file:///Users/aiden/Projects/morena/server/src/modules/content-generation/content-generation.controller.ts#L397-L414)）。
- 目标：
  - 只返回列表展示必要字段（不返回全文 content，可只返回摘要/长度/首图等）
  - 支持分页（cursor 或 page/pageSize），避免固定 50 且越用越慢

**验收**
- history 响应体显著缩小；匿名访问不会暴露多余字段；DB 读 IO 降低。

---

### Milestone 5：ai-skill 记录/轮询接口“轻量化 + 安全治理”

**5.1 轮询 record/:id 提供 lite**
- 目标：
  - 轮询只拿 `status/progress/result_url/error`，不要把 `input_text`/大 metadata 带上来。
- 改动文件：
  - `server/src/modules/ai-skill/ai-skill.controller.ts`
  - `server/src/modules/ai-skill/ai-skill.service.ts`

**5.2 清理硬编码密钥回退值**
- 现状：存在 `process.env.xxx || 'sk-...'`（见 [ai-skill.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/ai-skill/ai-skill.service.ts#L19-L22)）。
- 目标：
  - 仅从环境变量读取；缺失时 fail-fast（启动即报错/或接口返回明确错误）
  - 同步做仓库密钥治理（本计划只列任务，不在本阶段直接处理历史）

**验收**
- 轮询/历史列表响应体显著缩小；不再存在硬编码密钥。

---

### Milestone 6：上传链路内存峰值治理（防止并发上传拖垮进程）

**目标**
- 避免大文件默认读入内存导致 OOM；限制并发上传时的峰值。

**改动文件**
- `server/src/modules/upload/upload.controller.ts`
- 可能需要：`server/src/modules/upload/upload.module.ts` 或全局 Multer 配置（视当前实现）

**方案**
- 明确 Multer storage：使用 disk storage 或流式直传（能做的话优先直传到对象存储）
- 按类型设置 fileSize（image/audio/video 分开）
- 记录上传耗时与文件大小（仅 dev）

---

## Task Breakdown（可落地任务序列）

### Phase A（先观测再优化）
1. 前端 Network dev 采样开关与聚合统计（Milestone 0）

### Phase B（先打掉“高频+高成本”）
2. 统一轮询单飞（order-processing/status & ai/status）+ 页面改造（Milestone 1.1）
3. 副作用接口按钮单飞锁（repay/retry/generate/dispatch-all/trust-all）（Milestone 1.2）

### Phase C（后端乘数优化）
4. order-processing/status lite + 移除读路径写放大（Milestone 2）
5. open orders 平台过滤可索引化 + 索引迁移（Milestone 3）
6. content-generation 白名单/分页（Milestone 4）
7. ai-skill 轻量轮询 + 密钥治理（Milestone 5）
8. upload 内存峰值治理（Milestone 6）

## Verification（每阶段都做）
- 代码层：`pnpm validate`
- 端到端人工回归（最小集）：
  - 订单生成页：轮询请求数显著下降，且响应体变小；页面离开轮询停止
  - 支付重试：连点不会多次调用 repay
  - 生成重试/技能生成：连点只触发一次任务
  - 订单广场：平台筛选翻页稳定、无回跳
  - 后端：`EXPLAIN` 验证 open orders 命中索引；content-generation history 不再返回大字段

