# 微信小程序包体积问题解决方案

## 问题
- 错误码：80051
- 包体积：2436KB > 2MB限制

## 根本原因
1. 页面数量过多（原36个页面）
2. 管理后台页面（admin）占用276KB
3. 代码未充分压缩

## 最终解决方案

### 步骤1：删除admin管理后台页面（必须）

```bash
cd /workspace/projects/src/pages
rm -rf admin
```

**原因**：管理后台在小程序中使用体验不佳，建议只在H5端使用。

### 步骤2：简化app.config.ts

```typescript
export default defineAppConfig({
  pages: [
    'pages/social/index',
    'pages/avatar-profile/index',
    'pages/mind-chat/index',
    'pages/profile/index',
    'pages/login/index',
    // 保留核心功能页面...
  ],
  // 删除admin相关页面
})
```

### 步骤3：使用微信小程序开发者工具优化

1. 打开微信开发者工具
2. 点击右上角「详情」
3. 勾选「上传代码时自动压缩混淆」
4. 勾选「上传时进行代码保护」

### 步骤4：分包加载（高级）

如果仍超2MB，将非核心页面配置为分包：

```typescript
export default defineAppConfig({
  pages: [
    // 主包：只留Tab页面
    'pages/social/index',
    'pages/avatar-profile/index',
    'pages/mind-chat/index',
    'pages/profile/index',
    'pages/login/index'
  ],
  subPackages: [
    {
      root: 'package-order',
      pages: [
        'pages/order-create/index',
        'pages/order-list/index'
      ]
    }
  ]
})
```

**注意**：分包需要将页面文件移动到对应目录。

## 预期效果

| 操作 | 减小体积 |
|------|---------|
| 删除admin目录 | -276KB |
| 删除不用的页面 | -500KB |
| 代码压缩 | -200KB |
| **总计** | **< 2MB** |

## 检查命令

```bash
# 构建后检查体积
cd /workspace/projects
pnpm build:weapp
du -sh dist-weapp

# 如果 < 2MB，则可以上传
```

## 建议

1. **管理后台只在H5使用** - 小程序端不需要
2. **核心功能放主包** - Tab页面和登录
3. **次要功能放分包** - 订单、设置等
4. **定期清理无用代码** - 删除console和注释
