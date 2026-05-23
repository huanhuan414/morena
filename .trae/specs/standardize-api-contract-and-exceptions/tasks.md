# Tasks
- [x] Task 1: 盘点并固化 API 契约基线
  - [x] 列出当前成功/失败响应的主要变体与影响面（最少覆盖 app/payment/order-processing 代表性接口）
  - [x] 定义 `ApiSuccessResponse<T>` / `ApiErrorResponse` 的字段清单与兼容策略（`message`/`msg`）

- [x] Task 2: 设计并接入 TraceId 贯穿机制
  - [x] 设计 TraceId 生成规则与 Header 名称（`X-Trace-Id`）
  - [x] 设计与异常过滤器/成功拦截器的对接方式（同一 traceId 输出到 Header+Body）

- [x] Task 3: 统一成功响应 Envelope（全局拦截器）
  - [x] 新增“统一成功响应”全局拦截器：将成功结果包装为标准 Envelope
  - [x] 设计防重复包装策略（避免 Controller 已返回 Envelope 时二次包装）

- [x] Task 4: 强化异常过滤器输出（全局 filter）
  - [x] 兼容读取 `message/msg`，统一输出 `message` 并在兼容期补齐 `msg`
  - [x] 输出 `traceId/timestamp`，未知异常不泄露内部细节

- [x] Task 5: 修复存量不合规范端点（从 payment 开始）
  - [x] 将 “HTTP 200 + { code: 400, msg }” 改为抛出标准异常
  - [x] 确保改动后前端依旧可用（兼容期内保留 `msg`）

- [x] Task 6: 校验与回归
  - [x] `pnpm validate` 通过（根目录执行）
  - [x] 通过最少 3 个端点手测：成功（200）、参数错误（400）、未授权（401）

# Task Dependencies
- Task 3 depends on Task 1, Task 2
- Task 4 depends on Task 2
- Task 5 depends on Task 3, Task 4
- Task 6 depends on Task 3, Task 4, Task 5
