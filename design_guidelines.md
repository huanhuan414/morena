# 莫瑞娜小程序设计指南 - 明亮高级大气版

## 品牌定位

**应用定位**：AI 分身智能助手平台
**设计风格**：明亮、高级、大气、现代
**目标用户**：追求高品质数字体验的年轻用户

## 配色方案

### 主色板

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

/* 选择 */
--selection: #dbeafe;
--selection-foreground: #1e293b;
```

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
