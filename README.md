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
