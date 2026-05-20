# Tasks
- [ ] Task 1: 现状对齐与口径确认（不改代码）
  - [ ] 盘点现有 Dashboard 前端请求链路与现有接口返回字段
  - [ ] 明确 GMV 来源字段（orders 表金额字段）与 revenue 来源字段（earnings.type='revenue'）
  - [ ] 明确订单状态分组复用来源（与订单列表一致）

- [ ] Task 2: 实现聚合接口 `/api/admin/dashboard/overview`
  - [ ] 在 `admin.controller.ts` 增加路由 `GET dashboard/overview`
  - [ ] 在 `admin.service.ts` 增加 `getDashboardOverview(days)` 聚合方法
  - [ ] 复用现有 stats/trends/queues/campaign 逻辑并统一返回结构
  - [ ] 增加增长率计算逻辑（处理 yesterday=0）
  - [ ] 保持旧接口兼容不移除

- [ ] Task 3: 统一指标口径与字段命名
  - [ ] 订单状态统计与管理后台订单列表状态分组对齐（同一处映射/同一套条件）
  - [ ] 供给队列字段输出满足前端展示需要（avatar/order 基本信息、时间、状态）

- [ ] Task 4: 重构 Dashboard 前端页面为“一次请求渲染”
  - [ ] 将页面请求改为只调用 `/api/admin/dashboard/overview`
  - [ ] 重新组织页面结构：顶部范围切换 + KPI + 趋势 + 工作台 + 告警
  - [ ] 去除所有硬编码趋势文案，统一读取后端增长率字段
  - [ ] 保持现有 AdminLayout 风格与组件使用习惯

- [ ] Task 5: 验证与回归
  - [ ] `pnpm validate` 通过
  - [ ] 手工验收：范围切换（7/14/30）、刷新、KPI 数字、趋势图、队列列表、活动数据、告警渲染
  - [ ] 旧接口仍可访问（不要求前端使用，但避免破坏其他页面）

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2
- Task 5 depends on Task 2, Task 4

