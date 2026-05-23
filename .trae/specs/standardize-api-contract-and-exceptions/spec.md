# 全局异常处理与接口契约统一 Spec

## Why
当前后端已具备全局异常过滤器与“POST 201→200”的拦截器，但成功响应结构不统一（`status/data`、`code/msg/data`、裸对象并存），且存在“业务错误用 HTTP 200 返回 `{ code: 400, msg: ... }`”的反模式，导致前端解包与错误处理复杂、可观测性弱、回归成本高。

## What Changes
- 统一成功响应 Envelope：所有成功响应统一为 `{ code: 200, message: "success", data: <payload>, traceId, timestamp }`（兼容期内同时返回 `msg` 字段）。  
- 强化全局异常输出：所有异常响应统一为 `{ code: <httpStatus>, message, data: null|object, traceId, timestamp }`（兼容期内同时返回 `msg` 字段），并补齐对 `msg`/`message` 的兜底取值。
- 引入 TraceId：对每个请求生成/透传 `X-Trace-Id`（响应 Header + 响应体 `traceId`），用于链路追踪与排障。
- 规范化接口约定：明确“HTTP 状态码语义 + Envelope 语义”的一致性规则；禁止在 HTTP 200 下返回 `code!=200` 的错误对象；错误必须通过抛出异常进入统一过滤器。
- 最小修复一批存量不合规范端点：以 `payment` 模块为起点，将“直接 return `{ code: 400, msg: ... }`”改为抛出 `BadRequestException` 等标准异常。

## Impact
- Affected specs: 全局异常处理 | API 响应契约 | 可观测性（traceId） | 端点一致性
- Affected code:
  - server/src/main.ts（注册 middleware/interceptor/filter）
  - server/src/common/filters/http-exception.filter.ts（异常响应结构与兼容逻辑）
  - server/src/interceptors/*（新增/调整统一响应拦截器）
  - server/src/common/middlewares/*（新增 traceId middleware）
  - server/src/modules/payment/payment.controller.ts（存量端点修正示范）

## ADDED Requirements
### Requirement: 成功响应 Envelope 统一
系统 SHALL 对所有成功请求返回统一 Envelope。

#### Scenario: 任意成功请求
- **WHEN** 客户端调用任意成功返回的接口（GET/POST/PUT/DELETE）
- **THEN** HTTP 状态码为 200
- **AND** 响应体包含：
  - `code = 200`
  - `message = "success"`
  - `data` 为原业务 payload（允许为 `null`）
  - `traceId` 为字符串
  - `timestamp` 为毫秒级时间戳（number）
- **AND** 在兼容期内同时返回 `msg`（值等于 `message`）

### Requirement: 异常响应 Envelope 统一
系统 SHALL 对所有异常通过全局异常过滤器输出统一 Envelope。

#### Scenario: 抛出标准 HttpException
- **WHEN** 业务代码抛出 `BadRequestException/UnauthorizedException/ForbiddenException/NotFoundException/ConflictException` 等
- **THEN** HTTP 状态码与异常语义一致（4xx/5xx）
- **AND** 响应体包含：
  - `code = <HTTP status>`
  - `message` 为可读错误信息（不泄露敏感数据）
  - `data` 可选携带结构化错误上下文（默认 `null`）
  - `traceId` 与本次请求一致
  - `timestamp` 为毫秒级时间戳（number）
- **AND** 在兼容期内同时返回 `msg`（值等于 `message`）

#### Scenario: 未知异常（非 HttpException）
- **WHEN** 发生未捕获异常
- **THEN** HTTP 状态码为 500
- **AND** 响应体 `message` 为通用错误信息（例如“服务器内部错误”），不透传内部异常 message

### Requirement: TraceId 贯穿请求与响应
系统 SHALL 在每次请求中生成或透传 `X-Trace-Id`，并在响应 Header 与响应体中回传。

#### Scenario: 客户端未传 TraceId
- **WHEN** 客户端请求不包含 `X-Trace-Id`
- **THEN** 服务端生成新的 TraceId，并在响应 Header 与响应体回传同一值

#### Scenario: 客户端已传 TraceId
- **WHEN** 客户端请求包含 `X-Trace-Id`
- **THEN** 服务端沿用该值并在响应 Header 与响应体回传同一值

## MODIFIED Requirements
### Requirement: 接口错误处理规则
接口错误处理 SHALL 统一通过“抛出异常 + 全局异常过滤器”实现，禁止返回“业务错误对象”并保持 HTTP 200。

#### Scenario: 参数缺失/非法
- **WHEN** 接口参数缺失或非法（例如缺少 openid）
- **THEN** 必须抛出 `BadRequestException`（或等价 4xx 异常）
- **AND** 不允许 `return { code: 400, ... }` 且 HTTP 200

### Requirement: POST 成功状态码
POST 成功状态码 SHALL 统一为 200（已通过全局拦截器实现，后续保持不回退到 201）。

## REMOVED Requirements
### Requirement: 成功响应结构可自由定义
**Reason**: 成功结构不统一会放大前端解包复杂度与回归成本，并削弱可观测性。
**Migration**: 统一由全局响应拦截器输出 Envelope；兼容期内保留 `msg` 字段避免前端立即改动。
