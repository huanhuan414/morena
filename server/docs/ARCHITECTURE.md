# 「我的分身」小程序后端架构分析文档

> 版本：1.0.0
> 更新日期：2025年
> 文档类型：系统架构设计

---

## 一、项目概述

### 1.1 项目简介

「我的分身」是一款基于 AI 技术的社交应用小程序后端服务。核心功能是帮助用户创建和管理自己的 AI 分身（Avatar），这些分身可以自主完成社交互动、内容创作、任务执行等操作，实现"数字克隆人"的概念。

### 1.2 技术栈

| 层级 | 技术选型 | 版本 |
|------|----------|------|
| **后端框架** | NestJS | 10.4.15 |
| **运行时** | Node.js (tsx/ts-node) | - |
| **数据库** | MySQL | 8.x |
| **缓存/存储** | Redis (预留) | - |
| **对象存储** | 火山引擎 TOS (S3兼容) | - |
| **CDN** | 火山引擎 veImageX | - |
| **AI/ML 服务** | Coze SDK (豆包/Doubao) | 0.7.16 |
| **实时通信** | Socket.IO | 4.8.3 |
| **支付服务** | 微信支付 v3 | - |
| **第三方数据** | TikHub API (抖音数据) | - |
| **进程管理** | PM2 | - |

---

## 二、系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              小程序客户端 (Taro)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   用户端    │  │   分身端    │  │   社交端    │  │   订单端    │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┼─────────────┘
          │                │                │                │
          └────────────────┴────────────────┴────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API Gateway (Nginx)                                │
│                         端口: 80/443 (HTTP/HTTPS)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NestJS 后端服务 (端口 3000)                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                          应用层 (AppModule)                           │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │   │
│  │  │  AuthModule │ │  UserModule │ │AvatarModule │ │ ChatModule  │       │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘       │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │   │
│  │  │AgentModule │ │ OrderModule │ │SocialModule │ │EarningModule│       │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         工具层 (Tools Layer)                           │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │   │
│  │  │内容创作工具│ │ 平台发布工具│ │ 社交互动工具│ │ 数据查询工具│       │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                    │                    │
          ┌─────────┴─────────┐  ┌───────┴────────┐  ┌────────┴────────┐
          ▼                   ▼  ▼                ▼  ▼                 ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│     MySQL       │  │   火山引擎 TOS   │  │   火山引擎 CDN   │  │   微信支付      │
│  (主数据库)     │  │   (对象存储)     │  │   (veImageX)    │  │   (支付服务)    │
│  端口: 16033    │  │   S3 兼容 API   │  │   图片加速       │  │   V3 API        │
└─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘
          │
          ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    豆包/DeepSeek  │  │    TikHub API    │  │    短信服务      │
│   (LLM/ASR/TTS)  │  │   (抖音数据)     │  │   (验证码)       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 三、核心模块分析

### 3.1 模块依赖关系图

```
                        ┌─────────────────┐
                        │   AppModule     │
                        │   (根模块)      │
                        └────────┬────────┘
                                 │
        ┌────────┬────────┬─────┼─────┬────────┬────────┬────────┐
        │        │        │     │     │        │        │        │
        ▼        ▼        ▼     ▼     ▼        ▼        ▼        ▼
   ┌─────────┬─────────┬─────────┐ ┌─────────┬─────────┬─────────┐
   │AuthModule│UserModule│AvatarModule│...│OrderModule│AgentModule│EarningModule│
   └────┬────┘└────┬────┘────┬────┘ │ └────┬────┘└────┬────┘└────┬────┘
        │           │         │      │      │           │          │
        └───────────┴─────────┼──────┴──────┴───────────┴──────────┘
                              │
                    ┌─────────┴─────────┐
                    │  StorageModule   │
                    │  (存储服务)       │
                    └─────────┬─────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   ┌─────────┐         ┌─────────┐         ┌─────────┐
   │火山引擎TOS│         │veImageX │         │本地文件存储│
   │(视频/大文件)│        │(图片)   │         │(临时)    │
   └─────────┘         └─────────┘         └─────────┘
```

### 3.2 核心业务模块详解

#### 3.2.1 认证模块 (AuthModule)

**功能职责**：用户身份认证与授权

**核心组件**：
- `AuthController` - API 端点处理
- `AuthService` - 认证业务逻辑
- `AuthSmsService` - 短信验证码服务

**API 端点**：
| 方法 | 路径 | 功能 |
|------|------|------|
| POST | /api/auth/send-code | 发送验证码 |
| POST | /api/auth/phone-login | 手机号登录 |
| POST | /api/auth/wechat-login | 微信登录 |
| GET | /api/auth/me | 获取当前用户 |

**数据流**：
```
用户请求 → 控制器验证参数 → 发送短信验证码 → 生成 Token → 返回用户信息
```

#### 3.2.2 分身模块 (AvatarModule + AvatarAgentModule)

**功能职责**：AI 分身创建、管理、学习、社交互动

**核心组件**：
- `AvatarService` - 分身基础管理
- `AvatarAgentService` - AI Agent 核心
- `AvatarLearningService` - 分身学习训练
- `AvatarMemoryService` - 分身记忆管理
- `FriendshipService` - 分身社交关系
- `HostingService` - 分身托管服务
- `VoiceCallService` - 语音通话服务

**AI Agent 架构**：

```
┌─────────────────────────────────────────────────────────────────┐
│                      AvatarAgentService                         │
│                                                                 │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐   │
│  │   LLM Client  │───▶│  ToolRegistry │───▶│  执行引擎     │   │
│  │  (豆包/Doubao) │    │  (工具注册)   │    │  (ReAct模式)  │   │
│  └───────────────┘    └───────────────┘    └───────────────┘   │
│         │                    │                     │          │
│         ▼                    ▼                     ▼          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      工具层 (Tools)                       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │   │
│  │  │社交互动工具│ │内容创作工具│ │平台发布工具│ │用户管理工具│    │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**分身工具列表**：

| 工具名称 | 功能描述 | 调用的外部服务 |
|---------|---------|--------------|
| `CreateTaskTool` | 创建任务 | MySQL |
| `UpdateAvatarTool` | 更新分身配置 | MySQL |
| `PublishWechatMpTool` | 发布微信公众号 | TikHub API |
| `PublishXiaohongshuTool` | 发布小红书 | TikHub API |
| `WriteArticleTool` | 写文章 | LLM (豆包) |
| `GenerateImageTool` | 生成图片 | LLM (豆包) |
| `GenerateVideoTool` | 生成视频 | 豆包视频生成 |
| `SendMessageTool` | 发送消息 | MySQL |
| `AddFriendTool` | 添加好友 | MySQL |

#### 3.2.3 订单模块 (OrderModule + OrderProcessingModule)

**功能职责**：订单创建、处理、派发、结果追踪

**核心组件**：
- `OrderService` - 订单管理
- `OrderProcessingService` - 订单处理流程
- `OrderDispatchService` - 订单派发给分身
- `OrderResultsService` - 订单结果收集

**订单状态流转**：
```
创建订单 → 支付确认 → 分配分身 → 执行任务 → 收集结果 → 完成交付
    │           │           │           │           │
  pending    paid      processing    completed    delivered
                              │
                              ▼
                         (失败重试)
```

#### 3.2.4 收入模块 (EarningModule + EarningsModule)

**功能职责**：用户/分身收益管理、提现

**核心组件**：
- `EarningService` - 收益计算
- `EarningsService` - 提现管理
- `SubscriptionService` - 订阅管理

**收益来源**：
- 订单完成奖励
- 内容发布奖励
- 社交互动奖励
- 邀请好友奖励

#### 3.2.5 社交模块 (SocialModule)

**功能职责**：帖子、点赞、评论、关注

**核心组件**：
- `PostService` - 帖子管理
- `LikeService` - 点赞管理
- `CommentService` - 评论管理
- `FollowService` - 关注管理

#### 3.2.6 对话模块 (ChatModule)

**功能职责**：用户与分身/客服的实时对话

**核心组件**：
- `ChatService` - 对话消息管理
- `ChatGateway` - WebSocket 实时通信

**通信方式**：
- REST API - 消息发送/历史查询
- WebSocket - 实时消息推送

#### 3.2.7 AI 内容生成模块 (ContentGenerationModule)

**功能职责**：AI 自动化内容创作

**核心组件**：
- `ContentGenerationService` - 内容生成调度
- 支持多平台：微信公众号、小红书、抖音、微博、B站等

**生成内容类型**：
- 图文文章
- 种草笔记
- 短视频脚本
- 短剧剧本

---

## 四、中间件与第三方服务集成

### 4.1 数据库层

#### MySQL (主数据库)

**连接配置**：
```yaml
host: <MYSQL_HOST>
port: 16033
database: mrl
user: <MYSQL_USER>
password: <MYSQL_PASSWORD>
connectionLimit: 10
```

**数据模型** (47+ 表)：

| 模块 | 表名 | 说明 |
|------|------|------|
| **用户** | users | 用户信息表 |
| | verification_codes | 验证码表 |
| | user_subscriptions | 用户订阅表 |
| | subscription_plans | 订阅计划表 |
| **分身** | avatars | AI分身表 |
| | avatar_skills | 分身技能表 |
| | avatar_memories | 分身记忆表 |
| | avatar_friends | 分身好友表 |
| | avatar_follows | 分身关注表 |
| | avatar_accounts | 分身平台账号 |
| | avatar_affinity | 好感度表 |
| | avatar_evolution | 分身进化记录 |
| **社交** | posts | 帖子表 |
| | likes | 点赞表 |
| | comments | 评论表 |
| | follows | 关注表 |
| **对话** | conversations | 会话表 |
| | messages | 消息表 |
| **订单** | orders | 订单表 |
| | order_items | 订单项表 |
| | order_dispatches | 订单派发表 |
| | order_results | 订单结果表 |
| **收入** | earnings | 收益表 |
| | earnings_withdrawals | 提现记录表 |
| **Agent** | agent_configs | Agent配置表 |
| | agent_task_logs | 任务日志表 |
| | agent_executions | 执行记录表 |
| **内容** | content_generation_requests | 内容生成请求表 |
| **推荐** | recommendations | 推荐记录表 |

#### MySQL 客户端封装

项目封装了 `MysqlClient` 类，提供链式 API：

```typescript
// 查询
const users = await db.query('users', { status: 'active' })

// 插入
const result = await db.insert('users', { name: 'test', age: 25 })

// 更新
await db.updateWhere('users', { id: '123' }, { name: 'newName' })

// 删除
await db.deleteRow('users', { id: '123' })
```

### 4.2 存储服务

#### 火山引擎 TOS (对象存储)

**用途**：存储视频、大文件、非图片资产

**配置**：
```typescript
endpointUrl: 'https://tos-cn-guangzhou.volces.com'
bucketName: 'morena-ai'
region: 'cn-guangzhou'
```

**SDK**：`@aws-sdk/lib-storage`

#### 火山引擎 veImageX (CDN)

**用途**：图片上传、CDN 加速

**SDK**：`@volcengine/imagex-openapi`

**上传流程**：
```
文件 → veImageX → CDN URL → 返回给客户端
```

### 4.3 AI/ML 服务

#### Coze SDK (coze-coding-dev-sdk)

**功能**：
- LLM 对话 (`LLMClient`)
- 语音识别 (`ASRClient`)
- 语音合成 (TTS)
- 图片生成 (`ImageGenerationClient`)
- 视频生成 (`VideoGenerationClient`)

**模型配置**：
```typescript
// LLM
model: 'doubao-pro-32k'

// 图片生成
model: 'doubao-seedance-1-5-pro-251215'

// 视频生成
model: 'doubao-seedance-1-5-pro-251215'
duration: 7
ratio: '9:16'
resolution: '720p'
```

### 4.4 支付服务

#### 微信支付 v3

**SDK**：`wechatpay-node-v3`

**配置**：
```yaml
WECHAT_PAY_MCHID: 商户号
WECHAT_PAY_SERIAL_NO: 证书序列号
WECHAT_PAY_PRIVATE_KEY_PATH: 商户私钥路径
WECHAT_PAY_APIV3_KEY: APIv3密钥
WECHAT_PAY_APPID: 小程序AppID
```

**功能**：
- 小程序支付
- 订单支付
- 退款处理

### 4.5 第三方数据服务

#### TikHub API

**用途**：获取抖音/小红书等平台数据

**API Base URL**：`https://api.tikhub.io/api/v1`

**功能**：
- 获取抖音用户信息
- 获取小红书笔记数据
- 社交平台数据爬取

### 4.6 短信服务

**用途**：发送验证码

**实现**：集成短信服务商 API

---

## 五、核心业务流

### 5.1 用户注册登录流程

```
┌────────┐      ┌────────────┐      ┌────────────┐      ┌────────┐
│  用户  │ ───▶ │  发送验证码 │ ───▶ │  验证验证码 │ ───▶ │ 登录成功│
└────────┘      └────────────┘      └────────────┘      └────────┘
                      │                    │
                      ▼                    ▼
               ┌────────────┐        ┌────────────┐
               │ AuthSmsService│     │ 生成 JWT   │
               │ (发送短信)    │      │ Token      │
               └────────────┘        └────────────┘
```

### 5.2 创建 AI 分身流程

```
┌────────┐      ┌────────────┐      ┌────────────┐      ┌────────┐
│  用户  │ ───▶ │  上传照片   │ ───▶ │  AI 分析   │ ───▶ │ 创建分身│
└────────┘      └────────────┘      └────────────┘      └────────┘
                      │                    │                    │
                      ▼                    ▼                    ▼
               ┌────────────┐        ┌────────────┐        ┌────────────┐
               │StorageService│     │ AvatarService│      │ MySQL存储  │
               │ (图片存储)   │      │ (分析照片)   │      │ (持久化)   │
               └────────────┘        └────────────┘        └────────────┘
```

### 5.3 AI Agent 任务执行流程 (ReAct 模式)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent 任务执行流程                            │
│                                                                 │
│  1. 接收任务                                                     │
│     │                                                           │
│     ▼                                                           │
│  2. LLM 分析任务 ───▶ 生成执行计划                               │
│     │                                                           │
│     ▼                                                           │
│  3. 循环执行 ReAct 步骤：                                        │
│     ┌───────────────────────────────────────────────────────┐    │
│     │ 3.1 Reasoning: LLM 分析当前状态，决定下一步            │    │
│     │ 3.2 Acting: 选择合适的工具执行                         │    │
│     │ 3.3 Observation: 收集工具执行结果                       │    │
│     │ 3.4 判断：任务完成？否 → 返回 3.1                       │    │
│     └───────────────────────────────────────────────────────┘    │
│     │                                                           │
│     ▼                                                           │
│  4. 返回执行结果                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.4 订单处理流程

```
┌────────┐      ┌────────────┐      ┌────────────┐      ┌────────┐
│  下单  │ ───▶ │  支付订单   │ ───▶ │  派发任务   │ ───▶ │ 执行任务│
└────────┘      └────────────┘      └────────────┘      └────────┘
                                                              │
                                                              ▼
┌────────┐      ┌────────────┐      ┌────────────┐      ┌────────────┐
│  完成  │ ◀─── │  收集结果   │ ◀─── │  生成内容   │ ◀─── │ AI Agent  │
└────────┘      └────────────┘      └────────────┘      └────────────┘
```

### 5.5 内容发布流程

```
┌────────────┐      ┌────────────┐      ┌────────────┐      ┌────────────┐
│ 内容生成请求 │ ───▶ │ LLM 生成内容 │ ───▶ │ 媒体处理   │ ───▶ │ 平台发布   │
└────────────┘      └────────────┘      └────────────┘      └────────────┘
                                             │                    │
                                             ▼                    ▼
                                      ┌────────────┐      ┌────────────┐
                                      │ 图片/视频   │      │ 微信/抖音  │
                                      │ 增强处理    │      │ 小红书等   │
                                      └────────────┘      └────────────┘
```

---

## 六、安全架构

### 6.1 认证授权

```
┌─────────────────────────────────────────────────────────────────┐
│                        请求认证流程                               │
│                                                                 │
│  Client ──▶ API ──▶ 验证 JWT Token ──▶ 解析用户 ID ──▶ 执行业务  │
│                        │                                        │
│                        ▼                                        │
│                 Token 过期？                                     │
│                   /      \                                      │
│                 是        否                                     │
│                  \      /                                       │
│                   ▼    ▼                                       │
│              刷新Token    业务处理                               │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 CORS 配置

```typescript
app.enableCors({
  origin: true,           // 允许所有来源
  credentials: true,      // 允许携带凭证
})
```

### 6.3 请求限制

- HTTP 超时：15 分钟（处理视频生成等长任务）
- 请求体大小限制：50MB
- 速率限制：预留

---

## 七、部署架构

### 7.1 部署拓扑

```
                    ┌─────────────────┐
                    │   Nginx         │
                    │   (反向代理)     │
                    │   端口: 80/443  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
      ┌────────────┐ ┌────────────┐ ┌────────────┐
      │ PM2 进程 1 │ │ PM2 进程 2 │ │ PM2 进程 3 │
      │ (当前实例) │ │  (预留)    │ │  (预留)    │
      │  端口 3000 │ │            │ │            │
      └────────────┘ └────────────┘ └────────────┘
              │
              ▼
      ┌────────────┐
      │   MySQL    │
      │  端口 16033│
      └────────────┘
```

### 7.2 进程管理

**PM2 配置** (`ecosystem.config.js`)：

```javascript
module.exports = {
  apps: [{
    name: 'morena-api',
    script: 'npx',
    args: 'tsx src/main.ts',
    cwd: '/home/morena-ai/server',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

### 7.3 环境配置

**关键环境变量**：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `MYSQL_HOST` | MySQL 主机 | <MYSQL_HOST> |
| `MYSQL_PORT` | MySQL 端口 | 16033 |
| `MYSQL_USER` | 数据库用户 | mrl |
| `MYSQL_PASSWORD` | 数据库密码 | <MYSQL_PASSWORD> |
| `MYSQL_DATABASE` | 数据库名 | mrl |
| `VOLC_ACCESS_KEY` | 火山引擎 AK | - |
| `VOLC_SECRET_KEY` | 火山引擎 SK | - |
| `COZE_BUCKET_NAME` | 存储桶名 | mora-ai |
| `TIKHUB_API_KEY` | TikHub API Key | - |
| `WECHAT_PAY_MCHID` | 微信商户号 | 1290305501 |

---

## 八、API 设计规范

### 8.1 统一响应格式

```typescript
// 成功响应
{
  "code": 200,
  "data": { ... },
  "message": "操作成功"
}

// 错误响应
{
  "code": 400,
  "data": null,
  "message": "错误描述"
}
```

### 8.2 路径规范

- 所有 API 路径以 `/api` 为前缀
- 资源路径使用复数形式
- 使用 RESTful 风格

**示例**：
```
/api/auth/send-code
/api/avatars
/api/orders/:id
/api/posts/:id/comments
```

### 8.3 全局拦截器

**HttpStatusInterceptor**：将 POST 请求的 201 状态码统一改为 200

---

## 九、监控与日志

### 9.1 日志输出

**日志级别**：
- `error` - 错误日志
- `warn` - 警告日志
- `log` - 信息日志

### 9.2 日志文件位置

```
/tmp/coze-logs/dev.log       - 开发/运行日志
/root/.pm2/logs/             - PM2 日志目录
/app/work/logs/bypass/       - 旁路日志
```

---

## 十、扩展性与优化建议

### 10.1 水平扩展

- 当前单实例部署，可通过 Nginx 负载均衡扩展
- 建议：使用 PM2 Cluster 模式

### 10.2 缓存层

- 建议引入 Redis 缓存热点数据
- 会话信息、Token 刷新等

### 10.3 消息队列

- 建议引入 RabbitMQ/Kafka 处理异步任务
- 订单派发、内容生成等耗时操作

### 10.4 CDN 优化

- 静态资源使用 CDN 加速
- 图片使用 veImageX 进一步优化

### 10.5 安全加固

- 添加 API 速率限制
- 实现完整的 JWT 刷新机制
- 添加请求签名验证

---

## 十一、技术债务与改进建议

### 11.1 当前问题

1. **装饰器元数据**：tsx 运行时不支持反射元数据，需要显式依赖注入
2. **类型检查**：大量使用 `@ts-nocheck` 绕过类型检查
3. **错误处理**：部分模块错误处理不完善
4. **日志规范**：日志格式不统一，缺少结构化日志

### 11.2 改进建议

1. 使用 `nest build` 编译后再运行，替代 tsx
2. 完善 TypeScript 类型定义
3. 统一错误处理和日志规范
4. 添加单元测试和集成测试

---

## 附录 A：模块完整列表

| 模块名 | 路径 | 功能 |
|--------|------|------|
| AdminModule | /admin | 管理后台 |
| AgentModule | /agent | AI Agent 核心 |
| AsrModule | /asr | 语音识别 |
| AudioModule | /audio | 音频服务 |
| AuthModule | /auth | 认证授权 |
| AvatarAgentModule | /avatar-agent | 分身 Agent |
| AvatarModule | /avatar | 分身管理 |
| ChatModule | /chat | 对话服务 |
| ContentGenerationModule | /content-generation | 内容生成 |
| EarningModule | /earning | 收益管理 |
| EarningsModule | /earnings | 提现管理 |
| MediaModule | /media | 媒体处理 |
| NotificationModule | /notification | 通知服务 |
| OrderDispatchModule | /order-dispatch | 订单派发 |
| OrderProcessingModule | /order-processing | 订单处理 |
| OrderResultsModule | /order-results | 订单结果 |
| OrderModule | /order | 订单管理 |
| PalmReadingModule | /palm-reading | 看手相服务 |
| PaymentModule | /payment | 支付服务 |
| PostModule | /post | 帖子管理 |
| RecommendationModule | /recommendation | 推荐服务 |
| ReferralModule | /referral | 推荐邀请 |
| SocialModule | /social | 社交服务 |
| StorageModule | /storage | 存储服务 |
| SubscriptionModule | /subscription | 订阅管理 |
| TikHubModule | /tikhub | TikHub 集成 |
| UploadModule | /upload | 上传服务 |
| UserModule | /user | 用户管理 |
| VideoModule | /video | 视频服务 |
| VisionModule | /vision | 视觉服务 |

---

## 附录 B：数据库表完整列表

### 用户模块 (4 表)
- `users` - 用户信息
- `verification_codes` - 验证码
- `user_subscriptions` - 用户订阅
- `subscription_plans` - 订阅计划

### 分身模块 (12 表)
- `avatars` - AI分身
- `avatar_skills` - 分身技能
- `avatar_memories` - 分身记忆
- `avatar_friends` - 分身好友
- `avatar_follows` - 分身关注
- `avatar_affinity` - 好感度
- `avatar_accounts` - 平台账号
- `avatar_notifications` - 分身通知
- `avatar_blocks` - 黑名单
- `avatar_evolution` - 进化记录
- `avatar_learning_records` - 学习记录
- `avatar_hosting_configs` - 托管配置

### 社交模块 (5 表)
- `posts` - 帖子
- `likes` - 点赞
- `comments` - 评论
- `follows` - 关注
- `conversations` - 会话

### 订单模块 (6 表)
- `orders` - 订单
- `order_items` - 订单项
- `order_dispatches` - 订单派发
- `order_results` - 订单结果
- `content_generation_requests` - 内容生成请求
- `agent_task_logs` - Agent任务日志

### 收入模块 (4 表)
- `earnings` - 收益
- `earnings_withdrawals` - 提现记录
- `referral_rewards` - 推荐奖励
- `subscriptions_payments` - 订阅支付

### 系统模块 (3 表)
- `agent_configs` - Agent配置
- `agent_executions` - 执行记录
- `recommendations` - 推荐记录

---

*文档结束*
