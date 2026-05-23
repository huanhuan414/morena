# 核心链路安全与契约补强 Spec

## Why
当前“核心链路治理（状态/DTO/导航/回流）”已具备可演示闭环，但 code review 暴露多项上线阻断风险（token 可伪造、默认弱密钥、SQL 注入、PII 泄露、收益 DTO 契约错配）。需要以最小改动补齐安全与契约底座，恢复“可可信上线”的工程基线。

## What Changes
- 管理端鉴权 token 改为可验证的签名 token（JWT/HMAC），禁止无签名 base64 token。**BREAKING**
- 用户端 token 禁止默认弱密钥回退，补齐过期机制（exp）与统一错误响应。**BREAKING**
- 修复收益相关 SQL 拼接点，收敛为参数化查询（消除注入面）。
- 修复收益 overview 前后端 DTO 契约错配，确保余额/待结算/可用余额展示与提现判断可信。
- 修复匿名或非必要接口的 PII 暴露（leaderboard 不返回 phone）。
- 规范化测试文件处理策略：确保 `pnpm validate` 不会因为 `*.test.ts/*.spec.ts` 失败（不再靠删除测试文件维持通过）。

## Impact
- Affected specs: 鉴权与会话管理 | 资产与收益展示 | 邀请与结算 | 工程化验证
- Affected code:
  - 管理端鉴权：`server/src/modules/admin/*`
  - 用户鉴权：`server/src/modules/auth/*`、`server/src/common/auth-user.util.ts`
  - 收益：`server/src/modules/earning/*`、`server/src/modules/earnings/*`、`src/package-profile/pages/earning-center/*`
  - Leaderboard：`server/src/modules/earnings/earnings.service.ts`
  - 工程校验：前后端 `tsconfig` 或脚本（仅限影响 `pnpm validate` 的测试文件策略）

## ADDED Requirements
### Requirement: 管理端 token 可验证
系统 SHALL 只接受可验证的签名 token 作为管理端鉴权凭证。

#### Scenario: 伪造 token 被拒绝
- **WHEN** 客户端传入未签名或伪造 token
- **THEN** `/api/admin/*`（除 login）统一返回 401（body 含 `{ code: 401, data: null, message: "未授权" }`）

#### Scenario: 正常登录可访问
- **WHEN** 管理员通过 `/api/admin/login` 获取 token
- **THEN** 使用 token 可访问 dashboard/users 等接口

### Requirement: 用户端 token 可信与可过期
系统 SHALL 禁止使用默认弱密钥签发或校验用户 token，并提供 token 过期机制。

#### Scenario: 缺少密钥时拒绝签发
- **WHEN** 服务端未配置用户 token 签名密钥
- **THEN** 服务启动或登录签发流程必须失败（fail-fast），禁止产生弱 token

#### Scenario: token 过期统一失效
- **WHEN** 客户端携带过期 token 访问需登录接口
- **THEN** 统一返回 401，并提示“登录已过期/请先登录”

### Requirement: 收益与排行榜无注入/无 PII
系统 SHALL 对收益查询使用参数化 SQL，并避免返回手机号等 PII。

#### Scenario: 收益查询无 SQL 拼接
- **WHEN** 查询收益 overview 或收益列表
- **THEN** 不允许出现 `user_id = '${userId}'` 等字符串拼接 where

#### Scenario: 排行榜不泄露 phone
- **WHEN** 获取收益排行榜
- **THEN** 响应不包含 phone 字段（或仅返回脱敏字段且需鉴权）

### Requirement: 收益 overview DTO 契约一致
系统 SHALL 对齐收益 overview 的字段口径，确保前端展示与提现判断可信。

#### Scenario: 前端展示正确
- **WHEN** 前端请求收益 overview
- **THEN** `balance/totalEarnings/pendingAmount/...`（或约定字段）准确映射后端真实含义，不出现全部为 0 的错配

## MODIFIED Requirements
### Requirement: 管理端登录失效
管理端登录失效 SHALL 由统一鉴权链路处理，并且 token 无法被伪造；网络层与页面层仅负责“失效后跳转登录页”的一致体验。

### Requirement: 核心链路回归闭环
核心链路回归 SHALL 额外覆盖“鉴权伪造拒绝”“token 过期”“收益契约正确”“排行榜无 PII”“SQL 注入面清零”。

## REMOVED Requirements
### Requirement: 允许无签名 token
**Reason**: 无签名 token 可被任意伪造，属于上线阻断安全漏洞。
**Migration**: 管理端登录接口返回新的签名 token；前端存储与请求头自动切换到新 token。

