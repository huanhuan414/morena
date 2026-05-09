import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useEffect } from 'react'
import * as Network from '@/network'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useUserStore } from '@/stores/user'
import Taro, { navigateBack } from '@tarojs/taro'
import { Star, Check, ArrowLeft } from 'lucide-react-taro'
import './index.css'

// 技能名称中文映射
const SKILL_NAME_MAP: Record<string, string> = {
  // 短剧套件中的技能
  generate_shortdrama_script: '短剧剧本生成',
  generate_storyboard: '分镜脚本生成',
  produce_shortdrama: '短剧制作',
  generate_multi_episode_drama: '多集短剧生成',
  generate_drama_voiceover: '短剧配音生成',
  edit_shortdrama_video: '短剧视频编辑',
  generate_subtitle: '字幕生成',
  recommend_bgm: '背景音乐推荐',
  // 分身秩序
  app_assign_order: '分身秩序',
  // 自动发帖助手
  auto_post_to_home: '自动发帖助手',
  // 账号管理
  list_avatar_accounts: '账号管理',
  // 个人IP打造套件中的技能
  generate_video: '视频生成',
  // 视频相关
  generate_image: '图片生成',
  generate_text: '文本生成',
  generate_audio: '音频生成',
  generate_video_content: '视频内容生成',
  generate_video_script: '视频脚本生成',
  generate_video_shotlist: '视频分镜生成',
  produce_video: '视频制作',
  generate_video_clips: '视频片段生成',
  generate_video_voiceover: '视频配音生成',
  recommend_video_music: '视频音乐推荐',
  edit_video: '视频编辑',
  optimize_video: '视频优化',
  // 社交媒体相关
  social_media_publish: '社交媒体发布',
  schedule_post: '定时发布',
  analyze_performance: '性能分析',
  generate_social_content: '社交内容生成',
  create_custom_effect: '自定义特效创建',
  generate_thumbnail: '缩略图生成',
  optimize_for_tiktok: 'TikTok 优化',
  create_video_series: '视频系列创建',
  // 音频相关
  generate_voiceover: '配音生成',
  create_avatar_voice: '分身声音创建',
  speech_to_text: '语音转文字',
  text_to_speech: '文字转语音',
  voice_cloning: '声音克隆',
  accent_conversion: '口音转换',
  voice_enhancement: '声音增强',
  voice_style_transfer: '声音风格迁移',
  // 分身相关
  create_avatar: '创建分身',
  customize_avatar: '自定义分身',
  avatar_animation: '分身动画',
  avatar_voice_binding: '分身声音绑定',
  avatar_scene_interaction: '分身场景交互',
  create_virtual_background: '虚拟背景创建',
  // 内容规划
  content_scheduling: '内容排期',
  content_planning: '内容规划',
  content_analysis: '内容分析',
  trend_analysis: '趋势分析',
  audience_analysis: '受众分析',
  performance_optimization: '性能优化',
  // 短视频相关
  create_reel: '短视频制作',
  edit_reel: '短视频编辑',
  optimize_reel: '短视频优化',
  generate_reel_ideas: '短视频创意生成',
  create_shorts: 'Shorts 制作',
  optimize_shorts: 'Shorts 优化',
  generate_shorts_ideas: 'Shorts 创意生成',
  create_tiktok_content: 'TikTok 内容制作',
  optimize_tiktok_content: 'TikTok 内容优化',
  generate_tiktok_ideas: 'TikTok 创意生成',
  create_youtube_shorts: 'YouTube Shorts 制作',
  optimize_youtube_shorts: 'YouTube Shorts 优化',
  generate_youtube_ideas: 'YouTube 创意生成',
  create_instagram_reels: 'Instagram Reels 制作',
  optimize_instagram_reels: 'Instagram Reels 优化',
  generate_instagram_ideas: 'Instagram 创意生成'
}

// 获取技能中文名称
const getSkillDisplayName = (name: string, toolName: string): string => {
  // 如果有映射，使用映射的中文名称
  if (SKILL_NAME_MAP[toolName]) {
    return SKILL_NAME_MAP[toolName]
  }

  // 如果是短剧套件中的技能，直接映射
  if (SHORT_DRAMA_KIT.skills.includes(toolName as any)) {
    return SKILL_NAME_MAP[toolName] || name
  }

  // 否则返回原始名称
  return name
}

// 短剧创作套件配置
const SHORT_DRAMA_KIT: {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  skills: string[];
  tags: string[];
  rating: number;
  purchase_count: number;
} = {
  id: 'short_drama_kit',
  name: '短剧创作套件',
  description: '一键获取短剧创作全流程技能，从剧本到成品一站式解决',
  icon: '🎬',
  category: '短剧',
  skills: [
    'generate_shortdrama_script',      // 生成短剧剧本
    'generate_storyboard',             // 生成分镜脚本
    'produce_shortdrama',              // 制作短剧
    'generate_multi_episode_drama',     // 生成多集短剧
    'generate_drama_voiceover',         // 生成短剧配音
    'edit_shortdrama_video',            // 编辑短剧视频
    'generate_subtitle',                // 生成字幕
    'recommend_bgm'                     // 推荐背景音乐
  ],
  tags: ['短剧', '视频', '全流程'],
  rating: 5.0,
  purchase_count: 999
}

// 分身秩序技能配置
const AGENT_ORDER_SKILL = {
  id: 'agent_order',
  name: '分身秩序',
  description: '智能编排分身协作流程，一键生成短剧成品。分身自动协作完成剧本创作、分镜设计、视频制作、配音、字幕等全流程',
  icon: '🤖',
  category: '短剧',
  tool_name: 'app_assign_order',
  tags: ['协作', '短剧', '自动化'],
  rating: 4.9,
  purchase_count: 500
}

/*
// 个人IP打造技能配置（已隐藏）
const PERSONAL_IP_KIT: {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  skills: string[];
  tags: string[];
  rating: number;
  purchase_count: number;
} = {
  id: 'personal_ip_kit',
  name: '个人IP打造',
  description: '一键打造个人IP，支持上传自定义图片或使用分身头像生成爆款口播视频，自动添加字幕和背景音乐',
  icon: '🌟',
  category: '个人IP',
  skills: [
    'generate_video',         // 生成视频（支持上传图片或使用分身头像）
    'generate_subtitle',      // 生成字幕
    'recommend_bgm'           // 推荐背景音乐
  ],
  tags: ['个人IP', '口播', '爆款视频', '自定义图片'],
  rating: 5.0,
  purchase_count: 666
}
*/

// 自动发帖助手技能配置
const AUTO_POST_SKILL = {
  id: 'auto_post_to_home',
  name: '自动发帖助手',
  description: '让分身自动在首页发布动态帖子。系统会根据分身的等级、订阅情况智能分配发帖配额，支持纯文字、图文、视频多种格式。等级越高、订阅越好，发帖权限越大。',
  icon: '📝',
  category: '内容创作',
  tool_name: 'auto_post_to_home',
  tags: ['自动发帖', '内容创作', '社交', '首页'],
  rating: 4.8,
  purchase_count: 256,
  // 权限配置
  requirements: {
    minLevel: 1,
    needHosting: true,
    quotaRules: {
      free: { textOnly: 1, imageText: 0, video: 0, desc: '免费版：每天1条纯文字' },
      basic: { textOnly: 2, imageText: 1, video: 0, desc: '基础版：每天2条文字+1条图文' },
      premium: { textOnly: 3, imageText: 3, video: 2, desc: '尊享版：每天3条文字+3条图文+每月2条视频' }
    },
    levelBonus: '每升1级增加1条图文配额'
  }
}

// 根据 tool_name 或 icon_url 获取图标
const getSkillIcon = (toolName?: string, iconUrl?: string): string => {
  // 如果有 icon_url 且是 emoji，直接返回
  if (iconUrl && iconUrl.length <= 4 && /^[\u4e00-\u9fa5a-zA-Z0-9]+$/.test(iconUrl)) {
    return iconUrl
  }
  // 如果 icon_url 是 URL，使用默认图标
  if (iconUrl && iconUrl.startsWith('http')) {
    // 从 URL 中尝试提取可能的图标
    const iconMap: Record<string, string> = {
      'marketing': '📱',
      'content': '📝',
      'video': '🎬',
      'growth': '💰',
      'service': '💬',
      'social': '🐦',
      'knowledge': '💡',
      'community': '👥',
    }
    const urlLower = iconUrl.toLowerCase()
    for (const [key, icon] of Object.entries(iconMap)) {
      if (urlLower.includes(key)) return icon
    }
  }
  
  const iconMap: Record<string, string> = {
    'wechat_marketing': '📱',
    'xiaohongshu_note': '📔',
    'short_video_script': '🎬',
    'private_traffic': '💰',
    'customer_service': '💬',
    'moments_copywriting': '✍️',
    'douyin_script': '🎥',
    'weibo_post': '🐦',
    'zhihu_answer': '💡',
    'write_wechat_mp_article': '📰',
    'food_review_reply': '🍜',
    'community_chat': '👥',
    'auto_post_to_home': '📝',
    'generate_shortdrama_script': '📝',
    'generate_storyboard': '🎬',
    'produce_shortdrama': '🎥',
    'generate_multi_episode_drama': '📺',
    'generate_drama_voiceover': '🎙️',
    'edit_shortdrama_video': '✂️',
    'generate_subtitle': '💬',
    'recommend_bgm': '🎵',
    'list_avatar_accounts': '🔗',
    'write_article': '✍️',
    'write_wechat_mp_article': '📰',
    'generate_image': '🖼️',
    'generate_video': '🎬',
    'publish_wechat_mp': '💬',
    'publish_xiaohongshu': '📱',
    'publish_bilibili': '📺',
    'publish_weibo': '🌐',
    'publish_douyin': '🎵',
    'publish_wechat_video': '📱',
    'default': '🎯'
  }
  return iconMap[toolName || ''] || iconMap['default']
}

// 🔴 过滤技能 - 宽松模式，所有技能都显示
const filterSkills = (skills: Skill[]): Skill[] => {
  // 移除严格的过滤逻辑，显示所有技能
  return skills.filter(skill => {
    // 只要有 id 和 name 就显示
    return skill.id && skill.name
  })
}

interface Skill {
  id: string
  name: string
  description: string
  category: string
  price: number
  icon: string
  tags: string[]
  rating: number
  rating_count: number
  purchase_count: number
  requirements?: string
  status: string
  tool_name?: string
}

interface Avatar {
  id: string
  name: string
  avatar_url?: string
}

export default function SkillsSquare() {
  const { userInfo, avatarId, setAvatarId } = useUserStore()
  const [skills, setSkills] = useState<Skill[]>([])
  const [currentAvatar, setCurrentAvatar] = useState<Avatar | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [mySkills, setMySkills] = useState<string[]>([])
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [showKitDialog, setShowKitDialog] = useState(false)
  const [showOrderDialog, setShowOrderDialog] = useState(false)
  const [showAutoPostDialog, setShowAutoPostDialog] = useState(false)

  // 打印环境信息
  useEffect(() => {
    console.log('[SkillSquare] 环境信息')
  }, [])

  // 获取分身列表
  const fetchAvatars = async () => {
    if (!userInfo?.id) return

    try {
      const res = await Network.request({
        url: '/api/avatar/my',
        method: 'GET'
      })

      if (res.data?.code === 200) {
        const avatarList = res.data.data || []

        // 从 URL 参数中获取 avatarId
        const router = Taro.getCurrentInstance().router
        const urlAvatarId = router?.params?.avatarId as string
        const targetAvatarId = urlAvatarId || avatarId

        console.log('[SkillSquare] fetchAvatars - targetAvatarId:', targetAvatarId)
        console.log('[SkillSquare] fetchAvatars - urlAvatarId:', urlAvatarId)
        console.log('[SkillSquare] fetchAvatars - store avatarId:', avatarId)

        if (targetAvatarId) {
          const current = avatarList.find((a: Avatar) => a.id === targetAvatarId)
          if (current) {
            setCurrentAvatar(current)
            console.log('[SkillSquare] 找到匹配的分身:', current.name)
          } else {
            console.warn('[SkillSquare] 未找到匹配的分身，ID:', targetAvatarId)
          }
        } else if (avatarList.length > 0) {
          const firstAvatar = avatarList[0]
          setCurrentAvatar(firstAvatar)
          setAvatarId?.(firstAvatar.id)
          console.log('[SkillSquare] 使用第一个分身:', firstAvatar.name)
        }
      }
    } catch (error) {
      console.error('[SkillSquare] 获取分身列表失败:', error)
    }
  }

  // 获取技能列表
  const fetchSkills = async () => {
    try {
      setLoading(true)

      console.log('[SkillSquare] 开始获取技能列表，搜索关键词:', searchKeyword)

      // 构建请求参数，只传递有值的参数
      const params: any = {
        pageSize: 100,
        _t: Date.now()
      }
      if (searchKeyword && searchKeyword.trim()) {
        params.search = searchKeyword.trim()
      }

      // 使用 Network.request 发送请求
      const res = await Network.request({
        url: '/api/skills',
        method: 'GET',
        data: params
      })

      console.log('[SkillSquare] 完整响应:', res)
      console.log('[SkillSquare] res.data:', res.data)
      console.log('[SkillSquare] res.statusCode:', res.statusCode)

      // 支持两种格式：res.data.data.skills 或 res.data.data (直接数组)
      let skillsList: any[] = []
      if (res.statusCode === 200) {
        if (res.data?.data?.skills && Array.isArray(res.data.data.skills)) {
          // 旧格式：{skills: [...]}
          skillsList = res.data.data.skills
        } else if (Array.isArray(res.data?.data)) {
          // 新格式：直接是数组
          skillsList = res.data.data
        }
        setSkills(skillsList)
        console.log('[SkillSquare] 技能列表长度:', skillsList.length)
      } else {
        console.log('[SkillSquare] 请求失败')
        setSkills([])
      }
    } catch (error) {
      console.error('[SkillSquare] 获取技能列表失败:', error)
      Taro.showToast({ title: '获取技能列表失败', icon: 'none' })
      setSkills([])
    } finally {
      setLoading(false)
    }
  }

  // 获取我的技能
  const fetchMySkills = async () => {
    console.log('[SkillSquare] fetchMySkills - currentAvatar:', currentAvatar)
    console.log('[SkillSquare] fetchMySkills - currentAvatar.id:', currentAvatar?.id)

    if (!currentAvatar?.id) {
      console.warn('[SkillSquare] currentAvatar.id 为空，跳过获取分身技能')
      return
    }

    try {
      console.log('[SkillSquare] 开始获取分身技能，分身ID:', currentAvatar.id)
      const res = await Network.request({
        url: `/api/skills/avatar/${currentAvatar.id}`,
        method: 'GET'
      })

      console.log('[SkillSquare] 分身技能响应:', res)
      console.log('[SkillSquare] 分身技能数据:', res.data?.data)

      if (res.data?.code === 200) {
        const mySkillsList = res.data.data || []
        console.log('[SkillSquare] 技能列表数组长度:', mySkillsList.length)
        console.log('[SkillSquare] 技能列表数组:', mySkillsList)

        // 提取技能ID，优先使用后端返回的 skillId 字段
        const skillIds = mySkillsList.map((s: any) => {
          // 优先使用后端返回的 skillId
          if (s.skillId) return s.skillId
          // 其次尝试其他可能的字段名
          if (s.skill_id) return s.skill_id
          if (s.metadata?.skill_id) return s.metadata.skill_id
          // 最后尝试 id（不推荐，但作为兜底）
          if (s.id) return s.id
          return s
        })
        console.log('[SkillSquare] 提取的技能ID列表:', skillIds)

        // 打印每个技能的详细信息
        console.log('[SkillSquare] ========== 分身已拥有的技能详情 ==========')
        mySkillsList.forEach((skill: any, index: number) => {
          const skillInfo = {
            序号: index + 1,
            ID: skill.id || skill.skillId || skill.skill_id,
            skillId: skill.skillId,
            skill_type: skill.skill_type,
            名称: skill.name || skill.skill?.name,
            metadata: skill.metadata,
            完整对象: skill
          }
          console.log(`[SkillSquare] 技能${index + 1}:`, skillInfo)
        })
        console.log('[SkillSquare] ===========================================')

        setMySkills(skillIds)
      }
    } catch (error) {
      console.error('[SkillSquare] 获取我的技能失败:', error)
    }
  }

  // 检查是否已拥有
  const isOwned = (skillId: string) => {
    const result = mySkills.includes(skillId)
    console.log('[SkillSquare] 检查技能是否已拥有:', {
      skillId,
      mySkills,
      result,
      mySkillsLength: mySkills.length
    })
    return result
  }

  // 购买技能
  const handlePurchase = async () => {
    if (!selectedSkill || !currentAvatar?.id) return

    // 防止重复点击
    if (purchasing) {
      console.warn('[SkillSquare] 正在处理中，请勿重复点击')
      return
    }

    try {
      setPurchasing(true)
      console.log('[SkillSquare] 开始添加技能:', {
        skillId: selectedSkill.id,
        skillName: selectedSkill.name,
        avatarId: currentAvatar.id
      })

      const res = await Network.request({
        url: '/api/skills/purchase',
        method: 'POST',
        data: {
          skillId: selectedSkill.id,
          avatarId: currentAvatar.id
        }
      })

      console.log('[SkillSquare] 添加技能响应:', res)

      if (res.data?.code === 200) {
        Taro.showToast({ title: '添加成功', icon: 'success' })
        setShowPurchaseDialog(false)
        setSelectedSkill(null)
        fetchMySkills()
      } else {
        Taro.showToast({ title: res.data?.message || '添加失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[SkillSquare] 添加技能失败:', error)
      Taro.showToast({ title: '添加失败', icon: 'none' })
    } finally {
      setPurchasing(false)
    }
  }

  // 添加自动发帖助手技能
  const handlePurchaseAutoPost = async () => {
    if (!currentAvatar?.id) {
      Taro.showToast({ title: '请先选择分身', icon: 'none' })
      return
    }

    try {
      setPurchasing(true)
      console.log('[SkillSquare] 开始添加自动发帖助手:', {
        toolName: AUTO_POST_SKILL.tool_name,
        avatarId: currentAvatar.id
      })

      // 通过 tool_name 添加技能
      const res = await Network.request({
        url: '/api/skills/purchase-by-tool-name',
        method: 'POST',
        data: {
          toolName: AUTO_POST_SKILL.tool_name,
          avatarId: currentAvatar.id
        }
      })

      console.log('[SkillSquare] 添加自动发帖助手响应:', res)

      if (res.data?.code === 200) {
        Taro.showToast({
          title: '添加成功！请前往分身托管设置开启自动发帖',
          icon: 'success'
        })
        setShowAutoPostDialog(false)
        fetchMySkills()
      } else {
        Taro.showToast({ title: res.data?.message || '添加失败', icon: 'none' })
      }
    } catch (error: any) {
      console.error('[SkillSquare] 添加自动发帖助手失败:', error)
      Taro.showToast({ title: '添加失败: ' + (error.message || '未知错误'), icon: 'none' })
    } finally {
      setPurchasing(false)
    }
  }

  // 一键添加短剧套件
  const handleAddDramaKit = async () => {
    if (!currentAvatar?.id) {
      Taro.showToast({ title: '请先选择分身', icon: 'none' })
      return
    }

    try {
      setPurchasing(true)
      console.log('[SkillSquare] 开始添加短剧套件:', {
        skills: SHORT_DRAMA_KIT.skills,
        avatarId: currentAvatar.id
      })

      // 批量添加技能
      const results = await Promise.all(
        SHORT_DRAMA_KIT.skills.map(toolName =>
          Network.request({
            url: '/api/skills/purchase-by-tool-name',
            method: 'POST',
            data: {
              toolName,
              avatarId: currentAvatar.id
            }
          })
        )
      )

      console.log('[SkillSquare] 短剧套件添加结果:', results)

      const successCount = results.filter(r => r.data?.code === 200).length
      const totalCount = results.length

      if (successCount === totalCount) {
        Taro.showToast({
          title: `短剧套件添加成功！已添加 ${totalCount} 个技能`,
          icon: 'success'
        })
      } else if (successCount > 0) {
        Taro.showToast({
          title: `部分添加成功（${successCount}/${totalCount}）`,
          icon: 'none'
        })
      } else {
        Taro.showToast({ title: '添加失败，请重试', icon: 'none' })
      }

      setShowKitDialog(false)
      fetchMySkills()
    } catch (error: any) {
      console.error('[SkillSquare] 添加短剧套件失败:', error)
      Taro.showToast({ title: '添加失败: ' + (error.message || '未知错误'), icon: 'none' })
    } finally {
      setPurchasing(false)
    }
  }

  // 一键生成分身秩序
  const handleGenerateAgentOrder = async () => {
    if (!currentAvatar?.id) {
      Taro.showToast({ title: '请先选择分身', icon: 'none' })
      return
    }

    try {
      setPurchasing(true)
      console.log('[SkillSquare] 开始生成分身秩序:', {
        avatarId: currentAvatar.id
      })

      const res = await Network.request({
        url: '/api/skills/purchase-by-tool-name',
        method: 'POST',
        data: {
          toolName: AGENT_ORDER_SKILL.tool_name,
          avatarId: currentAvatar.id
        }
      })

      console.log('[SkillSquare] 分身秩序添加结果:', res)

      if (res.data?.code === 200) {
        Taro.showToast({ title: '分身秩序添加成功！', icon: 'success' })
        setShowOrderDialog(false)
        fetchMySkills()

        // 跳转到聊天页面
        setTimeout(() => {
          Taro.navigateTo({
            url: '/pages/mind-chat/index'
          })
        }, 1500)
      } else {
        Taro.showToast({ title: res.data?.message || '添加失败', icon: 'none' })
      }
    } catch (error: any) {
      console.error('[SkillSquare] 添加分身秩序失败:', error)
      Taro.showToast({ title: '添加失败: ' + (error.message || '未知错误'), icon: 'none' })
    } finally {
      setPurchasing(false)
    }
  }

  // 移除技能
  const handleRemoveSkill = async (skillId: string, skillName: string) => {
    if (!currentAvatar?.id) return

    try {
      const result = await Taro.showModal({
        title: '确认移除',
        content: `确定要移除"${skillName}"技能吗？移除后分身将无法使用该技能。`
      })

      if (!result.confirm) return

      console.log('[SkillSquare] 开始移除技能:', {
        skillId,
        skillName,
        avatarId: currentAvatar.id
      })

      const res = await Network.request({
        url: '/api/skills/remove',
        method: 'DELETE',
        data: {
          skillId,
          avatarId: currentAvatar.id
        }
      })

      console.log('[SkillSquare] 移除技能响应:', res)

      if (res.data?.code === 200) {
        Taro.showToast({ title: '移除成功', icon: 'success' })
        fetchMySkills()
      } else {
        const errorMessage = res.data?.message || '移除失败'
        // 如果错误提示技能不存在，则认为技能已经被移除，刷新列表
        if (errorMessage.includes('未找到该技能') || errorMessage.includes('可能已经移除')) {
          console.log('[SkillSquare] 技能不存在，可能已经移除，刷新列表')
          Taro.showToast({ title: '技能已移除', icon: 'success' })
          fetchMySkills()
        } else {
          Taro.showToast({ title: errorMessage, icon: 'none' })
        }
      }
    } catch (error: any) {
      console.error('[SkillSquare] 移除技能失败:', error)
      const errorMessage = error?.message || '移除失败'
      // 如果错误提示技能不存在，则认为技能已经被移除，刷新列表
      if (errorMessage.includes('未找到该技能') || errorMessage.includes('可能已经移除')) {
        console.log('[SkillSquare] 技能不存在，可能已经移除，刷新列表')
        Taro.showToast({ title: '技能已移除', icon: 'success' })
        fetchMySkills()
      } else {
        Taro.showToast({ title: errorMessage, icon: 'none' })
      }
    }
  }

  // 搜索
  const handleSearch = () => {
    fetchSkills()
  }

  useEffect(() => {
    // 从 URL 参数中获取 avatarId
    const router = Taro.getCurrentInstance().router
    const urlAvatarId = router?.params?.avatarId as string

    console.log('[SkillSquare] URL 参数 avatarId:', urlAvatarId)

    // 如果 URL 参数中有 avatarId，更新 store
    if (urlAvatarId && setAvatarId) {
      setAvatarId(urlAvatarId)
      console.log('[SkillSquare] 更新 store 中的 avatarId:', urlAvatarId)
    }

    fetchAvatars()
    fetchSkills()
  }, [])

  useEffect(() => {
    if (currentAvatar?.id) {
      fetchMySkills()
    }
  }, [currentAvatar?.id])

  // 追踪 skills 状态变化
  useEffect(() => {
    console.log('[SkillSquare] skills 状态变化，长度:', skills.length)
    if (skills.length > 0) {
      console.log('[SkillSquare] 所有技能列表:')
      skills.forEach((skill, index) => {
        console.log(`[SkillSquare]   技能${index + 1}:`, {
          id: skill.id,
          name: skill.name,
          category: skill.category
        })
      })
    }
  }, [skills])

  // 追踪 mySkills 状态变化
  useEffect(() => {
    console.log('[SkillSquare] mySkills 状态变化:', mySkills)
    console.log('[SkillSquare] mySkills 长度:', mySkills.length)
  }, [mySkills])

  return (
    <View className="skills-square-container">
      {/* 头部 - 适配状态栏 */}
      <View className="skills-header">
        <View className="back-button" onClick={() => navigateBack()}>
          <ArrowLeft size={24} color="#1f2937" />
        </View>
        <Text className="header-title">技能广场</Text>
        {currentAvatar && (
          <View className="avatar-selector">
            <Text className="avatar-name">{currentAvatar.name}</Text>
            <Text className="avatar-count">{mySkills.length} 个技能</Text>
          </View>
        )}
      </View>

      {/* 搜索框 */}
      <View className="search-container">
        <Input
          className="search-input"
          placeholder="搜索技能名称"
          value={searchKeyword}
          onInput={(e) => setSearchKeyword(e.detail.value)}
          onConfirm={handleSearch}
        />
        {searchKeyword && (
          <Button className="search-btn" onClick={handleSearch}>
            搜索
          </Button>
        )}
      </View>

      {/* 训练技能入口 */}
      <View
        className="skill-training-entry"
        onClick={() => Taro.navigateTo({ url: '/pages/skill-training/index' })}
      >
        <View className="training-icon">🎯</View>
        <View className="training-content">
          <Text className="training-title">训练专属技能</Text>
          <Text className="training-desc">输入你的经验和技巧，AI生成独特技能</Text>
        </View>
        <View className="training-arrow">→</View>
      </View>

      {/* 快捷分类标签 */}
      <View className="quick-tags">
        <View
          className={`tag-item ${!searchKeyword ? 'active' : ''}`}
          onClick={() => {
            setSearchKeyword('')
            fetchSkills()
          }}
        >
          <Text>全部</Text>
        </View>
        <View
          className={`tag-item ${searchKeyword === '短剧' ? 'active' : ''}`}
          onClick={() => {
            setSearchKeyword('短剧')
            handleSearch()
          }}
        >
          <Text>🎬 短剧</Text>
        </View>
        <View
          className={`tag-item ${searchKeyword === '视频' ? 'active' : ''}`}
          onClick={() => {
            setSearchKeyword('视频')
            handleSearch()
          }}
        >
          <Text>🎥 视频</Text>
        </View>
        <View
          className={`tag-item ${searchKeyword === '写作' ? 'active' : ''}`}
          onClick={() => {
            setSearchKeyword('写作')
            handleSearch()
          }}
        >
          <Text>✍️ 写作</Text>
        </View>
        <View
          className={`tag-item ${searchKeyword === '发布' ? 'active' : ''}`}
          onClick={() => {
            setSearchKeyword('发布')
            handleSearch()
          }}
        >
          <Text>📤 发布</Text>
        </View>
      </View>

      {/* 短剧创作套件和分身秩序（已隐藏） */}
      {false && !searchKeyword && (
        <View className="special-cards">
          {/* 短剧创作套件 - 已隐藏 */}
          {/* 分身秩序 - 已隐藏 */}
          {/* 个人IP打造 - 已隐藏 */}
        </View>
      )}

      {/* 技能列表 */}
      <ScrollView className="skills-scroll" scrollY>
        {loading ? (
          <View className="loading-container">
            <Text>加载中...</Text>
          </View>
        ) : !currentAvatar ? (
          <View className="empty-container">
            <Text>请先创建分身</Text>
            <Button onClick={() => Taro.navigateTo({ url: '/pages/avatar/avatar-create/index' })}>
              创建分身
            </Button>
          </View>
        ) : skills.length === 0 ? (
          <View className="empty-container">
            <Text>暂无技能</Text>
          </View>
        ) : (
          <View className="skills-grid">
            {/* 掌相阅读 */}
            {!searchKeyword && (
              <View
                className="skill-card-vertical"
                onClick={() => Taro.navigateTo({ url: '/pages/palm-reading/index' })}
              >
                <View className="vertical-icon-area purple">
                  <Text className="vertical-icon">✋</Text>
                </View>
                <View className="vertical-content">
                  <Text className="vertical-name">掌相阅读</Text>
                  <Text className="vertical-desc">上传手掌图片，AI智能生成掌相阅读指南</Text>
                </View>
                <View className="vertical-bottom">
                  <View className="vertical-stats">
                    <Star size={12} color="#f59e0b" />
                    <Text className="vertical-stat-val">5.0</Text>
                  </View>
                  <View className="vertical-btn purple-btn">
                    <Text className="vertical-btn-text">体验</Text>
                  </View>
                </View>
              </View>
            )}

            {/* 始终对发布相关技能进行过滤，只保留公众号发布技能 */}
            {filterSkills(skills).map((skill) => {
              const owned = isOwned(skill.id)
              const displayName = getSkillDisplayName(skill.name, skill.tool_name || '')
              console.log('[SkillSquare] 渲染技能卡片:', {
                技能ID: skill.id,
                技能名称: skill.name,
                显示名称: displayName,
                是否已添加: owned,
                已添加技能列表: mySkills
              })
              return (
                <View
                  key={skill.id}
                  className={`skill-card-vertical ${owned ? 'owned' : ''}`}
                  onClick={() => {
                    if (owned) {
                      handleRemoveSkill(skill.id, skill.name)
                      return
                    }
                    setSelectedSkill(skill)
                    if (skill.tool_name === 'auto_post_to_home') {
                      setShowAutoPostDialog(true)
                    } else {
                      setShowPurchaseDialog(true)
                    }
                  }}
                >
                  <View className="vertical-icon-area">
                    <Text className="vertical-icon">{getSkillIcon(skill.tool_name, skill.icon_url)}</Text>
                    {owned && (
                      <View className="vertical-owned-badge">
                        <Check size={10} color="#fff" />
                      </View>
                    )}
                  </View>
                  <View className="vertical-content">
                    <Text className="vertical-name">{displayName}</Text>
                    <Text className="vertical-desc">{skill.description}</Text>
                  </View>
                  <View className="vertical-bottom">
                    <View className="vertical-stats">
                      <Star size={12} color="#f59e0b" />
                      <Text className="vertical-stat-val">{skill.rating}</Text>
                    </View>
                    {owned ? (
                      <View className="vertical-btn owned">
                        <Text className="vertical-btn-text owned">已添加</Text>
                      </View>
                    ) : (
                      <View className="vertical-btn">
                        <Text className="vertical-btn-text">添加</Text>
                      </View>
                    )}
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>

      {/* 购买弹窗 */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent style={{
          width: 'calc(100vw - 64px)',
          maxWidth: '600px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        >
          <DialogHeader style={{ flexShrink: 0, padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#ffffff' }}>
            <DialogTitle>添加技能</DialogTitle>
          </DialogHeader>
          <View style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', maxHeight: 'calc(80vh - 140px)' }}>
            {selectedSkill && (
              <View className="dialog-content">
                <View className="skill-preview">
                  <Text className="preview-icon">{getSkillIcon(selectedSkill.tool_name, selectedSkill.icon_url)}</Text>
                  <View className="preview-info">
                    <Text className="preview-name">{selectedSkill.name}</Text>
                    <Text className="preview-desc">{selectedSkill.description}</Text>
                  </View>
                </View>
                <View className="target-avatar">
                  <Text className="target-label">目标分身</Text>
                  <Text className="target-name">{currentAvatar?.name}</Text>
                </View>
              </View>
            )}
          </View>
          <DialogFooter style={{ flexShrink: 0, padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <Button variant="outline" onClick={() => setShowPurchaseDialog(false)}>
              <Text>取消</Text>
            </Button>
            <Button onClick={handlePurchase} disabled={purchasing}>
              <Text>{purchasing ? '添加中...' : '确认添加'}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 短剧套件弹窗 */}
      <Dialog open={showKitDialog} onOpenChange={setShowKitDialog}>
        <DialogContent style={{
          width: 'calc(100vw - 64px)',
          maxWidth: '600px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        >
          <DialogHeader style={{ flexShrink: 0, padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#ffffff' }}>
            <DialogTitle>短剧创作套件</DialogTitle>
          </DialogHeader>
          <View style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', maxHeight: 'calc(80vh - 140px)' }}>
            <View className="dialog-content">
              <View className="kit-preview">
                <Text className="kit-icon">{SHORT_DRAMA_KIT.icon}</Text>
                <View className="kit-info">
                  <Text className="kit-name">{SHORT_DRAMA_KIT.name}</Text>
                  <Text className="kit-desc">{SHORT_DRAMA_KIT.description}</Text>
                </View>
              </View>
              <View className="kit-skills-list">
                <Text className="kit-skills-title">包含技能：</Text>
                {SHORT_DRAMA_KIT.skills.map((skill: string, idx: number) => (
                  <View key={idx} className="kit-skill-item">
                    <Text className="kit-skill-icon">✓</Text>
                    <Text className="kit-skill-text">{getSkillDisplayName('', skill)}</Text>
                  </View>
                ))}
              </View>
              <View className="target-avatar">
                <Text className="target-label">目标分身</Text>
                <Text className="target-name">{currentAvatar?.name}</Text>
              </View>
            </View>
          </View>
          <DialogFooter style={{ flexShrink: 0, padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <Button variant="outline" onClick={() => setShowKitDialog(false)}>
              <Text>取消</Text>
            </Button>
            <Button onClick={handleAddDramaKit} disabled={purchasing}>
              <Text>{purchasing ? '添加中...' : `一键添加 ${SHORT_DRAMA_KIT.skills.length} 个技能`}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 分身秩序弹窗 */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent style={{
          width: 'calc(100vw - 64px)',
          maxWidth: '600px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        >
          <DialogHeader style={{ flexShrink: 0, padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#ffffff' }}>
            <DialogTitle>分身秩序</DialogTitle>
          </DialogHeader>
          <View style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', maxHeight: 'calc(80vh - 140px)' }}>
            <View className="dialog-content">
              <View className="order-preview">
                <Text className="order-icon">{AGENT_ORDER_SKILL.icon}</Text>
                <View className="order-info">
                  <Text className="order-name">{AGENT_ORDER_SKILL.name}</Text>
                  <Text className="order-desc">{AGENT_ORDER_SKILL.description}</Text>
                </View>
              </View>
              <View className="order-features">
                <Text className="order-features-title">核心功能：</Text>
                <View className="order-feature-item">
                  <Text className="order-feature-icon">🎯</Text>
                  <Text className="order-feature-text">智能分析需求</Text>
                </View>
                <View className="order-feature-item">
                  <Text className="order-feature-icon">🎬</Text>
                  <Text className="order-feature-text">自动编排流程</Text>
                </View>
                <View className="order-feature-item">
                  <Text className="order-feature-icon">🤖</Text>
                  <Text className="order-feature-text">分身协作执行</Text>
                </View>
                <View className="order-feature-item">
                  <Text className="order-feature-icon">✨</Text>
                  <Text className="order-feature-text">一键生成成品</Text>
                </View>
              </View>
              <View className="order-tip">
                <Text className="order-tip-text">💡 添加后，在分身聊天中发送&quot;生成短剧&quot;即可一键完成短剧创作</Text>
              </View>
              <View className="target-avatar">
                <Text className="target-label">目标分身</Text>
                <Text className="target-name">{currentAvatar?.name}</Text>
              </View>
            </View>
          </View>
          <DialogFooter style={{ flexShrink: 0, padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <Button variant="outline" onClick={() => setShowOrderDialog(false)}>
              <Text>取消</Text>
            </Button>
            <Button onClick={handleGenerateAgentOrder} disabled={purchasing}>
              <Text>{purchasing ? '添加中...' : '立即体验'}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 自动发帖助手弹窗 */}
      <Dialog open={showAutoPostDialog} onOpenChange={setShowAutoPostDialog}>
        <DialogContent style={{
          width: 'calc(100vw - 64px)',
          maxWidth: '600px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        >
          <DialogHeader style={{ flexShrink: 0, padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#ffffff' }}>
            <DialogTitle>自动发帖助手</DialogTitle>
          </DialogHeader>
          <View style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', maxHeight: 'calc(80vh - 140px)' }}>
            <View className="dialog-content">
              <View className="order-preview">
                <Text className="order-icon">{AUTO_POST_SKILL.icon}</Text>
                <View className="order-info">
                  <Text className="order-name">{AUTO_POST_SKILL.name}</Text>
                  <Text className="order-desc">{AUTO_POST_SKILL.description}</Text>
                </View>
              </View>

              {/* 权限要求 */}
              <View className="order-features">
                <Text className="order-features-title">权限要求：</Text>
                <View className="order-feature-item">
                  <Text className="order-feature-icon">📊</Text>
                  <Text className="order-feature-text">分身等级 ≥ Lv.{AUTO_POST_SKILL.requirements.minLevel}</Text>
                </View>
                <View className="order-feature-item">
                  <Text className="order-feature-icon">🤖</Text>
                  <Text className="order-feature-text">需开启托管模式</Text>
                </View>
              </View>

              {/* 发帖配额 */}
              <View className="order-features">
                <Text className="order-features-title">每日发帖配额：</Text>
                <View className="order-feature-item">
                  <Text className="order-feature-icon">🆓</Text>
                  <Text className="order-feature-text">{AUTO_POST_SKILL.requirements.quotaRules.free.desc}</Text>
                </View>
                <View className="order-feature-item">
                  <Text className="order-feature-icon">⭐</Text>
                  <Text className="order-feature-text">{AUTO_POST_SKILL.requirements.quotaRules.basic.desc}</Text>
                </View>
                <View className="order-feature-item">
                  <Text className="order-feature-icon">👑</Text>
                  <Text className="order-feature-text">{AUTO_POST_SKILL.requirements.quotaRules.premium.desc}</Text>
                </View>
              </View>

              {/* 等级加成 */}
              <View className="order-tip">
                <Text className="order-tip-text">💡 {AUTO_POST_SKILL.requirements.levelBonus}</Text>
              </View>

              {/* 支持格式 */}
              <View className="order-features">
                <Text className="order-features-title">支持格式：</Text>
                <View style={{ display: 'flex', flexDirection: 'row', gap: '8px', flexWrap: 'wrap' }}>
                  <Text style={{ background: 'rgba(123, 63, 228, 0.2)', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', color: '#7B3FE4' }}>纯文字</Text>
                  <Text style={{ background: 'rgba(123, 63, 228, 0.2)', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', color: '#7B3FE4' }}>图文</Text>
                  <Text style={{ background: 'rgba(123, 63, 228, 0.2)', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', color: '#7B3FE4' }}>视频</Text>
                </View>
              </View>

              <View className="target-avatar">
                <Text className="target-label">目标分身</Text>
                <Text className="target-name">{currentAvatar?.name}</Text>
              </View>
            </View>
          </View>
          <DialogFooter style={{ flexShrink: 0, padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <Button variant="outline" onClick={() => setShowAutoPostDialog(false)}>
              <Text>取消</Text>
            </Button>
            <Button onClick={handlePurchaseAutoPost} disabled={purchasing}>
              <Text>{purchasing ? '添加中...' : '立即添加'}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </View>
  )
}
