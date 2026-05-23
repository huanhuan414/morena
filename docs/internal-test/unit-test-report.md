# 单元测试与覆盖率报告（CI 口径）

更新时间：2026-05-22  
口径：GitHub Actions `quality` job（Node 20 + pnpm 9）

## 一句话结论

仓库已接入后端 Jest 与前端 Vitest 的单元测试与覆盖率统计；CI 会输出覆盖率摘要（text-summary）与明细（text/lcov），并已启用低阈值覆盖率门禁以防止回退（阈值会逐步抬升）。

## 1. 执行入口

- 本地/CI 推荐入口：`pnpm test:unit`
- 仅后端：`pnpm test:server:cov`
- 仅前端：`pnpm test:front:cov`

脚本定义见：[package.json](file:///Users/aiden/Projects/morena/package.json)、[server/package.json](file:///Users/aiden/Projects/morena/server/package.json)

## 2. 本次运行结果（最新一次本地复现）

执行命令：

```bash
pnpm test:unit
```

### 2.1 后端（Jest + ts-jest）

覆盖率统计范围（已收敛）：

- `server/src/modules/order/**`
- `server/src/modules/order-processing/**`

测试文件：

- [order-status.spec.ts](file:///Users/aiden/Projects/morena/server/src/modules/order/order-status.spec.ts)

运行结果：

- Test Suites：1 passed
- Tests：2 passed

覆盖率摘要（Jest text-summary）：

- Statements：5.8% (80/1378)
- Branches：3.56% (44/1233)
- Functions：8.37% (15/179)
- Lines：5.39% (71/1316)

配置：

- [jest.config.cjs](file:///Users/aiden/Projects/morena/server/jest.config.cjs)

### 2.2 前端（Vitest + coverage-v8）

覆盖率统计范围（已收敛）：

- `src/constants/**`
- `src/utils/**`

测试文件：

- [publish-platform.test.ts](file:///Users/aiden/Projects/morena/src/constants/publish-platform.test.ts)
- [referral-rewards.test.ts](file:///Users/aiden/Projects/morena/src/constants/referral-rewards.test.ts)
- [avatar-style.test.ts](file:///Users/aiden/Projects/morena/src/utils/avatar-style.test.ts)
- [format.test.ts](file:///Users/aiden/Projects/morena/src/utils/format.test.ts)

运行结果：

- Test Files：1 passed
- Tests：3 passed

覆盖率摘要（v8 text-summary）：

- Statements：29.35% (246/838)
- Branches：77.77% (21/27)
- Functions：88.88% (16/18)
- Lines：29.35% (246/838)

配置：

- [vitest.config.ts](file:///Users/aiden/Projects/morena/vitest.config.ts)

## 3. CI 实际执行点（线上门禁口径）

CI 工作流：

- [ci.yml](file:///Users/aiden/Projects/morena/.github/workflows/ci.yml)

关键步骤（quality job）：

- `pnpm install --frozen-lockfile`
- `pnpm validate`
- `pnpm test:unit`
- `pnpm build:ci`

说明：

- 目前 CI 仅输出覆盖率摘要，不设阈值门禁；目的是先保证“测试体系可运行 + 输出可观测”。
- 冒烟与黑盒回归仍由 `docker-smoke` job 负责（`pnpm docker:test`，内部跑 `pnpm test` 的 API smoke）。

## 4. 已知限制与下一步建议

- 当前覆盖率低是预期行为：测试用例数量极少，coverage 统计分母覆盖了大量业务文件。
- 建议后续按模块补齐测试，并逐步收敛 coverage 统计范围与引入渐进阈值（先模块阈值、后全局阈值）。
