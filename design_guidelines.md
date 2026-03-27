# 莫瑞娜（Morina）设计指南 V2.0

## 品牌定位

**应用名称**：莫瑞娜（Morina）AI原生人机共生自动协同矩阵生态平台  
**设计风格**：霓虹赛博朋克 / 未来科技感 / 沉浸式体验  
**目标用户**：追求AI效率工具的创作者、企业用户、科技爱好者  
**核心理念**：AI分身全自动协同，解放人力，提升创造力

---

## 配色方案

### 主色板（霓虹渐变）

| 用途 | 色值 | Tailwind类名 | 说明 |
|------|------|--------------|------|
| 霓虹青 | #00f5ff | `text-cyan-400` | 科技感、未来感 |
| 霓虹紫 | #bf00ff | `text-purple-500` | AI智能、创造力 |
| 霓虹粉 | #ff00aa | `text-pink-500` | 能量、活力 |
| 电光蓝 | #0088ff | `text-blue-500` | 信息、链接 |
| 主渐变 | cyan-400 → purple-500 | `from-cyan-400 to-purple-500` | 核心渐变 |

### 背景色系

| 用途 | 色值 | Tailwind类名 |
|------|------|--------------|
| 主背景 | #0a0a0f | `bg-[#0a0a0f]` |
| 卡片背景 | rgba(20, 20, 30, 0.8) | `bg-[#14141e]/80` |
| 表面层 | rgba(30, 30, 50, 0.6) | `bg-[#1e1e32]/60` |
| 边框发光 | rgba(0, 245, 255, 0.3) | `border-cyan-400/30` |

### 语义色

| 用途 | 色值 | Tailwind类名 |
|------|------|--------------|
| 成功 | #00ff88 | `text-emerald-400` |
| 警告 | #ffaa00 | `text-amber-400` |
| 错误 | #ff4466 | `text-red-400` |
| 信息 | #00aaff | `text-blue-400` |

---

## 视觉效果

### 霓虹发光效果

```css
/* 霓虹发光边框 */
.neon-border {
  border: 1px solid rgba(0, 245, 255, 0.3);
  box-shadow: 0 0 20px rgba(0, 245, 255, 0.1),
              inset 0 0 20px rgba(0, 245, 255, 0.05);
}

/* 霓虹发光文字 */
.neon-text {
  text-shadow: 0 0 10px currentColor,
               0 0 20px currentColor,
               0 0 40px currentColor;
}

/* 霓虹按钮 */
.neon-button {
  background: linear-gradient(135deg, #00f5ff 0%, #bf00ff 100%);
  box-shadow: 0 0 30px rgba(0, 245, 255, 0.4),
              0 0 60px rgba(191, 0, 255, 0.2);
}
```

### 玻璃拟态

```css
.glass-card {
  backdrop-filter: blur(20px);
  background: rgba(20, 20, 30, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
}
```

### 渐变背景

```css
/* 页面背景 */
.page-bg {
  background: radial-gradient(ellipse at top, #1a0a2e 0%, #0a0a0f 50%),
              radial-gradient(ellipse at bottom, #0a1a2e 0%, #0a0a0f 50%);
}

/* 动态网格背景 */
.grid-bg {
  background-image: 
    linear-gradient(rgba(0, 245, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 245, 255, 0.03) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

---

## 字体规范

| 层级 | Tailwind类名 | 字号 | 字重 | 场景 |
|------|--------------|------|------|------|
| 超大标题 | `text-5xl font-bold` | 48px | 700 | 登录页品牌 |
| 大标题 | `text-3xl font-bold` | 30px | 700 | 页面标题 |
| 中标题 | `text-xl font-semibold` | 20px | 600 | 卡片标题 |
| 正文 | `text-base` | 16px | 400 | 普通文本 |
| 小字 | `text-sm` | 14px | 400 | 辅助信息 |
| 微型 | `text-xs` | 12px | 400 | 标签、时间 |

---

## 组件规范

### 按钮样式

```tsx
// 主要按钮 - 霓虹渐变
<Button className="bg-gradient-to-r from-cyan-400 to-purple-500 text-white font-semibold rounded-full px-8 py-3 shadow-lg shadow-cyan-500/30">
  开始体验
</Button>

// 次要按钮 - 玻璃拟态
<Button className="bg-white/10 backdrop-blur-xl border border-white/20 text-white rounded-full px-8 py-3">
  了解更多
</Button>

// 图标按钮 - 发光
<Button className="bg-cyan-400/20 border border-cyan-400/40 rounded-full p-3 shadow-lg shadow-cyan-400/20">
  <Icon size={20} color="#00f5ff" />
</Button>
```

### 卡片样式

```tsx
// 玻璃拟态卡片
<View className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-5 shadow-xl">
  ...
</View>

// 发光卡片
<View className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-400/30 rounded-2xl p-4 shadow-lg shadow-cyan-500/10">
  ...
</View>
```

### 输入框样式

```tsx
// 玻璃输入框
<View className="backdrop-blur-xl bg-white/5 border border-white/20 rounded-2xl px-4 py-3">
  <Input className="w-full bg-transparent text-white placeholder:text-white/40" />
</View>
```

---

## 导航结构

### TabBar 页面（5个主Tab）

| Tab | 页面路径 | 图标 | 说明 |
|-----|----------|------|------|
| 首页 | `pages/home/index` | Sparkles | 分身入口、快捷操作 |
| 对话 | `pages/chat/index` | MessageCircle | AI对话、语音交互 |
| 学习 | `pages/learn/index` | GraduationCap | 学习路径、进度追踪 |
| 广场 | `pages/social/index` | Users | 社交广场、动态流 |
| 我的 | `pages/profile/index` | User | 个人中心、设置 |

### 页面流程

```
启动 → 登录/注册 → 首页 → 创建分身 → 对话/学习
```

---

## 核心页面设计

### 1. 登录注册页

- 全屏渐变背景 + 动态网格
- 品牌Logo + 霓虹标题
- 玻璃拟态登录卡片
- 微信一键登录 + 手机号登录

### 2. 首页

- 顶部：用户欢迎 + 学习进度环
- 中部：AI分身卡片（左右滑动）
- 底部：快捷操作入口（对话/学习/任务）

### 3. 创建分身页

- 分步引导：选择性格 → 选择能力 → 设置外观 → 命名
- 每步卡片选择器 + 进度指示
- 最终预览 + 创建按钮

### 4. 对话页

- 顶部：分身信息 + 切换按钮
- 中部：消息流（气泡式）
- 底部：输入框 + 语音按钮 + 快捷指令

### 5. 学习中心

- 学习路径可视化
- 课程卡片列表
- 学习进度统计
- 成就徽章展示

---

## 动画规范

```css
/* 淡入上移 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 霓虹脉冲 */
@keyframes neonPulse {
  0%, 100% {
    box-shadow: 0 0 20px rgba(0, 245, 255, 0.4);
  }
  50% {
    box-shadow: 0 0 40px rgba(0, 245, 255, 0.6),
                0 0 60px rgba(191, 0, 255, 0.3);
  }
}

/* 渐变流动 */
@keyframes gradientFlow {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

/* 打字指示 */
@keyframes typing {
  0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-4px); }
}
```

---

## 图标规范

使用 `lucide-react-taro` 图标库：

- **尺寸**：默认 24px，小图标 18px，大图标 32px
- **颜色**：霓虹色系（cyan-400 / purple-400 / pink-400）
- **风格**：线性图标，统一描边 2px

常用图标：
- AI分身：`Sparkles` / `Bot` / `Brain`
- 对话：`MessageCircle` / `Send` / `Mic`
- 学习：`GraduationCap` / `BookOpen` / `Trophy`
- 社交：`Users` / `Heart` / `Share2`
- 设置：`Settings` / `Bell` / `Shield`

---

## 小程序约束

- **主包体积**：≤ 2MB
- **图片优化**：使用CDN，懒加载
- **性能优化**：虚拟列表、防抖节流
- **动画优化**：CSS动画优先，避免频繁重排
