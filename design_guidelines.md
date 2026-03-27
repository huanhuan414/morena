# 莫瑞娜（Morina）设计指南

## 品牌定位

**应用名称**：莫瑞娜（Morina）AI原生人机共生自动协同矩阵生态平台  
**设计风格**：未来科技风、AI原生、人机共生、高级质感  
**目标用户**：追求AI效率工具的创作者、企业用户、科技爱好者  
**核心理念**：AI分身全自动协同，解放人力，提升创造力

---

## 配色方案

### 主色板（科技蓝紫渐变）

| 用途 | 色值 | Tailwind类名 | 说明 |
|------|------|--------------|------|
| 主色 | #6366f1 | `bg-indigo-500` / `text-indigo-500` | AI智能、科技感 |
| 主色渐变起始 | #818cf8 | `bg-indigo-400` | 渐变亮部 |
| 主色渐变结束 | #4f46e5 | `bg-indigo-600` | 渐变暗部 |
| 强调色 | #a855f7 | `bg-purple-500` | 创意、魔法效果 |
| 强调色渐变 | #c084fc → #9333ea | `from-purple-400 to-purple-600` | 渐变效果 |

### 中性色

| 用途 | 色值 | Tailwind类名 |
|------|------|--------------|
| 主文本 | #f8fafc | `text-slate-50` |
| 次文本 | #cbd5e1 | `text-slate-300` |
| 辅助文本 | #64748b | `text-slate-500` |
| 背景主色 | #0f172a | `bg-slate-900` |
| 背景次色 | #1e293b | `bg-slate-800` |
| 背景卡片 | rgba(30, 41, 59, 0.8) | `bg-slate-800/80` |
| 边框 | rgba(148, 163, 184, 0.2) | `border-slate-600/20` |

### 语义色

| 用途 | 色值 | Tailwind类名 |
|------|------|--------------|
| 成功 | #10b981 | `bg-emerald-500` / `text-emerald-500` |
| 警告 | #f59e0b | `bg-amber-500` / `text-amber-500` |
| 错误 | #ef4444 | `bg-red-500` / `text-red-500` |
| 信息 | #3b82f6 | `bg-blue-500` / `text-blue-500` |

### 深色模式（默认）

```css
/* 全局深色背景 */
background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);

/* 磨砂玻璃效果 */
backdrop-filter: blur(20px);
background: rgba(30, 41, 59, 0.6);
border: 1px solid rgba(148, 163, 184, 0.1);

/* 发光效果 */
box-shadow: 0 0 30px rgba(99, 102, 241, 0.3);
```

---

## 字体规范

| 层级 | Tailwind类名 | 字号 | 行高 | 字重 |
|------|--------------|------|------|------|
| H1 | `text-4xl font-bold` | 36px | 1.2 | 700 |
| H2 | `text-2xl font-semibold` | 24px | 1.3 | 600 |
| H3 | `text-xl font-semibold` | 20px | 1.4 | 600 |
| H4 | `text-lg font-medium` | 18px | 1.5 | 500 |
| Body | `text-base` | 16px | 1.6 | 400 |
| Caption | `text-sm` | 14px | 1.5 | 400 |
| Micro | `text-xs` | 12px | 1.4 | 400 |

---

## 间距系统

| 类型 | Tailwind类名 | 值 |
|------|--------------|-----|
| 页面边距 | `px-4` / `py-6` | 16px / 24px |
| 卡片内边距 | `p-4` / `p-6` | 16px / 24px |
| 列表间距 | `gap-3` / `gap-4` | 12px / 16px |
| 组件间距 | `space-y-4` | 16px |

---

## 组件使用原则

### 必须优先使用 `@/components/ui/*`

所有通用UI组件必须从组件库导入，禁止用 `View/Text` 手搓：

- **按钮**：`Button` / `ButtonGroup` — 所有操作按钮
- **输入框**：`Input` / `Textarea` / `InputGroup` — 所有文本输入
- **卡片**：`Card` 系列 — 信息卡片、列表项容器
- **标签**：`Badge` — 状态标识、分类标签
- **切换**：`Tabs` — 分段切换、频道页
- **弹窗**：`Dialog` / `AlertDialog` / `Drawer` — 所有弹层交互
- **提示**：`Toast` / `Sonner` — 操作反馈、轻提示
- **加载**：`Skeleton` — 加载态占位
- **进度**：`Progress` — 任务进度、上传进度
- **列表**：`ScrollArea` — 滚动区域、列表容器
- **分隔**：`Separator` — 内容分割线

### 页面实现前必做

创建/重写页面前，先拆分UI单元并映射到组件库：

1. 列出页面需要的所有UI单元（按钮、输入框、卡片、标签等）
2. 逐个检查 `src/components/ui` 是否已有对应组件
3. 优先从 `@/components/ui/*` 导入使用
4. 仅当组件库缺失时才考虑自行实现

---

## 导航结构

### TabBar 页面（5个主Tab）

| Tab | 页面路径 | 图标 | 说明 |
|-----|----------|------|------|
| 首页 | `pages/home/index` | House | 分身概览、快捷入口 |
| 对话 | `pages/chat/index` | MessageCircle | AI对话、语音交互 |
| 任务 | `pages/task/index` | ClipboardList | 任务管理、进度追踪 |
| 广场 | `pages/social/index` | Users | 社交广场、动态流 |
| 我的 | `pages/profile/index` | User | 个人中心、设置 |

### TabBar 配置

```typescript
tabBar: {
  color: '#64748b',
  selectedColor: '#818cf8',
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  borderStyle: 'white',
  list: [
    { pagePath: 'pages/home/index', text: '首页', iconPath: './assets/tabbar/house.png', selectedIconPath: './assets/tabbar/house-active.png' },
    { pagePath: 'pages/chat/index', text: '对话', iconPath: './assets/tabbar/message-circle.png', selectedIconPath: './assets/tabbar/message-circle-active.png' },
    { pagePath: 'pages/task/index', text: '任务', iconPath: './assets/tabbar/clipboard-list.png', selectedIconPath: './assets/tabbar/clipboard-list-active.png' },
    { pagePath: 'pages/social/index', text: '广场', iconPath: './assets/tabbar/users.png', selectedIconPath: './assets/tabbar/users-active.png' },
    { pagePath: 'pages/profile/index', text: '我的', iconPath: './assets/tabbar/user.png', selectedIconPath: './assets/tabbar/user-active.png' }
  ]
}
```

---

## 视觉效果规范

### 磨砂玻璃效果

```css
.glass-card {
  backdrop-filter: blur(20px);
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 16px;
}
```

### 渐变效果

```css
/* 主色渐变背景 */
.gradient-bg {
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
}

/* 文字渐变 */
.text-gradient {
  background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

### 发光效果

```css
/* 主色发光 */
.glow-primary {
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
}

/* 悬停发光增强 */
.glow-primary:hover {
  box-shadow: 0 0 30px rgba(99, 102, 241, 0.6);
}
```

### 动画效果

```css
/* 淡入 */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 脉冲 */
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.4); }
  50% { box-shadow: 0 0 40px rgba(99, 102, 241, 0.6); }
}

/* 打字指示器 */
@keyframes typing {
  0%, 60%, 100% { opacity: 0.3; }
  30% { opacity: 1; }
}
```

---

## 空状态与加载态

### 空状态

```tsx
<View className="flex flex-col items-center justify-center py-20">
  <Inbox size={64} color="#64748b" className="mb-4" />
  <Text className="text-slate-400 text-base">暂无数据</Text>
</View>
```

### 加载态

```tsx
<View className="flex items-center justify-center py-20">
  <View className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
</View>
```

### 骨架屏

```tsx
<View className="space-y-4">
  <Skeleton className="h-16 w-full rounded-xl" />
  <Skeleton className="h-32 w-full rounded-xl" />
  <Skeleton className="h-24 w-full rounded-xl" />
</View>
```

---

## 小程序约束

- **主包体积**：≤ 2MB，非核心页面使用分包
- **总包体积**：≤ 20MB
- **图片优化**：使用 CDN，懒加载，压缩质量 80%
- **性能优化**：虚拟列表、防抖节流、减少 setData
- **动画优化**：CSS 动画优先，避免频繁重排重绘

---

## 图标规范

使用 `lucide-react-taro` 图标库，统一风格：

- **尺寸**：默认 24px，小图标 16px，大图标 32px
- **颜色**：使用 Tailwind 颜色类名或 `color` 属性
- **描边**：默认 2px，细线条 1.5px

常用图标映射：
- 首页：`House`
- 对话：`MessageCircle`
- 任务：`ClipboardList`
- 社交：`Users`
- 我的：`User`
- 设置：`Settings`
- 添加：`Plus`
- 搜索：`Search`
- 分享：`Share2`
- 编辑：`Edit`
- 删除：`Trash2`
- 成功：`CheckCircle`
- 警告：`AlertTriangle`
- 错误：`XCircle`
- 信息：`Info`
