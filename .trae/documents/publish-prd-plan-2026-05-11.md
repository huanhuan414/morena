# 产品发布需求梳理计划（PRD级，全平台通用模型）

## 1. Summary
- 目标：基于当前项目已实现的发布链路与平台能力，产出一份可评审、可执行的“产品发布需求PRD”。
- 成功标准：
  - 明确当前能力边界与断点（前后端链路、平台支持、状态流转）。
  - 形成“全平台通用模型”需求（统一对象模型、流程、接口、状态机、异常策略）。
  - 给出可落地验收标准，优先“功能闭环 + 稳定性”。
- 受众：产品、研发、测试联合评审与执行。
- 范围：先完成“需求梳理文档”本身，不做代码实现。

## 2. Current State Analysis

### 2.1 已发现的平台与入口（基于代码）
- 订单创建页平台集合：`douyin`、`wechat_mp`、`xiaohongshu`、`wechat`、`weibo`、`kuaishou`。来源：`src/pages/order/order-create/index.tsx`。
- 发布引导页平台集合：`xiaohongshu`、`douyin`、`wechat_moments`、`wechat_mp`、`weibo`、`bilibili`。来源：`src/pages/order/order-publish-guide/index.tsx`。
- 发布反馈页平台映射覆盖更广：`wechat_mp`、`wechat_channel`、`wechat_moments`、`weibo`、`xiaohongshu`、`douyin`、`zhihu`、`bilibili`、`toutiao`、`kuaishou`。来源：`src/pages/order-publish-feedback/index.tsx`。

### 2.2 已实现的发布主链（后端）
- `GET /api/order-processing/status/:id`
- `POST /api/order-processing/confirm/:id`
- `POST /api/order-processing/publish/:id`
- `POST /api/order-processing/feedback/:id`
- `PUT /api/order-processing/accept/:id`
- 来源：`server/src/modules/order-processing/order-processing.controller.ts`。

### 2.3 当前状态机（后端实际）
- `confirm` -> `publishing`
- `publish` -> `published`（并写入 `publish_status`）
- `feedback` -> `awaiting_acceptance`（并写入 `publish_feedback`）
- `accept` -> `completed`（并尝试同步 `orders.status`）
- 来源：`server/src/modules/order-processing/order-processing.service.ts`。

### 2.4 现状问题（需求层）
- 平台枚举分散在多个页面，命名口径不统一（如 `wechat` / `wechat_mp` / `wechat_moments`）。
- 内容类型与平台适配策略分散在前端页面，缺少统一规则中心。
- “自动发布/手动发布”边界在体验与状态表达上未形成统一规范。
- 发布反馈结构虽可用，但缺少跨平台字段标准（截图、链接、指标、证据完整性）。

## 3. Proposed Changes

### 3.1 交付物
- 新增一份 PRD 文档（建议路径）：`docs/PRD-发布能力全平台通用模型.md`。
- 文档内容按以下结构落地，确保产品、研发、测试可直接评审执行。

### 3.2 PRD 文档章节与写法（What/Why/How）

#### A. 业务目标与边界
- What：定义“发布产品”在当前项目中的业务目标（提升发布闭环完成率与可追踪性）。
- Why：解决当前多平台、多命名、多入口导致的一致性问题。
- How：以“平台适配层 + 通用发布模型 + 统一状态机”三层结构梳理需求。

#### B. 全平台通用对象模型
- What：统一实体定义：
  - `PublishTask`（发布任务）
  - `PlatformTarget`（平台目标）
  - `PublishArtifact`（内容产物：标题/正文/图/视频）
  - `PublishEvidence`（发布凭证：链接/截图/回执）
  - `PublishMetrics`（效果指标：曝光/点赞/评论/分享）
- Why：消除页面和接口对字段命名的重复转换。
- How：在 PRD 内给出字段字典（必填/选填/来源/校验规则）。

#### C. 统一平台模型与命名标准
- What：定义平台 canonical key（例如 `wechat_mp`、`wechat_moments`、`douyin` 等）。
- Why：避免 `wechat` 等别名在链路中歧义。
- How：PRD 中列“平台映射表（别名 -> canonical key）”及兼容策略。

#### D. 发布流程与状态机
- What：定义端到端流程：
  - 订单创建 -> 内容生成 -> 发布确认 -> 发布执行 -> 反馈提交 -> 验收完成
- Why：将当前后端可用状态机提升为产品/测试可验证规范。
- How：提供状态机定义：
  - 状态集合、状态进入条件、可逆/不可逆迁移、失败回退策略。

#### E. 平台策略（自动/手动）
- What：按平台区分自动发布、半自动引导、纯手动回填三种策略。
- Why：平台能力不一致，必须在产品层明确。
- How：给出每个平台的策略矩阵：
  - 是否需要账号绑定
  - 支持的内容类型
  - 回填要求（截图/链接/指标）
  - 最小验收证据

#### F. 交互与异常规则
- What：定义关键页面交互规则（发布引导、反馈提交、验收）。
- Why：减少“状态成功但数据不足”与“字段缺失”问题。
- How：列出异常场景：
  - 未绑定账号
  - 发布中断
  - 反馈证据不足
  - 重复提交/重复验收
  - 多平台部分成功

#### G. 接口契约（需求口径）
- What：梳理主链接口输入输出规范（不改代码，仅形成契约需求）。
- Why：作为后续接口治理与自动化测试基线。
- How：按以下接口给出请求/响应/错误码要求：
  - `/api/order-processing/status/:id`
  - `/api/order-processing/confirm/:id`
  - `/api/order-processing/publish/:id`
  - `/api/order-processing/feedback/:id`
  - `/api/order-processing/accept/:id`

#### H. 验收标准（功能闭环+稳定性优先）
- 功能闭环验收：
  - 单平台链路可闭环
  - 多平台链路可闭环
  - 反馈后可验收并驱动订单状态同步
- 稳定性验收：
  - 失败可重试
  - 幂等性（重复点击不产生脏状态）
  - 关键字段完整性校验
  - 状态与数据一致性校验

## 4. Assumptions & Decisions
- 决策：文档深度为 PRD 级。
- 决策：范围采用“全平台通用模型”而非仅当前可用平台清单。
- 决策：交付仅一份需求文档，不附迭代路线图和任务拆解。
- 决策：评审对象为产品+研发+测试联合团队。
- 决策：验收优先“功能闭环+稳定性”。
- 假设：当前代码中的平台枚举差异视为“现状输入”，PRD 将输出统一标准。

## 5. Verification Steps
- 文档完整性检查：
  - 是否覆盖目标、范围、对象模型、流程、状态机、接口、验收标准。
- 一致性检查：
  - 平台命名是否统一到 canonical key。
  - 状态机是否与现有后端链路兼容（`status/confirm/publish/feedback/accept`）。
- 可执行性检查：
  - 产品可据此评审功能边界。
  - 研发可据此对齐接口与字段。
  - 测试可据此设计闭环与异常用例。

## 6. 参考代码（用于文档事实溯源）
- `src/pages/order/order-create/index.tsx`
- `src/pages/order/order-content-creation/index.tsx`
- `src/pages/order/order-publish-guide/index.tsx`
- `src/pages/order-publish-feedback/index.tsx`
- `server/src/modules/order-processing/order-processing.controller.ts`
- `server/src/modules/order-processing/order-processing.service.ts`
