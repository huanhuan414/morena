/**
 * 分身标签体系 - 连接创建分身与订单调度
 * 
 * 三维匹配模型：
 * - 内容风格 (contentStyle): 分身创作内容的方式 → 影响商单匹配
 * - 专业领域 (niche): 分身擅长的行业 → 影响商单匹配
 * - 技能 (skills): 分身能做什么 → 影响内容类型匹配
 * 
 * 匹配权重: 技能40% + 风格30% + 领域30%
 */

// ========== 内容风格 ==========
export const CONTENT_STYLES: Array<{
  key: string
  name: string
  desc: string
  color: string
  matchOrderStyles: string[]
  matchPlatforms: string[]
  matchContentTypes: string[]
}> = [
  {
    key: 'seeding',
    name: '种草安利型',
    desc: '好物推荐/使用心得/产品测评',
    color: '#EC4899',
    // 适合的订单风格偏好
    matchOrderStyles: ['seeding', 'lifestyle'],
    // 适合的平台
    matchPlatforms: ['xiaohongshu', 'douyin'],
    // 适合的内容类型
    matchContentTypes: ['text', 'image'],
  },
  {
    key: 'professional',
    name: '专业评测型',
    desc: '深度测评/横向对比/行业分析',
    color: '#3B82F6',
    matchOrderStyles: ['professional', 'knowledge'],
    matchPlatforms: ['douyin', 'xiaohongshu', 'wechat_mp'],
    matchContentTypes: ['text', 'image', 'video'],
  },
  {
    key: 'humorous',
    name: '搞笑段子型',
    desc: '搞笑剧情/趣味挑战/吐槽整活',
    color: '#F59E0B',
    matchOrderStyles: ['humorous', 'lifestyle'],
    matchPlatforms: ['douyin'],
    matchContentTypes: ['text', 'video'],
  },
  {
    key: 'knowledge',
    name: '知识科普型',
    desc: '教程攻略/干货分享/技术解读',
    color: '#10B981',
    matchOrderStyles: ['knowledge', 'professional'],
    matchPlatforms: ['xiaohongshu', 'wechat_mp'],
    matchContentTypes: ['text', 'image'],
  },
  {
    key: 'emotional',
    name: '情感共鸣型',
    desc: '情感故事/生活感悟/暖心治愈',
    color: '#EF4444',
    matchOrderStyles: ['emotional', 'lifestyle'],
    matchPlatforms: ['wechat_moments', 'xiaohongshu'],
    matchContentTypes: ['text', 'image'],
  },
  {
    key: 'aesthetic',
    name: '文艺清新型',
    desc: '旅行摄影/生活美学/文艺分享',
    color: '#8B5CF6',
    matchOrderStyles: ['aesthetic', 'lifestyle'],
    matchPlatforms: ['xiaohongshu', 'wechat_moments'],
    matchContentTypes: ['text', 'image'],
  },
] as const

// ========== 专业领域 ==========
export const NICHE_TAGS: Array<{
  key: string
  name: string
  desc: string
  color: string
  icon: string
}> = [
  {
    key: 'beauty',
    name: '美妆护肤',
    desc: '护肤彩妆/美妆教程',
    color: '#EC4899',
    icon: '💄',
  },
  {
    key: 'tech',
    name: '数码科技',
    desc: '3C评测/科技趋势',
    color: '#3B82F6',
    icon: '📱',
  },
  {
    key: 'food',
    name: '美食探店',
    desc: '美食推荐/探店打卡',
    color: '#F59E0B',
    icon: '🍜',
  },
  {
    key: 'fashion',
    name: '时尚穿搭',
    desc: '穿搭灵感/时尚趋势',
    color: '#8B5CF6',
    icon: '👗',
  },
  {
    key: 'travel',
    name: '旅行摄影',
    desc: '旅行攻略/摄影分享',
    color: '#10B981',
    icon: '✈️',
  },
  {
    key: 'parenting',
    name: '母婴育儿',
    desc: '育儿经验/母婴好物',
    color: '#F472B6',
    icon: '👶',
  },
  {
    key: 'fitness',
    name: '健身运动',
    desc: '健身教程/运动分享',
    color: '#EF4444',
    icon: '💪',
  },
  {
    key: 'home',
    name: '家居生活',
    desc: '家居好物/生活方式',
    color: '#F97316',
    icon: '🏠',
  },
  {
    key: 'workplace',
    name: '职场成长',
    desc: '职场技能/升职加薪',
    color: '#6366F1',
    icon: '💼',
  },
  {
    key: 'psychology',
    name: '情感心理',
    desc: '心理疏导/情感建议',
    color: '#14B8A6',
    icon: '🧠',
  },
] as const

// ========== 订单偏好风格（与内容风格对应） ==========
export const ORDER_STYLE_PREFERENCES = [
  { key: 'seeding', name: '种草安利', desc: '好物推荐/使用体验', color: '#EC4899' },
  { key: 'professional', name: '专业评测', desc: '深度测评/专业解读', color: '#3B82F6' },
  { key: 'humorous', name: '搞笑趣味', desc: '轻松搞笑/趣味整活', color: '#F59E0B' },
  { key: 'knowledge', name: '知识干货', desc: '教程攻略/干货分享', color: '#10B981' },
  { key: 'emotional', name: '情感共鸣', desc: '故事叙事/暖心治愈', color: '#EF4444' },
  { key: 'aesthetic', name: '文艺美学', desc: '清新文艺/高级审美', color: '#8B5CF6' },
] as const

// ========== 订单行业领域（与专业领域对应） ==========
export const ORDER_NICHE_OPTIONS = NICHE_TAGS.map(n => ({
  key: n.key,
  name: n.name,
  icon: n.icon,
  color: n.color,
}))

// ========== 工具函数 ==========

/**
 * 计算分身与订单的匹配分数
 * @returns 0-100 的匹配度分数
 */
export function calculateMatchScore(params: {
  avatarStyles: string[]
  avatarNiches: string[]
  avatarSkills: string[]
  orderStyle?: string
  orderNiche?: string
  orderContentType?: string
}): number {
  const { avatarStyles, avatarNiches, avatarSkills, orderStyle, orderNiche, orderContentType } = params

  let score = 0
  let totalWeight = 0

  // 1. 技能匹配 (权重 40%)
  if (orderContentType) {
    totalWeight += 40
    const skillContentTypeMap: Record<string, string[]> = {
      'text': ['content_writing'],
      'image': ['image_gen', 'content_writing'],
      'video': ['video_gen', 'content_writing'],
    }
    const relevantSkills = skillContentTypeMap[orderContentType] || []
    const hasRelevantSkill = relevantSkills.some(s => avatarSkills.includes(s))
    if (hasRelevantSkill) {
      score += 40
    } else if (avatarSkills.length > 0) {
      score += 15 // 有技能但不直接相关
    }
  }

  // 2. 风格匹配 (权重 30%)
  if (orderStyle) {
    totalWeight += 30
    const styleConfig = CONTENT_STYLES.find(s => s.key === orderStyle)
    if (styleConfig) {
      // 直接匹配
      if (avatarStyles.includes(orderStyle)) {
        score += 30
      } else {
        // 间接匹配：风格有关联风格
        const hasRelated = avatarStyles.some(as_ => styleConfig.matchOrderStyles.includes(as_))
        if (hasRelated) {
          score += 18
        }
      }
    }
  }

  // 3. 领域匹配 (权重 30%)
  if (orderNiche) {
    totalWeight += 30
    if (avatarNiches.includes(orderNiche)) {
      score += 30
    } else if (avatarNiches.length > 0) {
      score += 8 // 有领域但不直接匹配
    }
  }

  // 如果订单没有指定风格/领域，给基础分
  if (totalWeight === 0) {
    return avatarSkills.length > 0 ? 60 : 30
  }

  // 归一化到 0-100
  return Math.round((score / totalWeight) * 100)
}

/**
 * 分身技能定义（与 avatar-create 页面同步）
 * skills JSON 字段格式: { content_writing: true, video_gen: true, ... }
 */
export const AVATAR_SKILL_MAP: Record<string, { label: string; icon: string; color: string }> = {
  content_writing: { label: '内容创作', icon: 'PenTool', color: '#8B5CF6' },
  video_gen: { label: '视频生成', icon: 'Film', color: '#EC4899' },
  image_gen: { label: '图片生成', icon: 'Camera', color: '#06B6D4' },
  audio_gen: { label: '音频生成', icon: 'Music', color: '#F59E0B' },
  palm_reading: { label: '看手相', icon: 'Hand', color: '#10B981' },
  style_makeover: { label: '衣品改造', icon: 'Sparkles', color: '#F43F5E' },
  music_rec: { label: '音乐推荐', icon: 'Music', color: '#6366F1' },
  data_analysis: { label: '数据分析', icon: 'TrendingUp', color: '#14B8A6' },
}

/**
 * 获取匹配度等级文案
 */
export function getMatchLevel(score: number): { label: string; color: string; desc: string } {
  if (score >= 80) return { label: '高度匹配', color: '#10B981', desc: '你的风格非常契合此订单' }
  if (score >= 60) return { label: '比较匹配', color: '#3B82F6', desc: '你的能力适合完成此订单' }
  if (score >= 40) return { label: '一般匹配', color: '#F59E0B', desc: '可以尝试接单积累经验' }
  return { label: '待提升', color: '#94A3B8', desc: '补充技能可提升匹配度' }
}
