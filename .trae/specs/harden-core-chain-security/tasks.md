# Tasks

## Batch P0：上线阻断（必须先完成）

- [x] Task 1: 管理端 token 改为可验证签名（**BREAKING**）
  - [x] SubTask 1.1: 定义 token 规范（签名算法、exp、iss/aud 可选）与 header 传输约定（Authorization Bearer 优先）
  - [x] SubTask 1.2: `admin/login` 签发新 token，并保持响应 envelope 不变
  - [x] SubTask 1.3: `AdminAuthGuard` 校验新 token，校验通过后将 `admin` 挂载到 request
  - [x] SubTask 1.4: 验证伪造 token（base64/json）无法访问任一 `/api/admin/*`（除 login）
  - [x] SubTask 1.5: `pnpm validate` 通过

- [x] Task 2: 用户端 token 禁止弱密钥回退 + 过期机制（**BREAKING**）
  - [x] SubTask 2.1: 移除默认 secret 回退策略；缺失密钥时 fail-fast（启动失败或拒绝签发/校验）
  - [x] SubTask 2.2: token 增加 exp 并在校验处强制过期判定
  - [x] SubTask 2.3: 统一 401/403 的 body 结构（沿用 `{ code, data, message }`）
  - [x] SubTask 2.4: `pnpm validate` 通过

- [x] Task 3: 清理收益 SQL 拼接点（注入面清零）
  - [x] SubTask 3.1: 扫描收益模块所有 where 拼接，改为参数化查询
  - [x] SubTask 3.2: 增加最小自检（grep 不允许出现 `user_id = '${` 之类模式）
  - [x] SubTask 3.3: `pnpm validate` 通过

- [x] Task 4: 收益 overview DTO 契约对齐（前后端一致）
  - [x] SubTask 4.1: 选定契约策略（二选一）
    - 策略 A：后端返回 canonical camelCase（推荐）
    - 策略 B：前端 adapter 同时兼容 snake_case 并映射到 camelCase
  - [x] SubTask 4.2: 完成契约改造并更新消费侧（收益中心页）
  - [x] SubTask 4.3: 验证“余额/待结算/可用余额/提现门槛”展示不为 0 且含义正确
  - [x] SubTask 4.4: `pnpm validate` 通过

## Batch P1：合规与一致性（强烈建议本轮收尾）

- [x] Task 5: leaderboard 移除 PII（phone）
  - [x] SubTask 5.1: leaderboard 响应不返回 phone（必要时仅返回脱敏字段且需鉴权）
  - [x] SubTask 5.2: `pnpm validate` 通过

- [x] Task 6: 测试文件策略收口（不再靠删测试文件过 tsc）
  - [x] SubTask 6.1: 选择策略（二选一）
    - 策略 A：tsconfig 排除 `*.test.ts/*.spec.ts`（最小变更）
    - 策略 B：引入测试类型/框架并纳入验证链路（系统化）
  - [x] SubTask 6.2: 验证新增测试文件不会导致 `pnpm validate` 失败

# Task Dependencies
- Task 3 depends on Task 2 (鉴权统一后可顺手清理收益模块的 owner 校验取值链)
- Task 4 depends on Task 3 (避免边改契约边改 SQL 引入回归)
- Task 5 can run in parallel with Task 4
- Task 6 can run in parallel with Task 5

# Acceptance Gate
- 每个 Task 完成必须跑一次 `pnpm validate`
- 所有 P0 Task 完成后，才允许开始任何新功能或 UI 优化
