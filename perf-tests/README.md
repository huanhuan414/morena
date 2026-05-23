# 后端性能 / 高并发测试

## 前置条件

- 准备压测目标地址：`API_BASE_URL`（例如 `http://localhost:3000`）
- 不同角色令牌：
  - 普通用户：`API_TOKEN`
  - 管理员：`API_ADMIN_TOKEN`

> 建议不要在压测中走短信/微信登录链路，直接使用稳定的 token（避免把外部依赖当成系统瓶颈）。

## 运行并生成 HTML 报告

匿名（不带 token）：

- `pnpm perf:baseline:anon` → `perf-tests/reports/anon-baseline.html`
- `pnpm perf:stress:anon` → `perf-tests/reports/anon-stress.html`

普通用户：

- `pnpm perf:baseline:user` → `perf-tests/reports/user-baseline.html`
- `pnpm perf:stress:user` → `perf-tests/reports/user-stress.html`

管理员：

- `pnpm perf:baseline:admin` → `perf-tests/reports/admin-baseline.html`
- `pnpm perf:stress:admin` → `perf-tests/reports/admin-stress.html`

## 场景文件

目录：`perf-tests/artillery/scenarios/`

- `*-baseline.yml`：基线压测（warmup + baseline）
- `*-stress.yml`：高并发压力测试（ramp + peak）

