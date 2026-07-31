# 头像风格化应用指南

## 概述

用户选择的"形象风格"（如卡通、二次元、赛博朋克等）需要应用到所有显示头像的地方。

## 已完成的页面

1. ✅ **分身管理页面** (`/pages/avatar-manage/index.tsx`)
   - 头像列表显示
   - 应用方式：`className="avatar-img style-${avatar.appearance_style || 'real'}"`

2. ✅ **分身创建页面** (`/pages/avatar-create/index.tsx`)
   - 最后一步命名时的预览
   - 应用方式：容器使用`style-${appearanceStyle}`类名

3. ✅ **全局CSS样式** (`/styles/avatar-styles.css`)
   - 8种风格滤镜定义
   - 所有带有对应类名的元素都会自动应用

## 需要添加风格化的页面

### 1. 聊天页面 (`/pages/mind-chat/index.tsx`)

**需要修改的位置**：
- 自己的头像（消息气泡左侧）
- 分身的头像（消息气泡右侧）

**修改方式**：
```tsx
// 在头部引入工具函数
import { getAvatarStyleClass } from "@/utils/avatar-style"

// 修改头像显示
<Image
  src={message.avatar_url}
  className={`avatar-img ${getAvatarStyleClass(message.appearance_style)}`}
  mode="aspectFill"
/>
```

### 2. 分身详情页面 (`/pages/avatar-profile/index.tsx`)

**需要修改的位置**：
- 页面顶部的大头像
- 互动记录中的小头像

**修改方式**：
```tsx
<Image
  src={avatar.avatar_url}
  className={`avatar-img ${getAvatarStyleClass(avatar.appearance_style)}`}
  mode="aspectFill"
/>
```

### 3. 好友列表页面 (`/pages/avatar-friends/index.tsx`)

**需要修改的位置**：
- 每个好友的头像

**修改方式**：
```tsx
<Image
  src={friend.avatar_url}
  className={`avatar-img ${getAvatarStyleClass(friend.appearance_style)}`}
  mode="aspectFill"
/>
```

### 4. 推荐分身页面 (`/pages/avatar-recommend/index.tsx`)

**需要修改的位置**：
- 每个推荐分身的头像

**修改方式**：
```tsx
<Image
  src={avatar.avatar_url}
  className={`avatar-img ${getAvatarStyleClass(avatar.appearance_style)}`}
  mode="aspectFill"
/>
```

### 5. 社交动态页面 (`/pages/social/index.tsx`)

**需要修改的位置**：
- 发帖人的头像
- 评论中的头像

**修改方式**：
```tsx
<Image
  src={post.avatar_url}
  className={`avatar-img ${getAvatarStyleClass(post.appearance_style)}`}
  mode="aspectFill"
/>
```

## 8种风格滤镜

| 风格ID | 中文名称 | 滤镜效果 |
|--------|----------|----------|
| `real` | 真实 | 无滤镜 |
| `cartoon` | 卡通 | 对比度1.2, 饱和度1.5, 亮度1.1 |
| `anime` | 二次元 | 对比度1.3, 饱和度1.8, 亮度1.15 |
| `cyberpunk` | 赛博朋克 | 对比度1.4, 饱和度1.6, 色相旋转180°, 亮度0.9 |
| `mysterious` | 神秘 | 对比度1.2, 饱和度0.8, 亮度0.85, 复古0.2 |
| `energetic` | 活力 | 对比度1.3, 饱和度1.7, 亮度1.2 |
| `elegant` | 优雅 | 对比度1.1, 饱和度0.9, 亮度1.05, 复古0.1 |
| `cute` | 可爱 | 对比度1.15, 饱和度1.4, 亮度1.25 |

## 通用组件推荐

项目中已创建通用头像组件：`/components/avatar-avatar/index.tsx`

**使用方式**：
```tsx
import AvatarAvatar from '@/components/avatar-avatar'

<AvatarAvatar
  src={avatar.avatar_url}
  appearanceStyle={avatar.appearance_style}
  size={48}
  shape="circle"
  onClick={() => navigateToAvatarDetail(avatar.id)}
/>
```

**优点**：
- 自动应用风格化滤镜
- 支持多种形状（圆形、圆角、方形）
- 可自定义尺寸
- 处理无头像的占位符

## 快速修复脚本

如果想批量修复所有页面，可以使用以下步骤：

1. 在每个页面导入工具函数
2. 搜索所有 `avatar_url` 的使用
3. 为每个 `<Image src={...avatar_url}>` 添加类名
4. 确保数据中有 `appearance_style` 字段

## 注意事项

1. **数据完整性**：确保后端API返回的avatar对象包含`appearance_style`字段
2. **性能考虑**：滤镜效果可能影响性能，大量头像时需注意
3. **兼容性**：已添加`transition: filter 0.3s ease`，确保切换流畅
4. **默认值**：如果没有`appearance_style`，默认使用`real`风格（无滤镜）
