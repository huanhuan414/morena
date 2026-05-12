# A-6 冻结风险清单

| 风险 | 类型 | 当前责任人 | 优先级 | 所属阶段 | 处理策略 |
| --- | --- | --- | --- | --- | --- |
| `avatarId / id` 双轨 | 参数双轨 | 前端 | P0 | B | 统一分身路由参数为 `avatarId` |
| `trust_enabled / is_hosted / hosting_enabled` 双轨 | 字段双轨 | 后端 | P0 | B | 统一主写字段并保留兼容读 |
| processing 历史状态混用 | 状态双轨 | 后端/前端 | P0 | C | 服务统一归一，页面只消费 canonical |
| 列表页直达反馈页 | 导航旁路 | 前端 | P0 | C | 统一经过 `order-processing` |
| 订单状态多处计算 | 状态事实源 | 后端 | P0 | C | `OrderService` 作为唯一聚合入口 |
| 页面路径与注册不一致 | 导航断裂 | 前端 | P1 | E | 以 `src/app.config.ts` 清理 |
| 发布平台别名混用 | 字段双轨 | 前后端 | P1 | D | 统一 canonical 平台键 |
