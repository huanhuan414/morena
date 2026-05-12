export type CanonicalPlatformKey =
  | 'wechat_mp'
  | 'wechat_moments'
  | 'wechat_channel'
  | 'douyin'
  | 'xiaohongshu'
  | 'weibo'
  | 'bilibili'
  | 'kuaishou'
  | 'zhihu'
  | 'toutiao'

export interface PlatformRequirement {
  id: string
  label: string
  placeholder: string
}

export interface PlatformMeta {
  key: CanonicalPlatformKey
  name: string
  icon: string
  color: string
  bgColor: string
  requiresBinding: boolean
  description?: string
  contentTips?: string[]
  requirements?: PlatformRequirement[]
}

export interface PlatformAppConfig {
  scheme: string
  downloadUrl: string
  tips: string
}

const ALIAS_TO_CANONICAL: Record<string, CanonicalPlatformKey> = {
  wechat: 'wechat_channel',
  wechat_channel: 'wechat_channel',
  wechat_video: 'wechat_channel',
  wechat_mp: 'wechat_mp',
  wechat_official: 'wechat_mp',
  wechat_moments: 'wechat_moments',
  douyin: 'douyin',
  xiaohongshu: 'xiaohongshu',
  xhs: 'xiaohongshu',
  weibo: 'weibo',
  bilibili: 'bilibili',
  bili: 'bilibili',
  kuaishou: 'kuaishou',
  zhihu: 'zhihu',
  toutiao: 'toutiao'
}

export const PLATFORM_META_MAP: Record<CanonicalPlatformKey, PlatformMeta> = {
  wechat_mp: {
    key: 'wechat_mp',
    name: '微信公众号',
    icon: '📧',
    color: '#07C160',
    bgColor: '#E8FFF0',
    requiresBinding: true,
    description: '发布深度文章，建立专业形象',
    contentTips: ['标题要吸引人', '封面图要高清', '排版要整洁美观', '文章要有价值输出'],
    requirements: [
      { id: 'fans', label: '粉丝量要求', placeholder: '如：500' },
      { id: 'account_type', label: '账号类型', placeholder: '订阅号/服务号' }
    ]
  },
  wechat_moments: {
    key: 'wechat_moments',
    name: '微信朋友圈',
    icon: '💬',
    color: '#07C160',
    bgColor: '#E8FFF0',
    requiresBinding: false,
    description: '分享生活点滴，增强社交互动',
    contentTips: ['朋友圈建议3-9张图', '文案要生活化、真实', '配图风格要统一', '可以适当添加表情'],
    requirements: [
      { id: 'friends', label: '好友数量', placeholder: '如：500' },
      { id: 'style', label: '风格要求', placeholder: '生活化/专业感' }
    ]
  },
  wechat_channel: {
    key: 'wechat_channel',
    name: '视频号',
    icon: '🎥',
    color: '#07C160',
    bgColor: '#E8FFF0',
    requiresBinding: false,
    requirements: [
      { id: 'fans', label: '视频号粉丝', placeholder: '如：1000' },
      { id: 'moments', label: '需发朋友圈', placeholder: '是/否' }
    ]
  },
  douyin: {
    key: 'douyin',
    name: '抖音',
    icon: '🎵',
    color: '#00F2EA',
    bgColor: '#E0FFFD',
    requiresBinding: false,
    description: '发布短视频，获取流量曝光',
    contentTips: ['视频前3秒要抓住眼球', '配文要简短有力', '添加热门音乐', '使用热门话题标签'],
    requirements: [
      { id: 'fans', label: '粉丝量要求', placeholder: '如：1000' },
      { id: 'group', label: '需开通团购', placeholder: '是/否' },
      { id: 'cert', label: '需蓝V认证', placeholder: '是/否' }
    ]
  },
  xiaohongshu: {
    key: 'xiaohongshu',
    name: '小红书',
    icon: '📕',
    color: '#FF2442',
    bgColor: '#FFF0F0',
    requiresBinding: false,
    description: '发布图文笔记，吸引年轻用户',
    contentTips: ['封面图要精美，吸引眼球', '标题要有悬念或共鸣', '正文要简洁有条理', '添加相关话题标签'],
    requirements: [
      { id: 'fans', label: '粉丝量要求', placeholder: '如：500' },
      { id: 'cert', label: '需专业号', placeholder: '是/否' }
    ]
  },
  weibo: {
    key: 'weibo',
    name: '微博',
    icon: '🌐',
    color: '#E6162D',
    bgColor: '#FFE8E8',
    requiresBinding: false,
    description: '发布短内容，扩大影响力',
    contentTips: ['配图要精美', '话题标签要相关', '文案要简洁', '可以@相关账号'],
    requirements: [
      { id: 'fans', label: '粉丝量要求', placeholder: '如：10000' },
      { id: 'cert', label: '需认证', placeholder: '是/否' }
    ]
  },
  bilibili: {
    key: 'bilibili',
    name: 'B站',
    icon: '📺',
    color: '#FB7299',
    bgColor: '#FFF0F5',
    requiresBinding: false,
    description: '发布视频内容，吸引年轻用户',
    contentTips: ['封面图要吸引人', '标题要有吸引力', '视频质量要清晰', '添加相关标签']
  },
  kuaishou: {
    key: 'kuaishou',
    name: '快手',
    icon: '📸',
    color: '#FF4906',
    bgColor: '#FFF1EB',
    requiresBinding: false,
    requirements: [
      { id: 'fans', label: '粉丝量要求', placeholder: '如：1000' },
      { id: 'shop', label: '需开通快手小店', placeholder: '是/否' }
    ]
  },
  zhihu: {
    key: 'zhihu',
    name: '知乎',
    icon: '📘',
    color: '#1677FF',
    bgColor: '#EEF5FF',
    requiresBinding: false
  },
  toutiao: {
    key: 'toutiao',
    name: '今日头条',
    icon: '📰',
    color: '#FF4D4F',
    bgColor: '#FFF1F0',
    requiresBinding: false
  }
}

export const PLATFORM_UI_ORDER: CanonicalPlatformKey[] = [
  'douyin',
  'xiaohongshu',
  'wechat_moments',
  'wechat_mp',
  'wechat_channel',
  'bilibili',
  'kuaishou',
  'zhihu',
  'toutiao'
]

export const PLATFORM_APP_CONFIG_MAP: Partial<Record<CanonicalPlatformKey, PlatformAppConfig>> = {
  xiaohongshu: {
    scheme: 'xhsdiscover://',
    downloadUrl: 'https://www.xiaohongshu.com/download',
    tips: '打开小红书APP，点击底部"+"号发布'
  },
  douyin: {
    scheme: 'snssdk1128://',
    downloadUrl: 'https://www.douyin.com/download',
    tips: '打开抖音APP，点击底部"+"号发布'
  },
  bilibili: {
    scheme: 'bilibili://',
    downloadUrl: 'https://www.bilibili.com/download',
    tips: '打开B站APP，点击"发布"创作内容'
  },
  weibo: {
    scheme: 'sinaweibo://',
    downloadUrl: 'https://weibo.com/download',
    tips: '打开微博APP，点击"+"发布'
  },
  wechat_channel: {
    scheme: '',
    downloadUrl: '',
    tips: '打开微信 → 发现 → 视频号 → 点击相机图标发布'
  },
  wechat_mp: {
    scheme: '',
    downloadUrl: 'https://mp.weixin.qq.com',
    tips: '打开微信公众平台后台，粘贴内容并完成发布'
  }
}

export const canonicalizePlatform = (platform?: string): string => {
  const key = String(platform || '').trim().toLowerCase()
  return ALIAS_TO_CANONICAL[key] || key
}

export const canonicalizePlatforms = (platforms: string[] | string = []): string[] => {
  const arr = Array.isArray(platforms) ? platforms : (typeof platforms === 'string' && platforms ? platforms.split(',').map(s => s.trim()) : [])
  const normalized = arr.map(canonicalizePlatform).filter(Boolean)
  return Array.from(new Set(normalized))
}

export const getPlatformMeta = (platform?: string): PlatformMeta | undefined => {
  const canonical = canonicalizePlatform(platform) as CanonicalPlatformKey
  return PLATFORM_META_MAP[canonical]
}

export const getPlatformAppConfig = (platform?: string): PlatformAppConfig | undefined => {
  const canonical = canonicalizePlatform(platform) as CanonicalPlatformKey
  return PLATFORM_APP_CONFIG_MAP[canonical]
}

export const getPlatformLabel = (platform?: string): string => {
  const meta = getPlatformMeta(platform)
  return meta?.name || String(platform || '未知平台')
}
