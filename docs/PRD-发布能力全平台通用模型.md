# PRD-发布能力全平台通用模型

## 0. Premise / Constraints / Boundaries / Endgame

### Premise（前提）
- 当前项目已具备发布主链基础能力：`status -> confirm -> publish -> feedback -> accept`。
- 当前业务是“订单驱动的内容生产与平台发布”，并非纯社媒中台。
- 平台接入现状存在“页面枚举多源、命名不一、策略不一”的问题，需要统一产品模型。

### Constraints（约束）
- 保持对现有主链接口兼容：`/api/order-processing/*`。
- 平台能力客观不一致，无法统一为“全自动发布”；需支持自动/半自动/手动混合策略。
- 优先完成“功能闭环 + 稳定性”验收，不以短期业务增长指标作为一期硬门槛。

### Boundaries（边界）
- 本 PRD 仅覆盖“发布能力域”，不重写订单创建、分身培养、支付结算全域逻辑。
- 本 PRD 聚焦 C 端发单与分身执行链路，不扩展到管理后台运营工具细节。
- 本 PRD 输出需求与验收，不包含本次代码实现细节。

### Endgame（终局）
- 建立一个可扩展的“全平台通用发布模型”，使新平台接入从“改页面”升级为“配置+适配”。
- 确保任一订单在多平台场景下都可追踪、可回退、可验收、可审计。

---

## 1. 背景与目标

### 1.1 背景问题
- 平台枚举分散在多个页面，命名口径不统一（`wechat`/`wechat_mp`/`wechat_moments` 等）。
- 内容类型与平台匹配规则分散，产品规则靠页面逻辑隐式维护。
- 发布反馈结构可用但缺乏统一字段标准，跨平台证据完整性不稳定。

### 1.2 目标
- 建立统一发布域模型：任务、平台目标、内容产物、发布凭证、效果指标。
- 建立统一平台命名规范与兼容映射，避免前后端语义漂移。
- 建立统一状态机与异常策略，确保链路“可闭环、可重试、可验收”。

### 1.3 非目标
- 本期不追求所有平台“自动发布”。
- 本期不包含复杂推荐策略优化、商业化定价策略迭代。

---

## 2. 当前平台现状与统一口径

### 2.1 代码中已出现的平台集合（现状输入）
- 订单创建：`douyin`、`wechat_mp`、`xiaohongshu`、`wechat`、`weibo`、`kuaishou`
- 发布引导：`xiaohongshu`、`douyin`、`wechat_moments`、`wechat_mp`、`weibo`、`bilibili`
- 发布反馈映射：`wechat_mp`、`wechat_channel`、`wechat_moments`、`weibo`、`xiaohongshu`、`douyin`、`zhihu`、`bilibili`、`toutiao`、`kuaishou`

### 2.2 Canonical Platform Key（统一平台主键）
- `wechat_mp`：微信公众号
- `wechat_moments`：朋友圈
- `wechat_channel`：视频号
- `douyin`：抖音
- `xiaohongshu`：小红书
- `weibo`：微博
- `bilibili`：B站
- `kuaishou`：快手
- `zhihu`：知乎
- `toutiao`：今日头条

### 2.3 别名兼容映射
- `wechat` -> `wechat_channel`（默认视频号语义）
- `bili` -> `bilibili`
- `xhs` -> `xiaohongshu`
- 兼容策略：输入可接收别名，存储与返回统一 canonical key。

---

## 3. 用户与核心场景

### 3.1 角色
- 发单用户：发起订单并最终验收。
- 执行分身：领取任务、生成内容、执行发布、回填证据。
- 测试/运营：核验主链闭环与证据有效性。

### 3.2 核心场景
- 单平台发布：订单要求单平台产出，分身完成发布并提交反馈，发单方验收。
- 多平台发布：同一订单多平台执行，允许部分成功、部分失败，支持补提反馈。
- 手动发布引导：平台不支持自动发布时，系统提供引导并要求证据回填。

---

## 4. 通用发布域模型

### 4.1 PublishTask（发布任务）
- `taskId`：任务唯一标识（对应 requestId）
- `orderId`：订单ID
- `avatarId`：执行分身ID
- `status`：任务状态
- `contentType`：内容类型（图文/视频/文章/混合）

### 4.2 PlatformTarget（平台目标）
- `platformKey`：canonical key
- `publishMode`：`auto` / `semi_auto` / `manual`
- `bindingRequired`：是否强依赖账号绑定
- `requirements`：平台特定要求（粉丝、认证、格式）

### 4.3 PublishArtifact（内容产物）
- `title`：标题（选填）
- `content`：正文（选填）
- `images[]`：图片列表（选填）
- `videos[]`：视频列表（选填）

### 4.4 PublishEvidence（发布凭证）
- `link`：发布链接（至少其一）
- `screenshots[]`：截图凭证（至少其一）
- `submitTime`：提交时间
- `operator`：提交方（分身/用户）

### 4.5 PublishMetrics（效果指标）
- `views`、`likes`、`comments`、`shares`
- 指标策略：一期支持选填；二期可按平台要求升级为必填。

---

## 5. 端到端流程与状态机

### 5.1 标准流程
1. 订单创建并匹配分身
2. 内容生成（可轮询状态）
3. 确认内容（进入发布阶段）
4. 执行发布（自动或手动）
5. 提交反馈（链接/截图）
6. 发单方验收完成

### 5.2 状态机定义
- `queuing`：排队中
- `generating`：生成中
- `preview`：待确认
- `publishing`：发布中
- `published`：已发布（待反馈补全）
- `awaiting_acceptance`：待验收
- `completed`：已完成
- `failed`：失败

### 5.3 状态迁移规则
- `preview -> publishing`：确认内容
- `publishing -> published`：发布接口成功
- `published -> awaiting_acceptance`：提交反馈
- `awaiting_acceptance -> completed`：验收通过
- 任意中间态失败 -> `failed`，支持重试回到上一步可执行态

---

## 6. 平台策略矩阵（一期）

| 平台 | 发布模式 | 是否需绑定 | 支持内容 | 最小反馈凭证 |
|---|---|---|---|---|
| 小红书 `xiaohongshu` | semi_auto/manual | 否 | 图文/短视频 | 链接或截图 |
| 抖音 `douyin` | manual | 否 | 短视频 | 链接或截图 |
| 公众号 `wechat_mp` | manual | 是 | 文章/图文 | 链接+截图（建议） |
| 朋友圈 `wechat_moments` | manual | 否 | 图文 | 截图 |
| 微博 `weibo` | manual | 否 | 图文/视频 | 链接或截图 |
| B站 `bilibili` | manual | 否 | 视频 | 链接或截图 |
| 快手 `kuaishou` | manual | 否 | 视频 | 链接或截图 |
| 知乎 `zhihu` | manual | 否 | 文章 | 链接 |
| 今日头条 `toutiao` | manual | 否 | 图文/视频 | 链接或截图 |

说明：
- 一期默认“证据最小满足”原则：`link` 与 `screenshots` 至少满足一个。
- 对高风险平台（如 `wechat_mp`）建议策略为“链接 + 截图”双证据。

---

## 7. 功能需求（FR）

### FR-1 平台统一与映射
- 系统必须接收平台别名并转换为 canonical key。
- 系统返回数据必须统一使用 canonical key。

### FR-2 发布引导
- 系统必须根据平台策略给出对应发布引导。
- 平台要求绑定但未绑定时，必须阻止进入发布并引导绑定。

### FR-3 反馈回填
- 用户可按平台填写反馈，支持多平台逐个提交。
- 每个平台反馈必须满足最小证据校验。

### FR-4 验收与状态同步
- 验收后任务状态必须更新为 `completed`。
- 当订单下所有任务完成时，订单状态需同步为 `completed`。

### FR-5 幂等与重试
- 重复点击“发布完成/提交反馈/验收”不得产生脏状态。
- 失败后允许重试，且不覆盖已有效凭证。

---

## 8. 非功能需求（NFR）

### NFR-1 一致性
- 平台键、状态键、字段键在前后端保持一致。

### NFR-2 稳定性
- 主链关键接口需支持失败重试。
- 接口返回需包含清晰错误信息，便于前端兜底提示。

### NFR-3 可观测性
- 关键节点记录操作日志：确认、发布、反馈、验收。
- 能区分“平台成功/失败/待补充反馈”的状态。

---

## 9. 接口契约需求（产品口径）

### 9.1 状态查询
- `GET /api/order-processing/status/:id`
- 需求：支持 `orderId/requestId` 双查询；返回标准化 `generatedContent/publishStatus/publishFeedback`。

### 9.2 内容确认
- `POST /api/order-processing/confirm/:id`
- 需求：可携带内容修订；成功后进入 `publishing`。

### 9.3 发布执行
- `POST /api/order-processing/publish/:id`
- 需求：支持可选 `platforms[]` 参数；成功后写入平台发布状态。

### 9.4 反馈提交
- `POST /api/order-processing/feedback/:id`
- 需求：支持按平台反馈对象提交；成功后进入 `awaiting_acceptance`。

### 9.5 验收完成
- `PUT /api/order-processing/accept/:id`
- 需求：任务完成并触发订单状态聚合同步。

---

## 10. 异常与失败策略

### E-1 未绑定账号
- 行为：阻断发布动作，弹出绑定引导。
- 提示：明确平台名与绑定入口。

### E-2 发布中断
- 行为：保持任务在可重试状态，允许重试发布。
- 提示：保留已填写内容，避免二次录入。

### E-3 凭证不完整
- 行为：阻止提交反馈。
- 提示：指出缺少链接/截图中的哪一项。

### E-4 多平台部分成功
- 行为：允许分平台补交，不强制一次性全成功。
- 提示：展示平台级状态清单。

---

## 11. 验收标准（UAT）

### 11.1 功能闭环验收
- 用例1：单平台订单可从生成走到验收完成。
- 用例2：多平台订单可完成至少一个平台反馈并补完其余平台。
- 用例3：验收完成后订单状态按聚合规则同步。

### 11.2 稳定性验收
- 用例4：重复提交反馈不产生重复脏数据。
- 用例5：接口失败后重试可成功，不丢失先前证据。
- 用例6：平台别名输入时，返回统一 canonical key。

### 11.3 数据一致性验收
- 用例7：`publishStatus` 与 `publishFeedback` 平台键一致。
- 用例8：状态迁移不允许跳过关键节点（如直接 `publishing -> completed`）。

---

## 12. 版本范围建议

### V1（本期）
- 完成统一模型与主链闭环验收规范。
- 统一平台命名规范与别名映射。
- 打通手动发布反馈与验收。

### V1.5（后续）
- 增加平台插件化策略配置。
- 增加平台差异化指标模板（按平台动态字段）。

### V2（远期）
- 引入自动发布能力编排（有权限与风控前提的平台）。
- 引入发布效果质量评分与推荐回路。

---

## 13. 事实溯源（代码参考）
- `src/pages/order/order-create/index.tsx`
- `src/pages/order/order-content-creation/index.tsx`
- `src/pages/order/order-publish-guide/index.tsx`
- `src/pages/order-publish-feedback/index.tsx`
- `server/src/modules/order-processing/order-processing.controller.ts`
- `server/src/modules/order-processing/order-processing.service.ts`
