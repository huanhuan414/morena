# Coze Mini Program

这是一个基于 [Taro 4](https://docs.taro.zone/docs/) + [Nest.js](https://nestjs.com/) 的前后端分离项目，由扣子编程 CLI 创建。

## 技术栈

- **整体框架**: Taro 4.1.9
- **语言**: TypeScript 5.4.5
- **渲染**: React 18.0.0
- **样式**: TailwindCSS 4.1.18
- **Tailwind 适配层**: weapp-tailwindcss 4.9.2
- **状态管理**: Zustand 5.0.9
- **图标库**: lucide-react-taro latest
- **工程化**: Vite 4.2.0
- **包管理**: pnpm
- **运行时**: Node.js >= 18
- **服务端**: NestJS 10.4.15
- **数据库 ORM**: Drizzle ORM 0.45.1
- **类型校验**: Zod 4.3.5

## 项目结构

```
├── .cozeproj/                # Coze 平台配置
│   └── scripts/              # 构建和运行脚本
├── config/                   # Taro 构建配置
│   ├── index.ts              # 主配置文件
│   ├── dev.ts                # 开发环境配置
│   └── prod.ts               # 生产环境配置
├── server/                   # NestJS 后端服务
│   └── src/
│       ├── main.ts           # 服务入口
│       ├── app.module.ts     # 根模块
│       ├── app.controller.ts # 应用控制器
│       └── app.service.ts    # 应用服务
├── src/                      # 前端源码
│   ├── pages/                # 页面组件
│   ├── presets/              # 框架预置逻辑（无需读取，如无必要不改动）
│   ├── utils/                # 工具函数
│   ├── network.ts            # 封装好的网络请求工具
│   ├── app.ts                # 应用入口
│   ├── app.config.ts         # 应用配置
│   └── app.css               # 全局样式
├── types/                    # TypeScript 类型定义
├── key/                      # 小程序密钥（CI 上传用）
├── .env.local                # 环境变量
└── project.config.json       # 微信小程序项目配置
```

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 环境变量

复制示例文件并按需调整：

```bash
cp .env.example .env
```

### 本地开发

同时启动 H5 前端和 NestJS 后端：

```bash
pnpm dev
```

- 前端地址：http://localhost:5000
- 后端地址：http://localhost:3000

单独启动：

```bash
pnpm dev:web      # 仅 H5 前端
pnpm dev:weapp    # 仅微信小程序
pnpm dev:server   # 仅后端服务
pnpm dev:docker   # 使用 Docker Compose 启动 db + server-dev（热更新）
```

### Docker 本地联调

项目已补齐两条本地 Docker 链路：

- 开发链路：`db + server-dev + web-dev`
- 测试链路：`db + server + api-tests`

开发链路：

```bash
pnpm docker:dev
```

测试链路：

```bash
pnpm docker:test
```

默认服务说明：

- `db`: MySQL 8.4
- `server-dev`: NestJS 开发服务，运行 `pnpm --filter server dev`
- `web-dev`: H5 开发服务，运行 `pnpm dev:web`
- `server`: NestJS 运行时服务，供测试链路与 CI 冒烟使用
- `api-tests`: 基于容器执行 `pnpm test`

开发链路访问地址：

- H5: `http://localhost:5000`
- API: H5 通过 `/api` 代理到容器内 `server-dev:3000`

常用命令：

```bash
docker compose up -d db server
docker compose --profile dev up --build db server-dev web-dev
docker compose --profile test up --build --abort-on-container-exit --exit-code-from api-tests api-tests
docker compose logs -f db server server-dev web-dev
docker compose config
pnpm docker:down
```

说明：

- MySQL 初始化脚本来自 `server/init_database.sql`
- 后端容器通过 `server/Dockerfile` 构建
- 前端开发容器通过 `Dockerfile.web-dev` 构建
- 上传目录通过 Compose volume 挂载到 `/app/uploads`
- `server-dev` 通过 bind mount 挂载 `server/` 源码，便于本地热更新开发
- `web-dev` 通过 bind mount 挂载 `src/`、`config/`、`public/` 和根配置，便于 H5 热更新开发
- 本地开发建议保持 `PROJECT_DOMAIN` 为空，让 H5 走 `/api` 代理而不是直连远端域名
- `api-tests` 通过容器内 `pnpm test` 对 `server` 执行冒烟测试
- 最小排障命令：`docker compose logs -f web-dev server-dev db`

#### 网络受限/不拉镜像（兜底运行）

当本机 Docker 无法稳定访问 `docker.io` / `registry.npmjs.org`（导致 `pnpm docker:dev` 里构建阶段拉基础镜像或装依赖失败）时，可使用 `compose.local.yaml` 直接用本地已有镜像 + 本地构建产物挂载启动。

前置条件：

- 本机已存在镜像：`mysql:8.4`、`morena-server:latest`
- 本机已安装依赖（已存在 `server/node_modules`）

启动步骤：

```bash
# 1) 构建后端产物（生成 server/dist）
pnpm build:server

# 2) 准备 H5 静态产物（任选其一）
# 2.1 使用仓库内已有 dist-web.tar.gz（推荐离线场景）
rm -rf .docker-dist-web && mkdir -p .docker-dist-web && tar -xzf dist-web.tar.gz -C .docker-dist-web
# 2.2 或者本机重新构建 H5 后，把 dist-web 拷贝到 .docker-dist-web

# 3) 启动（db + server + web）
pnpm docker:local
```

访问地址：

- H5: `http://localhost:5001`
- API: `http://localhost:3000`（H5 通过 `/api` 反代到后端）

排障与清理：

```bash
pnpm docker:local:logs
pnpm docker:local:down
```

### 构建

```bash
pnpm build        # 构建所有（H5 + 小程序 + 后端）
pnpm build:web    # 仅构建 H5，输出到 dist-web
pnpm build:weapp  # 仅构建微信小程序，输出到 dist-weapp
pnpm build:server # 仅构建后端
pnpm build:ci     # CI 使用：仅构建 H5 + 后端
```

### 校验与测试

统一工程化入口：

```bash
pnpm validate      # 前端 lint/tsc + 后端 typecheck/build
pnpm test          # Docker / 本地服务启动后的 API 冒烟
pnpm test:unit     # 单元测试 + 覆盖率（后端 Jest + 前端 Vitest，控制台摘要）
pnpm test:api      # 执行完整 API 测试集
pnpm test:api:regression # 稳定回归集（smoke + 关键负例）
pnpm test:server   # 仅后端单元测试（Jest）
pnpm test:server:cov # 仅后端单元测试 + 覆盖率摘要
pnpm test:front    # 仅前端单元测试（Vitest）
pnpm test:front:cov  # 仅前端单元测试 + 覆盖率摘要
pnpm test:docker   # 通过 Docker Compose 启动 server + api-tests 做本地容器冒烟
pnpm test:full:local # 本地全量：validate + unit + docker:local + api regression
pnpm ci            # 本地模拟 CI：validate + test + build:ci
```

`pnpm test` 默认执行：

- `GET /api/hello`
- `GET /api/health`

如果要改用其他环境，可覆盖：

```bash
API_BASE_URL=http://127.0.0.1:3000 pnpm test
```

覆盖率说明：

- 当前 CI 仅输出覆盖率摘要，不设阈值门禁（先保证体系可跑通，后续再逐步抬升覆盖面与阈值）。

### CI

仓库已新增 GitHub Actions 工作流：`.github/workflows/ci.yml`

默认能力：

- 安装 pnpm 依赖
- 执行 `pnpm validate`
- 执行 `pnpm test:unit`（单元测试 + 覆盖率摘要）
- 执行 `pnpm build:ci`
- 校验 `docker compose config`
- 构建 `web-dev` 与 `server-dev` 开发镜像
- 通过 Docker Compose 拉起 `db + server`
- 执行 `pnpm test` 冒烟

### 预览小程序

```bash
pnpm preview:weapp # 构建并生成预览小程序二维码
```

## 前端核心开发规范

### 新建页面流程

1. 在 \`src/pages/\` 下创建页面目录
2. 创建 \`index.tsx\`（页面组件）
3. 创建 \`index.config.ts\`（页面配置）
4. 创建 \`index.css\`（页面样式，可选）
5. 在 \`src/app.config.ts\` 的 \`pages\` 数组中注册页面路径

或使用 Taro 脚手架命令：

```bash
pnpm new      # 交互式创建页面/组件
```

### 组件库

#### UI 组件

UI 组件位于 `@/components/ui`，推荐按需引入：

```typescript
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
```

UI 组件列表:

Accordion,Alert,AlertDialog,AspectRatio,Avatar,Badge,Breadcrumb,Button,ButtonGroup,Calendar,Card,Carousel,Checkbox,CodeBlock,Collapsible,Command,ContextMenu,Dialog,Drawer,DropdownMenu,Field,HoverCard,Input,InputGroup,InputOTP,Label,Menubar,NavigationMenu,Pagination,Popover,Portal,Progress,RadioGroup,Resizable,ScrollArea,Select,Separator,Sheet,Skeleton,Slider,Sonner,Switch,Table,Tabs,Textarea,Toast,Toggle,ToggleGroup,Tooltip

#### Taro 原生组件

可以使用的 Taro 组件（UI 未覆盖）

```typescript
import { View, Text, Icon, Image } from '@tarojs/components'
```

Taro 原生组件列表：

Text,Icon,RichText,CheckboxGroup,Editor,Form,Picker,PickerView,PickerViewColumn,Radio,FunctionalPageNavigator,NavigationBar,Navigator,TabItem,Camera,Image,Video,ScrollView,Swiper,SwiperItem,View

### 路径别名

项目配置了 `@/*` 路径别名指向 `src/*`：

```typescript
import { SomeComponent } from '@/components/some-component'
import { useUserStore } from '@/stores/user'
```

### 代码模板

#### 页面组件 (TypeScript + React)

```tsx
// src/pages/example/index.tsx
import { View } from '@tarojs/components'
import { useLoad, useDidShow } from '@tarojs/taro'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import './index.css'

const ExamplePage: FC = () => {
  useLoad(() => {
    console.log('Page loaded.')
  })

  useDidShow(() => {
    console.log('Page showed.')
  })

  return (
    <View className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Hello Taro!</CardTitle>
          <CardDescription>
            页面布局用 Taro 基础组件，交互与视觉优先用项目内置 UI 组件。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <View className="text-sm text-muted-foreground">
            组件位于 src/components/ui，推荐按需从 @/components/ui/* 引入。
          </View>
        </CardContent>
        <CardFooter className="justify-end">
          <Button size="sm" onClick={() => console.log('clicked')}>
            点击
          </Button>
        </CardFooter>
      </Card>
    </View>
  )
}

export default ExamplePage
```

#### 页面配置

```typescript
// src/pages/example/index.config.ts
import { definePageConfig } from '@tarojs/taro'

export default definePageConfig({
  navigationBarTitleText: '示例页面',
  enablePullDownRefresh: true,
  backgroundTextStyle: 'dark',
})
```

#### 应用配置

```typescript
// src/app.config.ts
import { defineAppConfig } from '@tarojs/taro'

export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/example/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'App',
    navigationBarTextStyle: 'black',
  },
  // TabBar 配置 (可选)
  // tabBar: {
  //   list: [
  //     { pagePath: 'pages/index/index', text: '首页' },
  //   ],
  // },
})
```

### 发送请求

**IMPORTANT: 禁止直接使用 Taro.request、Taro.uploadFile、Taro.downloadFile，使用 Network.request、Network.uploadFile、Network.downloadFile 替代。**

Network 是对 Taro.request、Taro.uploadFile、Taro.downloadFile 的封装，自动添加项目域名前缀，参数与 Taro 一致。

✅ 正确使用方式

```typescript
import { Network } from '@/network'

// GET 请求
const data = await Network.request({
  url: '/api/hello'
})

// POST 请求
const result = await Network.request({
  url: '/api/user/login',
  method: 'POST',
  data: { username, password }
})

// 文件上传
await Network.uploadFile({
  url: '/api/upload',
  filePath: tempFilePath,
  name: 'file'
})

// 文件下载
await Network.downloadFile({
  url: '/api/download/file.pdf'
})
```

❌ 错误用法

```typescript
import Taro from '@tarojs/taro'

// ❌ 会导致自动域名拼接无法生效，除非是特殊指定域名
const data = await Network.request({
  url: 'http://localhost/api/hello'
})

// ❌ 不要直接使用 Taro.request
await Taro.request({ url: '/api/hello' })

// ❌ 不要直接使用 Taro.uploadFile
await Taro.uploadFile({ url: '/api/upload', filePath, name: 'file' })
```

### Zustand 状态管理

```typescript
// src/stores/user.ts
import { create } from 'zustand'

interface UserState {
  userInfo: UserInfo | null
  token: string
  setUserInfo: (info: UserInfo) => void
  setToken: (token: string) => void
  logout: () => void
}

interface UserInfo {
  id: string
  name: string
  avatar: string
}

export const useUserStore = create<UserState>((set) => ({
  userInfo: null,
  token: '',
  setUserInfo: (info) => set({ userInfo: info }),
  setToken: (token) => set({ token }),
  logout: () => set({ userInfo: null, token: '' }),
}))
```

### Taro 生命周期 Hooks

```typescript
import {
  useLoad,             // 页面加载 (onLoad)
  useReady,            // 页面初次渲染完成 (onReady)
  useDidShow,          // 页面显示 (onShow)
  useDidHide,          // 页面隐藏 (onHide)
  usePullDownRefresh,  // 下拉刷新 (onPullDownRefresh)
  useReachBottom,      // 触底加载 (onReachBottom)
  useShareAppMessage,  // 分享 (onShareAppMessage)
  useRouter,           // 获取路由参数
} from '@tarojs/taro'
```

### 路由导航

```typescript
import Taro from '@tarojs/taro'

// 保留当前页面，跳转到新页面
Taro.navigateTo({ url: '/pages/detail/index?id=1' })

// 关闭当前页面，跳转到新页面
Taro.redirectTo({ url: '/pages/detail/index' })

// 跳转到 tabBar 页面
Taro.switchTab({ url: '/pages/index/index' })

// 返回上一页
Taro.navigateBack({ delta: 1 })

// 获取路由参数
const router = useRouter()
const { id } = router.params
```

### 图标使用 (lucide-react-taro)

**IMPORTANT: 禁止使用 lucide-react，必须使用 lucide-react-taro 替代。**

lucide-react-taro 是 Lucide 图标库的 Taro 适配版本，专为小程序环境优化，API 与 lucide-react 一致：

```tsx
import { View } from '@tarojs/components'
import { House, Settings, User, Search, Camera, Zap } from 'lucide-react-taro'

const IconDemo = () => {
  return (
    <View className="flex gap-4">
      {/* 基本用法 */}
      <House />
      {/* 自定义尺寸和颜色 */}
      <Settings size={32} color="#1890ff" />
      {/* 自定义描边宽度 */}
      <User size={24} strokeWidth={1.5} />
      {/* 绝对描边宽度（描边不随 size 缩放） */}
      <Camera size={48} strokeWidth={2} absoluteStrokeWidth />
      {/* 组合使用 */}
      <Zap size={32} color="#ff6b00" strokeWidth={1.5} className="my-icon" />
    </View>
  )
}
```

常用属性：
- `size` - 图标大小（默认 24）
- `color` - 图标颜色（默认 currentColor，小程序中建议显式设置）
- `strokeWidth` - 线条粗细（默认 2）
- `absoluteStrokeWidth` - 绝对描边宽度，启用后描边不随 size 缩放
- `className` / `style` - 自定义样式

更多图标请访问：https://lucide.dev/icons

### TabBar 图标生成 (CLI 工具)

**IMPORTANT: 微信小程序的 TabBar 不支持 base64 或 SVG 图片，必须使用本地 PNG 文件。**

lucide-react-taro 提供了 CLI 工具来生成 TabBar 所需的 PNG 图标：

```bash
# 生成带选中状态的图标
npx taro-lucide-tabbar House Settings User -c "#999999" -a "#1890ff"

# 指定输出目录和尺寸
npx taro-lucide-tabbar House Settings User -c "#999999" -a "#1890ff" -o ./src/assets/tabbar -s 81
```

CLI 参数：
- `--color, -c` (默认 #000000): 图标颜色
- `--active-color, -a`: 选中状态颜色
- `--size, -s` (默认 81): 图标尺寸
- `--output, -o` (默认 ./tabbar-icons): 输出目录
- `--stroke-width` (默认 2): 描边宽度

在 `app.config.ts` 中使用生成的图标：

> IMPORTANT：iconPath 和 selectedIconPath 必须以 `./` 开头，否则图标无法渲染

```typescript
export default defineAppConfig({
  tabBar: {
    color: '#999999',
    selectedColor: '#1890ff',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: './assets/tabbar/house.png',
        selectedIconPath: './assets/tabbar/house-active.png',
      },
      {
        pagePath: 'pages/settings/index',
        text: '设置',
        iconPath: './assets/tabbar/settings.png',
        selectedIconPath: './assets/tabbar/settings-active.png',
      },
      {
        pagePath: 'pages/user/index',
        text: '用户',
        iconPath: './assets/tabbar/user.png',
        selectedIconPath: './assets/tabbar/user-active.png',
      },
    ],
  },
})

### Tailwind CSS 样式开发

IMPORTANT：必须使用 tailwindcss 实现样式，只有在必要情况下才能 fallback 到 css / less

> 项目已集成 Tailwind CSS 4.x + weapp-tailwindcss，支持跨端原子化样式：

```tsx
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'

<View className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
  <Text className="text-2xl font-bold text-blue-600 mb-4">标题</Text>
  <View className="w-full px-4">
    <Button className="w-full" size="lg">
      按钮
    </Button>
  </View>
</View>
```

### 性能优化

#### 图片懒加载

```tsx
import { Image } from '@tarojs/components'

<Image src={imageUrl} lazyLoad mode="aspectFill" />
```

#### 虚拟列表

```tsx
import { VirtualList } from '@tarojs/components'

<VirtualList
  height={500}
  itemData={list}
  itemCount={list.length}
  itemSize={100}
  renderItem={({ index, style, data }) => (
    <View style={style}>{data[index].name}</View>
  )}
/>
```

#### 分包加载

```typescript
// src/app.config.ts
export default defineAppConfig({
  pages: ['pages/index/index'],
  subPackages: [
    {
      root: 'packageA',
      pages: ['pages/detail/index'],
    },
  ],
})
```

### 小程序限制

| 限制项   | 说明                                     |
| -------- | ---------------------------------------- |
| 主包体积 | ≤ 2MB                                    |
| 总包体积 | ≤ 20MB                                   |
| 域名配置 | 生产环境需在小程序后台配置合法域名       |
| 本地开发 | 需在微信开发者工具开启「不校验合法域名」 |

### 权限配置

```typescript
// src/app.config.ts
export default defineAppConfig({
  // ...其他配置
  permission: {
    'scope.userLocation': {
      desc: '你的位置信息将用于小程序位置接口的效果展示'
    }
  },
  requiredPrivateInfos: ['getLocation', 'chooseAddress']
})
```

### 位置服务

```typescript
// 需先在 app.config.ts 中配置 permission
async function getLocation(): Promise<Taro.getLocation.SuccessCallbackResult> {
  return await Taro.getLocation({ type: 'gcj02' })
}
```

## 后端核心开发规范

本项目后端基于 NestJS + TypeScript 构建，提供高效、可扩展的服务端能力。

### 项目结构

```sh
.
├── server/                   # NestJS 后端服务
│   └── src/
│       ├── main.ts           # 服务入口
│       ├── app.module.ts     # 根模块
│       ├── app.controller.ts # 根控制器
│       └── app.service.ts    # 根服务
```

### 开发命令

```sh
pnpm dev:server // 启动开发服务 (热重载, 默认端口 3000)
pnpm build:server // 构建生产版本
```

### 新建模块流程 (CLI)

快速生成样板代码：

```bash
cd server

# 生成完整的 CRUD 资源 (包含 Module, Controller, Service, DTO, Entity)
npx nest g resource modules/product

# 仅生成特定部分
npx nest g module modules/order
npx nest g controller modules/order
npx nest g service modules/order
```

### 环境变量配置

在 server/ 根目录创建 .env 文件：

```sh
## 服务端口
PORT=3000

## 微信小程序配置
WX_APP_ID=你的AppID
WX_APP_SECRET=你的AppSecret

## JWT 密钥
JWT_SECRET=your-super-secret-key
```

在代码中使用 @nestjs/config 读取环境变量：

```typescript
import { ConfigService } from '@nestjs/config';

// 在 Service 中注入
constructor(private configService: ConfigService) {}

getWxConfig() {
  return {
    appId: this.configService.get<string>('WX_APP_ID'),
    secret: this.configService.get<string>('WX_APP_SECRET'),
  };
}
```

### 标准响应封装

建议使用拦截器 (Interceptor) 统一 API 响应格式：

```typeScript
// src/common/interceptors/transform.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  code: number;
  data: T;
  message: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => ({
        code: 200,
        data,
        message: 'success',
      })),
    );
  }
}
```

在 main.ts 中全局注册：

```typescript
app.useGlobalInterceptors(new TransformInterceptor());
```

### 微信登录后端实现

```typescript
// src/modules/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class AuthService {
  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  async code2Session(code: string) {
    const appId = this.configService.get('WX_APP_ID');
    const secret = this.configService.get('WX_APP_SECRET');
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;

    const { data } = await lastValueFrom(this.httpService.get(url));

    if (data.errcode) {
      throw new UnauthorizedException(`微信登录失败: ${data.errmsg}`);
    }

    return data; // 包含 openid, session_key
  }
}
```

### 异常处理

使用全局异常过滤器 (Filter) 统一错误响应：

```typescript
// src/common/filters/http-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    response.status(status).json({
      code: status,
      message: typeof exceptionResponse === 'string' ? exceptionResponse : (exceptionResponse as any).message,
      data: null,
    });
  }
}
```

在 main.ts 中注册：

```
app.useGlobalFilters(new HttpExceptionFilter());
```

### 数据库 (Drizzle ORM)

推荐使用 [Drizzle ORM](https://orm.drizzle.team/)，已预安装。

### 类型校验 (Zod)

项目集成了 [Zod](https://zod.dev/) 用于运行时类型校验。

#### 定义 Schema

```typescript
import { z } from 'zod';

// 基础类型
const userSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(50),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

// 从 schema 推导 TypeScript 类型
type User = z.infer<typeof userSchema>;
```

#### 请求校验

```typescript
// src/modules/user/dto/create-user.dto.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  nickname: z.string().min(1, '昵称不能为空').max(20, '昵称最多20个字符'),
  avatar: z.string().url('头像必须是有效的URL').optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确').optional(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;

// 在 Controller 中使用
@Post()
create(@Body() body: unknown) {
  const result = createUserSchema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException(result.error.errors);
  }
  return this.userService.create(result.data);
}
```

---

## 开发日志

### 2026-07-28 — 我的页面新增「我的分身」菜单项

**会话目的**：在「我的」页面（profile）中，于订阅中心按钮上方新增「我的分身」菜单入口。

**完成任务**：
1. 在 `menuItems` 配置数组头部插入「我的分身」菜单项，位置在「订阅中心」之前。
2. 使用 `Bot` 图标（来自 `lucide-react-taro`），配色与「订阅中心」保持一致（`type: 'primary'`，紫色系）。
3. 点击跳转至 `/package-avatar/pages/avatar-manage/index`（已有分身管理页，路由已在 `app.config.ts` 中注册）。
4. 与现有菜单项一致：需登录（`requireLogin: true`），菜单可见性受后端 `menu-feature/enabled` 接口控制（`key: 'my_avatar'`）。

**修改文件**：
- `src/pages/profile/index.tsx`：import 增加 `Bot`，`menuItems` 数组头部插入「我的分身」配置项。

---

### 2026-07-28 — 修复小程序 `invalid url` 网络请求报错

**会话目的**：排查并修复微信小程序开发环境中所有接口请求报 `request:fail invalid url "/api/..."` 的问题。

**根因分析**：
- `src/network.ts` 的 `createUrl()` 函数在 URL 不含 `http(s)://` 时，会在前面拼接 `PROJECT_DOMAIN` 编译常量。
- `PROJECT_DOMAIN` 由构建时读取 `.env.local` 中的同名变量注入。
- `.env.local` 中未配置 `PROJECT_DOMAIN`，导致该常量编译为空字符串。
- 最终请求 URL 仍为相对路径（如 `/api/user-stats/overview`），微信小程序不支持相对路径，报 `invalid url` 错误。

**完成任务**：
1. 在 `.env.local` 中新增 `PROJECT_DOMAIN=http://127.0.0.1:3000`，指向本地后端服务地址。
2. 重启 `pnpm dev:weapp` 使编译常量生效，请求 URL 将被正确拼接为完整地址。

**修改文件**：
- `.env.local`：新增 `PROJECT_DOMAIN=http://127.0.0.1:3000`。

---

### 2026-07-28 — 修复后端 VolcengineService 无 AK/SK 时启动崩溃

**会话目的**：排查 `ERR_CONNECTION_REFUSED`，后端服务无法在 3000 端口监听的原因。

**根因分析**：
- `server/.env.local` 中已有 `STORAGE_MOCK=1`，但 `VolcengineService` 和 `StorageService` 的 `constructor` 不感知该标志。
- `ImageXClient` 在 AK/SK 为空时直接抛出异常，发生在 NestJS 依赖注入阶段，导致整个应用无法启动。
- 后端进程崩溃退出，3000 端口无服务，小程序所有请求均报 `ERR_CONNECTION_REFUSED`。

**完成任务**：
1. `VolcengineService.constructor`：在 `STORAGE_MOCK=1` 时跳过 `ImageXClient` 初始化，赋值 `null`。
2. `StorageService.constructor`：在 `STORAGE_MOCK=1` 时跳过 `S3Storage` 和 `VolcengineService` 实例化。
3. 修改保存后，`tsc --watch` 自动重编译，NestJS 热重载，后端成功在 `http://localhost:3000` 启动。

**修改文件**：
- `server/src/modules/upload/volcengine.service.ts`：constructor 增加 Mock 守卫。
- `server/src/modules/storage/storage.service.ts`：constructor 增加 Mock 守卫。

---

### 2026-08-03 — 创建分身模块一期：创建分身页面（第1步-基础信息）

**会话目的**：基于 ai_avatar 新表结构，开发「创建分身」第1步页面（基础信息填写），包含前后端全链路。

**完成任务**：
1. 新建前端页面 `src/package-my-avatar/pages/avatar-create-step1/`，实现设计图中的 UI 布局（头像上传、昵称输入、标签选择弹窗、个性描述）
2. 新建后端 NestJS 模块 `server/src/modules/ai-avatar/`，提供 `POST /api/ai-avatar` 接口，直接写入 `ai_avatar` 表
3. 注册页面路由到 `app.config.ts` 的 `package-my-avatar` 分包
4. 修改引导页 `avatar-onboarding` 的「开始创建」按钮跳转到新页面
5. 前后端联调完成：点击「下一步」→ 调用接口 → 保存成功提示 → 返回上一页

**修改/新增文件**：
- `src/package-my-avatar/pages/avatar-create-step1/index.tsx`（新增）
- `src/package-my-avatar/pages/avatar-create-step1/index.css`（新增）
- `src/package-my-avatar/pages/avatar-create-step1/index.config.ts`（新增）
- `server/src/modules/ai-avatar/ai-avatar.controller.ts`（新增）
- `server/src/modules/ai-avatar/ai-avatar.service.ts`（新增）
- `server/src/modules/ai-avatar/ai-avatar.module.ts`（新增）
- `server/src/app.module.ts`（添加 AiAvatarModule 导入）
- `src/app.config.ts`（package-my-avatar 分包添加新页面路径）
- `src/package-my-avatar/pages/avatar-onboarding/index.tsx`（跳转路径修改）

---

### 2026-08-04 — 分身编辑模式 + 标签必填校验

**会话目的**：实现分身编辑功能——草稿/待测试状态的分身点击后进入编辑页面修改已有内容（而非新建），以及将分身标签设为必填项。

**完成任务**：
1. **后端新增接口**：`GET /api/ai-avatar/:id` 查询分身详情（仅本人）、`PUT /api/ai-avatar/:id` 更新分身基础信息
2. **后端新增方法**：`AiAvatarService.updateAvatar()` 更新分身 avatar_name/avatar_url/description/tags_json/skill_type
3. **我的分身页编辑跳转**：点击分身卡片时，草稿/待测试状态跳转到 step1 编辑页面（携带 avatarId），已上线状态跳转到分身详情页
4. **step1 编辑模式**：通过 URL 参数 `avatarId` 判断编辑模式，调用详情接口回填表单数据，下一步时调用 PUT 更新接口
5. **分身标签必填校验**：年龄、性别、职业、地理位置四项标签均为必填，未填写时提示对应项
6. **step2 返回保持编辑**：step2 点击返回按钮时使用 `redirectTo` 携带 avatarId 回到 step1，保持编辑模式而不新增数据
7. **页面标题适配**：编辑模式下标题显示"编辑分身（1/3）"/"编辑分身（2/3）"

**修改文件**：
- `server/src/modules/ai-avatar/ai-avatar.controller.ts`（新增 GET :id、PUT :id 路由）
- `server/src/modules/ai-avatar/ai-avatar.service.ts`（新增 updateAvatar 方法）
- `src/package-my-avatar/pages/my-avatar/index.tsx`（openAvatar 方法改为根据状态跳转编辑或详情）
- `src/package-my-avatar/pages/avatar-create-step1/index.tsx`（新增 editAvatarId 状态、useLoad 加载回填、validateForm 标签必填校验、handleNext 区分创建/更新）
- `src/package-my-avatar/pages/avatar-create-step2/index.tsx`（handleBack 携带 avatarId 返回 step1、标题适配）

---

### 2026-08-04 — 技能认证生成任务完整流程（积分扣除+作品入库+模板启用）

**会话目的**：将技能认证页面的"立即使用并认证"按钮从调试运行（debug-run，不扣积分不落库）改为完整的生成任务流程：校验→扣积分→调用模型→成功创建作品+分身提供者收益+模板状态→已启用 / 失败全额退款。

**完成任务**：

1. **扩展 CoinService**：
   - `consume()` 增加可选 `options.description`、`options.metadata`、`options.connection` 参数
   - `gift()` 增加可选 `options.metadata`、`options.connection` 参数
   - 支持外部传入数据库连接以参与外部事务
   - 积分流水写入 `coin_transactions.metadata` 字段（JSON），包含 `business_type`、`task_no`、`avatar_id` 等业务追溯信息

2. **后端新增方法（AiAvatarService）**：
   - `createGenerationTask()` — 完整生成任务流程（校验→幂等检查→事务扣积分+插入 ai_generation_task→调用模型→成功/失败处理）
   - `pollGenerationTask()` — 异步任务轮询，成功后创建作品
   - `getTaskByNo()` — 查询任务状态
   - `handleGenerationSuccess()` — 创建 ai_generated_work + 分身提供者收益 + 更新统计 + 模板状态→已启用
   - `handleGenerationFailure()` — 全额退款 + 更新任务失败状态

3. **后端新增接口（AiAvatarController）**：
   - `POST /api/ai-avatar/generation-tasks` — 创建生成任务
   - `GET /api/ai-avatar/generation-tasks/:taskNo` — 查询任务状态
   - `POST /api/ai-avatar/generation-tasks/:taskNo/poll` — 轮询异步任务

4. **前端 skill-certify 页面改造**：
   - `handleSubmit` 改为调用 `/api/ai-avatar/generation-tasks` 接口
   - 提交前显示积分确认弹窗（模型成本 + 创作者收益）
   - 新增"费用说明"区域展示积分明细
   - 增加提交中禁用状态

5. **前端 skill-certify-result 页面改造**：
   - 通过 `taskNo` 参数查询/轮询任务状态（替代旧的 debug-run + filledPrompt 方式）
   - 生成失败时显示"已自动退还 xx 积分"
   - 认证信息区域增加消耗积分展示
   - 保留旧流程兼容（filledPrompt 参数仍可用）

6. **AiAvatarModule 引入 CoinModule 依赖注入**

**核心业务规则**：
- 用户支付积分 = 模型成本积分 + 创作者收益积分
- 分身所有者使用自己的分身时只扣模型成本，不产生自我收益
- 模型失败全额退款（模型成本 + 创作者收益）
- 任务成功后创建一条作品（ai_generated_work），模板状态从"待测试"→"已启用"
- 支持幂等键防止重复提交
- 积分流水 metadata 包含完整业务追溯信息

**修改文件**：
- `server/src/modules/coin/coin.service.ts`（扩展 consume/gift 方法签名）
- `server/src/modules/ai-avatar/ai-avatar.service.ts`（新增生成任务完整流程方法）
- `server/src/modules/ai-avatar/ai-avatar.controller.ts`（新增 3 个生成任务接口）
- `server/src/modules/ai-avatar/ai-avatar.module.ts`（引入 CoinModule）
- `src/package-my-avatar/pages/skill-certify/index.tsx`（handleSubmit 改用生成任务接口 + 积分确认 + 费用说明）
- `src/package-my-avatar/pages/skill-certify/index.css`（新增费用说明和禁用状态样式）
- `src/package-my-avatar/pages/skill-certify-result/index.tsx`（改用 taskNo 轮询 + 退款提示 + 积分展示）
- `src/package-my-avatar/pages/skill-certify-result/index.css`（新增退款提示样式）

### 2026-08-04 技能认证流程恢复与优化

**会话目的**：恢复原有的"技能认证→体验结果页"交互流程，同时在流程中嵌入积分扣除和作品入库逻辑

**完成的任务**：

将后端 `createGenerationTask`（一体化）拆分为前后端解耦的两步流程，恢复原有 UI 交互体验：

1. **后端拆分为两步接口**：
   - `createTaskAndDeductPoints`：仅创建任务+扣积分，不调用模型，返回 `taskNo`
   - `completeGenerationTask`：前端拿到模型结果后提交，后端负责落作品或退款
   - 对应 Controller 接口：`POST /generation-tasks`（创建+扣积分）、`POST /generation-tasks/:taskNo/complete`（提交结果）

2. **前端 skill-certify 页面恢复**：
   - 恢复原来的 `filledPrompt` 构建逻辑（本地替换 `{{变量}}` 占位符）
   - 点击按钮后积分确认弹窗 → 构建 filledPrompt → 直接跳转到 result 页面
   - 保留费用说明展示区域

3. **前端 skill-certify-result 页面重构**：
   - 进入页面后自动执行完整流程：创建任务→扣积分→调模型(debug-run)→提交结果(complete)
   - 恢复原有 `debug-run` / `debug-poll` 调用链路
   - 模型成功/失败后自动调用 `complete` 接口落作品或退款

**完整流程**：`创建任务` → `扣除积分` → `调用模型(debug-run)` → `成功创建作品(complete)` → `结算分身收益`

**修改文件**：
- `server/src/modules/ai-avatar/ai-avatar.service.ts`（拆分为 createTaskAndDeductPoints + completeGenerationTask）
- `server/src/modules/ai-avatar/ai-avatar.controller.ts`（替换接口为拆分版本）
- `src/package-my-avatar/pages/skill-certify/index.tsx`（恢复 filledPrompt 跳转逻辑）
- `src/package-my-avatar/pages/skill-certify-result/index.tsx`（恢复 debug-run/poll + 嵌入扣积分落作品）

### 2026-08-04 等待页面动态化 + content_json 规范修正

**会话目的**：解决 `request:fail timeout` 用户体验问题；按数据库文档规范修正作品写入逻辑

**完成的任务**：

1. **等待页面动态化重设计**：
   - 添加读秒计时器，实时显示已等待秒数（`0s, 1s, 2s...`）
   - 添加流程步骤进度条：创建任务 → 扣除积分 → 调用模型 → 生成完成
   - 每个步骤实时切换状态（等待/进行中/已完成），使用不同图标和颜色
   - 旋转加载动画 + 脉冲效果
   - 底部动态提示文字（随步骤变化）

2. **content_json 规范修正（按文档 9.3 节）**：
   - 文字作品：`{ text }`
   - 图片作品：`{ images: [url, ...] }`（原来错误地用了 `items: [{url}]`）
   - 视频作品：`{ video_url, cover_url }`
   - 图文作品：`{ title, text, images: [url, ...] }`（原来错误地用了 `items`）

3. **source_snapshot_json 规范修正（按文档 9.2 节）**：
   - 补齐 `avatar_url`、`template_cover_url` 字段
   - 从 `ai_avatar` 表查询真实分身名称和头像

4. **作品写入补充 tags_json**：继承模板的标签到作品

**修改文件**：
- `src/package-my-avatar/pages/skill-certify-result/index.tsx`（等待页动态化 + 步骤进度）
- `src/package-my-avatar/pages/skill-certify-result/index.css`（动画样式）
- `server/src/modules/ai-avatar/ai-avatar.service.ts`（content_json + source_snapshot_json + tags_json 修正）

### 2026-08-04 修复 complete 接口超时导致作品丢失

**会话目的**：修复 `request:fail timeout` 导致大模型已生成成功但 `ai_generated_work` 无数据、`ai_generation_task.status` 仍为"生成中"的问题

**根因分析**：
- 微信小程序 `Taro.request` 默认超时 60s
- `complete` 接口需执行事务（查询任务+模板+分身 → 更新任务状态 → 插入作品 → 创作者收益积分 → 更新统计 → 模板状态变更），数据库连接池繁忙时可能超过 60s
- 超时后前端 catch 只 console.error，无重试机制，作品数据永久丢失

**修复措施**：
1. `submitCompletion` 超时设为 120s + 最多 3 次重试（间隔递增 2s/4s/6s）
2. 3 次全部失败后 Toast 提示用户"作品保存异常，请稍后在「我的作品」中查看"
3. `debug-run` 模型调用超时也设为 120s（模型生成本身耗时不定）
4. 创建任务接口超时设为 60s

**修改文件**：
- `src/package-my-avatar/pages/skill-certify-result/index.tsx`（submitCompletion 重试机制 + 各请求超时配置）

### 2026-08-05 修复 complete 接口事务报错导致作品未落库

**会话目的**：彻底解决"大模型已生成成功返回页面，但 `ai_generated_work` 无数据、`ai_generation_task.status` 仍为生成中"问题

**根因分析**：
1. `CoinService.consume()` 和 `CoinService.gift()` 的 INSERT 语句包含了 `coin_transactions` 表**不存在的列**（`skill_type`、`metadata`），导致 SQL 执行报错
2. `handleGenerationSuccess` 事务 rollback，但错误只打印到 console 未传回前端
3. `completeGenerationTask` 查询条件 `status = '生成中'` 导致重试时如果任务已被其他调用改为成功状态则查不到（幂等问题）
4. 前端 complete 失败后无用户可见的重试入口

**修复措施**：
1. **CoinService SQL 修复**：移除 `coin_transactions` INSERT 中不存在的 `skill_type` 和 `metadata` 列，仅保留表中确实有的基础列
2. **completeGenerationTask 幂等保护**：查询不再限定 `status = '生成中'`，若任务已是"生成成功"则直接返回成功
3. **handleGenerationSuccess 事务内逐步日志**：每个关键 SQL 执行后打印日志，精准定位失败步骤
4. **completeGenerationTask try-catch 细化**：`handleGenerationSuccess` 异常被内部 catch 并返回具体错误信息（而非向上冒泡导致 500）
5. **Controller 增加时间和日志**：记录 complete 请求的处理耗时和结果
6. **前端增加重试 UI**：complete 失败后显示"作品保存失败"提示和"重新保存"按钮，用户可手动重试

**修改文件**：
- `server/src/modules/coin/coin.service.ts`（移除不存在的列 skill_type/metadata）
- `server/src/modules/ai-avatar/ai-avatar.service.ts`（幂等查询 + try-catch 细化 + 逐步日志）
- `server/src/modules/ai-avatar/ai-avatar.controller.ts`（complete 接口增加日志和耗时记录）
- `src/package-my-avatar/pages/skill-certify-result/index.tsx`（complete 失败 UI + 手动重试按钮）
- `src/package-my-avatar/pages/skill-certify-result/index.css`（重试区域样式）

### 2026-08-05 重构生成任务架构——后端一步到位

**会话目的**：彻底解决 complete 接口反复失败（code=500 msg=处理失败）、setData 2038KB 性能问题、重试按钮表面成功实际未写入的问题

**根因分析**：
1. 前端将完整模型结果（含 2MB base64 图片）通过 POST body 传给 complete 接口，导致：
   - `setData` 传输 2038KB 触发小程序性能警告
   - 大数据量 POST 传输不稳定，超时/截断概率高
   - 后端 INSERT 的 content_json 字段包含超大 base64 可能触发连接问题
2. 前端 `submitCompletion` 使用 `void`（fire-and-forget）触发，多次重试与手动重试互相竞争 `completeFailed` 状态
3. `CoinService.consume/gift` 中 `skill_type` 和 `metadata` 列之前被误删

**修复措施（架构重构）**：
1. **新增 `executeGenerationTask` 接口**：前端只传 taskNo + filledPrompt，后端自己调用 debugRun → handleGenerationSuccess → 返回精简预览（不含 base64）
2. **移除前端中转大数据**：前端不再调 debugRun + submitCompletion，改为调后端 execute 一步到位
3. **精简 genResult**：前端 state 只存展示摘要（文本前 500 字 / 图片 URL），不存原始 base64
4. **新增 `retrySaveWork` 接口**：模型成功但落作品失败时，缓存 modelResult 到 task，重试时从缓存读取
5. **新增 `poll` 接口**：异步任务轮询由后端统一处理（pollGenerationTask 已包含落作品逻辑）
6. **恢复 CoinService**：`consume` 写入 `skill_type` 和 `metadata`，`gift` 写入 `metadata`

**API 变更**：
- 新增 `POST /api/ai-avatar/generation-tasks/:taskNo/execute`（替代前端调 debugRun + complete）
- 新增 `GET /api/ai-avatar/generation-tasks/:taskNo/poll`（异步任务轮询）
- 新增 `POST /api/ai-avatar/generation-tasks/:taskNo/retry-save`（重试保存）
- `POST /api/ai-avatar/generation-tasks/:taskNo/complete` 保留但不再是主流程

**修改文件**：
- `server/src/modules/coin/coin.service.ts`（恢复 skill_type + metadata 写入）
- `server/src/modules/ai-avatar/ai-avatar.service.ts`（新增 executeGenerationTask、retrySaveWork、buildResultPreview）
- `server/src/modules/ai-avatar/ai-avatar.controller.ts`（新增 execute、poll、retry-save 接口 + 日志优化）
- `src/package-my-avatar/pages/skill-certify-result/index.tsx`（重构 runFullFlow 使用 execute、精简 state、移除 submitCompletion）

### 2026-08-05 Base64 图片自动上传 TOS

**会话目的**：解决大模型返回 4MB+ base64 图片导致 `cover_url` VARCHAR(500) 溢出、`content_json` 存储效率低下的问题

**方案**：在 `handleGenerationSuccess` 执行前，自动将 base64 图片上传到 TOS 对象存储，替换为持久化 URL

**修改文件**：
- `server/src/modules/ai-avatar/ai-avatar.module.ts`（导入 UploadModule）
- `server/src/modules/ai-avatar/ai-avatar.service.ts`（注入 UploadService、新增 `convertBase64ToUrls` 方法、在 `executeGenerationTask` 和 `retrySaveWork` 中调用）

### 2026-08-06 模版列表页优化：添加模版按钮、展示开关、卡片重设计

**会话目的**：优化模版管理页面的功能和交互体验

**完成的主要任务**：
1. 底部添加固定"添加模版"按钮，点击跳转到"编辑模版（3/3）"页面
2. 每个模版卡片增加对外展示 Switch 开关（默认关闭=仅自己可见），切换时更新数据库 `display_status` 字段，采用乐观更新策略
3. 重新设计模版卡片布局：三段式结构（封面+信息 → 标签行 → 数据+开关），更紧凑的 120rpx 封面、独立标签行展示状态/技能/版本、底部行左侧数据指标右侧展示开关
4. 后端新增 `PUT /api/ai-avatar/templates/:templateId/display-status` 接口

**修改文件**：
- `src/package-my-avatar/pages/template-list/index.tsx`（前端列表页重构：添加 Switch 组件、添加模版按钮、toggleDisplayStatus 乐观更新逻辑）
- `src/package-my-avatar/pages/template-list/index.css`（样式重写：新卡片三段式布局、底部固定按钮栏、展示开关样式）
- `server/src/modules/ai-avatar/ai-avatar.controller.ts`（新增 toggleDisplayStatus 路由）
- `server/src/modules/ai-avatar/ai-avatar.service.ts`（新增 toggleTemplateDisplayStatus 方法）

### 2026-08-06 分身广场列表页整行可点击 + 详情页模版使用跳转

**会话目的**：优化分身广场列表页交互（整行可点击进入详情）和详情页功能（默认图、标题修改、模版使用跳转）

**完成的主要任务**：
1. **分身广场列表页整行可点击**：将 `onClick` 事件从"查看"按钮提升到整个 Card 组件，收藏按钮通过 `stopPropagation` 阻止冒泡，"查看"按钮简化为纯文本提示
2. **列表页无图片默认展示**：无 `avatarUrl` 时显示渐变背景 + 分身名称首字母大写 + Sparkles 图标装饰
3. **详情页无图片默认展示**：头部分身头像无图片时显示大号首字母 + 紫色渐变背景 + Sparkles 装饰图标
4. **详情页标题修改**："精选作品 / 模板" → "精品模版文案"
5. **详情页"使用模版"按钮跳转**：点击后跳转到 `/package-my-avatar/pages/template-use/index`，携带 `templateId` 和 `avatarId` 参数；无关联模版时 Toast 提示
6. **后端返回 templateId**：`getPublicAvatarWorks` SQL 查询新增 `template_id` 字段，前端 `WorkPreview` 类型同步添加

**修改文件**：
- `src/pages/avatar-square/index.tsx`（Card 整行点击、收藏按钮 stopPropagation、无图片默认展示）
- `src/pages/avatar-square/index.css`（默认头像样式、卡片 active 反馈、查看文本样式）
- `src/package-avatar-square/pages/avatar-public-detail/index.tsx`（WorkPreview 加 templateId、标题修改、使用模版跳转、头像默认展示）
- `src/package-avatar-square/pages/avatar-public-detail/index.css`（默认头像首字母样式）
- `server/src/modules/avatar-square/avatar-square.service.ts`（SQL 新增 template_id、返回值加 templateId）
