# 管理后台 Dashboard 重构 Spec

## Why
当前“系统概览”页面信息架构混乱、口径不统一且存在硬编码趋势数据，无法支持运营与经营决策。需要重构为可扩展、口径一致的一体化 Dashboard。

## What Changes
- 新增管理后台聚合接口 `GET /api/admin/dashboard/overview?days=7|14|30`，一次返回首屏所需数据。
- Dashboard 首屏信息架构重排为“用户/交易/供给/财务”四象限 KPI + 趋势 + 运营队列 + 活动效果 + 告警。
- 指标口径统一：订单状态统计与管理后台订单列表使用同一套状态分组/枚举映射。
- 去除前端硬编码趋势（例如 “+12%”），由后端计算并返回“较昨日增长率”字段。
- 保留现有旧接口（`/api/admin/dashboard/stats`、`/api/admin/dashboard/trends`、`/api/admin/queues/supply`、`/api/admin/activities/campaign*`）以避免 **BREAKING**，但前端页面切换为优先使用 `overview`。

## Impact
- Affected specs: 管理后台数据总览、增长活动统计、供给队列、订单状态口径、财务概览
- Affected code:
  - `src/package-admin/pages/dashboard/index.tsx`
  - `server/src/modules/admin/admin.controller.ts`
  - `server/src/modules/admin/admin.service.ts`

## ADDED Requirements
### Requirement: Dashboard 聚合接口
系统 SHALL 提供 `GET /api/admin/dashboard/overview`，用于一次性获取 Dashboard 首屏数据。

#### Scenario: Success case
- **WHEN** 管理员携带合法 token 请求 `GET /api/admin/dashboard/overview?days=7`
- **THEN** 返回 `{ code: 200, data, message: "success" }`
- **AND THEN** `data` 包含以下字段：
  - `range`: `{ days: number, startDate: string, endDate: string }`
  - `kpi`: `{ users, trade, supply, finance }`
  - `trends`: `{ days: number, points: Array<{ date: string, newUsers: number, orders: number, gmv: number, revenue: number }> }`
  - `queues`: `{ pendingDispatch: any[], dispatchExpired: any[], awaitingAcceptance: any[] }`
  - `campaign`: `{ config: any, stats: any }`
  - `alerts`: `Array<{ key: string, level: "info"|"warn"|"critical", title: string, count: number, link?: string }>`

#### Scenario: Invalid token
- **WHEN** 未授权请求 `GET /api/admin/dashboard/overview`
- **THEN** 返回 `{ code: 401, data: null, message: "未授权" }`

### Requirement: KPI 指标口径（GMV + 收入）
系统 SHALL 同时展示 GMV 与收入口径，并在接口返回中明确字段含义。

#### Scenario: KPI 计算
- **WHEN** 请求 `overview`
- **THEN** `kpi.trade` 同时包含：
  - `todayOrders`
  - `todayGmv`（来自订单金额字段聚合）
  - `todayRevenue`（来自 earnings.type='revenue' 聚合）
  - `ordersGrowthRate`、`gmvGrowthRate`、`revenueGrowthRate`（较昨日）

### Requirement: 趋势与增长率
系统 SHALL 在后端计算增长率并返回，前端不得展示硬编码趋势数据。

#### Scenario: Growth rate
- **WHEN** `todayValue` 与 `yesterdayValue` 可计算
- **THEN** 返回 `growthRate`（百分比或小数，统一口径在实现中固定）
- **AND THEN** `yesterdayValue=0` 时返回 `null` 或 `0`（实现中需明确，避免除零）

## MODIFIED Requirements
### Requirement: Dashboard 页面首屏布局
系统 SHALL 将管理后台 Dashboard 首屏组织为以下模块，并提供跳转到对应管理页面的入口：
- 顶部：时间范围（7/14/30）+ 手动刷新
- Row1：4 张 KPI 卡（用户/交易/供给/财务），每张卡包含“今日值 + 较昨日变化”
- Row2：趋势图（新增用户/订单/GMV/收入）
- Row3：运营工作台（供给队列、待验收、内容待审、活动 CTR）
- Row4：告警与异常（可折叠）

## REMOVED Requirements
### Requirement: 前端硬编码趋势文案
**Reason**：与真实数据无关，误导决策。
**Migration**：改为读取 `overview.kpi.*GrowthRate` 渲染；无数据时展示 “-”。

