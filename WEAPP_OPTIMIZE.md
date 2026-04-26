# 微信小程序包体积优化指南

## 问题原因

微信小程序主包大小限制 **2MB**，当前项目构建后约 **2.5MB**，超出限制。

## 解决方案

### 方案一：删除非核心页面（推荐，快速解决）

删除以下页面目录，只保留核心功能：

```bash
# 进入pages目录
cd src/pages

# 删除以下非核心页面（保留核心9个页面）
rm -rf avatar-account-add
rm -rf avatar-account-config
rm -rf avatar-friends
rm -rf avatar-order-completed
rm -rf avatar-orders
rm -rf avatar-recommend
rm -rf earning-center
rm -rf followers
rm -rf generated-content
rm -rf notifications
rm -rf order-acceptance
rm -rf order-content-creation
rm -rf order-feedback
rm -rf order-matching
rm -rf order-processing
rm -rf order-publish-feedback
rm -rf order-stats
rm -rf pending-order
rm -rf profile
rm -rf publish-redirect
rm -rf referral-center
rm -rf skill-create
rm -rf skills-square
rm -rf skill-training
rm -rf subscription
rm -rf task
rm -rf webview
```

### 方案二：配置分包加载（推荐，保留所有功能）

在 `src/app.config.ts` 中配置分包：

```typescript
export default defineAppConfig({
  // 主包只放核心页面
  pages: [
    'pages/social/index',
    'pages/avatar-profile/index',
    'pages/mind-chat/index',
    'pages/profile/index',
    'pages/login/index'
  ],
  
  // 其他页面放分包
  subPackages: [
    {
      root: 'package-order',
      pages: [
        'pages/order-create/index',
        'pages/order-list/index',
        'pages/order-detail/index'
      ]
    },
    {
      root: 'package-avatar',
      pages: [
        'pages/avatar-create/index',
        'pages/avatar-manage/index',
        'pages/avatar-settings/index'
      ]
    }
  ]
})
```

**注意**：分包需要将对应页面文件移动到 `src/package-order/pages/` 等目录。

### 方案三：开启代码压缩（已配置）

确保 `config/index.ts` 中：
```typescript
minified: true,
uglifyFileName: true,
```

## 快速操作步骤

### 步骤1：查看当前包体积
```bash
cd /workspace/projects
pnpm build:weapp
du -sh dist-weapp
```

### 步骤2：识别大文件
```bash
# 查看最大的pages
du -h dist-weapp/pages/* | sort -hr | head -10

# 查看总体积
du -sh dist-weapp/*
```

### 步骤3：删除大页面或分包

**推荐删除的大页面**（按体积排序）：
1. `mind-chat` - 心灵聊天（200KB+）
2. `avatar-profile` - 分身档案（180KB+）
3. `social` - 社交（150KB+）
4. `order-*` - 订单相关页面（100KB+ each）

### 步骤4：更新app.config.ts

删除不用的页面路径配置。

### 步骤5：重新构建

```bash
rm -rf dist-weapp
pnpm build:weapp
```

## 目标

主包体积 < 2MB：
- 当前：~2.5MB
- 目标：< 2MB
- 需要减少：> 500KB

## 检查清单

- [ ] 删除不用的页面目录
- [ ] 更新app.config.ts
- [ ] 重新构建
- [ ] 检查dist-weapp总大小 < 2MB
- [ ] 微信小程序上传测试

## 注意事项

1. **删除页面前先备份**
2. **分包需要修改页面跳转路径**
3. **TabBar页面必须在主包**
4. **分包总大小不能超过20MB**
