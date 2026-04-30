// 社交页面图标路径 — 使用静态字符串，兼容 H5 和小程序
// H5: Vite 从 public/ 提供静态文件，/assets/social/ → public/assets/social/
// 小程序: Taro 构建时将 public/assets/ 复制到输出目录 dist/assets/
export const SOCIAL_ICONS = {
  thumbsUp: '/assets/social/thumbs-up.png',
  thumbsUpActive: '/assets/social/thumbs-up-active.png',
  messageCircle: '/assets/social/message-circle.png',
  share: '/assets/social/share.png',
}
