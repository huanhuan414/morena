/**
 * 获取头像风格化的类名
 * @param appearanceStyle 形象风格（real、cartoon、anime、cyberpunk等）
 * @returns CSS类名
 */
export function getAvatarStyleClass(appearanceStyle?: string): string {
  const style = appearanceStyle || 'real'
  return `avatar-style-${style}`
}

/**
 * 获取8种预定义的形象风格
 */
export const AVATAR_STYLES = [
  { value: 'real', label: '真实' },
  { value: 'cartoon', label: '卡通' },
  { value: 'anime', label: '二次元' },
  { value: 'cyberpunk', label: '赛博朋克' },
  { value: 'mysterious', label: '神秘' },
  { value: 'energetic', label: '活力' },
  { value: 'elegant', label: '优雅' },
  { value: 'cute', label: '可爱' }
]
