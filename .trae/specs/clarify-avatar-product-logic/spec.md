# 分身模块产品逻辑梳理 Spec

## Why
分身模块已经覆盖创建、托管、交友、语音通话、接单、内容发布与验收，但当前前后端链路跨多个页面与模块，存在入口分散、状态双轨、参数不一致与页面悬空等问题。需要先把真实产品闭环和当前断点梳理清楚，作为后续产品收敛、交互修正和技术治理的统一依据。

## What Changes
- 梳理分身模块的完整生命周期，包括发现入口、创建、日常运营、社交扩展、商单执行、发布反馈与验收完结。
- 明确前端页面职责、页面跳转关系、关键接口调用和页面回流规则。
- 明确后端核心实体、主要接口、状态流转和当前真实的数据承载路径。
- 识别当前影响闭环稳定性的关键断点，并给出后续收敛方向。
- 定义分身模块后续治理范围，避免继续在双轨模型和临时页面入口上迭代。

## Impact
- Affected specs: 分身生命周期、托管运营、分身社交、语音通话、商单执行、发布反馈、账号绑定
- Affected code: `src/pages/mind-chat/index.tsx`、`src/pages/avatar/*`、`src/pages/avatar-profile/index.tsx`、`src/pages/avatar-recommend/index.tsx`、`src/pages/voice-call/index.tsx`、`src/pages/order/*`、`server/src/modules/avatar/*`、`server/src/modules/order/*`、`server/src/modules/order-processing/*`

## Current Product Logic
### Premise
- 分身模块当前不是单点功能，而是“用户资产 + 自动运营代理 + 社交节点 + 商单执行主体”的复合模块。
- 真实业务闭环已经跨越前端多个页面和后端多个模块，不能只从单一页面或单一表结构理解。

### Constraints
- 前端入口分散在首页、个人中心、TabBar、订单链路补入口中，用户认知路径并不统一。
- 后端同时存在 `order_dispatch_requests`、`content_generation_requests`、`orders.result`、`published_works`、`order_results` 等多处结果承载点。
- 部分页面与参数约定不一致，导致产品设计上的理想链路与实际可执行链路存在偏差。

### Boundaries
- 本次梳理聚焦“分身模块的真实产品逻辑与治理边界”，不进入视觉交互重设计。
- 本次梳理覆盖前端页面职责、关键跳转、核心接口、状态流转与断点，不延伸到所有外部平台细节。

### Endgame
- 后续应将分身模块收敛为单一用户入口、单一业务主链、单一状态源、单一结果归档方式。

## Current Lifecycle
### 1. 发现入口
- 首页提供创建分身和素材库入口，分身缺失时 Banner 也会引导创建。
- 个人中心提供“我的分身”和“好友”入口。
- TabBar 的分身入口进入 `mind-chat`，承载“我的分身 / 分身广场”双 Tab。
- 订单与匹配页在缺少可用分身时也会补充创建入口。

### 2. 创建分身
- 用户通过三步流程完成素材上传、音色选择或声音复刻、能力配置。
- 创建依赖上传接口和分身创建接口，成功后通过返回上一页方式回流。
- 如果是声音复刻型分身，后端初始状态会进入 `training`，否则直接进入 `active`。

### 3. 日常运营
- `mind-chat` 负责分身列表浏览、搜索与托管开关。
- `avatar-manage` 负责配额、托管总设置、活跃时段、自动能力和删除等运营操作。
- `avatar-settings` 负责单个分身资料、定位和功能配置。
- 平台账号配置页承接内容发布前的平台绑定需求。

### 4. 社交扩展
- `avatar-recommend` 负责分身交友推荐与好友请求发起。
- `avatar-friends` 负责待确认请求、好友列表、聊天记录和通话入口。
- `voice-call` 承接分身与好友之间的语音通话。
- 社交链路本质上是托管运营的扩展能力，而不是独立模块。

### 5. 商单执行
- 分身在派单后进入订单执行链路，用户可在分身商单页查看状态。
- 当前产品主链应按“接单 -> 生成 -> 确认 -> 发布 -> 反馈 -> 验收 -> 完成”理解。
- 发布前若未绑定平台账号，会从发布指引页跳转到账号配置页。

### 6. 发布反馈与完结
- 当前真实发布反馈主写入点在 `content_generation_requests.publish_feedback`。
- 验收完成后，订单会在全部处理记录完成时同步为 `completed`。
- 因为结果模型多处并存，当前“结果归档”并未完全形成单一可信出口。

## Frontend Map
### 核心页面职责
- `src/pages/mind-chat/index.tsx`: 分身主入口，承载我的分身、分身广场、搜索、托管开关和创建入口。
- `src/pages/avatar/avatar-create/index.tsx`: 分身创建页，负责素材上传、声音复刻和能力配置。
- `src/pages/avatar/avatar-manage/index.tsx`: 分身运营中心，负责配额、托管配置与分身管理。
- `src/pages/avatar/avatar-settings/index.tsx`: 单个分身的资料与功能设置。
- `src/pages/avatar/avatar-friends/index.tsx`: 分身好友、待确认请求、聊天记录、语音通话入口。
- `src/pages/avatar-profile/index.tsx`: 分身公开主页。
- `src/pages/avatar-recommend/index.tsx`: 分身推荐与交友请求发起。
- `src/pages/avatar/avatar-account-config/index.tsx`: 外部平台账号绑定和刷新。
- `src/pages/avatar-orders/index.tsx`: 分身商单状态查看。
- `src/pages/voice-call/index.tsx`: 分身语音通话执行页。

### 页面回流规则
- 创建成功后应返回分身列表或管理页，并保证数据刷新。
- 平台账号配置完成后应返回发布指引页继续闭环。
- 交友请求接受后应回到好友详情或聊天上下文，而不是丢失当前分身上下文。

## Backend Map
### 核心实体职责
- `avatars`: 分身主实体，承载资料、人格、技能、状态、托管相关字段。
- `orders`: 订单主实体，承载订单需求、预算、状态与聚合结果。
- `order_dispatch_requests`: 派单请求实体，理论上可承载分发与处理状态。
- `content_generation_requests`: 当前真实的内容处理主载体，承接生成、发布、反馈、验收。
- `published_works`: 发布作品归档实体。
- `order_results`: 效果验收实体。

### 当前真实主链
- 分身创建写入 `avatars`。
- 订单创建写入 `orders`。
- 派单动作进入 `order_dispatch_requests`。
- 内容生成、确认、发布、反馈、验收主要写入 `content_generation_requests`。
- 全部处理完成后回写 `orders.status = completed`。

### 状态维护边界
- 分身状态由 `avatar` 模块维护，核心状态包括 `training`、`active`、`failed`。
- 订单状态由 `order` 与 `order-processing` 共同维护，当前存在 `pending_payment`、`in_progress`、`submitted`、`completed` 等状态。
- 分发状态由 `order-dispatch` 维护，但当前 `confirmed/rejected/accepted` 口径不统一。
- 内容处理状态由 `order-processing` 维护，主链为 `queuing -> publishing -> published -> awaiting_acceptance -> completed`。

## Key Breakpoints
### P0
- 分身主页参数不一致：有的页面传 `avatarId`，而主页读取 `id`。
- 非 Tab 页面误用 `switchTab`，导致部分跳转理论上无法执行。
- 个人中心直接进入好友页但未提供 `avatarId`，好友页缺少执行上下文。

### P1
- 托管字段口径不一致：`is_hosted` 与 `trust_enabled` 并存。
- 分发状态口径不一致：统计使用 `confirmed/rejected`，接单写入 `accepted`。
- 订单详情存在查错表风险，部分逻辑读取 `order_requests`，其余逻辑使用 `order_dispatch_requests`。

### P2
- 分身商单页、完单页、交友聚合页存在注册但入口不清晰的问题。
- 语音通话链路包含硬编码地址和默认图兜底，跨端稳定性较弱。
- 创建页声音复刻使用 `anonymous` 作为用户标识，存在真实归属风险。

## Governance Direction
### 产品收敛
- 统一分身模块入口，明确“Tab 主入口 + 任务型补入口”的单一策略。
- 统一分身模块心智模型，按“资产创建 -> 自动运营 -> 社交扩展 -> 商单执行”描述业务，而不是零散页面集合。

### 技术收敛
- 统一订单处理主链，避免继续并行扩展多套结果容器。<mccoremem id="03g3uvp5irfejizsr1nztltta" />
- 统一状态源，明确订单状态、分发状态、处理状态各自唯一维护者。<mccoremem id="03g3uvp5irfejizsr1nztltta" />
- 统一页面参数规范和回流规则，避免分身上下文在跳转中丢失。

## ADDED Requirements
### Requirement: 分身生命周期全景
系统 SHALL 提供一份可落地的分身模块全景说明，覆盖用户从进入分身模块到完成分身商单闭环的完整主链。

#### Scenario: 用户创建并激活分身
- **WHEN** 用户从首页、个人中心或分身 Tab 进入创建页
- **THEN** 系统应能说明创建分身所需素材、步骤、依赖接口和创建后的回流页面

#### Scenario: 用户运营已创建分身
- **WHEN** 用户进入我的分身或分身管理页
- **THEN** 系统应能说明分身托管、活跃时段、自动能力与平台账号绑定之间的关系

#### Scenario: 分身执行商单闭环
- **WHEN** 分身接收派单并进入内容处理流程
- **THEN** 系统应能说明接单、生成、确认、发布、反馈、验收和完结的真实状态流转与数据落点

### Requirement: 页面职责与入口映射
系统 SHALL 明确分身模块的主要页面职责、来源入口、核心跳转关系和依赖参数，避免页面之间职责重叠或入口悬空。

#### Scenario: 页面职责可追溯
- **WHEN** 查看分身模块页面地图
- **THEN** 应能区分哪些页面属于创建、管理、社交、接单、发布和结果查看

#### Scenario: 页面跳转可验证
- **WHEN** 查看页面跳转关系
- **THEN** 应能识别每个关键页面的来源页、目标页、必填参数和回流规则

### Requirement: 后端实体与状态模型梳理
系统 SHALL 明确分身模块涉及的核心实体、状态字段、接口边界和当前真实处理主链。

#### Scenario: 后端链路可解释
- **WHEN** 查看后端模型说明
- **THEN** 应能区分 `avatars`、`orders`、`order_dispatch_requests`、`content_generation_requests`、`published_works`、`order_results` 各自承担的职责

#### Scenario: 状态流转可追踪
- **WHEN** 查看订单与发布处理状态
- **THEN** 应能说明订单状态、分发状态、内容处理状态和分身状态分别由哪些模块维护

### Requirement: 关键断点与治理优先级
系统 SHALL 输出当前影响分身模块稳定性的关键断点，并按用户体验和闭环风险进行优先级排序。

#### Scenario: 识别高风险断点
- **WHEN** 审视分身模块现状
- **THEN** 应至少识别入口错误、参数不一致、页面悬空、字段命名不一致、状态模型双轨等问题

#### Scenario: 输出后续治理方向
- **WHEN** 完成现状梳理
- **THEN** 应给出后续优先治理方向，包括单一主链、单一状态源、单一入口策略和页面回流规则

## MODIFIED Requirements
### Requirement: 分身商单闭环定义
分身商单闭环的当前实现 SHALL 以“订单创建 -> 派单 -> 内容处理 -> 发布反馈 -> 验收完成”为核心主链进行说明，其中内容处理链路当前以 `content_generation_requests` 为主要处理载体，而不是仅依据 `order_dispatch_requests` 或 `orders.result` 推断闭环结果。

## REMOVED Requirements
### Requirement: 默认认为分身模块只有创建与展示
**Reason**: 当前业务已经扩展为“创建 + 托管 + 社交 + 商单 + 发布 + 验收”的复合模块，仅以创建和展示理解模块边界会导致产品与技术判断失真。
**Migration**: 后续讨论分身模块时，统一以生命周期视角描述模块，不再把分身仅视作单一资料页或素材实体。
