# Morena 项目开发基准

> 本文档基于当前仓库阅读整理。后续开发默认以本文档和 `AGENTS.md` 为准；如代码事实与文档冲突，以当前代码、数据库迁移和实际运行结果为准，并同步更新本文档。

## 项目简介

Morena 是一个前后端分离的 AI 分身平台，前端基于 Taro + React 构建，面向 H5、微信小程序、抖音小程序等多端；后端基于 NestJS，提供用户登录、分身管理、订单发布与派单、内容生成、支付订阅、收益提现、社交互动、技能市场、后台管理等能力。

核心业务主线：

- 用户注册登录后创建或管理 AI 分身。
- 需求方发布订单并支付。
- 系统根据分身、订阅、位置、能力等条件派单。
- 分身接单、生成内容、提交发布结果。
- 平台记录收益、佣金、提现、金币和订阅权益。
- 后台管理用户、分身、订单、内容、财务、推广、活动和系统配置。

## 项目整体架构

整体为单仓库多应用结构：

- `src/`：Taro 前端应用，主包 + 多个分包。
- `server/`：NestJS 后端服务。
- `api-tests/`：API 冒烟和回归测试入口。
- `config/`：Taro/Vite/weapp-tailwindcss 构建配置。
- `compose.yaml` / `compose.local.yaml`：MySQL、后端、H5、本地/测试容器编排。

运行链路：

1. 前端页面通过 `@/network` 的 `Network.request/uploadFile/downloadFile` 发起请求。
2. `Network` 自动拼接 `PROJECT_DOMAIN`，并从 Taro Storage 注入用户 token、管理员 token、`X-User-Id`。
3. H5 开发环境中 `/api` 由 Taro/Vite dev server 代理到后端 `http://localhost:3000`。
4. 后端 `server/src/main.ts` 启动 NestJS，设置全局前缀 `/api`、CORS、上传静态目录 `/uploads`、全局异常过滤器和 HTTP 状态拦截器。
5. 后端模块大多通过 `server/src/storage/database/mysql-client.ts` 访问 MySQL，部分历史/生成代码保留 Drizzle/Supabase 结构定义。

## 目录说明

| 路径 | 说明 |
| --- | --- |
| `src/app.tsx` | 前端 App 入口，加载用户状态、注入 `LucideTaroProvider`，做全局错误日志记录。 |
| `src/app.config.ts` | Taro 页面、分包、权限、TabBar 配置。当前文件有未提交改动，修改前必须确认业务范围。 |
| `src/pages/` | 主包页面：首页、分身聊天、个人中心、登录、协议、隐私、webview、发布跳转。 |
| `src/package-order/` | 订单相关分包：订单列表、发布、详情、匹配、处理、验收、反馈、统计等。 |
| `src/package-avatar/` | 分身相关分包：分身主页、创建、管理、账号、好友、订阅、通话、内容等。 |
| `src/package-profile/` | 个人中心分包：设置、安全、通知、收益、推广、粉丝等。 |
| `src/package-skill/` | AI 技能分包：技能广场、创建、训练、试用、手相、穿搭、公众号文章等。 |
| `src/package-admin/` | 管理后台分包：登录、仪表盘、用户、分身、订单、财务、内容、推广、技能、设置。 |
| `src/package-coin/` | 金币分包：余额、充值、交易记录。 |
| `src/package-group-bot/` | 群机器人分包：群列表、群聊天。 |
| `src/components/ui/` | Taro 版 shadcn/ui 组件库。通用 UI 必须优先使用这里的组件。 |
| `src/network.ts` / `src/network/index.ts` | 前端唯一网络请求封装。禁止绕开它直接调用 `Taro.request/uploadFile/downloadFile`。 |
| `src/stores/user.ts` | Zustand 用户状态和登录态本地持久化。 |
| `src/constants/` | 前端常量，例如发布平台、分销奖励、头像标签。 |
| `src/utils/` | 时间、权限、轮询、地图、格式化等工具。 |
| `server/src/main.ts` | 后端启动入口，全局 `/api` 前缀、CORS、超时、静态上传目录、过滤器、拦截器。 |
| `server/src/app.module.ts` | NestJS 根模块，集中注册所有业务模块。 |
| `server/src/modules/` | 后端业务模块。 |
| `server/src/storage/database/` | 数据库客户端、schema、迁移。 |
| `server/src/storage/database/schema/migrations/` | 增量迁移脚本，是数据库变更的重要事实源。 |
| `api-tests/run.ts` | API 测试入口，支持按 id / group 跑用例。 |
| `scripts/` | 本地测试、迁移、二维码、视频 key 迁移等脚本。 |
| `docs/` | 产品、架构、支付、测试、验收等文档。 |
| `uploads/` | 本地上传目录。除调试/历史文件外，业务图片视频应走 TOS URL。 |
| `assets/`, `public/assets/`, `src/static/` | 历史或静态资源。新增图片视频原则上不得放入包内，TabBar 图标例外。 |

## 技术栈

前端：

- Taro `4.1.9`
- React `18`
- TypeScript
- Vite runner
- Tailwind CSS 4 + `weapp-tailwindcss`
- Zustand
- `lucide-react-taro`
- Vitest

后端：

- NestJS 10
- TypeScript
- MySQL 8.x 为主要运行数据库
- `mysql2/promise`
- Redis / ioredis
- Drizzle ORM 相关依赖和 PostgreSQL schema 生成文件仍存在
- Supabase client 兼容代码仍存在
- WebSocket / Socket.IO
- 微信支付、微信小程序、阿里云短信、火山引擎 Ark/ImageX/TOS、TikHub、飞书/企微等外部服务

工程：

- 包管理器必须使用 `pnpm`
- Docker Compose 支持 dev/test/local 链路
- ESLint + TypeScript 校验
- API 冒烟、回归、Docker 测试

## 启动流程

本地安装依赖：

```bash
pnpm install
```

开发模式：

```bash
pnpm dev
```

该命令通过 `concurrently` 同时执行：

- `pnpm dev:web`：Taro H5 watch，默认端口 `5000`
- `pnpm dev:server`：NestJS watch，默认端口 `3000`

单独启动：

```bash
pnpm dev:web
pnpm dev:weapp
pnpm dev:tt
pnpm dev:server
```

构建：

```bash
pnpm build:web
pnpm build:weapp
pnpm build:tt
pnpm build:server
pnpm build
```

验证：

```bash
pnpm validate
pnpm test:smoke
pnpm test:api
pnpm test:api:regression
pnpm test:docker
pnpm release:check
```

Docker 开发链路：

```bash
pnpm docker:dev
```

Docker 测试链路：

```bash
pnpm test:docker
```

后端启动细节：

- `server/src/main.ts` 会加载 `.env` 和 `.env.local`。
- `app.setGlobalPrefix('api')` 已设置全局路由前缀。
- 所有 Controller 装饰器中禁止手写 `api`。
- 默认端口为 `3000`，也支持命令行 `-p <port>`。
- H5 开发代理在 `config/index.ts` 的 `h5.devServer.proxy['/api']` 中配置。

## 数据库说明

### 当前事实源

运行代码大量使用 `server/src/storage/database/mysql-client.ts` 的 `getMySQLClient()` / `getPool()` 访问 MySQL。Docker 默认初始化脚本为 `server/init_database.sql`，Compose 中数据库名默认为 `mrl`。

同时仓库存在：

- `server/src/storage/database/shared/schema.ts`：Drizzle/PostgreSQL 风格 schema 生成文件。
- `server/src/storage/database/shared/relations.ts`：Drizzle relations。
- `mysql-schema.sql`：根目录 MySQL schema 草案/历史基线。
- `server/src/storage/database/schema/order_tables.sql`：订单链路相关表补充。
- `server/src/storage/database/schema/migrations/*.sql`：订单、派单、收益、内容价格等增量迁移。

开发数据库变更时必须先确认当前环境实际使用的 MySQL 表结构，再基于迁移补丁小步变更；禁止只改 TypeScript 类型或只改历史 SQL。

### 主要表

核心用户与分身：

- `users`：用户基础信息、手机号/openid、等级、余额、推荐码、封禁/风控字段等。
- `avatars`：分身信息、归属用户、形象、技能、状态、托管、位置、风格、统计等。
- `avatar_accounts`：分身外部平台账号配置。
- `avatar_skills`：分身技能绑定。
- `avatar_memories` / `avatar_contexts` / `avatar_agent_configs` / `avatar_learning_records`：分身智能体记忆、上下文、配置、学习记录。
- `avatar_friends` / `avatar_follows` / `avatar_affinity` / `avatar_blocks`：分身社交关系。

订单与内容：

- `orders`：订单主表，关联用户、分身、预算、状态、内容类型、平台、截止时间、软删除等。
- `order_dispatch_requests`：派单请求、目标分身、状态、过期时间、生成内容和发布反馈。
- `order_executions`：订单执行记录。
- `order_results`：订单结果与验收数据。
- `generated_content`：生成内容草稿/结果。
- `published_works`：已发布作品、URL、平台、封面、证明等。

社交与聊天：

- `posts`、`comments`、`likes`、`follows`
- `conversations`、`messages`
- `notifications`

收益、支付、订阅、金币：

- `earnings`
- `withdrawals` / `withdrawal_requests`
- `transactions`
- `payment_orders`
- `subscription_plans`
- `user_subscriptions`
- `avatar_subscriptions`
- 金币相关字段和充值记录由 `coin` / `payment` 模块维护。

运营与系统：

- `admin_users`
- `system_config`
- `skills`
- `referrals`、`referral_tiers`、佣金/奖励相关表
- `growth_campaigns`、`growth_campaign_events`
- `tasks`
- `platform_configs`

## 权限说明

### 普通用户

登录入口：

- `POST /api/auth/send-code`
- `POST /api/auth/phone-login`
- `POST /api/auth/wechat-login`
- `POST /api/auth/wechat-phone-login`
- `POST /api/auth/wechat/get-openid`
- `GET /api/auth/me`

普通用户 token：

- 后端 `AuthService` 生成自定义 token，格式为 `base64(payload).hmacSignature`。
- 不是标准 JWT。
- 默认有效期为 7 天。
- 前端存储在 Taro Storage 的 `token`。
- `Network` 会自动注入 `Authorization: Bearer <token>`。
- 同时兼容 `X-User-Id` 旧链路。

风控：

- 登录/验证码有 IP 和手机号频率限制。
- 有虚拟运营商号段限制。
- 有 IP 黑名单和每日注册限制。
- 推荐/邀请链路会记录设备和 IP 风险。

### 管理员

登录入口：

- `POST /api/admin/login`

管理员 token：

- `AdminService` 生成 base64 JSON token，包含 `id`、`username`、`exp`。
- 前端存储为 `admin_token`。
- `Network` 对 `/api/admin` 请求会优先带管理员 token，并附带 `admin_token` header。
- 后端每个 admin 接口手动调用 `adminService.verifyToken()` 校验。

注意：

- 管理员密码当前代码以数据库明文字段方式校验，不是现代哈希方案。
- 普通接口整体缺少统一 Nest Guard，很多接口依赖模块内自行读取 header/body/query 中的 userId。
- 不要在局部页面自己设计新鉴权协议，必须复用 `Network` 和现有后端校验方式。

## 公共组件说明

优先使用 `@/components/ui`：

- 按钮：`Button`
- 卡片：`Card`
- 表单：`Input`、`Textarea`、`Field`、`Label`
- 弹窗：`Dialog`、`AlertDialog`、`Drawer`、`Sheet`
- 选择控件：`Checkbox`、`RadioGroup`、`Select`、`Switch`、`Slider`
- 反馈：`Toast`、`Sonner`、`Skeleton`、`Progress`
- 导航与数据：`Tabs`、`Table`、`Pagination`、`DropdownMenu`

只有 `View`、`Text`、`Image`、`Camera`、`Canvas`、`Video` 等 Taro 基础能力，或组件库确实缺失时，才直接使用 `@tarojs/components`。

图标必须使用 `lucide-react-taro`。小程序端图标颜色应通过 `color/size/strokeWidth` 显式传入，不要依赖 `className="text-*"` 改 SVG stroke。

## 模块说明

前端模块：

- 首页/订单广场：`src/pages/index`、`src/package-order/pages/order-square`
- 分身聊天：`src/pages/mind-chat`
- 登录：`src/pages/login`
- 订单发布：`src/package-order/pages/order-create`、`order-create_new`
- 订单处理：`order-processing`、`order-matching`、`order-content-creation`、`order-asset-waiting`
- 订单验收反馈：`order-acceptance`、`order-feedback`、`order-publish-feedback`
- 分身创建管理：`src/package-avatar/pages/avatar-create`、`avatar-manage`、`avatar-settings`
- 分身账号和发布平台：`avatar-account-add`、`avatar-account-config`
- 订阅与金币：`package-avatar/pages/subscription`、`package-coin`
- 技能市场：`package-skill`
- 个人中心和收益推广：`package-profile`
- 管理后台：`package-admin`

后端模块：

- `auth`：手机号/微信登录、验证码、token、推荐注册风控。
- `user` / `user-stats`：用户资料、安全状态、学习进度、统计。
- `avatar` / `avatar-agent`：分身 CRUD、技能、记忆、托管、账号、Agent 配置。
- `chat`：会话和消息。
- `order`：订单创建、列表、详情、支付后状态、取消、删除、结果。
- `order-dispatch`：派单、推荐、接单、拒绝、超时、重新分配、时间线。
- `order-processing`：订单链路状态、链接校验、确认、发布、反馈、争议。
- `order-assets`：订单素材生成、上传、压缩包、排序、摘要。
- `content-generation`：文案/图片/视频内容生成、状态、历史、发布校验。
- `payment` / `coin` / `subscription` / `withdraw` / `earnings`：支付、金币、订阅、提现、收益。
- `referral` / `activities`：邀请推广、佣金、活动曝光点击。
- `social`：帖子、评论、点赞、关注。
- `skill` / `ai-skill`：技能列表、绑定、试用、AI 技能生成。
- `admin` / `dashboard` / `menu-feature`：后台管理、仪表盘、功能开关。
- `upload` / `storage` / `media`：上传、本地/TOS/ImageX 资源处理、签名。
- `ai` / `image-gen` / `video-gen` / `vision` / `voice-clone` / `asr`：AI 生成、视觉、语音、识别。
- `agent`：工具注册、平台配置、任务执行、发布辅助。
- `group-bot`：企微/飞书群机器人。

## 主要接口关系

所有后端实际访问路径都带 `/api` 前缀。

基础：

- `GET /api/hello`
- `GET /api/health`

认证/用户：

- `/api/auth/*`
- `/api/user/*`
- `/api/user-stats/*`

分身：

- `/api/avatar`
- `/api/avatar/:id`
- `/api/avatar/:id/skills`
- `/api/avatar/:id/memories`
- `/api/avatar/accounts`
- `/api/avatar-agent/:avatarId/*`

订单：

- `/api/order`
- `/api/order/list`
- `/api/order/open`
- `/api/order/stats`
- `/api/order/price-config`
- `/api/order/:id`
- `/api/order/:id/cancel`
- `/api/order/:id/repay`
- `/api/order-dispatch/*`
- `/api/order-processing/*`
- `/api/order-results/*`
- `/api/order-assets/*`

内容和 AI：

- `/api/content-generation/*`
- `/api/ai/*`
- `/api/ai-skill/*`
- `/api/image-gen/*`
- `/api/video-gen/*`
- `/api/vision/*`
- `/api/palm-reading/*`

支付/收益：

- `/api/payment/*`
- `/api/coin/*`
- `/api/subscription/*`
- `/api/earnings/*`
- `/api/withdraw/*`
- `/api/referral/*`

社交和通知：

- `/api/social/*`
- `/api/notifications/*`
- `/api/chat/*`

后台：

- `/api/admin/login`
- `/api/admin/dashboard/stats`
- `/api/admin/users`
- `/api/admin/avatars`
- `/api/admin/orders`
- `/api/admin/skills`
- `/api/admin/posts`
- `/api/admin/finance/*`
- `/api/admin/referral/*`
- `/api/admin/activities/*`
- `/api/admin/settings/*`

## 开发规范

### 变更流程

每次改动开始前必须写清：

```md
Premise:
- 现状：
- 目标：

Constraints:
- 禁止事项：
- 质量红线：pnpm validate 必须通过

Boundaries:
- 允许改动文件：
- 禁止改动内容：

Endgame:
- 验收标准：
```

默认边界：

- 单次只解决一个问题。
- 默认 1-3 个文件。
- 只做手术式最小 diff。
- 不顺手重构、不重排 import、不批量格式化。
- 完成小步骤后运行 `pnpm validate` 或等价 lint + tsc。
- 不引入新依赖，除非任务明确需要并已确认。

### 包管理器

只允许使用 pnpm：

```bash
pnpm install
pnpm add <package>
pnpm add -D <package>
pnpm remove <package>
```

禁止 `npm` / `yarn` 安装依赖。

### 网络请求

前端请求必须使用：

```ts
import { Network } from '@/network'
```

禁止：

- 业务代码直接 `Taro.request`
- 业务代码直接 `Taro.uploadFile`
- 业务代码直接 `Taro.downloadFile`
- 业务代码直接 `fetch('/api/...')`
- 请求 URL 硬编码 `localhost` 或业务域名

正确形式：

```ts
await Network.request({
  url: '/api/order/list',
})
```

注意双层 data：

- 第一层：`res.data` 是 Taro HTTP 响应体。
- 第二层：`res.data.data` 才通常是后端 envelope 中的业务数据。

### 资源规范

图片、视频等静态资源必须走 TOS/ImageX 等对象存储 URL。

禁止：

- 将大图片/视频打包进项目。
- 使用 `via.placeholder.com`、`placehold.co`、`example.com`、虚构 `/images/placeholder.jpg`。
- 复制后端工具里的 placeholder URL 到真实业务。

例外：

- 微信小程序 TabBar 图标可放本地 PNG，例如 `src/assets/tabbar/` 或当前 `src/tabbar-icons/`。

### 样式规范

- 默认 Tailwind className。
- 禁止常规样式使用硬编码 `px` 任意值，例如 `w-[340px]`、`text-[14px]`。
- 禁止常规样式写 `style={{ width: '200px' }}`。
- CSS 仅用于动画、复杂选择器、第三方覆盖、跨端兼容等必要场景。

### 跨端规范

- 平台判断直接用 `Taro.getEnv() === Taro.ENV_TYPE.WEAPP`，不要用 state 延迟设置。
- 垂直排列的 Taro `Text` 添加 `block`。
- Taro 原生 `Input/Textarea` 在 H5 端需要外层 `View` 包裹，样式放外层。
- Fixed + Flex 的底部操作栏 H5 需要必要 inline style，并避开 TabBar。
- Camera/Map/Canvas/Video/RecorderManager 等原生能力必须平台检测并提供 H5 降级。

## 命名规范

- 文件名：kebab-case，例如 `user-profile.tsx`
- 组件名：PascalCase，例如 `UserProfile`
- 变量/函数：camelCase，例如 `getUserInfo`
- 常量：UPPER_SNAKE_CASE，例如 `API_BASE_URL`
- 类型/接口：PascalCase，例如 `UserInfo`
- CSS 类名：优先 Tailwind 原子类

后端路由：

- Controller 禁止手写 `api`。
- 全局前缀由 `main.ts` 统一处理。

## 部署流程

### H5

```bash
pnpm build:web
```

产物默认在 `dist-web/`，可由 Nginx 或静态服务托管。H5 使用 hash 路由。

### 微信小程序

```bash
pnpm build:weapp
pnpm preview:weapp
```

产物默认在 `dist-weapp/`。微信项目配置会由构建插件生成/修正。

### 抖音小程序

```bash
pnpm build:tt
pnpm preview:tt
```

### 后端

```bash
pnpm build:server
```

后端产物在 `server/dist/`，生产运行入口为：

```bash
pnpm --filter server start:prod
```

或直接：

```bash
node server/dist/main.js
```

### Docker

开发：

```bash
pnpm docker:dev
```

测试：

```bash
pnpm test:docker
```

离线/本地产物链路参考：

```bash
pnpm docker:local
```

上线前建议：

```bash
pnpm release:check
```

## 哪些代码不能随意修改

以下区域属于高风险基础设施，非本次目标禁止顺手修改：

- `src/network.ts` 和 `src/network/index.ts`：请求、鉴权、域名拼接、去重都在这里。
- `server/src/main.ts`：全局 `/api` 前缀、CORS、超时、过滤器、拦截器。
- `server/src/storage/database/mysql-client.ts`：全局数据库访问和字段 camel/snake 转换。
- `server/src/storage/database/schema/*` 和 `server/init_database*.sql`：数据库基线与迁移。
- `config/index.ts`、`config/dev.ts`、`config/prod.ts`：构建、代理、PROJECT_DOMAIN、weapp-tailwindcss。
- `src/app.config.ts`：页面注册、分包、TabBar、权限，容易影响小程序包体和导航。
- `src/app.tsx`：全局状态和错误捕获。
- `src/stores/user.ts`：登录态、用户缓存、暗色模式。
- `src/components/ui/*`：通用 UI 基础组件，影响面大。
- `server/src/modules/payment/*`、`withdraw/*`、`coin/*`、`subscription/*`：资金链路。
- `server/src/modules/order*/*`、`content-generation/*`、`order-assets/*`：订单主链路。
- `.env`、`.env.local`、密钥、证书、支付配置、CI key：禁止提交或泄露。

## 哪些代码耦合最高

最高耦合区域：

- 订单链路：`order`、`order-dispatch`、`order-processing`、`order-assets`、`content-generation`、`order-results`、`payment`、`earnings`、`notification` 互相影响。
- 支付/订阅/金币/提现：`payment`、`subscription`、`coin`、`withdraw`、`earnings`、`referral` 同时改余额、冻结余额、佣金、交易记录。
- 分身智能体：`avatar`、`avatar-agent`、`agent`、`skill`、`ai-skill`、`chat`、`content-generation` 共享分身能力、平台账号、工具调用。
- 数据访问层：大量模块直接调用 `getMySQLClient().query()`，SQL 分散在各服务里，没有统一 Repository 层。
- 前端订单页面：`order-create` / `order-create_new` / `order-detail` / `order-matching` / `order-content-creation` / `order-acceptance` 跨页面依赖订单状态字段。
- 管理后台：`admin.service.ts` 聚合大量表查询和状态修改，是后台高耦合中心。

## 哪些地方最容易踩坑

- `/api` 前缀：后端已有 `app.setGlobalPrefix('api')`，Controller 里不能再写 `api`。
- 响应解包：前端经常需要 `res.data.data`，不能盲目把 `res.data` 当业务对象。
- 数据库事实源混杂：代码当前主要跑 MySQL，但仓库里还有 PostgreSQL/Drizzle schema 和 Supabase 兼容文件。
- 字段命名转换：`mysql-client.ts` 会做 snake_case/camelCase 转换，原生 SQL 返回和包装方法返回形态可能不同。
- `db.query()` 返回值不完全统一：有些代码按数组读，有些按 `result.data` 读。
- 普通 token 不是 JWT，管理员 token 也不是标准 JWT。
- 管理员接口没有统一 Guard，多数接口手动验证 token。
- `config/prod.ts` 当前硬编码了生产/测试域名，修改前必须确认环境。
- H5、小程序样式差异大：`Text`、`Input`、Fixed/Flex、原生组件都容易白屏或样式失效。
- `lucide-react-taro` 图标颜色不继承 `text-*`。
- 图片视频必须走 TOS/ImageX，仓库中历史占位图和 placeholder URL 不可继续复制。
- 部分中文注释/README 出现编码错乱，不能依赖注释文字判断业务。
- `src/app.config.ts` 当前包含用户未提交改动，后续改页面注册要先看 diff。
- `src/package-order/pages/order-create_new/` 当前是未跟踪目录，后续不要误删或覆盖。
- `server/src/modules/earning` 和 `server/src/modules/earnings` 同时存在，且 Controller 都可能挂 `/earnings`，需要确认实际注册模块和冲突。
- `server/src/modules/group-bot` 存在 Controller，但 `AppModule` 当前未注册 `GroupBotModule`，接口是否生效需核实。
- `server/src/modules/post` 存在服务但未明显注册为模块，社交内容主要走 `social`。
- `server/src/storage/database/mysql-client.ts` 内有默认连接配置，生产必须依赖环境变量覆盖。

## 注意事项

- 本仓库已有未提交改动，当前读到的状态包括：
  - `config/prod.ts`
  - `src/app.config.ts`
  - `src/package-order/pages/order-list/index.tsx`
  - `src/package-order/pages/order-create_new/`
- 后续开发不得回滚这些改动，除非明确确认。
- 改数据库必须写迁移并说明回滚策略。
- 改订单状态机必须同时检查前端页面、后台、派单、收益和通知。
- 改支付/提现必须补充冒烟或回归测试。
- 改资源引用必须确认是否为 TOS/ImageX URL。
- 新增通用 UI 前先查 `src/components/ui`。
- 小程序主包体积敏感，新增页面优先放入合适分包。
- 后端外部 API 调用较多，涉及微信、火山、阿里云、TikHub、飞书/企微时必须通过环境变量配置密钥。

## 常见问题

### H5 请求打到哪里？

开发环境中前端请求 `/api/*`，由 `config/index.ts` 的 H5 proxy 转发到 `H5_API_PROXY_TARGET`，默认 `http://localhost:3000`。生产环境通过 `PROJECT_DOMAIN` 拼接。

### 为什么接口返回成功但前端拿不到数据？

检查是否误用了 `res.data`。多数后端返回 envelope：`{ code, data, message }`，业务数据通常是 `res.data.data`。

### 为什么小程序页面没有出现在路由里？

检查 `src/app.config.ts` 是否注册到 `pages` 或对应 `subPackages`。TabBar 页面必须在主包。

### 为什么按钮/输入框 lint 报错？

项目要求通用 UI 使用 `@/components/ui`，不要用 `View/Text` 手搓按钮或直接用原生 `Input` 做通用输入框。

### 为什么图标颜色没变？

`lucide-react-taro` 在小程序端渲染为 `Image` 包裹的 SVG data URL，`className="text-red-500"` 不会改变内部 stroke。使用 `color="#..."`。

### 为什么本地图片不允许新增？

小程序包体积有限，且项目规定图片/视频走 TOS 对象存储 URL。只有 TabBar 图标允许本地 PNG。

### 为什么后台接口 401？

确认登录后 `admin_token` 已写入 Taro Storage，且请求 URL 以 `/api/admin` 开头，这样 `Network` 才会带管理员 token。

### 为什么普通用户接口 401？

确认 `token` 和 `userInfo` 已写入 Taro Storage。旧接口可能还依赖 `X-User-Id`，`Network` 会从 `userInfo.id` 自动补。

### 为什么 Docker 测试失败？

先看：

```bash
pnpm docker:logs
```

重点检查 MySQL healthcheck、`server/init_database.sql` 初始化、`/api/health`、端口占用和环境变量。

### 修改后最小验收跑什么？

优先：

```bash
pnpm validate
pnpm test:smoke
```

订单/支付/后台等链路改动再跑对应 API 回归或 Docker 冒烟。

## 整个项目开发建议

- 先收敛事实源：数据库以实际 MySQL 初始化和迁移为准，逐步淘汰或标注历史 Supabase/Drizzle 草稿。
- 建议逐步给 `getMySQLClient().query()` 建立模块级 Repository 或 DAO，减少散落 SQL。
- 订单状态机建议集中成枚举、状态迁移表和测试资产，避免页面/服务各写一套字符串。
- 管理员鉴权建议后续抽成 Nest Guard，但必须单独任务做，不要混入业务改动。
- 普通用户鉴权建议后续统一为标准 JWT 或保留现状并封装验证工具，避免各模块重复解析。
- 支付、提现、金币、佣金建议保持事务化，所有余额变动写交易记录。
- 前端新页面先选分包，避免主包膨胀。
- 资源上传和引用统一走 TOS/ImageX，不再新增本地业务图片。
- 保持 `pnpm validate` 为最低质量红线，涉及核心链路增加 `pnpm test:api:regression` 或 `pnpm test:docker`。
- 所有 AI 协作任务必须先写清 Premise、Constraints、Boundaries、Endgame，再做最小 diff。
