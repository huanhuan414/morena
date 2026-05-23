# 上线回归清单（测试门禁 + 人工走查）

目标：形成一条可重复执行的上线前回归路径，确保“能阻断高风险回归 + 可快速定位问题”。

## 0. 适用范围

- PR/日常迭代：以 CI 门禁为准（`validate + test:unit`）
- 上线前：在 CI 绿色基础上，补齐 Docker 黑盒冒烟与关键路径人工走查

## 1. 自动化门禁（必须通过）

### 1.1 CI 门禁（默认）

CI `quality` job 必须全绿：

- `pnpm validate`
- `pnpm test:unit`
- `pnpm build:ci`
- 产物：CI 会上传 `coverage` artifact（含 server/front 的 lcov 与按文件明细）

### 1.2 本地一键回归（上线前推荐）

执行：

```bash
pnpm release:check
```

包含：

- `pnpm validate`
- `pnpm test:unit`（包含低阈值覆盖率门禁，防止回退）
- `pnpm test:docker`（docker-compose 起 db+server，跑 API smoke）

## 2. 黑盒冒烟（必须通过）

### 2.1 Docker 冒烟

执行：

```bash
pnpm test:docker
```

通过标准：

- docker-compose 全流程退出码为 0
- `api-tests` 容器内 `pnpm test` 冒烟通过（默认 `GET /api/hello`、`GET /api/health`）

### 2.2 关键接口（可选增强）

若上线涉及鉴权/支付/发布等关键域，建议在具备测试 token/账号时补跑：

```bash
pnpm test:api
```

说明：

- `test:api` 为完整 API 集合，可能依赖权限与测试数据，不建议作为 PR 强制门禁

## 3. 人工走查（上线前必须做一次）

要求：只走“最短关键路径”，每条路径以“页面可正常推进 + 无白屏 + 无关键报错 toast”为通过标准。

### 3.1 分身侧（接单/处理/验收）

- 进入分身端订单列表
- 点击一条 `pending`：能进入待接单/待处理页面
- 点击一条 `accepted/generating/preview/revision_requested`：能进入处理中桥页并正确路由后续页面
- 点击一条 `published`：能进入发布反馈提交页
- 点击一条 `awaiting_acceptance`：能进入待验收反馈页（role=avatar）

### 3.2 用户侧（下单/发布/反馈）

- 进入订单列表与订单详情：状态展示正常
- 关键状态流转页可正常打开：处理中 / 发布反馈 / 验收反馈 / 已完成

### 3.3 管理端（如本次上线涉及）

- 登录
- 订单列表可打开、筛选可用、详情可打开

## 4. 回滚与定位（出现问题时）

- 单测失败：优先看 `coverage` artifact 的按文件明细，定位最近改动模块是否回退
- Docker 冒烟失败：看 `docker compose logs -f server api-tests db`
- 前端白屏/跳转异常：优先复现后查看控制台/小程序日志，并比对状态→路由映射逻辑

