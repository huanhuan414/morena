# 莫瑞娜小程序设计指南 - 明亮高级大气版

## 品牌定位

**应用定位**：AI 分身智能助手平台
**设计风格**：明亮、高级、大气、现代
**目标用户**：追求高品质数字体验的年轻用户

## 主题系统

### 双主题设计

应用支持两种主题模式：

#### 明亮模式（默认）
- 背景色：#f8fafc（浅灰）
- 主色调：#2563eb（典雅蓝）
- 强调色：#f59e0b（温暖金）
- 风格：明亮、高级、大气

#### 深色模式（霓虹科技风格）
- 背景色：#0a0e27（深蓝黑）
- 主色调：#00f5ff（霓虹青）
- 强调色：#bf00ff（霓虹紫）
- 风格：科技感、未来感、高级感

### 主题切换

- 用户可以在个人设置页面切换主题
- 主题设置会持久化到本地存储
- 切换主题时会有平滑过渡动画（0.3s）

### 主题预览

在设置页面可以看到当前主题的预览：
- 显示主题名称（霓虹科技风格 / 明亮高级风格）
- 显示主题的主要颜色点（3个）

### CSS 变量系统

所有颜色都使用 CSS 变量定义：
```css
:root {
  --background: #f8fafc;
  --foreground: #1e293b;
  --primary: #2563eb;
  --accent: #f59e0b;
  /* ... */
}

.dark {
  --background: #0a0e27;
  --foreground: #f1f5f9;
  --primary: #00f5ff;
  --accent: #bf00ff;
  /* ... */
}
```

使用时：
```tsx
<View className="bg-background text-primary">
```

### Tailwind 类名映射

```tsx
// 明亮模式
bg-slate-50 text-blue-600

// 深色模式（通过 CSS 变量自动切换）
bg-background text-primary
```

## 配色方案

### 明亮模式（默认）

```css
/* 主色调 - 典雅蓝 */
--primary: #2563eb; /* Royal Blue - 权威与信任 */
--primary-foreground: #ffffff;

/* 辅助色 */
--primary-light: #3b82f6; /* Light Blue */
--primary-dark: #1d4ed8; /* Dark Blue */

/* 强调色 - 温暖金 */
--accent: #f59e0b; /* Amber - 温暖与活力 */
--accent-foreground: #ffffff;

/* 中性色 */
--background: #f8fafc; /* Slate 50 - 柔和的浅灰背景 */
--foreground: #1e293b; /* Slate 800 - 深灰文字 */

/* 卡片色 */
--card: #ffffff; /* 纯白卡片 */
--card-foreground: #1e293b;

/* 次要色 */
--secondary: #f1f5f9; /* Slate 100 */
--secondary-foreground: #475569;

/* 静音色 */
--muted: #e2e8f0; /* Slate 200 */
--muted-foreground: #64748b;

/* 边框 */
--border: #e2e8f0;
--input: #cbd5e1;

/* 环形焦点 */
--ring: #2563eb;

/* 语义色 */
--success: #10b981; /* Emerald 500 */
--warning: #f59e0b; /* Amber 500 */
--destructive: #ef4444; /* Red 500 */
--info: #06b6d4; /* Cyan 500 */

/* 特殊强调色（用于高级感点缀） */
--neon-cyan: #06b6d4;
--neon-purple: #8b5cf6;
--neon-pink: #ec4899;
```

### 深色模式（霓虹科技风格）

```css
/* 主色调 - 霓虹青 */
--primary: #00f5ff; /* Neon Cyan - 科技感 */
--primary-foreground: #0a0e27;

/* 辅助色 */
--primary-light: #33faff;
--primary-dark: #00b8c4;

/* 强调色 - 霓虹紫 */
--accent: #bf00ff; /* Neon Purple - 高级感 */
--accent-foreground: #ffffff;

/* 中性色 */
--background: #0a0e27; /* Deep Blue-Black */
--foreground: #f1f5f9; /* Light Slate */

/* 卡片色 */
--card: rgba(22, 33, 62, 0.85); /* 半透明深蓝 */
--card-foreground: #f1f5f9;

/* 次要色 */
--secondary: #16213e; /* Dark Blue */
--secondary-foreground: #94a3b8;

/* 静音色 */
--muted: #1e293b; /* Dark Gray */
--muted-foreground: #64748b;

/* 边框 */
--border: rgba(0, 245, 255, 0.15); /* 青色边框 */
--input: rgba(0, 245, 255, 0.2);

/* 环形焦点 */
--ring: #00f5ff;

/* 语义色 - 霓虹色系 */
--success: #00ff88; /* Neon Green */
--warning: #ffaa00; /* Neon Orange */
--destructive: #ff4757; /* Neon Red */
--info: #00f5ff; /* Neon Cyan */

/* 特殊强调色 */
--neon-cyan: #00f5ff;
--neon-purple: #bf00ff;
--neon-pink: #ff00aa;
```

## 配色方案

（已整合到"主题系统"章节）

### Tailwind 类名映射

```tsx
// 主色
bg-blue-600 text-white
hover:bg-blue-700

// 辅助色
bg-amber-500 text-white

// 背景
bg-slate-50
bg-white

// 文字
text-slate-800
text-slate-600
text-slate-400

// 边框
border-slate-200

// 卡片
bg-white shadow-sm border border-slate-200 rounded-xl

// 语义色
text-emerald-500 bg-emerald-50
text-amber-500 bg-amber-50
text-red-500 bg-red-50
```

## 字体规范

```css
/* H1 - 页面大标题 */
font-size: 28px;
font-weight: 700;
color: #1e293b;
line-height: 1.3;

/* H2 - 区块标题 */
font-size: 20px;
font-weight: 600;
color: #1e293b;
line-height: 1.4;

/* H3 - 卡片标题 */
font-size: 16px;
font-weight: 600;
color: #1e293b;
line-height: 1.5;

/* Body - 正文 */
font-size: 14px;
font-weight: 400;
color: #475569;
line-height: 1.6;

/* Caption - 辅助文字 */
font-size: 12px;
font-weight: 400;
color: #64748b;
line-height: 1.5;
```

## 间距系统

```css
/* 页面边距 */
page-padding: 16px;

/* 组件内边距 */
padding-xs: 8px;
padding-sm: 12px;
padding-md: 16px;
padding-lg: 20px;
padding-xl: 24px;

/* 组件间距 */
gap-xs: 4px;
gap-sm: 8px;
gap-md: 12px;
gap-lg: 16px;
gap-xl: 20px;
gap-2xl: 24px;
```

## 组件使用原则

### 优先使用组件库

所有通用 UI 组件必须优先使用 `@/components/ui/*`：

- 按钮：`@/components/ui/button`
- 输入框：`@/components/ui/input`
- 弹窗：`@/components/ui/dialog`
- 卡片：`@/components/ui/card`
- Tabs：`@/components/ui/tabs`
- Toast：`@/components/ui/toast`
- 选择器：`@/components/ui/select`
- ... 等等

**禁止**：使用 `View/Text` 手搓通用组件

### 容器样式

```tsx
// 页面容器
<View className="bg-slate-50 min-h-screen pb-20">

// 卡片容器
<Card className="bg-white shadow-sm border border-slate-200 rounded-xl">

// 分组容器
<View className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
```

### 按钮规范

```tsx
// 主要按钮
<Button className="bg-blue-600 text-white hover:bg-blue-700">
  <Text>确定</Text>
</Button>

// 次要按钮
<Button className="bg-slate-100 text-slate-700 hover:bg-slate-200">
  <Text>取消</Text>
</Button>

// 强调按钮
<Button className="bg-amber-500 text-white hover:bg-amber-600">
  <Text>立即行动</Text>
</Button>
```

## 导航结构

### TabBar 配置

```typescript
tabBar: {
  color: '#64748b',        // 未选中 - 灰色
  selectedColor: '#2563eb', // 选中 - 蓝色
  backgroundColor: '#ffffff', // 背景 - 白色
  borderStyle: 'white',
  list: [...]
}
```

### 页面导航

- **TabBar 页面**：使用 `switchTab()` 跳转
- **普通页面**：使用 `navigateTo()` 跳转
- **返回按钮**：仅二级页面显示，一级页面不显示

## 空状态与加载态

### 空状态

```tsx
<View className="flex flex-col items-center justify-center py-12">
  <View className="w-16 h-16 mb-4 bg-slate-100 rounded-full flex items-center justify-center">
    <Icon size={32} color="#94a3b8" />
  </View>
  <Text className="text-slate-400 text-sm">暂无数据</Text>
</View>
```

### 加载态

```tsx
<View className="flex items-center justify-center py-8">
  <Loader className="text-blue-600" size={24} />
  <Text className="ml-2 text-slate-400 text-sm">加载中...</Text>
</View>
```

## 小程序约束

### 包体积限制
- 主包：≤ 2MB
- 单个分包：≤ 2MB
- 所有分包：≤ 20MB

### 图片策略
- 所有图片使用 TOS 对象存储
- TabBar 图标必须使用本地 PNG
- 推荐格式：WebP（质量优先）、PNG（兼容性优先）

### 性能优化
- 使用分包加载
- 按需引入组件
- 避免深层嵌套
- 使用虚拟列表（长列表）

### 阴影使用

```tsx
// 轻微阴影
shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05)

// 中等阴影
shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)

// 大阴影
shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)

// 浮动卡片阴影
shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)
```

## 设计亮点

### 高级感设计

1. **白色卡片 + 柔和阴影**：使用纯白卡片配合柔和阴影，营造层次感
2. **优雅的间距**：使用 16px/20px/24px 的间距系统，保持视觉舒适
3. **精致的边框**：使用 1px 的浅色边框，增加细节精致度
4. **柔和的渐变**：仅在关键操作处使用渐变，如按钮、高亮区域

### 大气感设计

1. **充足的留白**：页面、卡片、组件之间保持充足的留白
2. **清晰的层级**：通过颜色、大小、间距建立清晰的视觉层级
3. **统一的圆角**：统一使用 12px/16px 的圆角，保持一致性

### 明亮感设计

1. **浅色背景**：使用 Slate-50 作为页面背景
2. **高对比度文字**：使用深灰/黑色文字，确保可读性
3. **清爽的色彩**：使用蓝色系作为主色调，传递专业与信任

## 页面示例

### 首页（广场）

```tsx
<View className="bg-slate-50 min-h-screen">
  {/* 顶部导航 */}
  <View className="bg-white px-4 py-3 border-b border-slate-200">
    <Text className="text-lg font-bold text-slate-800">广场</Text>
  </View>

  {/* 内容区域 */}
  <ScrollView className="flex-1">
    <View className="p-4">
      <Card className="bg-white shadow-sm border border-slate-200 rounded-xl p-4">
        {/* 内容 */}
      </Card>
    </View>
  </ScrollView>
</View>
```

### 对话页面（心智对话）

```tsx
<View className="bg-slate-50 min-h-screen flex flex-col">
  {/* 消息列表 */}
  <ScrollView className="flex-1 px-4 py-4">
    {/* 消息 */}
  </ScrollView>

  {/* 输入区域 */}
  <View className="bg-white px-4 py-3 border-t border-slate-200">
    <View className="flex items-center gap-2">
      <Input className="flex-1 bg-slate-100 rounded-lg" />
      <Button className="bg-blue-600 text-white">
        <Send />
      </Button>
    </View>
  </View>
</View>
```

## 快速参考

### 常用 Tailwind 类

```tsx
// 背景
bg-slate-50 bg-white bg-slate-100

// 文字
text-slate-800 text-slate-600 text-slate-400 text-white

// 边框
border border-slate-200 border-slate-300

// 圆角
rounded-lg rounded-xl rounded-2xl

// 间距
p-4 px-4 py-3 gap-2 gap-4

// 阴影
shadow-sm shadow shadow-lg

// Flex 布局
flex items-center justify-between
flex-col gap-4
```

### 主题色速查

```tsx
// 主色
bg-blue-600 text-blue-600

// 强调色
bg-amber-500 text-amber-500

// 成功
bg-emerald-500 text-emerald-500

// 警告
bg-amber-500 text-amber-500

// 错误
bg-red-500 text-red-500

// 信息
bg-cyan-500 text-cyan-500
```
