# Morena 项目全视角优化迭代 Task Plan（可执行/可验收）

## 1. Summary

目标：把当前已贯通的主链路（登录→下单/支付→派单/接单→生成→发布/反馈/验收→结算）从“可跑通”升级到“可上线、可扩展、可观测、可回滚、可演进”。输出按优先级拆分的可执行任务清单，每个任务包含：范围、实施步骤、验收标准、验证方式、建议使用的子 agent。

## 2. Premise / Constraints / Boundaries / Endgame

### Premise（现状）

- 后端为 NestJS + MySQL（自研 `MysqlClient`/`getPool()`），生成链路包含 cron 轮询视频任务并转存 CDN。
- 发现明确的 P0 风险点（基于仓库现状）：
  - MySQL 连接层存在硬编码默认口令：`password: process.env.MYSQL_PASSWORD || '<MYSQL_PASSWORD>'`（[mysql-client.ts](file:///Users/aiden/Projects/morena/server/src/storage/database/mysql-client.ts#L6-L18)）。
  - 前端 Network 存在“双实现并存且导入姿势混用”：
    - `src/network.ts`（TS 实现）
    - `src/network/index.js`（JS 实现，@ts-nocheck，header 字段与行为不同）（[network.ts](file:///Users/aiden/Projects/morena/src/network.ts#L1-L120), [network/index.js](file:///Users/aiden/Projects/morena/src/network/index.js#L1-L80)）。
  - 视频轮询任务为 cron（每 30s）+ MySQL named lock，且存在吞错逻辑（`catch {}`）与状态更新写库（[content-generation.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/content-generation/content-generation.service.ts#L1883-L2007)）。

### Constraints（执行约束）

- 单次改动只解决一个问题；默认“手术式修改”，避免顺手重构与无关格式化。
- 优先不引入新依赖；如必须引入（Redis/队列/可观测），必须先在计划中明确选型与替代路径。
- 关键红线：`pnpm validate` 必须通过；线上链路必须可灰度/可回滚。

### Boundaries（边界）

- 本计划覆盖：安全密钥、接口契约、鉴权一致性、数据/索引、异步任务化、可观测、CI/CD。
- 不覆盖：业务功能大改（例如真实多平台发布全功能），仅把“stub/模拟发布”标记并隔离，避免误导口径。

### Endgame（终局）

- 单一主链路、单一状态源、单一契约与口径；可多实例水平扩展（Redis/队列）；有日志/指标/告警；有迁移体系与回滚。

## 3. 当前状态分析（架构痛点 → 可落地改造点）

### 3.1 安全

- 硬编码默认 DB 密码（P0）。
- 潜在的证书/密钥进入制品风险（后续需系统扫描：server/cert、env example、docs、CI）。

### 3.2 接口契约与前端网络层

- Response envelope 不统一（`msg` vs `message` 等），前端出现兼容式取值，后续会指数增长。
- Network 层双实现并存，且 JS 实现会 console.log userId/token，存在隐私与日志污染风险。

### 3.3 状态机与异步任务

- 长耗时生成与视频轮询依赖 cron + DB 状态更新；错误处理存在吞错；多实例下 cron 需要强互斥（目前用 MySQL named lock，方向正确，但需要全链路一致性与可观测补齐）。

### 3.4 数据治理

- schema 漂移与迁移体系不足（多份 DDL/热修/代码探测列）。
- `content_generation_requests` / `order_dispatch_requests` 等高频表缺少面向访问模式的复合索引（需用真实 SQL 路径确认并补齐）。

## 4. 里程碑与任务清单（可执行/可验收）

说明：
- 每个任务都包含建议“Owner 子 agent”。执行阶段将按任务逐个调用对应子 agent 落地实现。
- 验收优先采用：接口级验收（API 返回 + DB 断言）+ `pnpm validate`。

---

## Milestone M0（P0）：安全止血与泄露面收敛

### M0-T1：移除 MySQL 默认硬编码口令 + 启动强校验

- **Owner（子 agent）**：backend-architect
- **允许改动文件**
  - [mysql-client.ts](file:///Users/aiden/Projects/morena/server/src/storage/database/mysql-client.ts)
- **实施步骤**
  1. 将 `MYSQL_PASSWORD` 默认值从硬编码改为“无默认值”，缺失时启动失败并给出清晰错误。
  2. 将 `connectionLimit: 1500` 调整为更保守默认值（需要与部署规格匹配，先设为 50~200 的区间并可配置）。
- **验收标准**
  - 未配置 `MYSQL_PASSWORD` 时，服务启动明确失败（不允许隐式连库）。
  - 配置正确环境变量后，服务正常启动，关键接口（`/api/health`）可用。
  - `pnpm validate` 通过。

### M0-T2：仓库敏感信息扫描 + 清退策略落地

- **Owner（子 agent）**：devops-architect
- **允许改动范围**
  - `.github/workflows/*`（新增泄露扫描）
  - 文档与示例环境文件（仅移除真实值，保留占位符）
  - 明确禁止：任何真实密钥/证书再次提交
- **实施步骤**
  1. 在 CI 增加 gitleaks（或等价）扫描门禁：PR 阶段阻断。
  2. 清理/替换示例 env、文档中的真实敏感字段（只保留占位符）。
  3. 若存在 `server/cert` 等敏感文件被纳入构建制品，调整为运行时挂载（由部署脚本/说明负责）。
- **验收标准**
  - CI 在发现高置信度 secret 时失败。
  - 仓库中不再出现疑似真实密钥/证书内容（以扫描结果为准）。
  - 生产部署说明更新：证书/密钥的加载方式明确、可复现、可轮换。

---

## Milestone M1（P0）：契约一致性 + 前端 Network 单栈化

### M1-T1：前端 Network 单栈化（移除 JS 实现的歧义入口）

- **Owner（子 agent）**：frontend-architect
- **允许改动文件**
  - [src/network.ts](file:///Users/aiden/Projects/morena/src/network.ts)
  - [src/network/index.js](file:///Users/aiden/Projects/morena/src/network/index.js)
  - 全局引用点（按搜索结果逐个替换）
- **实施步骤**
  1. 统一导出入口：强制项目只使用 `import { Network } from '@/network'`（一个出口）。
  2. 清理 `src/network/index.js` 的导出或将其变为显式“仅兼容层”且不再被引用（以打包解析规则为准）。
  3. 删除/降级所有 token/userId 的 console 日志，避免隐私泄露与日志污染。
- **验收标准**
  - 全仓库不再存在 `import * as Network from '@/network'` 等混用写法（以 grep 断言）。
  - 关键页面（登录、下单、技能广场、管理端）接口调用正常。
  - `pnpm validate` 通过。

### M1-T2：后端 Response Envelope 统一（全模块一致）

- **Owner（子 agent）**：backend-architect
- **允许改动文件（优先从 controller 层最小改动）**
  - `server/src/modules/*/*.controller.ts`（按实际不一致点逐个修）
  - 全局响应拦截器/异常过滤器（如需要统一字段）
- **实施步骤**
  1. 选定统一 envelope：`{ code: number, msg: string, data: any }` 或 `{ code, message, data }` 二选一；全项目统一。
  2. 统一成功与失败字段名（禁止成功用 message、失败用 msg 这种混搭）。
  3. 前端 Network 增加 `unwrap()`：统一从 envelope 中解包，并统一 toast/error message 取值。
- **验收标准**
  - 选定字段名后，全后端接口一致（抽样：order、skill、ai-skill、tikhub、avatar/publish）。
  - 前端页面不再出现 `payload?.msg || payload?.message` 兼容写法（以 grep 断言逐步归零）。

---

## Milestone M2（P0/P1）：数据库 Schema 治理 + 索引补强

### M2-T1：补齐缺失关键表 DDL/迁移（ai_skill_records/skills/avatar_skills）

- **Owner（子 agent）**：backend-architect
- **允许改动文件**
  - `server/src/storage/database/schema/migrations/*`（新增迁移）
  - 业务读写表结构对应的 Service/Repo（如需要对齐字段）
- **实施步骤**
  1. 盘点业务代码对 `ai_skill_records` 的真实字段读写集合（以 service 的 INSERT/UPDATE/SELECT 为准）。
  2. 新增迁移：创建表 + 必要索引（至少覆盖 `user_id + created_at`、`user_id + skill_type + created_at`）。
  3. 同步补齐 `skills/avatar_skills` 的 MySQL DDL（若当前仅存在 PG/schema.ts 的定义，应以 MySQL 真实使用为准）。
- **验收标准**
  - 全新环境跑迁移后，相关接口可用：ai-skill 创建/历史列表/限额查询，skills 列表/绑定技能。
  - DB 执行计划（EXPLAIN）显示核心查询能命中索引（抽样检查）。

### M2-T2：为高频表补齐复合索引（按真实 SQL 访问模式）

- **Owner（子 agent）**：performance-expert + backend-architect
- **允许改动文件**
  - 迁移文件（新增索引）
- **实施步骤**
  1. 从代码检索出 `content_generation_requests` / `order_dispatch_requests` 的高频 where/order by 组合。
  2. 建议索引（需最终以代码为准）：
     - `content_generation_requests(order_id, updated_at)`
     - `content_generation_requests(order_id, avatar_id, platform, updated_at)`
     - `content_generation_requests(status, updated_at)`
     - `content_generation_requests(status, seedance_task_id, created_at)`
     - `order_dispatch_requests(order_id, status, updated_at)`
     - `order_dispatch_requests(user_id, status, created_at)`
  3. 对每个索引补齐回归用例：跑关键接口并观察耗时与扫描行数。
- **验收标准**
  - 轮询/恢复类 SQL 不再退化为大扫描（以慢查询与 explain 抽样验证）。
  - 不引入写入性能灾难（索引数量受控，写入 TPS 可接受）。

---

## Milestone M3（P1）：异步任务化与多实例可用（生成链路优先）

### M3-T1：生成/视频轮询链路可观测与幂等修正（先不引队列，先补“正确性与可观测”）

- **Owner（子 agent）**：backend-architect
- **允许改动文件**
  - [content-generation.service.ts](file:///Users/aiden/Projects/morena/server/src/modules/content-generation/content-generation.service.ts)
  - 通用 logger/中间件（如需要补 traceId/结构化字段）
- **实施步骤**
  1. 将吞错 `catch {}` 替换为结构化 warn（至少带 requestId/orderId/traceId）。
  2. 为关键状态更新添加幂等保护（避免重复轮询/重复写成功覆盖失败等）。
  3. 为 cron 锁竞争失败、任务超时、下载失败等场景补齐可检索日志。
- **验收标准**
  - 生成视频任务失败/超时/成功三类路径均产生可检索日志，并可通过 orderId 追踪。
  - 同一条生成记录在 cron 多次触发下不会出现“回写倒退”。

### M3-T2：引入 Redis + 队列（BullMQ/RabbitMQ 选型）并将“视频生成/发布校验”任务化

- **Owner（子 agent）**：backend-architect + devops-architect
- **决策点（本计划默认）**
  - 队列：BullMQ（Redis）优先（实现成本最低）；如生产已有 RabbitMQ，则切换为 RabbitMQ。
- **实施步骤**
  1. 增加 worker：消费 `content_generation:video`、`publish:verify` 等队列。
  2. API 侧改为 submit task：立即返回 `requestId/taskId`，前端轮询状态（保持现有轮询 UI，降低改动）。
  3. cron 改为“兜底扫描”，不再作为主执行器（避免重复执行）。
- **验收标准**
  - 主 API 进程不再执行视频下载/转存等重任务（只做编排）。
  - worker 宕机后可重启续跑；任务可重试且幂等。
  - 多实例下不会重复执行同一任务（队列语义保证 + 幂等落库）。

---

## Milestone M4（P1）：可观测性（日志/指标/告警）

### M4-T1：结构化请求日志（traceId 贯穿）

- **Owner（子 agent）**：backend-architect
- **允许改动文件**
  - `server/src/common/middlewares/*`
  - `server/src/common/filters/*`
  - `server/src/interceptors/*`
- **实施步骤**
  1. 请求入口记录：traceId、route、method、statusCode、latencyMs、userId（脱敏）、errorCode。
  2. 后台任务日志同样带 `jobId/requestId/orderId`，便于关联。
- **验收标准**
  - 任意一个 orderId 可在日志中串起“派单→接单→生成→发布→验收”的关键事件。

### M4-T2：错误聚合与基础指标

- **Owner（子 agent）**：devops-architect
- **实施步骤**
  1. 接入 Sentry 或 OTel（选一），将 5xx 与后台任务失败上报并聚合。
  2. 暴露基础 metrics（HTTP latency、队列堆积、失败率、DB 慢查询计数）。
- **验收标准**
  - 可在控制台看到错误聚合与 Top N 失败原因。
  - 可对“生成失败率/超时率/队列堆积”设置告警阈值（至少文档化）。

---

## Milestone M5（P2）：交付工程化（CI/CD + 回滚）

### M5-T1：构建制品版本化 + 健康检查门禁 + 回滚策略

- **Owner（子 agent）**：devops-architect
- **允许改动文件**
  - `.github/workflows/*`
  - 部署脚本/文档
- **实施步骤**
  1. CI 构建 server 镜像并推送（tag=git sha）。
  2. 部署阶段：拉起新版本 → `/api/health` 探活 → 失败自动回滚到上一版本。
- **验收标准**
  - 任意一次部署可复现（同 tag 同结果）。
  - 回滚步骤明确且可自动/半自动执行。

## 5. 验证总清单（执行阶段每个任务都要跑）

- `pnpm validate`（强制）
- API 抽样验收（至少覆盖）：登录、创建订单、支付回调模拟、派单、接单、生成状态查询、发布流程、验收/结算
- DB 断言（按任务）：表存在、关键索引存在、关键字段非空、状态机无倒退

## 6. 执行编排（如何调用子 agent 落地）

执行阶段按 Milestone 顺序推进，每个任务开始前必须输出：

- Premise / Constraints / Boundaries / Endgame（该任务级别）
- 允许改动文件清单（最多 1–3 个文件起步，超出拆分）
- 验收断言（API+DB）

对应子 agent 建议：

- 后端实现与重构：`backend-architect`
- 前端 Network/契约与 API client：`frontend-architect`
- 索引/性能与扫描验证：`performance-expert`
- CI/CD、secret、部署回滚：`devops-architect`
