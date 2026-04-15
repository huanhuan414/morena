import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useEffect } from 'react'
import * as Network from '@/network'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useUserStore } from '@/stores/user'
import Taro from '@tarojs/taro'
import { Star, Check, ShoppingCart, Search } from 'lucide-react-taro'
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

// 个人IP打造技能配置
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

// 根据 tool_name 获取图标
const getSkillIcon = (toolName?: string): string => {
  const iconMap: Record<string, string> = {
    // 短剧相关
    'generate_shortdrama_script': '📝',
    'generate_storyboard': '🎬',
    'produce_shortdrama': '🎥',
    'generate_multi_episode_drama': '📺',
    'generate_drama_voiceover': '🎙️',
    'edit_shortdrama_video': '✂️',
    'generate_subtitle': '💬',
    'recommend_bgm': '🎵',
    // 内容创作
    'write_article': '✍️',
    'write_wechat_mp_article': '📰',
    'write_xiaohongshu_note': '📝',
    'generate_image': '🖼️',
    'generate_video': '🎬',
    // 平台发布
    'publish_wechat_mp': '💬',
    'publish_xiaohongshu': '📱',
    'publish_bilibili': '📺',
    'publish_weibo': '🌐',
    'publish_douyin': '🎵',
    'publish_wechat_video': '📱',
    // 其他
    'default': '🎯'
  }
  return iconMap[toolName || ''] || iconMap['default']
}

// 🔴 过滤掉短剧套件和个人IP套件中的技能
const filterSkills = (skills: Skill[]): Skill[] => {
  const kitSkillToolNames = new Set([
    ...SHORT_DRAMA_KIT.skills,
    ...PERSONAL_IP_KIT.skills
  ])
  return skills.filter(skill => !skill.tool_name || !kitSkillToolNames.has(skill.tool_name))
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

  // 打印环境信息
  useEffect(() => {
    console.log('[SkillSquare] 环境信息')
  }, [])

  // 获取分身列表
  const fetchAvatars = async () => {
    if (!userInfo?.id) return

    try {
      const res = await Network.request({
        url: '/api/avatar',
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

      // 直接使用已验证的方式：res.data.data.skills
      if (res.statusCode === 200 && res.data?.data?.skills && Array.isArray(res.data.data.skills)) {
        const skillsList = res.data.data.skills
        console.log('[SkillSquare] 技能列表长度:', skillsList.length)
        console.log('[SkillSquare] 技能列表内容:', skillsList.slice(0, 2))
        console.log('[SkillSquare] 即将调用 setSkills')
        setSkills(skillsList)
        console.log('[SkillSquare] 已调用 setSkills，skillsList 长度:', skillsList.length)
      } else {
        console.log('[SkillSquare] 未获取到技能数据')
        console.log('[SkillSquare] statusCode:', res.statusCode)
        console.log('[SkillSquare] res.data.code:', res.data?.code)
        console.log('[SkillSquare] res.data.data?.skills:', res.data?.data?.skills)
        console.log('[SkillSquare] 即将调用 setSkills([])')
        setSkills([])
        console.log('[SkillSquare] 已调用 setSkills([])')
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

  // 一键添加个人IP打造套件
  const handlePurchasePersonalIpKit = async () => {
    if (!currentAvatar?.id) {
      Taro.showToast({ title: '请先选择分身', icon: 'none' })
      return
    }

    try {
      setPurchasing(true)
      console.log('[SkillSquare] 开始添加个人IP打造套件:', {
        skills: PERSONAL_IP_KIT.skills,
        avatarId: currentAvatar.id
      })

      // 批量添加技能
      const results = await Promise.all(
        PERSONAL_IP_KIT.skills.map(toolName =>
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

      console.log('[SkillSquare] 个人IP打造套件添加结果:', results)

      const successCount = results.filter(r => r.data?.code === 200).length
      const totalCount = results.length

      if (successCount === totalCount) {
        Taro.showToast({
          title: `个人IP打造套件添加成功！已添加 ${totalCount} 个技能`,
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

      fetchMySkills()
    } catch (error: any) {
      console.error('[SkillSquare] 添加个人IP打造套件失败:', error)
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
      {/* 头部 */}
      <View className="skills-header">
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
        <Search size={18} color="rgba(255,255,255,0.5)" />
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

      {/* 短剧创作套件和分身秩序（只在无搜索时显示） */}
      {!searchKeyword && (
        <View className="special-cards">
          {/* 短剧创作套件 */}
          <View className="special-card drama-kit" onClick={() => setShowKitDialog(true)}>
            <View className="special-header">
              <View className="special-icon-large">{SHORT_DRAMA_KIT.icon}</View>
              <View className="special-badge">🔥 热门</View>
            </View>
            <View className="special-content">
              <Text className="special-title">{SHORT_DRAMA_KIT.name}</Text>
              <Text className="special-desc">{SHORT_DRAMA_KIT.description}</Text>
              <Text className="special-tip">📌 已包含8个短剧核心技能，无需单独添加</Text>
              <View className="special-skills">
                {SHORT_DRAMA_KIT.skills.slice(0, 4).map((skill, idx) => (
                  <View key={idx} className="mini-skill-tag">
                    <Text className="mini-skill-text">{skill.replace(/_/g, ' ')}</Text>
                  </View>
                ))}
                {SHORT_DRAMA_KIT.skills.length > 4 && (
                  <View className="mini-skill-tag more">
                    <Text className="mini-skill-text">+{SHORT_DRAMA_KIT.skills.length - 4}</Text>
                  </View>
                )}
              </View>
            </View>
            <View className="special-footer">
              <View className="special-stats">
                <Star size={14} color="#ffb800" />
                <Text className="special-stat-value">{SHORT_DRAMA_KIT.rating}</Text>
                <Text className="special-stat-label">({SHORT_DRAMA_KIT.purchase_count}人使用)</Text>
              </View>
              <View className="special-action">
                <Text className="special-action-text">一键添加</Text>
              </View>
            </View>
          </View>

          {/* 分身秩序 */}
          <View className="special-card agent-order" onClick={() => setShowOrderDialog(true)}>
            <View className="special-header">
              <View className="special-icon-large">{AGENT_ORDER_SKILL.icon}</View>
              <View className="special-badge ai">🤖 AI协作</View>
            </View>
            <View className="special-content">
              <Text className="special-title">{AGENT_ORDER_SKILL.name}</Text>
              <Text className="special-desc">{AGENT_ORDER_SKILL.description}</Text>
              <View className="special-features">
                <View className="feature-item">
                  <Text className="feature-icon">⚡</Text>
                  <Text className="feature-text">智能编排</Text>
                </View>
                <View className="feature-item">
                  <Text className="feature-icon">🎬</Text>
                  <Text className="feature-text">一键成品</Text>
                </View>
                <View className="feature-item">
                  <Text className="feature-icon">🤝</Text>
                  <Text className="feature-text">分身协作</Text>
                </View>
              </View>
            </View>
            <View className="special-footer">
              <View className="special-stats">
                <Star size={14} color="#ffb800" />
                <Text className="special-stat-value">{AGENT_ORDER_SKILL.rating}</Text>
                <Text className="special-stat-label">({AGENT_ORDER_SKILL.purchase_count}人使用)</Text>
              </View>
              <View className="special-action ai">
                <Text className="special-action-text">立即体验</Text>
              </View>
            </View>
          </View>

          {/* 个人IP打造 */}
          <View className="special-card personal-ip" onClick={() => handlePurchasePersonalIpKit()}>
            <View className="special-header">
              <View className="special-icon-large">{PERSONAL_IP_KIT.icon}</View>
              <View className="special-badge ip">🌟 个人IP</View>
            </View>
            <View className="special-content">
              <Text className="special-title">{PERSONAL_IP_KIT.name}</Text>
              <Text className="special-desc">{PERSONAL_IP_KIT.description}</Text>
              <Text className="special-tip">📌 已包含3个核心技能：视频生成、字幕、背景音乐</Text>
              <View className="special-skills">
                {PERSONAL_IP_KIT.skills.map((skill, idx) => (
                  <View key={idx} className="mini-skill-tag">
                    <Text className="mini-skill-text">{skill.replace(/_/g, ' ')}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View className="special-footer">
              <View className="special-stats">
                <Star size={14} color="#ffb800" />
                <Text className="special-stat-value">{PERSONAL_IP_KIT.rating}</Text>
                <Text className="special-stat-label">({PERSONAL_IP_KIT.purchase_count}人使用)</Text>
              </View>
              <View className="special-action ip">
                <Text className="special-action-text">一键添加</Text>
              </View>
            </View>
          </View>
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
            <Button onClick={() => Taro.navigateTo({ url: '/pages/avatar-create/index' })}>
              创建分身
            </Button>
          </View>
        ) : skills.length === 0 ? (
          <View className="empty-container">
            <Text>暂无技能</Text>
          </View>
        ) : (
          <View className="skills-grid">
            {(!searchKeyword ? filterSkills(skills) : skills).map((skill) => {
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
                <View key={skill.id} className={`skill-card ${owned ? 'owned' : ''}`}>
                  {/* 图标和分类 */}
                  <View className="card-top">
                    <View className="icon-wrapper">
                      <Text className="skill-icon">{getSkillIcon(skill.tool_name)}</Text>
                    </View>
                    {owned && (
                      <View className="owned-badge">
                        <Check size={14} color="#00ff88" />
                        <Text className="owned-text">已添加</Text>
                      </View>
                    )}
                  </View>

                  {/* 内容 */}
                  <View className="card-content">
                    <Text className="category-tag">{skill.category}</Text>
                    <Text className="skill-name">{displayName}</Text>
                    <Text className="skill-description">{skill.description}</Text>

                    {/* 标签 */}
                    {skill.tags && skill.tags.length > 0 && (
                      <View className="tags-container">
                        {skill.tags.slice(0, 2).map((tag, idx) => (
                          <View key={idx} className="tag">
                            <Text className="tag-text">{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* 底部 */}
                  <View className="card-footer">
                    <View className="stats">
                      <View className="stat-item">
                        <Star size={14} color="#ffb800" />
                        <Text className="stat-value">{skill.rating}</Text>
                        <Text className="stat-label">({skill.rating_count})</Text>
                      </View>
                      <View className="stat-item">
                        <Text className="stat-value">{skill.purchase_count}</Text>
                        <Text className="stat-label">人使用</Text>
                      </View>
                    </View>
                    {owned ? (
                      <Button
                        className="action-btn remove"
                        onClick={() => handleRemoveSkill(skill.id, skill.name)}
                      >
                        <View className="btn-content">
                          <Text>移除</Text>
                        </View>
                      </Button>
                    ) : (
                      <Button
                        className="action-btn"
                        onClick={() => {
                          setSelectedSkill(skill)
                          setShowPurchaseDialog(true)
                        }}
                      >
                        <View className="btn-content">
                          <ShoppingCart size={14} color="#fff" />
                          <Text>添加</Text>
                        </View>
                      </Button>
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
                  <Text className="preview-icon">{getSkillIcon(selectedSkill.tool_name)}</Text>
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
    </View>
  )
}
