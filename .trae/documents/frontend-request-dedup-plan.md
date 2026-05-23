# 前端接口“防重复调用/防并发”治理计划（可逐步落地）

## Summary

目标是在不引入新依赖、尽量小 diff 的前提下，解决前端接口调用中的：
- 同参数重复请求（in-flight 并发重复）
- 轮询叠加/输入即请求造成的请求风暴
- 快速切换筛选/分页导致的竞态（过期响应覆盖新状态）
- 写接口按钮连点导致的重复提交

用户已确认的决策：
- 优先落地在 Network 层（全局收益最大）
- 不做响应缓存，只做去重/防并发（降低数据过期风险）
- 允许对 `src/network.ts` 做“必要最小”改动（尽量 opt-in，避免影响未知调用方）

## Current State Analysis（基于代码实况）

### 1) Network 层现状
- `src/network.ts` 目前仅做：域名拼接、鉴权 header 注入、401/403 统一处理；没有 in-flight 去重、没有取消（abort）、没有 request key。见 [network.ts](file:///Users/aiden/Projects/morena/src/network.ts#L140-L190)。
- 因缺少取消/去重，页面切换、快速输入、快速切 tab 时容易并发叠加，且旧响应可能覆盖新状态（需要业务层 guard 或“只认最后一次”机制）。

### 2) 高风险调用点（已定位）
- 管理后台用户搜索：`searchKeyword` 每次输入都触发 `useEffect` 拉取（无 debounce）。见 [users/index.tsx](file:///Users/aiden/Projects/morena/src/package-admin/pages/users/index.tsx#L28-L46)。
- 通知 hook：轮询 unread-count，且条件满足时再次拉 `/api/notifications` 列表，慢网下可能叠加。见 [useNotifications.ts](file:///Users/aiden/Projects/morena/src/hooks/useNotifications.ts#L65-L94)。
- “我的分身”列表：先拉 avatar，再对每个 avatar 并行拉 skills（分身多时瞬时并发爆发）。见 [mind-chat](file:///Users/aiden/Projects/morena/src/pages/mind-chat/index.tsx#L138-L159)。
- 订单列表：`useDidShow` + `onRefresh` 可并发触发 `fetchOrders`（内部无 inflight 门禁）。见 [order-list](file:///Users/aiden/Projects/morena/src/package-order/pages/order-list/index.tsx#L129-L149)。
- 订单广场：已有 `ordersLoading` 门禁，但快速切平台/翻页仍可能竞态；需要“只认最后一次响应”guard。见 [order-square](file:///Users/aiden/Projects/morena/src/package-order/pages/order-square/index.tsx#L178-L255)。

## Proposed Changes（分阶段、可回滚、可验收）

### Milestone A：Network 层补齐“in-flight 去重”能力（opt-in）

#### A1. 改动文件
- 允许改动文件：
  - [network.ts](file:///Users/aiden/Projects/morena/src/network.ts)

#### A2. 设计目标
- 仅处理“同 key 的并发重复请求”：第二次/第三次请求直接复用第一次的 Promise。
- 不做响应缓存（请求完成即从 map 移除）。
- 默认不启用（避免潜在行为变化），调用方通过 `dedupKey` 显式启用。
- 不引入新依赖：自己实现轻量 `stableStringify` 生成 key。

#### A3. 具体实现方案（决定性细节）
- 在 `network.ts` 内新增：
  - `const inflight = new Map<string, Promise<any>>()`
  - `const stableStringify(value: unknown): string`（对象 key 排序；循环引用保护：出现循环时转为 `"[Circular]"`）
  - `const buildDedupKey(option: any): string`：
    - 优先使用 `option.dedupKey`（字符串）
    - 否则返回空串（代表不启用）
- 修改 `request`：
  - 读取 `const dedupKey = buildDedupKey(option)`
  - 若 dedupKey 存在：
    - 若 `inflight.has(dedupKey)`：直接 return 已有 Promise
    - 否则创建 Promise，`inflight.set(dedupKey, promise)`，并在 finally 中 `inflight.delete(dedupKey)`
  - 其余逻辑保持原状（鉴权 header/401 处理不变）

#### A4. 验收标准
- 不传 `dedupKey` 时行为与现状一致。
- 传相同 `dedupKey` 且并发触发 2 次时：只发生 1 次真实网络请求（第二次复用 Promise）。

---

### Milestone B：把“请求风暴”点改为 debounce + 去重

#### B1. 管理后台用户搜索（优先级最高，最容易复现）
- 改动文件：
  - [users/index.tsx](file:///Users/aiden/Projects/morena/src/package-admin/pages/users/index.tsx)
- 改动目标：
  - 输入时不直接触发请求；使用 debounce（例如 300ms）后再更新用于查询的 keyword。
  - 调用 `Network.request` 时传 `dedupKey`，避免 debounce 边缘情况下的并发重复。
- 推荐实现（最小 diff）：
  - 增加 `searchInput`（Input 绑定）与 `searchKeyword`（用于查询）分离
  - `useEffect` 只依赖 `searchKeyword`；`onInput` 只更新 `searchInput`
  - 用 `useEffect` + `setTimeout/clearTimeout` 实现 debounce：`searchInput` 变化后延迟 setSearchKeyword
  - `fetchUsers` 的请求加 `dedupKey: 'admin/users?page=1&keyword=' + searchKeyword`（或更通用拼法）
- 验收：
  - 快速输入 10 个字符，只触发 1 次请求（停止输入后）。

---

### Milestone C：轮询链路去重与避免叠加

#### C1. useNotifications：避免 unread-count 触发二次列表拉取叠加
- 改动文件：
  - [useNotifications.ts](file:///Users/aiden/Projects/morena/src/hooks/useNotifications.ts)
- 改动目标：
  - `/api/notifications/unread-count` 的轮询请求增加 `dedupKey`，避免慢网下 interval 叠加。
  - `/api/notifications` 列表请求增加 `dedupKey`，避免“未读触发再拉列表”与“定时初始拉列表”重叠。
  - 当需要“拉最新一条未读通知”时，优先复用 `fetchNotifications()` 的结果或复用同一个 inflight（避免单独再打一枪）。
- 推荐实现：
  - 给 `fetchNotifications` 的 `Network.request` 加 `dedupKey: 'notifications:list'`
  - 给 `fetchUnreadCount` 的 `Network.request` 加 `dedupKey: 'notifications:unread-count'`
  - `fetchUnreadCount` 内触发“拉最新未读”时，直接 `await fetchNotifications()` 并从 state 列表里找最新未读（或拿返回值；如果不想改返回值，可在 `fetchNotifications` 里同时返回 list）
- 验收：
  - 把 `pollInterval` 设为 1s、模拟接口 2-3s 延迟时，不会出现并发叠加（最多 1 个 inflight）。

---

### Milestone D：控制 N+1 并发，避免瞬时压测式请求

#### D1. mind-chat：限制 loadAvatarSkills 的并发数
- 改动文件：
  - [mind-chat/index.tsx](file:///Users/aiden/Projects/morena/src/pages/mind-chat/index.tsx)
- 改动目标：
  - 将 `Promise.all(skillsPromises)` 替换为“有限并发池”（例如并发 3~5），避免分身数多时瞬时请求爆发。
  - 同时为 `/api/avatar` 主请求加 `dedupKey`，避免重复进入/刷新导致并发重复。
- 推荐实现：
  - 在文件内新增 `asyncPool(limit, items, worker)`（不引入依赖）
  - `skillsResults = await asyncPool(4, data, (item) => loadAvatarSkills(item.id))`
  - `/api/avatar` request 增加 `dedupKey: 'avatar:my-list'`
- 验收：
  - 分身数量 20 时，网络并发峰值受控在 4 左右（可通过抓包/日志确认）。

---

### Milestone E：分页/筛选竞态治理（只认最后一次响应）

#### E1. order-square：增加请求序列 guard，避免过期响应覆盖
- 改动文件：
  - [order-square/index.tsx](file:///Users/aiden/Projects/morena/src/package-order/pages/order-square/index.tsx)
- 改动目标：
  - 保留 `ordersLoading` 防并发；同时增加“请求序列号”guard，确保快速切换平台/翻页时只应用最后一次请求的结果。
- 推荐实现：
  - `const fetchSeqRef = useRef(0)`
  - `const seq = ++fetchSeqRef.current`；请求结束后在 setState 前判断 `if (seq !== fetchSeqRef.current) return`（过期则丢弃）
  - 请求加 `dedupKey`（可选）：`order:open:${platform}:${page}`
- 验收：
  - 连续快速切换平台 3 次，最终列表一定与最后一次选择的平台一致。

#### E2. order-list：加入 inflight 门禁 + dedupKey
- 改动文件：
  - [order-list/index.tsx](file:///Users/aiden/Projects/morena/src/package-order/pages/order-list/index.tsx)
- 改动目标：
  - `useDidShow` 与 `onRefresh` 不会并发触发重复请求。
- 推荐实现：
  - `const inflightRef = useRef<Promise<any> | null>(null)` 或 `loadingRef`
  - `Network.request` 增加 `dedupKey: 'order:list'`
- 验收：
  - 进入页面立刻下拉刷新，不会出现两次并发请求。

---

### Milestone F：写接口防连点（重复提交治理）

说明：该项属于“体验+数据一致性”治理，建议在上述 GET/轮询问题收敛后再做，避免一次改动覆盖太多文件。

优先处理的页面（从高风险到低风险）：
- `avatar-manage` 的 PUT/DELETE/POST 操作（托管开关、更新设置、删除等）
- 订单相关：取消/删除/接单等按钮

策略（统一口径）：
- UI 侧：按钮点击后进入“提交中”状态（禁用/Loading），直到请求结束
- 逻辑侧：同资源同动作增加 in-flight guard（比如 `actionKey = 'avatar:delete:' + id`）
- 网络层：可复用 `dedupKey`（注意写接口通常不建议无脑 dedup；需确认语义是“同动作连点”的同一请求）

## Task Breakdown（可逐步落地的任务清单）

按“单次改动范围可控（1-3 文件）+ 每步可验收”拆解：

### T1（基础设施）
- 修改：`src/network.ts`
- 交付：
  - request 支持 `dedupKey` in-flight 去重（opt-in）
  - 自测：写一个最小复现页面/在现有页面临时打点（不提交日志）验证只发 1 次请求

### T2（请求风暴）
- 修改：`package-admin/pages/users/index.tsx`
- 交付：
  - 搜索输入 debounce
  - 请求加 `dedupKey`

### T3（轮询叠加）
- 修改：`hooks/useNotifications.ts`
- 交付：
  - unread-count 与 notifications list 都加 `dedupKey`
  - unread 触发“拉最新未读”不再额外制造并发

### T4（并发上限）
- 修改：`pages/mind-chat/index.tsx`
- 交付：
  - skills 加载有限并发池
  - avatar 列表请求加 `dedupKey`

### T5（竞态治理）
- 修改：`package-order/pages/order-square/index.tsx`
- 交付：
  - request seq guard（只认最后一次响应）
  - 可选 dedupKey

### T6（并发门禁）
- 修改：`package-order/pages/order-list/index.tsx`
- 交付：
  - inflight 门禁或 dedupKey（避免 useDidShow + refresh 并发）

### T7（写接口防连点，后续逐步推广）
- 修改：按页面逐个推进（建议从 avatar-manage 开始）
- 交付：
  - 统一“提交中”状态与 actionKey 门禁

## Assumptions & Decisions
- 不引入新依赖（不使用 lodash debounce、p-limit 等），全部用本地小工具实现。
- `Network.request` 的 option 类型为 `any`，新增 `dedupKey` 不会触发 TS 约束问题；且默认不启用，不影响现有调用方。
- 不做响应缓存，不改变后端接口行为；本计划仅改前端调用策略。

## Verification（每步落地都要做）
- 静态检查：运行 `pnpm validate`
- 关键手工回归（建议每个 milestone 都回归一次）：
  - 管理后台用户搜索：快速输入/删除字符，确认不会“每个字符一次请求”
  - 通知：弱网下观察轮询不会堆积并发
  - mind-chat：分身多时不会瞬间打爆 skills 请求
  - 订单广场：快速切平台不会出现列表回跳
  - 订单列表：进入页面立刻刷新不会并发两次

