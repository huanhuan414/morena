# 核心链路治理执行 Spec

## Why
当前仓库已经具备“登录 -> 分身 -> 下单/接单 -> 生成 -> 发布 -> 反馈 -> 验收 -> 结算”的可演示主链，但项目级治理文档仍停留在分析层，开发无法直接按优先级实施，测试也缺少统一验收口径。需要把现有结论重组为一套可排期、可分工、可回归的执行 spec。

## What Changes
- 将现有分析结论收敛为项目级执行框架，明确本轮只处理核心链路和上线阻断项。
- 建立 P0/P1/P2 优先级模型，给开发、联调、测试明确实施顺序。
- 将“状态真源、鉴权边界、回流导航、收益一致性、联调回归”拆成可交付任务包。
- 明确本 spec 与 `clarify-avatar-product-logic` 的关系：本 spec 负责项目级排序与验收，下游 spec 负责分链路细化与具体实现。
- 建立可勾选的验收清单，确保每个批次都有代码、联调和验证出口。

## Impact
- Affected specs: 登录鉴权、分身生命周期、订单支付、派单接单、内容生成、发布反馈、验收结算、邀请收益、工程回归
- Affected code: `src/pages/login/index.tsx`、`src/pages/index/index.tsx`、`src/pages/mind-chat/index.tsx`、`src/pages/order/*`、`src/pages/avatar/*`、`src/pages/subscription/index.tsx`、`server/src/modules/auth/*`、`server/src/modules/order/*`、`server/src/modules/order-dispatch/*`、`server/src/modules/order-processing/*`、`server/src/modules/content-generation/*`、`server/src/modules/referral/*`、`server/src/modules/earnings/*`、`server/src/modules/payment/*`

## Premise
- 项目不缺页面和接口，当前缺的是统一实施顺序、统一状态边界和统一验收标准。
- 本次目标不是新增产品能力，而是把已有主链收敛成可稳定交付的系统。
- `clarify-avatar-product-logic` 已承接部分分身/订单/发布链路收敛，本 spec 只负责项目级优先级、批次和验收口径，不重复发明第二套规则。

## Constraints
- 单次改动必须聚焦一个任务包，禁止把状态收口、导航修复、收益治理混在一次提交中。
- 默认采用手术式修改，只允许触达对应链路的关键文件，禁止顺手重构和无关格式化。
- 每个任务包完成后必须通过 `pnpm validate` 或等价验证，再进入下一包。
- 本轮只收敛核心链路和上线阻断项，不覆盖视觉重设计、长尾页面统一重构和商业策略调整。

## Boundaries
- 覆盖范围：状态真源、接口契约、前端回流、身份鉴权、收益一致性、主链回归。
- 不覆盖范围：后台低频运营页体验优化、非主链社交长尾能力、全量历史兼容清理、外部平台深度联调。
- 下游细化：分身与订单执行细节继续由 `clarify-avatar-product-logic` 承接；本 spec 只定义“先做什么、做到什么算完成”。

## Endgame
- 团队能够按明确优先级推进核心链路，而不是继续并行修补。
- 每个阶段都只有一个状态真源、一个结果主写入点和一个验收出口。
- 开发拿到 `tasks.md` 就能按批次实施，测试拿到 `checklist.md` 就能按主链回归。

## Delivery Strategy
### Priority Model
- `P0`：阻断稳定上线或直接破坏用户信任的问题，必须先做完再进入下一批。
- `P1`：影响主链一致性和可维护性的问题，应在 P0 完成后收敛。
- `P2`：低风险残留和历史兼容清理，不阻塞上线，但必须登记。

### Execution Batches
- `Batch A / P0`：状态真源与 DTO 契约收口
- `Batch B / P0`：鉴权边界与接口信任链收口
- `Batch C / P0`：前端导航、回流与主链跳转收口
- `Batch D / P1`：邀请收益、结算状态与统计一致性收口
- `Batch E / P1`：核心链路联调与回归基线固化
- `Batch F / P2`：低频残留、兼容层和未纳入范围问题登记

## Current Governance Baseline
### 主链真源
- `orders`：只维护订单聚合阶段，不承载单个分身履约细节。
- `order_dispatch_requests`：只维护订单与分身的派单/接单关系。
- `content_generation_requests`：只维护生成、发布、反馈、验收四段履约真源。
- `earnings`：只维护收益流水，余额类字段只是汇总镜像。
- `referrals`：只维护邀请关系和邀请结算完成态，不替代收益流水。

### 当前主要风险
- 状态真源仍存在多点写入和字典交叉，开发容易继续越界写状态。
- 鉴权仍存在对可伪造头信息的信任链，用户身份边界不够可信。
- 前端主链回流已局部修复，但项目级没有统一验收矩阵，容易回归。
- 邀请收益、订单收益和统计展示口径仍可能漂移，影响用户信任。

## ADDED Requirements
### Requirement: 项目级执行优先级
系统 SHALL 提供一份项目级执行优先级定义，让开发、联调和测试按同一顺序推进核心链路治理。

#### Scenario: 开发领取任务
- **WHEN** 开发查看项目级治理任务
- **THEN** 能明确区分 P0、P1、P2 的任务边界、前置依赖和完成标准

#### Scenario: 测试安排回归
- **WHEN** 测试根据项目级 spec 安排回归
- **THEN** 能按批次确认哪些链路必须先通过、哪些问题可延后登记

### Requirement: 状态真源与 DTO 契约收口
系统 SHALL 先收敛订单、派单、内容处理、收益结算的状态真源和接口 DTO，再允许继续扩展主链功能。

#### Scenario: 订单主链状态可追踪
- **WHEN** 查看订单从支付到验收完成的全过程
- **THEN** 应能明确 `orders`、`order_dispatch_requests`、`content_generation_requests` 的唯一维护边界

#### Scenario: 接口消费口径一致
- **WHEN** 前端消费订单、处理记录或收益接口
- **THEN** 应只依赖一套 canonical DTO，不再在页面中自行兼容多套字段

#### Scenario: 历史兼容字段只读退场
- **WHEN** 系统仍需兼容 `*_id`、`*_at`、`summary_stats`、`publish_feedback.link` 等历史字段
- **THEN** 这些字段只允许在单点 adapter 内只读映射，页面与业务写入只读取 canonical DTO
- **AND** 当订单详情、处理状态、收益接口连续两轮回归均只返回 canonical DTO，且页面直接消费历史字段清零后，兼容映射必须下线

### Requirement: 鉴权边界可信
系统 SHALL 收敛用户端和管理端的身份识别边界，禁止核心接口仅依赖可伪造的请求头确认身份。

#### Scenario: 用户访问核心接口
- **WHEN** 用户访问需要登录的订单、分身、收益相关接口
- **THEN** 身份校验应由统一鉴权链完成，而不是仅凭 `x-user-id` 一类头信息放行

#### Scenario: 管理端登录失效
- **WHEN** 管理端 token 失效或缺失
- **THEN** 页面应统一进入失效处理，而不是各页自行兜底

### Requirement: 前端主链跳转与回流可验证
系统 SHALL 统一创建、接单、生成、发布、验收关键页面的跳转规则和回流规则。

#### Scenario: 创建后回流
- **WHEN** 用户完成分身创建
- **THEN** 页面应回到统一入口并刷新数据，且用户能看到新建对象

#### Scenario: 接单后单一路径推进
- **WHEN** 用户接单成功
- **THEN** 系统应只进入一条明确的生成/处理路径，避免双跳转、错路由和缺参

### Requirement: 收益与邀请统计一致
系统 SHALL 统一订单收益、邀请收益、余额汇总和状态展示的口径，避免流水与汇总不一致。

#### Scenario: 邀请奖励结算
- **WHEN** 被邀请用户满足首个有效触发条件
- **THEN** 奖励状态、收益流水和用户可见统计应保持一致

#### Scenario: 订单收益展示
- **WHEN** 用户查看收益记录或余额汇总
- **THEN** 订单结算状态与展示文案应来自统一字典，不出现 `settled/completed` 混用歧义

### Requirement: 核心链路回归闭环
系统 SHALL 为登录、下单支付、接单生成、发布反馈、验收结算、邀请收益提供统一回归清单。

#### Scenario: 回归执行
- **WHEN** 团队完成一个任务包
- **THEN** 必须能根据清单完成代码验证、接口验证和主链回归验证

#### Scenario: 问题留档
- **WHEN** 本轮未处理的问题被识别
- **THEN** 应被登记到 P2 残留项，而不是口头遗留或混入已完成范围

## MODIFIED Requirements
### Requirement: 项目完成度判断标准
项目完成度 SHALL 以“任务包是否交付、核心链路是否闭环、状态与接口是否一致、验收清单是否通过”为标准，而不再只看页面和接口是否存在。

### Requirement: 上线前验收范围
上线前验收 SHALL 优先覆盖登录鉴权、订单支付、派单接单、内容生成、发布反馈、验收结算、邀请收益七条主链，并按照 P0 -> P1 -> P2 的顺序推进，而不是平均分配精力到所有页面。

## REMOVED Requirements
### Requirement: 默认以单模块局部补丁推进
**Reason**: 当前风险已跨越前端、后端和数据模型，继续按页面或接口各自修补会重复制造多口径。
**Migration**: 后续改动必须先归属到某个任务包，再按对应状态边界、接口契约和验收清单落地。
