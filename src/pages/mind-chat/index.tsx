import { View, Text, ScrollView, Image, Video } from "@tarojs/components"
import Taro, { useLoad, useDidShow, useRouter, redirectTo, showToast } from "@tarojs/taro"
import { useState, useRef, useEffect } from "react"
import * as Network from "@/network"
import { useUserStore } from "@/stores/user"
import { formatTime } from "@/utils/time"
import { PlatformConfigDialog, PlatformType } from "@/components/agent/PlatformConfigDialog"
import { PublishGuideDialog, PLATFORM_CONFIGS } from "@/components/agent/PublishGuideDialog"
import MarkdownRender from "@/components/markdown-render"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { LevelDetailDialog } from "@/components/level-detail-dialog"
import "@/components/level-detail-dialog/index.css"
import { ExpPopup, LevelUpEffect } from "@/components/exp-popup"
import "@/components/exp-popup/index.css"
import { toast } from "@/components/ui/toast"
import { Textarea } from "@/components/ui/textarea"
import {
  Send, Sparkles, Bot, Copy, History, X, Brain, TrendingUp, Award, Target,
  MessageCircle, Mic, Keyboard, Loader, Zap, Check, Download, ChevronDown, ChevronUp, User, Wrench,
  Play, Image as ImageIcon, Video as VideoIcon
} from "lucide-react-taro"
import { getSafeArea } from "@/utils/safe-area"
import "./index.css"
import "./index-publish-success.css"

/**
 * 前端清理函数：移除消息内容中的图片链接等调试信息
 * 与后端 cleanDebugInfo 方法保持一致
 */
function cleanMessageContent(content: string): string {
  if (!content || typeof content !== 'string') return content

  let cleaned = content

  // 移除 Coze 临时文件代理链接
  cleaned = cleaned.replace(/https?:\/\/code\.coze\.cn\/api\/sandbox\/[^\s\n]+/gi, '')

  // 移除所有 TOS 对象存储链接
  cleaned = cleaned.replace(/https?:\/\/ark-content-generation-v2[\w-]+\.tos-cn-[\w-]+\.volces\.com\/[^\s\n]*/gi, '')

  // 移除"已为您生成.*链接如下："模式
  cleaned = cleaned.replace(/已为您?生成.*?[，,]?\s*链接如下[::：][\s\S]*?(?=\n\n|\n[A-Z\u4e00-\u9fa5]|$)/gi, '')

  // 移除"已为你生成.*链接如下："模式
  cleaned = cleaned.replace(/已为你生成.*?[，,]?\s*链接如下[::：][\s\S]*?(?=\n\n|\n[A-Z\u4e00-\u9fa5]|$)/gi, '')

  // 移除"图片链接如下："模式
  cleaned = cleaned.replace(/图片链接如下[::：]\s*\d*[\.、]?\s*https?:\/\/[^\s\n]+/gi, '')

  // 移除"视频链接如下："模式
  cleaned = cleaned.replace(/视频链接如下[::：]\s*\d*[\.、]?\s*https?:\/\/[^\s\n]+/gi, '')

  // 移除"已为你生成.*配图"模式
  cleaned = cleaned.replace(/已为你生成.*配图[，,]\s*图片链接如下[::：]\s*https?:\/\/[^\s\n]+/gi, '')

  // 移除独立的链接行
  cleaned = cleaned.replace(/^\s*\d+[\.、]\s*https?:\/\/[^\s\n]+$/gm, '')

  // 移除"链接如下："引导的多链接列表
  cleaned = cleaned.replace(/链接如下[::：][\s\S]*?(?=\n\n|\n[A-Z\u4e00-\u9fa5]|$)/gi, '')

  // 🔴 新增：移除"Image: [URL]"格式（包含中英文）- 匹配整行
  cleaned = cleaned.replace(/^Image[图片]?\s*[:：].*$/gim, '')

  // 🔴 新增：移除"Video: [URL]"格式（包含中英文）- 匹配整行
  cleaned = cleaned.replace(/^Video[视频]?\s*[:：].*$/gim, '')

  // 🔴 新增：移除"图片：[URL]"和"图片:[URL]"格式 - 匹配整行
  cleaned = cleaned.replace(/^图片\s*[:：].*$/gim, '')

  // 🔴 新增：移除"视频：[URL]"和"视频:[URL]"格式 - 匹配整行
  cleaned = cleaned.replace(/^视频\s*[:：].*$/gim, '')

  // 移除多余的空行
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n')

  return cleaned.trim()
}

interface MessageMedia {
  type: 'image' | 'video' | 'article'
  url?: string
  key?: string
  content?: string
  title?: string
  coverImage?: string  // 文章封面图
  // 短剧相关字段
  message?: string  // 发布成功提示信息
  production_stats?: {  // 生产统计数据
    total_clips?: number
    success_rate?: number
    average_duration?: number
    audio_coverage?: number
  }
  bgm_recommendations?: any[]  // 背景音乐推荐
  edited_video_url?: string  // 剪辑后的视频URL
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  metadata?: {
    media_keys?: string[]
    media_urls?: Record<string, string>
    media?: MessageMedia[]
    agent_result?: AgentResult
    agent_steps?: AgentStepDisplay[]
    task_state?: {
      progressHistory?: any[]
    }
    // 🔴 新增：上传的图片和视频
    uploaded_images?: string[]
    uploaded_videos?: string[]
  }
}

// Agent 步骤展示
interface AgentStepDisplay {
  action: string
  displayName: string
  status: 'success' | 'failed' | 'running'
  message: string
}

interface Conversation {
  id: string
  title: string
  avatar_id: string
  avatars?: {
    name: string
    avatar_url: string
  }
  created_at: string
  updated_at: string
}

// Agent 执行步骤
interface ReActStep {
  step_index: number
  thought: string
  action?: string
  action_input?: any
  observation?: any
  requires_config?: boolean
  config_platform?: PlatformType
  config_fields?: any[]
}

// Agent 执行结果
interface AgentResult {
  success: boolean
  finalAnswer: string
  steps: ReActStep[]
  requiresConfig: boolean
  configPlatform?: PlatformType
  configFields?: any[]
}

interface Avatar {
  id: string
  name: string
  avatar_url: string
  level: number
  personality: string
  exp?: number
  config?: {
    learning?: {
      messageCount: number
      avgMessageLength: number
      commonPhrases: string[]
      emotions: string[]
      topics: string[]
    }
    style?: string
    skills?: string[]  // 分身技能列表
    voice_enabled?: boolean  // 语音回复
    notification_enabled?: boolean  // 消息通知
    night_mode?: boolean  // 夜间模式
    auto_learning?: boolean  // 自动学习
    privacy_mode?: boolean  // 隐私模式
  }
}

interface LearningStats {
  messageCount: number
  learningDays: number
  masteryLevel: number
  avgMessageLength: number
  styleMatch: number
  // 学习特征
  toneProfile?: {
    formal: number
    casual: number
    humorous: number
    emotional: number
  }
  personalityTraits?: {
    openness: number
    conscientiousness: number
    extraversion: number
    agreeableness: number
    neuroticism: number
  }
  communicationStyle?: {
    direct: number
    polite: number
    detailed: number
    concise: number
  }
  interests?: string[]
  commonPhrases?: string[]
  userIdentity?: {
    occupation?: string
    education?: string
    personalityType?: string
    lifeEvents?: string[]
  }
}

// 🔴 新增：Agent 步骤名称映射（英文转中文）
const mapStepDisplayName = (displayName: string, step: any): string => {
  // 通用步骤映射
  const commonMapping: Record<string, string> = {
    'progress': '正在分析任务...',
    'thinking': '正在思考...',
    'action': '正在执行任务...',
    'observation': '正在获取结果...',
    'final_answer': '任务完成'
  }

  // 如果是短剧制作相关的步骤，使用更详细的映射
  if (step.action === 'produce_shortdrama') {
    return '🎬 正在制作短剧...'
  }

  // 如果是其他工具，使用工具名称映射
  if (step.action && typeof step.action === 'string') {
    const toolMapping: Record<string, string> = {
      'generate_shortdrama_script': '📝 正在生成剧本...',
      'generate_storyboard': '🎬 正在生成分镜头脚本...',
      'generate_multi_episode_drama': '📺 正在生成多集短剧...',
      'generate_drama_voiceover': '🎙️ 正在生成配音...',
      'edit_shortdrama_video': '✂️ 正在剪辑视频...',
      'generate_subtitle': '📝 正在生成字幕...',
      'recommend_bgm': '🎵 正在推荐配乐...',
      'produce_shortdrama': '🎬 正在制作短剧成品...',
      'generate-image': '🖼️ 正在生成图片...',
      'video_generation': '🎥 正在生成视频...',
      'content-creation': '✍️ 正在创作内容...',
      'app_update_avatar': '👤 正在更新分身信息...',
      'app_create_task': '📋 正在创建任务...'
    }

    // 尝试完整匹配
    if (toolMapping[step.action]) {
      return toolMapping[step.action]
    }

    // 尝试模糊匹配
    const fuzzyMatch = Object.keys(toolMapping).find(key =>
      step.action.includes(key) || key.includes(step.action)
    )
    if (fuzzyMatch) {
      return toolMapping[fuzzyMatch]
    }

    // 如果是工具调用，显示工具名称
    if (step.action.startsWith('app_')) {
      return `🔧 正在执行${step.action.replace('app_', '')}...`
    }

    return `⚡ 正在执行${step.action}...`
  }

  // 使用通用映射
  if (commonMapping[displayName]) {
    return commonMapping[displayName]
  }

  // 如果是数字步骤，显示为"步骤X"
  if (/^\d+$/.test(displayName)) {
    return `步骤 ${displayName}`
  }

  // 默认返回原名称
  return displayName
}

// 工具名称映射（已废弃，移除轮询相关代码）

// 解析 Markdown 为段落数组，用于分段渲染
export default function MindChatPage() {
  const router = useRouter()
  const { isLoggedIn, userInfo, avatarId, setAvatarId } = useUserStore()
  const [avatar, setAvatar] = useState<Avatar | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)  // 用于在闭包中获取最新的 loading 状态
  const [showHistory, setShowHistory] = useState(false)
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [learningStats, setLearningStats] = useState<LearningStats>({
    messageCount: 0,
    learningDays: 0,
    masteryLevel: 0,
    avgMessageLength: 0,
    styleMatch: 0
  })
  
  // 安全区域适配
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  
  // 学习动画状态
  const [showLearningEffect, setShowLearningEffect] = useState(false)
  const [learningProgress, setLearningProgress] = useState<{
    oldCount: number
    newCount: number
    expGained: number
  } | null>(null)
  const [learnPanelCollapsed, setLearnPanelCollapsed] = useState(false)
  const [learnPanelExpanded, setLearnPanelExpanded] = useState(false) // 控制详细内容的展开/折叠
  
  // 经验值飘字特效状态
  const [showExpPopup, setShowExpPopup] = useState(false)
  const [expPopupValue, setExpPopupValue] = useState(0)
  
  // 升级特效状态
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [levelUpData, setLevelUpData] = useState<{ oldLevel: number; newLevel: number } | null>(null)
  
  // 记录发送消息前的 messageCount，用于检测学习进度
  // 初始加载标记：是否已经加载过学习数据（用于区分首次加载和对话学习）
  const isInitialLoadRef = useRef(true)
  const messageCountBeforeSendRef = useRef<number>(0)

  // 轮询定时器 ref（用于任务状态恢复时的轮询）
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  // 任务超时定时器 ref（用于任务状态恢复时的超时保护）
  const taskTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 学习详情弹窗
  const [showLearningDetail, setShowLearningDetail] = useState<'dialog' | 'days' | 'mastery' | 'level' | 'identity' | 'style' | 'interests' | 'phrases' | 'capabilities' | null>(null)

  // 分身能力数据
  const [avatarCapabilities, setAvatarCapabilities] = useState<any>(null)
  
  // Agent 实时状态（每个分身都是独立智能体）
  const [currentStatus, setCurrentStatus] = useState<string>('')
  const [agentSteps, setAgentSteps] = useState<AgentStepDisplay[]>([])
  const [taskProgress, setTaskProgress] = useState<number>(0) // 任务进度百分比

  const [scrollIntoView, setScrollIntoView] = useState('')
  const isFirstLoadRef = useRef<boolean>(true)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const textareaRef = useRef<any>(null) // 输入框引用（使用 any 兼容 Taro）

  // 使用 scrollTop 滚动到底部
  const [scrollTop, setScrollTop] = useState(0)
  // 滚动计数器，确保每次 scrollTop 值都不同
  const scrollCounterRef = useRef(0)
  
  // 消息加载状态
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  
  // 平台配置弹窗
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [configPlatform, setConfigPlatform] = useState<PlatformType | null>(null)
  
  // 配置成功后待重试的消息
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  
  // 待发布的内容（用于发布确认）
  const [pendingPublish, setPendingPublish] = useState<{
    platform: PlatformType
    content: {
      title?: string
      content?: string
      coverImage?: string
      images?: string[]
      tags?: string[]
    }
  } | null>(null)
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)

  // 🔴 新增：上传的图片和视频
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [uploadedVideos, setUploadedVideos] = useState<string[]>([])
  
  // 发布引导弹窗（用于无 API 的平台）
  const [showPublishGuide, setShowPublishGuide] = useState(false)
  const [publishGuideData, setPublishGuideData] = useState<{
    platform: keyof typeof PLATFORM_CONFIGS
    content: {
      title?: string
      content?: string
      images?: string[]
      tags?: string[]
      videoUrl?: string
    }
  } | null>(null)
  
  // H5链接弹窗（小程序环境）
  const [showH5PublishDialog, setShowH5PublishDialog] = useState(false)
  const [h5PublishUrl, setH5PublishUrl] = useState('')

  // 辅助函数：获取记忆类型名称
  const getMemoryTypeName = (type: string): string => {
    const typeMap: Record<string, string> = {
      'user_preference': '用户偏好',
      'conversation': '对话记忆',
      'avatar_experience': '分身经验',
      'user_profile': '用户画像',
      'context': '上下文'
    }
    return typeMap[type] || type
  }

  // 辅助函数：获取意图类型显示名称
  const getIntentDisplayName = (intent: string): string => {
    const intentMap: Record<string, string> = {
      'unknown': '一般对话',
      'greeting': '问候',
      'question': '提问',
      'task': '任务',
      'creative': '创作',
      'analysis': '分析',
      'recommendation': '推荐',
      'tool_call': '工具调用'
    }
    return intentMap[intent] || intent
  }

  useLoad(() => {
    if (!isLoggedIn) {
      redirectTo({ url: '/pages/login/index' })
    }

    // 初始化安全区域信息
    const safeArea = getSafeArea()
    setStatusBarHeight(safeArea.statusBarHeight)
  })

  useDidShow(() => {
    if (isLoggedIn) {
      console.log('[MindChat] 页面显示，检查是否有正在执行的任务')

      // 清除所有定时器
      if (taskTimeoutRef.current) {
        console.log('[MindChat] 清除 taskTimeoutRef')
        clearTimeout(taskTimeoutRef.current)
        taskTimeoutRef.current = null
      }
      if ((pollIntervalRef as any).current) {
        console.log('[MindChat] 清除 pollIntervalRef')
        clearInterval((pollIntervalRef as any).current)
        ;(pollIntervalRef as any).current = null
      }

      // 标记页面已加载，让 fetchMessages 能够自动恢复任务状态
      pageLoadedRef.current = true
      console.log('[MindChat] pageLoadedRef 设置为 true')

      fetchConversations()

      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false
        const routeAvatarId = router.params.avatarId
        if (routeAvatarId) {
          fetchAvatar(routeAvatarId)
          fetchOrCreateConversation(routeAvatarId)
        } else {
          fetchDefaultAvatar()
        }
      }

      // 延迟获取学习数据，确保 avatar 已加载
      setTimeout(() => {
        fetchLearningStats()
      }, 500)
    }
  })
  // 组件卸载时停止轮询
  useEffect(() => {
    return () => {
      // 清理任务状态恢复时的轮询定时器
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      // 清理任务超时定时器
      if (taskTimeoutRef.current) {
        clearTimeout(taskTimeoutRef.current)
        taskTimeoutRef.current = null
      }
      // 旧的轮询机制已废弃，保留注释以防需要回退
      // stopProgressPolling()
      // stopResultPolling()
    }
  }, [])

  // 防止 loading 状态卡住：如果 loading 状态超过 5 分钟，提示用户任务可能还在执行
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null

    if (loading) {
      timer = setTimeout(() => {
        console.warn('[MindChat] loading 状态超过 5 分钟，提示用户')
        // 不清空 loading 状态，只是提示用户任务可能仍在执行中
        showToast({
          title: '任务执行时间较长，请耐心等待...',
          icon: 'loading',
          duration: 3000
        })
      }, 5 * 60 * 1000) // 5 分钟超时
    }

    return () => {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [loading])

  // 新消息时滚动到底部（排除加载历史消息的情况）
  const shouldScrollToBottomRef = useRef(true)
  const pageLoadedRef = useRef(false) // 标记页面是否已加载

  useEffect(() => {
    // 只有在需要滚动到底部时才滚动（新消息、发送消息时）
    if (shouldScrollToBottomRef.current && messages.length > 0) {
      // 延迟确保消息完全渲染
      const timer = setTimeout(() => {
        scrollToBottom()
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [messages.length, loading, currentStatus])

  const fetchConversations = async () => {
    try {
      const res = await Network.request({ url: '/api/chat/conversations' })
      if (res.data?.code === 200) {
        setConversations(res.data.data || [])
      }
    } catch (error) {
      console.error('[MindChat] 获取对话列表失败:', error)
    }
  }

  const fetchLearningStats = async (showEffect: boolean = false) => {
    console.log('[MindChat] fetchLearningStats 被调用, showEffect:', showEffect)
    try {
      // 获取当前分身ID（优先使用当前选中的分身）
      let targetAvatarId = avatar?.id
      
      // 如果没有选中的分身，获取用户第一个分身
      if (!targetAvatarId) {
        const res = await Network.request({ url: '/api/avatar' })
        if (res.data?.code === 200 && res.data.data?.length > 0) {
          targetAvatarId = res.data.data[0].id
          setAvatar(res.data.data[0])
        }
      }
      
      if (!targetAvatarId) return
      
      const res = await Network.request({ url: `/api/avatar/${targetAvatarId}/learning` })
      if (res.data?.code === 200 && res.data.data) {
        const { learning, metrics } = res.data.data
        if (learning && metrics) {
          const newStats = {
            messageCount: learning.messageCount || 0,
            learningDays: metrics.learningDays || 1,
            masteryLevel: metrics.masteryLevel || 0,
            styleMatch: metrics.styleMatch || 0,
            avgMessageLength: learning.avgMessageLength || 0,
            toneProfile: learning.toneProfile,
            personalityTraits: learning.personalityTraits,
            communicationStyle: learning.communicationStyle,
            interests: learning.interests,
            commonPhrases: learning.commonPhrases,
            userIdentity: learning.userIdentity
          }

          // 检查是否是首次加载
          const isInitialLoad = isInitialLoadRef.current
          if (isInitialLoad) {
            isInitialLoadRef.current = false
          }

          // 使用 messageCountBeforeSendRef 来检测变化（发送消息前记录的值）
          const oldMessageCount = messageCountBeforeSendRef.current
          const oldStats = learningStats

          // 检测是否有新内容被学习到
          // 首次加载不触发特效，只在对话后触发
          const messageCountIncreased = !isInitialLoad && newStats.messageCount > oldMessageCount
          const identityChanged = !isInitialLoad && (
            !oldStats.userIdentity || !newStats.userIdentity ||
            JSON.stringify(oldStats.userIdentity) !== JSON.stringify(newStats.userIdentity)
          )
          const interestsChanged = !isInitialLoad && (
            !oldStats.interests || !newStats.interests ||
            JSON.stringify(oldStats.interests) !== JSON.stringify(newStats.interests)
          )
          const phrasesChanged = !isInitialLoad && (
            !oldStats.commonPhrases || !newStats.commonPhrases ||
            JSON.stringify(oldStats.commonPhrases) !== JSON.stringify(newStats.commonPhrases)
          )

          // 只要满足以下任一条件，就触发特效：
          // 1. 消息数量增加
          // 2. 用户身份信息变化（职业、学历、性格、生活事件）
          // 3. 兴趣偏好变化
          // 4. 常用表达变化
          const hasNewLearning = messageCountIncreased || identityChanged || interestsChanged || phrasesChanged

          console.log('[MindChat] 学习数据比较:', {
            isInitialLoad,
            oldMessageCount,
            newMessageCount: newStats.messageCount,
            messageCountIncreased,
            identityChanged,
            interestsChanged,
            phrasesChanged,
            hasNewLearning,
            oldUserIdentity: JSON.stringify(oldStats.userIdentity),
            newUserIdentity: JSON.stringify(newStats.userIdentity)
          })

          if (showEffect && hasNewLearning) {
            console.log('[MindChat] 🎉 触发学习特效! 原因:', {
              messageCountIncreased,
              identityChanged,
              interestsChanged,
              phrasesChanged
            })
            
            // 计算这次对话获得的经验值（根据等级和消息长度）
            const currentLevel = avatar?.level || 1
            const expGained = calculateChatExp(currentLevel, newStats.avgMessageLength || 50)
            
            // 调用后端 API 更新经验值，并获取是否升级的信息
            try {
              const expRes = await Network.request({
                url: `/api/avatar/${targetAvatarId}/exp`,
                method: 'POST',
                data: { exp: expGained }
              })
              
              if (expRes.data?.code === 200) {
                const newAvatarData = expRes.data.data
                const oldLevel = avatar?.level || 1
                const newLevel = newAvatarData?.level || oldLevel
                
                // 更新本地分身数据
                if (newAvatarData) {
                  setAvatar(prev => prev ? { ...prev, level: newLevel, exp: newAvatarData.exp } : null)
                }
                
                // 检测是否升级
                if (newLevel > oldLevel) {
                  console.log('[MindChat] ⬆️ 分身升级了!', { oldLevel, newLevel })
                  // 延迟显示升级特效，等待经验值飘字
                  setTimeout(() => {
                    setLevelUpData({ oldLevel, newLevel })
                    setShowLevelUp(true)
                  }, 500)
                }
                
                // 触发经验值飘字特效
                setExpPopupValue(expGained)
                setShowExpPopup(true)
              }
            } catch (expError) {
              console.error('[MindChat] 更新经验值失败:', expError)
              // 即使更新失败，也显示经验值特效（前端模拟）
              setExpPopupValue(expGained)
              setShowExpPopup(true)
            }
            
            setLearningProgress({
              oldCount: oldMessageCount,
              newCount: newStats.messageCount,
              expGained: expGained
            })
            setShowLearningEffect(true)
            
            // 3秒后隐藏学习特效
            setTimeout(() => {
              setShowLearningEffect(false)
              setLearningProgress(null)
            }, 3000)
          }
          
          setLearningStats(newStats)
        }
      }
    } catch (error) {
      console.error('[MindChat] 获取学习数据失败:', error)
    }
  }
  
  // 根据等级和消息长度计算经验值
  const calculateChatExp = (level: number, messageLength: number): number => {
    let baseExp: number
    if (level <= 5) {
      baseExp = 5 + Math.floor((level - 1) * 2)
    } else {
      baseExp = 13 + Math.floor((level - 5) * 5)
    }
    // 消息长度加成：超过50字额外+1，超过200字每100字再+1
    let lengthBonus = 0
    if (messageLength > 50) {
      lengthBonus += 1
    }
    if (messageLength > 200) {
      lengthBonus += Math.floor((messageLength - 200) / 100)
    }
    return baseExp + lengthBonus
  }

  // 获取分身能力数据
  const fetchAvatarCapabilities = async () => {
    if (!avatar?.id) return
    try {
      const res = await Network.request({
        url: `/api/avatar-agent/${avatar.id}/capabilities`
      })
      if (res.data?.code === 200) {
        setAvatarCapabilities(res.data.data)
      }
    } catch (error) {
      console.error('[MindChat] 获取分身能力失败:', error)
    }
  }

  // 跳转到技能广场
  const navigateToSkillsSquare = () => {
    if (avatarId) {
      Taro.navigateTo({
        url: `/pages/skills-square/index?avatarId=${avatarId}`
      })
    } else {
      Taro.showToast({ title: '请先选择分身', icon: 'none' })
    }
  }

  const fetchDefaultAvatar = async () => {
    try {
      const res = await Network.request({ url: '/api/avatar' })
      if (res.data?.code === 200 && res.data.data?.length > 0) {
        const defaultAvatar = res.data.data[0]
        setAvatar(defaultAvatar)
        setAvatarId?.(defaultAvatar.id)  // 更新 store 中的 avatarId
        fetchOrCreateConversation(defaultAvatar.id)
      }
    } catch (error) {
      console.error('[MindChat] 获取分身失败:', error)
    }
  }

  const fetchAvatar = async (targetAvatarId: string) => {
    try {
      const res = await Network.request({ url: `/api/avatar/${targetAvatarId}` })
      if (res.data?.code === 200) {
        setAvatar(res.data.data)
        setAvatarId?.(targetAvatarId)  // 更新 store 中的 avatarId
      }
    } catch (error) {
      console.error('[MindChat] 获取分身失败:', error)
    }
  }

  const fetchOrCreateConversation = async (targetAvatarId: string) => {
    try {
      const conversationsRes = await Network.request({ url: '/api/chat/conversations' })

      if (conversationsRes.data?.code === 200 && conversationsRes.data.data?.length > 0) {
        // 过滤出当前分身的对话，并按更新时间排序
        const avatarConversations = conversationsRes.data.data.filter(
          (conv: any) => conv.avatar_id === targetAvatarId
        ).sort((a: any, b: any) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )

        // 如果当前分身有对话，使用最新的对话
        if (avatarConversations.length > 0) {
          const latestConv = avatarConversations[0]
          setConversation(latestConv)
          // 启用滚动到底部
          shouldScrollToBottomRef.current = true
          await fetchMessages(latestConv.id)
        } else {
          // 当前分身没有对话，创建新对话
          const res = await Network.request({
            url: '/api/chat/conversation',
            method: 'POST',
            data: { avatar_id: targetAvatarId }
          })
          if (res.data?.code === 200) {
            setConversation(res.data.data)
            setMessages([])
          }
        }
      } else {
        // 没有任何对话，创建新对话
        const res = await Network.request({
          url: '/api/chat/conversation',
          method: 'POST',
          data: { avatar_id: targetAvatarId }
        })
        if (res.data?.code === 200) {
          setConversation(res.data.data)
          setMessages([])
        }
      }
    } catch (error) {
      console.error('[MindChat] 获取对话失败:', error)
    }
  }

  // 获取最新消息（初始加载）
  const fetchMessages = async (conversationId: string) => {
    try {
      const res = await Network.request({
        url: `/api/chat/conversation/${conversationId}/messages?limit=20`
      })

      console.log('[MindChat fetchMessages] API 响应:', res.data)

      if (res.data?.code === 200) {
        const data = res.data.data || []

        console.log('[MindChat fetchMessages] 新消息数量:', data.length)
        if (data.length > 0) {
          const lastMsg = data[data.length - 1]
          if (lastMsg.role === 'assistant') {
            console.log('[MindChat fetchMessages] 最后一条 assistant 消息详情:', {
              id: lastMsg.id,
              hasAgentResult: !!lastMsg.metadata?.agent_result,
              agentResultStepsCount: lastMsg.metadata?.agent_result?.steps?.length || 0,
              hasMedia: !!lastMsg.metadata?.media,
              mediaCount: lastMsg.metadata?.media?.length || 0,
              media: lastMsg.metadata?.media,
              agentResult: lastMsg.metadata?.agent_result
            })
          }
        }

        setMessages(data)
        setHasMoreMessages(data.length >= 20)

        // 检查最后一条助手消息是否有任务状态
        const lastAssistantMessage = data.findLast((msg: Message) => msg.role === 'assistant')
        if (lastAssistantMessage?.metadata?.task_state) {
          const taskState = lastAssistantMessage.metadata.task_state
          const agentResult = lastAssistantMessage.metadata.agent_result

          console.log('[MindChat] 检测到任务状态:', taskState.status, 'pageLoaded:', pageLoadedRef.current)

          // 🔴 修复：检查任务是否真的在运行
          // 如果消息已经有完整内容（content 或 media 或 agent_result），说明任务已经完成
          // 即使 task_state.status 还是 'running'，也认为是完成状态
          const hasContent = !!lastAssistantMessage.content && lastAssistantMessage.content.trim().length > 0
          const hasMedia = !!lastAssistantMessage.metadata?.media && lastAssistantMessage.metadata.media.length > 0
          const hasAgentResult = !!lastAssistantMessage.metadata?.agent_result

          // 只对未完成的任务恢复状态
          if (taskState.status === 'running' && !hasContent && !hasMedia && !hasAgentResult) {
            console.log('[MindChat] 恢复任务状态显示:', taskState)

            // 恢复任务状态
            setLoading(true)
            loadingRef.current = true
            setCurrentStatus('任务执行中...')
            setAgentSteps(agentResult?.steps || [])
            setTaskProgress(taskState.progress || 0)

            // 获取最后一个进度记录
            let lastProgress: any = null
            if (taskState.progressHistory && taskState.progressHistory.length > 0) {
              lastProgress = taskState.progressHistory[taskState.progressHistory.length - 1]
              setCurrentStatus(lastProgress?.message || '任务执行中...')
            } else if (taskState.lastProgressMessage) {
              setCurrentStatus(taskState.lastProgressMessage)
            }

            // 如果任务状态是 running，启动轮询
            if (taskState.taskId) {
              const taskId = taskState.taskId
              console.log('[MindChat] 检测到任务正在执行中，启动轮询:', taskId)

              // 启动超时保护，但不自动取消任务
              const timeoutId = setTimeout(() => {
                if (loading) {
                  console.log('[MindChat] 任务执行时间较长，提示用户耐心等待')
                  setCurrentStatus('任务执行时间较长，请耐心等待...')
                }
              }, 5 * 60 * 1000) // 5 分钟

              taskTimeoutRef.current = timeoutId

              // 持续轮询直到任务完成
              let pollCount = 0
              const maxPollCount = 200 // 最多轮询 200 次（约 6.7 分钟，与后端视频生成时间匹配）
              const pollInterval = setInterval(async () => {
                pollCount++
                console.log('[MindChat] 轮询次数:', pollCount, '/', maxPollCount)

                try {
                  const progressRes = await Network.request({
                    url: '/api/agent/progress',
                    method: 'GET',
                    data: { taskId }
                  })

                  if (progressRes.data?.data?.latest) {
                    const latest = progressRes.data.data.latest
                    console.log('[MindChat] 任务进度更新:', latest)

                    // 重置轮询计数器（因为有进度更新）
                    pollCount = 0

                    // 更新进度提示
                    if (latest.message) {
                      setCurrentStatus(latest.message)
                    }

                    // 更新进度百分比
                    if (latest.percentage !== undefined) {
                      setTaskProgress(latest.percentage)
                    }

                    // 检查任务是否完成
                    if (latest.status === 'completed' || latest.status === 'failed') {
                      clearInterval(pollInterval)
                      clearTimeout(timeoutId)

                      // 刷新消息列表，获取最终结果
                      if (conversation) {
                        await fetchMessages(conversation.id)
                      }

                      // 清空状态
                      setLoading(false)
                      loadingRef.current = false
                      setCurrentStatus('')
                      taskTimeoutRef.current = null

                      console.log('[MindChat] 任务已完成')
                    }
                  } else if (progressRes.data?.data?.result) {
                    // 如果没有 latest 但有 result，说明任务已经完成
                    console.log('[MindChat] 任务已完成（通过 result）')
                    clearInterval(pollInterval)
                    clearTimeout(timeoutId)

                    // 刷新消息列表，获取最终结果
                    if (conversation) {
                      await fetchMessages(conversation.id)
                    }

                    // 清空状态
                    setLoading(false)
                    loadingRef.current = false
                    setCurrentStatus('')
                    taskTimeoutRef.current = null
                  } else {
                    // 没有进度更新，检查是否超时
                    if (pollCount >= maxPollCount) {
                      console.log('[MindChat] 轮询超时，自动停止')
                      clearInterval(pollInterval)
                      clearTimeout(timeoutId)

                      // 刷新消息列表，查看任务是否真的完成了
                      if (conversation) {
                        await fetchMessages(conversation.id)
                      }

                      // 清空状态
                      setLoading(false)
                      loadingRef.current = false
                      setCurrentStatus('')
                      taskTimeoutRef.current = null

                      Taro.showToast({
                        title: '任务状态已更新',
                        icon: 'none'
                      })
                    }
                  }
                } catch (error) {
                  console.error('[MindChat] 轮询任务进度失败:', error)
                  // 如果轮询失败超过一定次数，停止轮询
                  if (pollCount >= maxPollCount) {
                    console.log('[MindChat] 轮询失败次数过多，停止轮询')
                    clearInterval(pollInterval)
                    clearTimeout(timeoutId)

                    // 清空状态
                    setLoading(false)
                    loadingRef.current = false
                    setCurrentStatus('')
                    taskTimeoutRef.current = null
                  }
                }
              }, 2000)

              // 将 pollInterval 保存到 ref 中，以便在组件卸载时清理
              ;(pollIntervalRef as any).current = pollInterval
            }
          } else {
            // 任务已完成，清空所有状态
            if (taskState.status === 'running' && (hasContent || hasMedia || hasAgentResult)) {
              console.log('[MindChat] 检测到消息已有完整内容（content:', hasContent, ', media:', hasMedia, ', agent_result:', hasAgentResult, '），忽略 task_state.running，视为任务完成')
            } else {
              console.log('[MindChat] 任务已完成，清空所有状态')

              // 🔴 检查是否有失败的步骤（如视频生成超时）
              const hasFailedStep = taskState.progressHistory?.some((step: any) =>
                step.status === 'failed' || step.type === 'observation' && step.data?.success === false
              )

              if (hasFailedStep && !hasMedia && taskState.lastProgressMessage?.includes('生成视频')) {
                console.log('[MindChat] 检测到视频生成失败，提示用户')

                // 延迟显示提示，避免影响页面渲染
                setTimeout(() => {
                  Taro.showModal({
                    title: '视频生成失败',
                    content: '抱歉，视频生成超时，无法生成视频。豆包视频生成 API 较慢，通常需要 5-10 分钟，请稍后再试。',
                    showCancel: false,
                    confirmText: '知道了'
                  })
                }, 500)
              }
            }
            setLoading(false)
            loadingRef.current = false
            setCurrentStatus('')
            setTaskProgress(0)
            setAgentSteps([])
          }
        } else if (lastAssistantMessage?.metadata?.agent_steps) {
          // 兼容旧格式（metadata.agent_steps）
          const steps = lastAssistantMessage.metadata.agent_steps
          const lastStep = steps[steps.length - 1]

          // 检查任务是否已完成（有 result 字段或者 status 是 completed）
          const isTaskCompleted = lastStep?.status === 'completed' || lastStep?.status === 'failed' || lastAssistantMessage?.metadata?.result

          if (!isTaskCompleted && lastStep?.status === 'running') {
            console.log('[MindChat] 检测到未完成的任务（旧格式），恢复状态')

            // 恢复任务状态
            setLoading(true)
            loadingRef.current = true
            setCurrentStatus(lastStep.message || '任务执行中...')
            setAgentSteps(steps)

            // 提示用户任务状态
            Taro.showModal({
              title: '任务状态',
              content: '检测到有任务正在执行中，但可能已中断，当前停留在：' + (lastStep.message || '任务执行中') + '\n\n如需继续，请重新发送相同指令。',
              showCancel: false,
              success: () => {
                // 用户点击确定后清空 loading 状态
                setLoading(false)
                loadingRef.current = false
                setCurrentStatus('')
                setTaskProgress(0)
                setAgentSteps([])
              }
            })
          } else if (isTaskCompleted) {
            // 任务已完成，清空状态
            console.log('[MindChat] 任务已完成（旧格式），清空状态')
            setLoading(false)
            loadingRef.current = false
            setCurrentStatus('')
            setTaskProgress(0)
            setAgentSteps([])
          }
        } else {
          // 没有任务状态，清空所有状态
          console.log('[MindChat] 没有任务状态，清空所有状态')
          setLoading(false)
          loadingRef.current = false
          setCurrentStatus('')
          setTaskProgress(0)
          setAgentSteps([])
        }

        // 额外检查：如果最后一条消息是 assistant 消息且 loading 仍然为 true，强制清空
        if (loading && messages.length > 0) {
          const lastMessage = messages[messages.length - 1]
          if (lastMessage.role === 'assistant') {
            console.warn('[MindChat] 检测到最后一条消息是 assistant 但 loading 仍为 true，强制清空')
            setLoading(false)
            loadingRef.current = false
            setCurrentStatus('')
            setTaskProgress(0)
            setAgentSteps([])
          }
        }

        // 确保启用滚动到底部
        shouldScrollToBottomRef.current = true
        // useEffect 会在 messages 变化时自动滚动
        // 这里额外延迟滚动确保成功（双重保障）
        setTimeout(() => {
          scrollToBottom()
        }, 200)
        setTimeout(() => {
          scrollToBottom()
        }, 500)
      }
    } catch (error) {
      console.error('[MindChat] 获取消息失败:', error)
    }
  }

  // 加载更多历史消息（下拉刷新）
  const loadMoreMessages = async () => {
    if (!conversation || !hasMoreMessages || isLoadingMore) return
    
    setIsLoadingMore(true)
    // 加载历史消息时，禁止滚动到底部
    shouldScrollToBottomRef.current = false
    try {
      const oldestMessage = messages[0]
      const res = await Network.request({
        url: `/api/chat/conversation/${conversation.id}/messages?limit=20&before=${oldestMessage?.id}`
      })
      if (res.data?.code === 200) {
        const newMessages = res.data.data || []
        if (newMessages.length > 0) {
          setMessages(prev => [...newMessages, ...prev])
          setHasMoreMessages(newMessages.length >= 20)
        } else {
          setHasMoreMessages(false)
        }
      }
    } catch (error) {
      console.error('[MindChat] 加载更多消息失败:', error)
    } finally {
      setIsLoadingMore(false)
      setRefreshing(false)
      // 恢复滚动到底部的行为
      setTimeout(() => {
        shouldScrollToBottomRef.current = true
      }, 500)
    }
  }

  const switchConversation = async (conv: Conversation) => {
    setConversation(conv)
    setMessages([])
    // 切换对话时，启用滚动到底部
    shouldScrollToBottomRef.current = true
    await fetchMessages(conv.id)
    setShowHistory(false)
    showToast({ title: '已切换对话', icon: 'success', duration: 1000 })
  }

  const scrollToBottom = () => {
    // 方法1：使用 scrollTop 滚动到底部
    scrollCounterRef.current += 1
    const newScrollTop = 999999 + scrollCounterRef.current
    setScrollTop(newScrollTop)
    
    // 方法2：使用 scrollIntoView 滚动到最后一条消息
    // 计算最后一条消息的 id
    if (messages.length > 0) {
      const lastMsgId = `msg-${messages.length - 1}`
      setScrollIntoView(lastMsgId)
    }
  }

  // 🔴 新增：上传图片
  const handleUploadImage = () => {
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0]
        try {
          // 上传图片到 TOS
          const uploadRes = await Network.uploadFile({
            url: '/api/upload',
            filePath: tempFilePath,
            name: 'file'
          })

          console.log('[上传图片] 上传结果:', uploadRes)

          const uploadData = JSON.parse(uploadRes.data)
          if (uploadData.code === 200 && uploadData.data.url) {
            setUploadedImages([...uploadedImages, uploadData.data.url])
            showToast({ title: '图片上传成功', icon: 'success' })
          } else {
            showToast({ title: '上传失败', icon: 'none' })
          }
        } catch (error) {
          console.error('[上传图片] 错误:', error)
          showToast({ title: '上传失败', icon: 'none' })
        }
      }
    })
  }

  // 🔴 新增：上传视频
  const handleUploadVideo = () => {
    Taro.chooseVideo({
      sourceType: ['album', 'camera'],
      maxDuration: 60,
      camera: 'back',
      success: async (res) => {
        const tempFilePath = res.tempFilePath
        try {
          // 上传视频到 TOS
          const uploadRes = await Network.uploadFile({
            url: '/api/upload',
            filePath: tempFilePath,
            name: 'file'
          })

          console.log('[上传视频] 上传结果:', uploadRes)

          const uploadData = JSON.parse(uploadRes.data)
          if (uploadData.code === 200 && uploadData.data.url) {
            setUploadedVideos([...uploadedVideos, uploadData.data.url])
            showToast({ title: '视频上传成功', icon: 'success' })
          } else {
            showToast({ title: '上传失败', icon: 'none' })
          }
        } catch (error) {
          console.error('[上传视频] 错误:', error)
          showToast({ title: '上传失败', icon: 'none' })
        }
      }
    })
  }

  // 🔴 新增：删除上传的图片
  const handleRemoveImage = (index: number) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== index))
  }

  // 🔴 新增：删除上传的视频
  const handleRemoveVideo = (index: number) => {
    setUploadedVideos(uploadedVideos.filter((_, i) => i !== index))
  }

  // 发送消息 - 使用旧的 Agent 系统（ReAct 模式）
  const sendMessage = async (text?: string) => {
    const messageText = text || inputText

    console.log('[MindChat] sendMessage 被调用:', {
      textParam: text,
      inputTextState: inputText,
      messageText,
      trimmedMessageText: messageText.trim(),
      hasConversation: !!conversation,
      isLoading: loading,
      loadingRef: loadingRef.current,
      uploadedImages,
      uploadedVideos
    })

    if (!messageText.trim() && uploadedImages.length === 0 && uploadedVideos.length === 0) {
      showToast({ title: '请输入消息或上传图片/视频', icon: 'none' })
      return
    }

    if (!conversation) {
      showToast({ title: '对话不存在', icon: 'none' })
      return
    }

    // 如果 loading 状态卡住，强制清空（不考虑 loadingRef）
    if (loading) {
      console.warn('[MindChat] 检测到 loading 状态卡住，强制清空')
      setLoading(false)
      loadingRef.current = false
      setCurrentStatus('')
      setTaskProgress(0)
      setAgentSteps([])
    }

    // 再次检查 loading 状态
    if (loading) {
      showToast({ title: '正在处理中，请稍候', icon: 'none' })
      return
    }

    // 发送消息前，记录当前的 messageCount
    messageCountBeforeSendRef.current = learningStats.messageCount
    console.log('[MindChat] 发送消息前记录 messageCount:', learningStats.messageCount)

    // 发送消息时，确保滚动到底部
    shouldScrollToBottomRef.current = true

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString(),
      // 🔴 新增：添加上传的图片和视频
      metadata: {
        uploaded_images: uploadedImages.length > 0 ? uploadedImages : undefined,
        uploaded_videos: uploadedVideos.length > 0 ? uploadedVideos : undefined
      }
    }

    setMessages(prev => [...prev, userMessage])
    setInputText('')
    // 🔴 新增：清空上传的图片和视频
    setUploadedImages([])
    setUploadedVideos([])
    setLoading(true)
    loadingRef.current = true
    setAgentSteps([])  // 清空之前的步骤
    setTaskProgress(0) // 重置进度百分比
    setCurrentStatus('思考中...')

    // 立即滚动到底部，显示新消息
    setTimeout(() => {
      scrollToBottom()
    }, 50)

    try {
      // 🔴 新增：构建任务描述，包含上传的图片和视频
      let enhancedTaskDescription = messageText
      if (uploadedImages.length > 0) {
        enhancedTaskDescription += `\n[用户上传了 ${uploadedImages.length} 张图片: ${uploadedImages.join(', ')}]`
      }
      if (uploadedVideos.length > 0) {
        enhancedTaskDescription += `\n[用户上传了 ${uploadedVideos.length} 个视频: ${uploadedVideos.join(', ')}]`
      }

      // 所有消息都通过新的 Avatar Agent 处理（独立智能体模式）
      await executeAsAgent(enhancedTaskDescription, uploadedImages, uploadedVideos)
      scrollToBottom()
    } catch (error) {
      console.error('[MindChat] Avatar Agent 执行失败:', error)
      // 降级为普通对话（暂不修改，保持兼容）
      await fallbackToNormalChat(messageText)
    } finally {
      console.log('[MindChat] 发送消息完成，重置 loading 状态')
      setLoading(false)
      loadingRef.current = false
    }
  }

  // 使用旧的 Agent 系统（ReAct 模式）
  const executeAsAgent = async (content: string, images?: string[], videos?: string[]) => {
    try {
      console.log('[MindChat] 使用旧的 Agent 系统，ReAct 模式')
      console.log('[MindChat] 分身信息:', avatar)
      console.log('[MindChat] 会话信息:', conversation)

      const userStore = useUserStore.getState()
      const userId = userStore.userInfo?.id

      if (!avatar?.id) {
        throw new Error('分身信息不存在')
      }

      if (!userId) {
        throw new Error('用户信息不存在')
      }

      setCurrentStatus('思考中...')

      // 🔴 新增：构建附件信息
      const attachments: any = {}
      if (images && images.length > 0) {
        attachments.images = images
      }
      if (videos && videos.length > 0) {
        attachments.videos = videos
      }

      // 调用旧的 Agent API（异步模式）
      const res = await Network.request({
        url: `/api/agent/execute`,
        method: 'POST',
        data: {
          avatar_id: avatar.id,
          task_description: content,
          conversation_id: conversation?.id,
          conversation_history: messages.slice(-5).map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          // 🔴 新增：传递附件信息
          ...(Object.keys(attachments).length > 0 ? { attachments } : {})
        }
      })

      console.log('[MindChat] Agent 响应:', res.data)

      if (res.data?.code !== 200) {
        throw new Error(res.data?.message || 'Agent 调用失败')
      }

      const taskId = res.data.data.taskId
      console.log('[MindChat] 任务ID:', taskId)

      // 轮询获取结果
      await pollAgentResult(taskId)

      // 任务完成，清空状态提示
      setCurrentStatus('')
      setAgentSteps([])
      setTaskProgress(0)
      console.log('[MindChat] 任务完成，已清空所有状态')
    } catch (error: any) {
      console.error('[MindChat] Agent 执行失败:', error)
      // 清空状态提示，确保不会影响下一次发送
      setCurrentStatus('')
      setAgentSteps([])
      setTaskProgress(0)
      console.log('[MindChat] 已清空所有状态')
      // 重新抛出错误，让外层 catch 块处理
      throw error
    }
  }

  // 轮询获取 Agent 结果
  const pollAgentResult = async (taskId: string) => {
    const maxAttempts = 450 // 🔴 修复：最多轮询 450 次（约 15 分钟，确保6个视频生成完成）
    const interval = 2000 // 每 2 秒轮询一次
    const maxEmptyAttempts = 3 // 🔴 新增：最多连续 3 次进度为空，则认为任务已中断
    let emptyAttemptCount = 0 // 🔴 新增：记录连续为空的次数

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // 获取进度
        const progressRes = await Network.request({
          url: `/api/agent/progress`,
          method: 'GET',
          data: {
            taskId
          }
        })

        if (progressRes.data?.code === 200) {
          const progress = progressRes.data.data.progress || []

          // 🔴 修复：如果进度为空，记录次数
          if (progress.length === 0) {
            emptyAttemptCount++
            console.warn(`[MindChat] 进度为空（第 ${emptyAttemptCount}/${maxEmptyAttempts} 次），任务可能已中断`)

            // 如果连续多次为空，说明任务已中断
            if (emptyAttemptCount >= maxEmptyAttempts) {
              console.error('[MindChat] 任务已中断，停止轮询')

              // 清空进度显示
              setCurrentStatus('')
              setAgentSteps([])
              setTaskProgress(0)

              // 显示错误提示
              toast.error('任务已中断，请重试')

              // 停止轮询
              return null
            }

            // 继续轮询
            await new Promise(resolve => setTimeout(resolve, interval))
            continue
          }

          // 进度不为空，重置计数
          emptyAttemptCount = 0

          // 更新进度百分比
          const latestProgress = progress[progress.length - 1]

          // 更新进度百分比（如果有百分比字段）
          if (typeof latestProgress.percentage === 'number') {
            setTaskProgress(latestProgress.percentage)
          }

          // 更新步骤显示
          const stepDisplay: AgentStepDisplay = {
            action: latestProgress.action || latestProgress.step || '执行中',
            displayName: latestProgress.action || latestProgress.step || '执行中',
            status: latestProgress.status === 'completed' ? 'success' : latestProgress.status === 'failed' ? 'failed' : 'running',
            message: latestProgress.message || latestProgress.result || ''
          }
          setAgentSteps(prev => {
            // 避免重复添加相同的步骤
            const lastStep = prev[prev.length - 1]
            if (lastStep && lastStep.action === stepDisplay.action) {
              return prev
            }
            return [...prev, stepDisplay]
          })
          setCurrentStatus(latestProgress.message || latestProgress.step || '执行中...')
        }

        // 获取结果
        const resultRes = await Network.request({
          url: `/api/agent/result/${taskId}`,
          method: 'GET'
        })

        if (resultRes.data?.code === 200 && resultRes.data.data) {
          const result = resultRes.data.data

          console.log('[MindChat] 任务状态:', result.status, '任务数据:', result)

          // 检查任务是否完成
          if (result.status === 'completed' || result.status === 'failed') {
            // result.result 是 AgentExecutionResult 对象，包含 finalAnswer, steps 等字段
            const executionResult = result.result

            console.log('[MindChat] 任务完成，执行结果:', executionResult)

            // 创建助手消息
            const assistantMessage: Message = {
              id: Date.now().toString(),
              role: 'assistant',
              content: executionResult?.finalAnswer || result.result?.finalAnswer || result.result?.result || result.message || '任务完成',
              created_at: new Date().toISOString(),
              metadata: {
                agent_result: {
                  success: result.status === 'completed' && executionResult?.success !== false,
                  finalAnswer: executionResult?.finalAnswer || result.result?.finalAnswer || result.result?.result || result.message || '任务完成',
                  steps: executionResult?.steps || result.result?.steps || result.steps || [],
                  requiresConfig: executionResult?.requiresConfig ?? result.result?.requiresConfig ?? false
                },
                agent_steps: (executionResult?.steps || result.result?.steps || result.steps || []).map((step: any) => ({
                  action: step.action || step.step || '',
                  displayName: step.action || step.step || '',
                  status: step.status === 'completed' ? 'success' : step.status === 'failed' ? 'failed' : 'running',
                  message: step.message || step.result || step.observation || ''
                }))
              }
            }

            setMessages(prev => [...prev, assistantMessage])

            // 检查是否需要平台配置
            if (result.requiresConfig) {
              setConfigPlatform(result.configPlatform)
              setShowConfigDialog(true)
            }

            // 任务完成，设置进度为100%，清空状态提示
            setTaskProgress(100)
            setCurrentStatus('')
            setAgentSteps([])
            console.log('[MindChat] 任务完成，已清空状态')
            return
          }
        }

        // 等待下一次轮询
        await new Promise(resolve => setTimeout(resolve, interval))
      } catch (error) {
        console.error('[MindChat] 轮询失败:', error)
        // 继续轮询，不中断
      }
    }

    // 超时
    throw new Error('任务执行超时')
  }

  // 获取平台名称
  const getPlatformName = (platform: PlatformType): string => {
    const names: Record<PlatformType, string> = {
      wechat_mp: '微信公众号',
      xiaohongshu: '小红书',
      bilibili: 'B站',
      weibo: '微博',
      douyin: '抖音',
      wechat_video: '微信视频号'
    }
    return names[platform] || platform
  }
  
  // 处理发布请求
  const handlePublish = async () => {
    if (!pendingPublish) return
    
    const { platform, content } = pendingPublish
    
    // 判断是否是支持 API 发布的平台
    const apiSupportedPlatforms: PlatformType[] = ['wechat_mp']
    
    if (!apiSupportedPlatforms.includes(platform)) {
      // 不支持 API 发布的平台，一键发布到对应APP
      const env = Taro.getEnv()
      
      // 构建发布内容
      const publishContent = content.title 
        ? `【${content.title}】\n\n${content.content}`
        : content.content || ''
      
      if (env === Taro.ENV_TYPE.WEB) {
        // H5环境：跳转到中转页面
        const encodedContent = encodeURIComponent(publishContent)
        const encodedTitle = content.title ? encodeURIComponent(content.title) : ''
        const url = `/pages/publish-redirect/index?platform=${platform}&content=${encodedContent}&title=${encodedTitle}`
        Taro.navigateTo({ url })
      } else {
        // 小程序环境：显示H5链接弹窗
        // 生成H5链接（使用项目域名）
        const h5Url = `${window.location.origin}/pages/publish-redirect/index?platform=${platform}&content=${encodeURIComponent(publishContent)}&title=${content.title ? encodeURIComponent(content.title) : ''}`
        setH5PublishUrl(h5Url)
        setShowH5PublishDialog(true)
      }
      setShowPublishConfirm(false)
      return
    }
    
    try {
      setLoading(true)
      loadingRef.current = true
      setCurrentStatus('正在检查平台配置...')
      
      // 先检查平台配置
      const checkRes = await Network.request({
        url: `/api/agent/platform-config/${platform}`
      })
      
      const isConfigured = checkRes.data?.data?.configured
      
      if (!isConfigured) {
        // 未配置，打开配置弹窗
        setShowPublishConfirm(false)
        setConfigPlatform(platform)
        setShowConfigDialog(true)
        setLoading(false)
        setCurrentStatus('')
        return
      }
      
      // 已配置，直接发布
      setCurrentStatus(`正在发布到${getPlatformName(platform)}...`)
      
      const publishRes = await Network.request({
        url: `/api/agent/publish/${platform}`,
        method: 'POST',
        data: {
          title: content.title,
          content: content.content,
          cover_url: content.coverImage,
          images: content.images
        }
      })
      
      if (publishRes.data?.code === 200) {
        const publishData = publishRes.data.data
        
        // 检查是否需要手动发布
        if (publishData?.manual_publish_required) {
          // 需要手动发布，显示引导弹窗
          setShowPublishConfirm(false)
          setPublishGuideData({
            platform: platform as keyof typeof PLATFORM_CONFIGS,
            content: {
              title: publishData.title || content.title,
              content: publishData.content || content.content,
              images: publishData.images || content.images,
              tags: publishData.tags
            }
          })
          setShowPublishGuide(true)
        } else {
          // 发布成功
          showToast({ title: '发布成功！', icon: 'success' })
          setPendingPublish(null)
          
          // 添加一条发布成功的消息
          const successMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `✅ 内容已成功发布到${getPlatformName(platform)}！\n\n${publishData?.url ? `查看链接：${publishData.url}` : ''}`,
            created_at: new Date().toISOString()
          }
          setMessages(prev => [...prev, successMsg])
          scrollToBottom()
        }
      } else {
        showToast({ title: publishRes.data?.message || '发布失败', icon: 'none' })
      }
    } catch (err) {
      console.error('发布失败:', err)
      showToast({ title: '发布失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
      setCurrentStatus('')
    }
  }

  // 降级为普通对话
  const fallbackToNormalChat = async (content: string) => {
    try {
      const res = await Network.request({
        url: '/api/chat/send',
        method: 'POST',
        data: {
          conversation_id: conversation?.id,
          avatar_id: avatar?.id,
          content
        }
      })

      if (res.data?.code === 200) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: res.data.data.content,
          created_at: new Date().toISOString(),
          metadata: res.data.data.metadata
        }
        setMessages(prev => [...prev, aiMessage])
        scrollToBottom()
        // 播放语音回复
        playVoiceReply(res.data.data.content)
        fetchConversations()
        // 对话完成后刷新学习数据并显示学习特效
        // 延迟 1.5 秒确保后端学习分析完成
        setTimeout(() => {
          fetchLearningStats(true)
        }, 1500)
      }
    } catch (error) {
      // 最后的降级方案
      setTimeout(() => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `我是${avatar?.name || 'AI分身'}，我已收到你的消息。作为你的智能分身，我可以帮你写文章、生成图片、发布内容到各大平台。你可以直接告诉我要做什么，比如"帮我写一篇公众号文章"。`,
          created_at: new Date().toISOString()
        }
        setMessages(prev => [...prev, aiMessage])
        scrollToBottom()
      }, 1000)
    } finally {
      setLoading(false)
      loadingRef.current = false
      setCurrentStatus('')
    }
  }

  const toggleVoiceMode = () => {
    setIsVoiceMode(!isVoiceMode)
    if (isRecording) {
      stopRecording()
    }
  }

  const startRecording = () => {
    const env = Taro.getEnv()
    
    if (env !== Taro.ENV_TYPE.WEAPP) {
      // H5 端不支持录音，提示用户使用文字输入
      showToast({ title: 'H5端暂不支持语音输入，请使用文字输入', icon: 'none', duration: 2000 })
      setIsVoiceMode(false)  // 自动切换回文字模式
      return
    }
    
    const recorderManager = Taro.getRecorderManager()
    
    recorderManager.onStart(() => {
      setIsRecording(true)
      setRecordingTime(0)
      showToast({ title: '开始录音...', icon: 'none', duration: 60000 })
    })
    
    recorderManager.onStop((res) => {
      setIsRecording(false)
      const { tempFilePath } = res
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
      
      recognizeSpeech(tempFilePath)
    })
    
    recorderManager.onError((err) => {
      console.error('录音失败:', err)
      showToast({ title: '录音失败', icon: 'none' })
      setIsRecording(false)
    })
    
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1)
    }, 1000)
    
    try {
      recorderManager.start({
        format: 'mp3',
        duration: 60000
      })
    } catch (error) {
      console.error('启动录音失败:', error)
      showToast({ title: '启动录音失败', icon: 'none' })
    }
  }

  const stopRecording = () => {
    if (!isRecording) return
    
    setIsRecording(false)
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    
    const env = Taro.getEnv()
    
    if (env === Taro.ENV_TYPE.WEAPP) {
      const recorderManager = Taro.getRecorderManager()
      recorderManager.stop()
    }
    
    setRecordingTime(0)
  }

  const recognizeSpeech = async (filePath: string) => {
    try {
      showToast({ title: '识别中...', icon: 'loading', duration: 10000 })
      
      const res = await Network.uploadFile({
        url: '/api/audio/asr',
        filePath: filePath,
        name: 'audio'
      })
      
      const responseData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
      
      if (responseData?.code === 200) {
        const text = responseData.data?.text || ''
        setInputText(text)
        showToast({ title: '识别完成', icon: 'success', duration: 1000 })
        
        if (text.trim()) {
          setTimeout(() => {
            sendMessage(text)
          }, 500)
        }
      } else {
        showToast({ title: '识别失败', icon: 'none' })
      }
    } catch (error) {
      console.error('语音识别失败:', error)
      const fallbackText = '我发了一条语音消息'
      setInputText(fallbackText)
      showToast({ title: '语音功能暂不可用', icon: 'none' })
    }
  }

  const copyMessage = (content: string) => {
    Taro.setClipboardData({
      data: content,
      success: () => {
        showToast({ title: '已复制', icon: 'success' })
      }
    })
  }

  // 播放语音回复
  const playVoiceReply = async (content: string) => {
    // 检查是否开启语音回复
    if (!avatar?.config?.voice_enabled) {
      return
    }

    try {
      console.log('[MindChat] 正在获取语音回复...')
      const res = await Network.request({
        url: `/api/avatar/${avatar.id}/tts`,
        method: 'POST',
        data: { text: content }
      })

      if (res.data?.code === 200 && res.data?.data?.audioUrl) {
        const audioUrl = res.data.data.audioUrl
        console.log('[MindChat] 语音URL:', audioUrl)
        
        // 创建音频上下文并播放
        const innerAudioContext = Taro.createInnerAudioContext()
        innerAudioContext.src = audioUrl
        innerAudioContext.onPlay(() => {
          console.log('[MindChat] 开始播放语音')
        })
        innerAudioContext.onError((err) => {
          console.error('[MindChat] 语音播放失败:', err)
        })
        innerAudioContext.play()
      }
    } catch (error) {
      console.error('[MindChat] 获取语音失败:', error)
      // 静默失败，不影响用户体验
    }
  }

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 从文本中提取视频链接
  const extractVideoUrlFromText = (text: any): { videoUrl: string | null; textWithoutVideo: string } => {
    // 确保 text 是字符串类型
    const textStr = typeof text === 'string' ? text : String(text || '')

    // 清理调试信息（移除所有类型的调试文本和链接）
    let cleanedText = textStr

    // 移除"已为你生成.*链接如下："模式（包含后续的所有编号链接）
    cleanedText = cleanedText.replace(/已为你生成.*?[，,]?\s*链接如下[::：][\s\S]*?(?=\n\n|\n[A-Z\u4e00-\u9fa5]|$)/gi, '')

    // 移除"图片链接如下："模式（移除行内的URL和编号）
    cleanedText = cleanedText.replace(/图片链接如下[::：]\s*(\d+[\.、]\s*)?https?:\/\/[^\s\n]+(\s*\n\s*\d+[\.、]\s*https?:\/\/[^\s\n]+)*/gi, '')

    // 移除"视频链接如下："模式
    cleanedText = cleanedText.replace(/视频链接如下[::：]\s*(\d+[\.、]\s*)?https?:\/\/[^\s\n]+(\s*\n\s*\d+[\.、]\s*https?:\/\/[^\s\n]+)*/gi, '')

    // 移除"已为你生成.*配图"模式（包含后续的链接信息）
    cleanedText = cleanedText.replace(/已为你生成.*配图[，,]\s*图片链接如下[::：]\s*https?:\/\/[^\s\n]+/gi, '')

    // 移除独立的链接行（单独一行的带编号URL）
    cleanedText = cleanedText.replace(/^\s*\d+[\.、]\s*https?:\/\/[^\s\n]+$/gm, '')

    // 移除多余的空行
    cleanedText = cleanedText.replace(/\n\s*\n\s*\n/g, '\n\n')

    // 匹配视频链接（支持 .mp4、.mov、.webm 结尾的 URL）
    // 使用正则表达式匹配 "视频链接：" 或 "video:" 等关键词后的 URL
    const videoUrlPattern = /(视频链接[:：]\s*)?(https?:\/\/[^\s]+?\.(?:mp4|mov|webm)(?:\?[^\s]*)?)/i
    const match = cleanedText.match(videoUrlPattern)

    if (match && match[2]) {
      const videoUrl = match[2]
      const textWithoutVideo = cleanedText.replace(match[0], '').trim()
      return { videoUrl, textWithoutVideo }
    }

    // 如果没有匹配到，尝试直接查找以 .mp4、.mov、.webm 结尾的 URL
    const directUrlPattern = /(https?:\/\/[^\s]+?\.(?:mp4|mov|webm)(?:\?[^\s]*)?)/i
    const directMatch = cleanedText.match(directUrlPattern)

    if (directMatch && directMatch[1]) {
      const videoUrl = directMatch[1]
      const textWithoutVideo = cleanedText.replace(directMatch[0], '').trim()
      return { videoUrl, textWithoutVideo }
    }

    return { videoUrl: null, textWithoutVideo: cleanedText }
  }

  // 渲染消息内容（支持富媒体）
  const renderMessageContent = (msg: Message) => {
    // 🔴 新增：检测短剧数据
    const hasShortDrama = (() => {
      if (msg.metadata?.task_state?.progressHistory) {
        const progressHistory = msg.metadata.task_state.progressHistory as any[]
        console.log('[短剧检测] 检查 progressHistory，长度:', progressHistory.length)

        const dramaStep = progressHistory.find((item: any) =>
          item.action === 'observation' &&
          item.data?.action === 'produce_shortdrama' &&
          item.data?.status === 'completed'
        )

        console.log('[短剧检测] 找到的 dramaStep:', dramaStep ? '有' : '无')

        if (dramaStep) {
          const dramaData = dramaStep.data?.data
          const hasData = dramaData &&
            (dramaData.characters?.length > 0 ||
             dramaData.scenes?.length > 0 ||
             dramaData.video_clips?.length > 0)
          console.log('[短剧检测] dramaData 存在:', !!dramaData, '有数据:', hasData)
          return hasData
        }
      }
      return false
    })()

    // 🔴 新增：提取短剧数据
    const shortDramaData = (() => {
      if (msg.metadata?.task_state?.progressHistory) {
        const progressHistory = msg.metadata.task_state.progressHistory as any[]
        const dramaStep = progressHistory.find((item: any) =>
          item.action === 'observation' &&
          item.data?.action === 'produce_shortdrama' &&
          item.data?.status === 'completed'
        )
        const data = dramaStep?.data?.data
        console.log('[短剧检测] 提取到的 dramaData:', data ? {
          characters: data.characters?.length || 0,
          scenes: data.scenes?.length || 0,
          video_clips: data.video_clips?.length || 0
        } : '无')
        return data || null
      }
      return null
    })()

    // 检测分身列表数据
    const hasAvatarList = (() => {
      if (msg.metadata?.agent_result?.steps) {
        const steps = msg.metadata.agent_result.steps || []
        return steps.some((step: ReActStep) =>
          step.action === 'app_list_avatars' && step.observation?.data?.avatars
        )
      }
      return false
    })()

    // 检测用户好友列表数据
    const hasUserFriendList = (() => {
      if (msg.metadata?.agent_result?.steps) {
        const steps = msg.metadata.agent_result.steps || []
        return steps.some((step: ReActStep) =>
          step.action === 'app_list_user_friends' && step.observation?.data?.friends
        )
      }
      return false
    })()

    // 检测分身好友列表数据
    const hasAvatarFriendList = (() => {
      if (msg.metadata?.agent_result?.steps) {
        const steps = msg.metadata.agent_result.steps || []
        return steps.some((step: ReActStep) =>
          step.action === 'app_list_avatar_friends' && step.observation?.data?.friends
        )
      }
      return false
    })()

    return (
      <View className="message-content-wrapper">
        {/* Agent 执行步骤展示 */}
        {msg.metadata?.agent_steps && msg.metadata.agent_steps.length > 0 && (
          <View className="agent-steps-display">
            {msg.metadata.agent_steps.map((step, idx) => (
              <View key={idx} className={`agent-step-item ${step.status}`}>
                <View className="step-icon">
                  {step.status === 'success' ? (
                    <Check size={14} color="#00ff88" />
                  ) : (
                    <X size={14} color="#ff4444" />
                  )}
                </View>
                <Text className="step-name">{mapStepDisplayName(step.displayName, step)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 🔴 新增：短剧内容展示 */}
        {hasShortDrama && shortDramaData && (() => {
          const drama = shortDramaData
          const characters = drama.characters || []
          const scenes = drama.scenes || []
          const videoClips = drama.video_clips || []

          return (
            <View className="short-drama-display">
              {/* 角色展示 */}
              {characters.length > 0 && (
                <View className="drama-section">
                  <View className="section-header">
                    <Text className="section-title">👤 角色形象 ({characters.length})</Text>
                  </View>
                  <View className="characters-grid">
                    {characters.map((char: any, idx: number) => (
                      <View key={idx} className="character-card">
                        <Image
                          src={char.url}
                          className="character-image"
                          mode="aspectFill"
                          onError={() => {
                            console.error('[角色图片] 加载失败:', char.url)
                          }}
                        />
                        <Text className="character-name">{char.character || `角色 ${idx + 1}`}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* 场景展示 */}
              {scenes.length > 0 && (
                <View className="drama-section">
                  <View className="section-header">
                    <Text className="section-title">🎬 场景设计 ({scenes.length})</Text>
                  </View>
                  <View className="scenes-grid">
                    {scenes.map((scene: any, idx: number) => (
                      <View key={idx} className="scene-card">
                        <Image
                          src={scene.url}
                          className="scene-image"
                          mode="aspectFill"
                          onError={() => {
                            console.error('[场景图片] 加载失败:', scene.url)
                          }}
                        />
                        <Text className="scene-name">{scene.scene || scene.prompt || `场景 ${idx + 1}`}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* 视频展示 */}
              {videoClips.length > 0 && (
                <View className="drama-section">
                  <View className="section-header">
                    <Text className="section-title">🎥 关键镜头视频 ({videoClips.length})</Text>
                  </View>
                  <View className="videos-grid">
                    {videoClips.map((clip: any, idx: number) => (
                      <View key={idx} className="video-card">
                        {(() => {
                          const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB
                          return isH5 ? (
                            <video
                              src={clip.url}
                              className="video-player"
                              controls
                              playsInline
                              webkit-playsinline="true"
                              x5-playsinline="true"
                              preload="metadata"
                              muted={false}
                              loop={false}
                              style={{ width: '100%', height: '180px', borderRadius: '8px', backgroundColor: '#000' }}
                              onError={(e) => {
                                console.error('[视频渲染] H5视频播放错误:', e)
                                Taro.showToast({ title: '视频加载失败，请重试', icon: 'none' })
                              }}
                            />
                          ) : (
                            <Video
                              src={clip.url}
                              className="video-player"
                              controls
                              showFullscreenBtn
                              showPlayBtn
                              showCenterPlayBtn
                              poster={drama.image_urls && drama.image_urls[0] || undefined}
                              objectFit="contain"
                              style={{ width: '100%', height: '180px', borderRadius: '8px' }}
                              onError={(e) => {
                                console.error('[视频渲染] 小程序视频播放错误:', e)
                                Taro.showToast({ title: '视频加载失败，请重试', icon: 'none' })
                              }}
                            />
                          )
                        })()}
                        <Text className="video-title">{clip.clip_number ? `镜头 ${clip.clip_number}` : `视频 ${idx + 1}`}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* 🔴 新增：成品视频 */}
              {drama.edited_video_url && (() => {
                const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB
                return (
                  <View
                    className="drama-section"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 245, 255, 0.1))',
                      border: '1px solid rgba(0, 255, 136, 0.2)'
                    }}
                  >
                    <View className="section-header">
                      <Text className="section-title" style={{ color: '#00ff88' }}>🎬 完整成品视频</Text>
                    </View>
                    <View className="final-video-container">
                      {isH5 ? (
                        <video
                          src={drama.edited_video_url}
                          className="final-video-player"
                          controls
                          playsInline
                          webkit-playsinline="true"
                          x5-playsinline="true"
                          preload="metadata"
                          muted={false}
                          loop={false}
                          poster={drama.image_urls && drama.image_urls[0] || undefined}
                          style={{ width: '100%', height: '240px', borderRadius: '12px', backgroundColor: '#000' }}
                          onError={() => {
                            console.error('[成品视频] H5视频播放错误:', drama.edited_video_url)
                            Taro.showToast({ title: '成品视频加载失败，请重试', icon: 'none' })
                          }}
                        />
                      ) : (
                        <Video
                          src={drama.edited_video_url}
                          className="final-video-player"
                          controls
                          showFullscreenBtn
                          showPlayBtn
                          showCenterPlayBtn
                          poster={drama.image_urls && drama.image_urls[0] || undefined}
                          objectFit="contain"
                          style={{ width: '100%', height: '240px', borderRadius: '12px' }}
                          onError={() => {
                            console.error('[成品视频] 小程序视频播放错误:', drama.edited_video_url)
                            Taro.showToast({ title: '成品视频加载失败，请重试', icon: 'none' })
                          }}
                        />
                      )}
                      <Text className="final-video-hint">✨ 这是合成的完整成品视频，可直接观看</Text>
                    </View>
                  </View>
                )
              })()}

              {/* 🔴 新增：字幕展示 */}
              {drama.subtitle_url && (
                <View className="drama-section">
                  <View className="section-header">
                    <Text className="section-title">📝 字幕文件</Text>
                  </View>
                  <View className="subtitle-container">
                    <Text className="subtitle-text">字幕已生成并添加到视频中</Text>
                    <Text className="subtitle-url">{drama.subtitle_url.substring(0, 50)}...</Text>
                  </View>
                </View>
              )}

              {/* 🔴 新增：配乐推荐 */}
              {drama.bgm_recommendations && drama.bgm_recommendations.length > 0 && (
                <View className="drama-section">
                  <View className="section-header">
                    <Text className="section-title">🎵 配乐推荐 ({drama.bgm_recommendations.length})</Text>
                  </View>
                  <View className="bgm-list">
                    {drama.bgm_recommendations.map((bgm: any, idx: number) => (
                      <View key={idx} className="bgm-item">
                        <Text className="bgm-name">{bgm.name || `配乐 ${idx + 1}`}</Text>
                        <Text className="bgm-info">{bgm.mood || ''} · {bgm.duration || '1分钟'}</Text>
                        {bgm.description && (
                          <Text className="bgm-desc">{bgm.description}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* 统计信息 */}
              <View className="drama-stats">
                <Text className="stats-text">
                  {drama.message || `包含剧本、${characters.length}个角色、${scenes.length}个场景、${videoClips.length}个视频`}
                </Text>
              </View>
            </View>
          )
        })()}

        {/* 分身列表卡片展示 */}
        {hasAvatarList && (() => {
          const steps = msg.metadata?.agent_result?.steps || []
          const listStep = steps.find((step: ReActStep) =>
            step.action === 'app_list_avatars' && step.observation?.data?.avatars
          )
          const avatarList = listStep?.observation?.data?.avatars || []

          if (avatarList.length === 0) {
            return (
              <View className="avatar-list-empty">
                <Text className="empty-text">暂无分身，快去创建一个吧！</Text>
              </View>
            )
          }

          return (
            <View className="avatar-list-cards">
              {avatarList.map((item: any) => (
                <View
                  key={item.id}
                  className="avatar-card"
                  onClick={() => {
                    Taro.navigateTo({
                      url: `/pages/avatar-profile/index?id=${item.id}`
                    })
                  }}
                >
                  <View className="avatar-card-header">
                    <View className="avatar-card-avatar">
                      {item.avatar_url ? (
                        <Image
                          src={item.avatar_url}
                          className="avatar-card-img"
                          mode="aspectFill"
                          onError={() => {
                            // 图片加载失败时不做处理，使用默认图标
                          }}
                        />
                      ) : (
                        <Sparkles size={24} color="#00f5ff" />
                      )}
                    </View>
                    <View className="avatar-card-info">
                      <Text className="avatar-card-name">{item.name || '未命名分身'}</Text>
                      <View className="avatar-card-tags">
                        <Text className="avatar-card-level">Lv.{item.level || 1}</Text>
                        {item.is_active && (
                          <Text className="avatar-card-status">活跃</Text>
                        )}
                        {item.is_hosted && (
                          <Text className="avatar-card-hosted">托管中</Text>
                        )}
                      </View>
                    </View>
                    <ChevronDown size={16} color="rgba(255,255,255,0.4)" />
                  </View>
                  {item.personality && (
                    <Text className="avatar-card-personality">{item.personality}</Text>
                  )}
                </View>
              ))}
            </View>
          )
        })()}

        {/* 用户好友列表卡片展示 */}
        {hasUserFriendList && (() => {
          const steps = msg.metadata?.agent_result?.steps || []
          const listStep = steps.find((step: ReActStep) =>
            step.action === 'app_list_user_friends' && step.observation?.data?.friends
          )
          const friends = listStep?.observation?.data?.friends || []

          if (friends.length === 0) {
            return (
              <View className="avatar-list-empty">
                <Text className="empty-text">暂无好友，快去关注其他用户吧！</Text>
              </View>
            )
          }

          return (
            <View className="avatar-list-cards">
              {friends.map((friend: any) => (
                <View
                  key={friend.friend_id}
                  className="avatar-card"
                  onClick={() => {
                    // 跳转到用户详情页（需要创建对应的页面）
                    // Taro.navigateTo({
                    //   url: `/pages/user-profile/index?id=${friend.friend_id}`
                    // })
                  }}
                >
                  <View className="avatar-card-header">
                    <View className="avatar-card-avatar">
                      {friend.friend_avatar_url ? (
                        <Image
                          src={friend.friend_avatar_url}
                          className="avatar-card-img"
                          mode="aspectFill"
                          onError={() => {
                            // 图片加载失败时不做处理
                          }}
                        />
                      ) : (
                        <User size={24} color="#00f5ff" />
                      )}
                    </View>
                    <View className="avatar-card-info">
                      <Text className="avatar-card-name">{friend.friend_name || '未命名好友'}</Text>
                      <View className="avatar-card-tags">
                        <Text className="avatar-card-level">Lv.{friend.friend_level || 1}</Text>
                      </View>
                    </View>
                    <ChevronDown size={16} color="rgba(255,255,255,0.4)" />
                  </View>
                  {friend.friend_bio && (
                    <Text className="avatar-card-personality">{friend.friend_bio}</Text>
                  )}
                </View>
              ))}
            </View>
          )
        })()}

        {/* 分身好友列表卡片展示 */}
        {hasAvatarFriendList && (() => {
          const steps = msg.metadata?.agent_result?.steps || []
          const listStep = steps.find((step: ReActStep) =>
            step.action === 'app_list_avatar_friends' && step.observation?.data?.friends
          )
          const friends = listStep?.observation?.data?.friends || []

          if (friends.length === 0) {
            return (
              <View className="avatar-list-empty">
                <Text className="empty-text">{listStep?.observation?.data?.message || '暂无分身好友，敬请期待！'}</Text>
              </View>
            )
          }

          return (
            <View className="avatar-list-cards">
              {friends.map((friend: any) => (
                <View
                  key={friend.friend_id}
                  className="avatar-card"
                  onClick={() => {
                    Taro.navigateTo({
                      url: `/pages/avatar-profile/index?id=${friend.friend_id}`
                    })
                  }}
                >
                  <View className="avatar-card-header">
                    <View className="avatar-card-avatar">
                      {friend.friend_avatar_url ? (
                        <Image
                          src={friend.friend_avatar_url}
                          className="avatar-card-img"
                          mode="aspectFill"
                          onError={() => {
                            // 图片加载失败时不做处理
                          }}
                        />
                      ) : (
                        <Sparkles size={24} color="#00f5ff" />
                      )}
                    </View>
                    <View className="avatar-card-info">
                      <Text className="avatar-card-name">{friend.friend_name || '未命名分身'}</Text>
                      <View className="avatar-card-tags">
                        <Text className="avatar-card-level">Lv.{friend.friend_level || 1}</Text>
                        {friend.compatibility_score && (
                          <Text className="avatar-card-hosted">匹配度 {Math.round(friend.compatibility_score * 100)}%</Text>
                        )}
                      </View>
                    </View>
                    <ChevronDown size={16} color="rgba(255,255,255,0.4)" />
                  </View>
                  {friend.match_reason && (
                    <Text className="avatar-card-personality">{friend.match_reason}</Text>
                  )}
                </View>
              ))}
            </View>
          )
        })()}

        {/* 文本内容和内嵌视频 */}
        {(() => {
          const { videoUrl, textWithoutVideo } = extractVideoUrlFromText(msg.content)
          const hasVideo = !!videoUrl

          // 如果有视频链接，渲染去掉视频链接的文本和视频
          if (hasVideo) {
            return (
              <>
                {textWithoutVideo && (
                  <Text className="message-text">{textWithoutVideo}</Text>
                )}

                {(() => {
                  const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB

                  return (
                    <View className="media-item video" style={{ marginTop: '12px' }}>
                      {isH5 ? (
                        <video
                          src={videoUrl}
                          className="media-video"
                          controls
                          playsInline
                          webkit-playsinline="true"
                          x5-playsinline="true"
                          preload="metadata"
                          muted={false}
                          loop={false}
                          style={{ width: '100%', height: '200px', borderRadius: '8px', backgroundColor: '#000' }}
                          onError={(e) => {
                            console.error('[视频渲染] H5视频播放错误:', e)
                            console.error('[视频渲染] 视频URL:', videoUrl)
                            const video = e.target as HTMLVideoElement
                            console.error('[视频渲染] 视频错误详情:', video.error)
                            Taro.showToast({ title: '视频加载失败，请重试', icon: 'none' })
                          }}
                          onLoadStart={() => {
                            console.log('[视频渲染] 视频开始加载:', videoUrl.substring(0, 60))
                          }}
                          onCanPlay={() => {
                            console.log('[视频渲染] 视频可以播放了')
                          }}
                          onPlay={() => {
                            console.log('[视频渲染] 视频开始播放')
                          }}
                        />
                      ) : (
                        <Video
                          src={videoUrl}
                          className="media-video"
                          controls
                          showFullscreenBtn
                          showPlayBtn
                          showCenterPlayBtn
                          enableProgressGesture
                          objectFit="contain"
                          style={{ width: '100%', height: '400rpx', borderRadius: '16rpx' }}
                          onError={(e) => {
                            console.error('小程序视频播放错误:', e)
                            Taro.showToast({ title: '视频加载失败', icon: 'none' })
                          }}
                          onPlay={() => console.log('视频开始播放')}
                        />
                      )}
                    </View>
                  )
                })()}
              </>
            )
          }

          // 没有视频链接，不在这里渲染文本
          // 文本会在后面的统一渲染逻辑中显示
          return null
        })()}
        
        {/* 富媒体内容 */}
        {(() => {
          console.log('[富媒体渲染] 开始处理消息:', {
            id: msg.id,
            role: msg.role,
            hasMetadata: !!msg.metadata,
            metadata: msg.metadata,
            hasMedia: !!msg.metadata?.media,
            mediaLength: msg.metadata?.media?.length || 0
          })

          // 检查是否有文章内容（避免重复渲染）
          const hasArticleInMedia = msg.metadata?.media?.some((m: MessageMedia) => m.type === 'article')

          // 优先使用 metadata.media，但如果 metadata.media 不完整，从 agent_result 中补充
          let mediaList = [...(msg.metadata?.media || [])]
          let publishSuccessMessage = '' // 🔴 新增：保存发布成功的提示信息

          // 调试日志：打印初始 mediaList
          if (msg.metadata?.media) {
            console.log('[图片渲染] metadata.media:', msg.metadata.media)
          }

          // 从 agent_result.steps 和 task_state.progressHistory 中提取媒体内容（补充提取，确保不遗漏）
          if (msg.metadata?.agent_result?.steps) {
            const steps = msg.metadata.agent_result.steps || []
            const existingUrls = new Set(mediaList.map((m: MessageMedia) => m.url).filter(Boolean))

            console.log('[图片渲染] 从 agent_result.steps 提取媒体，现有 URLs:', existingUrls)
            console.log('[图片渲染] agent_result.steps 数量:', steps.length)

            steps.forEach((step: ReActStep, stepIdx: number) => {
              if (step.observation?.data) {
                const data = step.observation.data
                console.log(`[图片渲染] Step ${stepIdx} data:`, data)

                // 🔴 新增：提取发布成功的提示信息（草稿箱提示）
                if (data.message && (data.message.includes('草稿箱') || data.message.includes('微信公众平台'))) {
                  if (!publishSuccessMessage) {
                    publishSuccessMessage = data.message
                    console.log('[图片渲染] 提取发布成功提示:', publishSuccessMessage)
                  }
                }

                // 图片 - 支持单个 url 和 image_urls 数组两种格式
                if (data.url && typeof data.url === 'string') {
                  // 单个URL（generate-image.tool.ts 返回的格式）
                  if (!existingUrls.has(data.url)) {
                    mediaList.push({ type: 'image', url: data.url, key: data.key })
                    existingUrls.add(data.url)
                  }
                }
                if (data.image_urls && Array.isArray(data.image_urls)) {
                  // URL数组
                  data.image_urls.forEach((url: string) => {
                    if (url && typeof url === 'string' && !existingUrls.has(url)) {
                      mediaList.push({ type: 'image', url })
                      existingUrls.add(url)
                    }
                  })
                }

                // 封面图 - 只添加不重复的图片
                if (data.cover_image_url && !existingUrls.has(data.cover_image_url)) {
                  mediaList.push({ type: 'image', url: data.cover_image_url })
                  existingUrls.add(data.cover_image_url)
                }

                // 文章 - 如果 metadata.media 中没有文章，才添加
                if (data.content && data.title && !hasArticleInMedia) {
                  // 检查是否已经添加了相同标题的文章
                  const hasSameArticle = mediaList.some(
                    (m: MessageMedia) => m.type === 'article' && m.title === data.title
                  )
                  if (!hasSameArticle) {
                    mediaList.push({
                      type: 'article',
                      title: data.title,
                      content: data.content,
                      coverImage: data.cover_image_url
                    })
                  }
                }

                // 视频
                if (data.video_url && !existingUrls.has(data.video_url)) {
                  mediaList.push({
                    type: 'video',
                    url: data.video_url,
                    key: data.video_key || data.key // 🔴 保存 key 用于重新生成签名URL
                  })
                  existingUrls.add(data.video_url)
                }
              }
            })
          }

          // 🔴 新增：从 task_state.progressHistory 中提取媒体内容（特别是公众号文章）
          if (msg.metadata?.task_state?.progressHistory) {
            const progressHistory = msg.metadata.task_state.progressHistory as any[]
            const existingUrls = new Set(mediaList.map((m: MessageMedia) => m.url).filter(Boolean))
            const existingArticles = new Set(mediaList.filter((m: MessageMedia) => m.type === 'article').map((m: MessageMedia) => m.title))

            console.log('[图片渲染] 从 task_state.progressHistory 提取媒体，现有 URLs:', existingUrls)
            console.log('[图片渲染] task_state.progressHistory 数量:', progressHistory.length)

            progressHistory.forEach((progress: any, idx: number) => {
              if (progress.action === 'observation' && progress.data?.data) {
                const observationData = progress.data
                const toolAction = observationData.action // 🔴 修复：工具名称
                const toolData = observationData.data // 🔴 修复：工具返回的数据

                console.log(`[图片渲染] Progress ${idx}: action=${toolAction}`, toolData)

                // 文章 - 从 write_wechat_mp_article 工具的返回数据中提取
                if (toolAction === 'write_wechat_mp_article' && toolData?.content && toolData?.title) {
                  const articleTitle = toolData.title
                  const articleContent = toolData.content
                  const articleCover = toolData.cover_image_url

                  console.log('[图片渲染] 提取公众号文章:', articleTitle)

                  // 检查是否已经添加了相同标题的文章
                  if (!existingArticles.has(articleTitle)) {
                    mediaList.push({
                      type: 'article',
                      title: articleTitle,
                      content: articleContent,
                      coverImage: articleCover
                    })
                    existingArticles.add(articleTitle)
                  }
                }

                // 图片 - 封面图和配图
                if (toolData?.cover_image_url && !existingUrls.has(toolData.cover_image_url)) {
                  mediaList.push({ type: 'image', url: toolData.cover_image_url })
                  existingUrls.add(toolData.cover_image_url)
                }

                // 文章 - 从 publish_wechat_mp 工具的返回数据中提取
                if (toolAction === 'publish_wechat_mp' && toolData?.published_content && toolData?.published_title) {
                  const articleTitle = toolData.published_title
                  const articleContent = toolData.published_content
                  const articleCover = toolData.cover_url

                  console.log('[图片渲染] 提取已发布的公众号文章:', articleTitle)

                  // 检查是否已经添加了相同标题的文章
                  if (!existingArticles.has(articleTitle)) {
                    mediaList.push({
                      type: 'article',
                      title: articleTitle,
                      content: articleContent,
                      coverImage: articleCover
                    })
                    existingArticles.add(articleTitle)
                  }
                }

                // 🔴 新增：提取发布成功的提示信息（草稿箱提示）
                if (toolData?.message && (toolData.message.includes('草稿箱') || toolData.message.includes('微信公众平台'))) {
                  if (!publishSuccessMessage) {
                    publishSuccessMessage = toolData.message
                    console.log('[图片渲染] 提取发布成功提示:', publishSuccessMessage)
                  }
                }
              }
            })
          }

          if (mediaList.length === 0) {
            console.log('[图片渲染] mediaList 为空，不渲染媒体内容')
            return null
          }

          console.log('[图片渲染] 最终 mediaList:', mediaList)
          console.log('[图片渲染] 准备渲染', mediaList.length, '个媒体项')

          return (
            <View className="media-container">
              {mediaList.map((media, idx) => {
                const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB
                console.log(`[图片渲染] 渲染第 ${idx} 个媒体项，类型: ${media.type}, URL:`, media.url)
                if (media.type === 'image') {
                  console.log('[图片渲染] 渲染图片 URL:', media.url)
                  return (
                    <View key={`image-${idx}-${media.url}`} className="media-item image">
                      <Image
                        src={media.url || ''}
                        className="media-image"
                        mode="widthFix"
                        onLoad={() => {
                          console.log('[图片渲染] 图片加载成功:', media.url)
                        }}
                        onError={(e) => {
                          console.error('[图片渲染] 图片加载失败:', media.url, e)
                        }}
                        onClick={() => {
                          Taro.previewImage({
                            current: media.url,
                            urls: [media.url || '']
                          })
                        }}
                      />
                      {/* 图片操作按钮 */}
                      <View className="image-actions">
                        <View
                          className="image-action-btn"
                          onClick={async (e) => {
                            e.stopPropagation()
                            // 下载图片到相册
                            Taro.showLoading({ title: '保存中...' })
                            try {
                              const res = await Network.downloadFile({
                                url: media.url || ''
                              }) as any
                              await Taro.saveImageToPhotosAlbum({
                                filePath: res.tempFilePath
                              })
                              Taro.hideLoading()
                              Taro.showToast({ title: '已保存到相册', icon: 'success' })
                            } catch (err) {
                              Taro.hideLoading()
                              console.error('保存失败:', err)
                              Taro.showToast({ title: '保存失败', icon: 'none' })
                            }
                          }}
                        >
                          <Download size={16} color="#fff" />
                        </View>
                      </View>
                    </View>
                  )
                }

                if (media.type === 'video') {
                  const videoUrl = media.url || ''

                  console.log('[视频渲染] 渲染视频:', {
                    idx,
                    isH5,
                    videoUrl: videoUrl.substring(0, 80),
                    hasKey: !!media.key,
                    key: media.key?.substring(0, 50) || ''
                  })

                  return (
                    <View key={idx} className="media-item video">
                      {isH5 ? (
                        <video
                          src={videoUrl}
                          className="media-video"
                          controls
                          playsInline
                          webkit-playsinline="true"
                          x5-playsinline="true"
                          preload="metadata"
                          muted={false}
                          loop={false}
                          style={{ width: '100%', height: '200px', borderRadius: '8px', backgroundColor: '#000' }}
                          onError={async (e) => {
                            console.error('[视频渲染] H5视频播放错误:', e)
                            console.error('[视频渲染] 视频URL:', videoUrl.substring(0, 60))
                            const video = e.target as HTMLVideoElement
                            console.error('[视频渲染] 视频错误详情:', video.error)

                            // 🔴 如果有 key，尝试重新生成签名URL
                            if (media.key) {
                              console.log('[视频渲染] 尝试使用 key 重新生成签名URL:', media.key?.substring(0, 50) || 'undefined')
                              try {
                                const res = await Network.request({
                                  url: '/api/media/sign-url',
                                  method: 'GET',
                                  data: { key: media.key }
                                })

                                if (res.data?.code === 200 && res.data?.data?.url) {
                                  const newUrl = res.data.data.url
                                  console.log('[视频渲染] 重新生成的签名URL:', newUrl.substring(0, 60))
                                  // 更新 video 的 src
                                  video.src = newUrl
                                  // 更新 mediaList 中的 url
                                  mediaList[idx].url = newUrl
                                  console.log('[视频渲染] 签名URL已更新')
                                  return
                                }
                              } catch (err: any) {
                                console.error('[视频渲染] 重新生成签名URL失败:', err)
                              }
                            }

                            // 如果无法重新生成签名URL，显示错误提示
                            Taro.showToast({ title: '视频加载失败，请刷新页面重试', icon: 'none' })
                          }}
                          onLoadStart={() => {
                            console.log('[视频渲染] 视频开始加载:', videoUrl.substring(0, 60))
                          }}
                          onCanPlay={() => {
                            console.log('[视频渲染] 视频可以播放了')
                          }}
                          onPlay={() => {
                            console.log('[视频渲染] 视频开始播放')
                          }}
                        />
                      ) : (
                        <Video
                          src={videoUrl}
                          className="media-video"
                          controls
                          showFullscreenBtn
                          showPlayBtn
                          showCenterPlayBtn
                          enableProgressGesture
                          objectFit="contain"
                          style={{ width: '100%', height: '400rpx', borderRadius: '16rpx' }}
                          onError={(e) => {
                            console.error('小程序视频播放错误:', e)
                            Taro.showToast({ title: '视频加载失败', icon: 'none' })
                          }}
                          onPlay={() => console.log('视频开始播放')}
                        />
                      )}
                    </View>
                  )
                }

                if (media.type === 'article') {
                  return (
                    <View key={idx} className="media-item article">
                      {media.coverImage && (
                        <Image src={media.coverImage} className="article-cover" mode="widthFix" />
                      )}
                      <View className="article-content">
                        <Text className="article-title">{media.title}</Text>
                        <MarkdownRender content={media.content || ''} />
                      </View>
                    </View>
                  )
                }

                return null
              })}

              {/* 🔴 新增：显示发布成功的提示信息（草稿箱提示） */}
              {publishSuccessMessage && (
                <View className="publish-success-message">
                  <Text className="publish-success-text">{publishSuccessMessage}</Text>
                </View>
              )}
            </View>
          )
        })()}

        {/* 文本消息渲染 - 只在没有媒体内容且没有内嵌视频且没有文章时渲染 */}
        {(() => {
          // 检查是否有内嵌视频链接
          const { videoUrl } = extractVideoUrlFromText(msg.content)

          // 如果有视频链接，文本已经在视频处理中渲染过了，不再重复渲染
          if (videoUrl) return null

          // 如果没有视频链接，渲染文本
          if (msg.content && typeof msg.content === 'string') {
            // 🔴 检查是否有媒体内容（图片/视频/文章）
            const hasMediaContent = msg.metadata?.media && msg.metadata.media.length > 0

            // 🔴 新增：显示草稿箱提示信息
            // 如果 content 包含"草稿箱"或"微信公众平台"，说明是发布成功的提示，需要显示
            const isPublishSuccessHint = msg.content.includes('草稿箱') || msg.content.includes('微信公众平台')

            // 如果是发布成功的提示，显示它（即使有 mediaContent）
            if (isPublishSuccessHint) {
              return (
                <View className="text-message">
                  <MarkdownRender content={msg.content} />
                </View>
              )
            }

            // 如果有媒体内容（但不是发布成功提示），文本已经在媒体容器中渲染过了，不再重复渲染
            if (hasMediaContent) return null

            // 🔴 检查是否是公众号文章的 summary（避免重复渲染）
            // 如果 content 是类似 "✅ 已完成公众号爆款图文的创作..." 的 summary，则不渲染
            const isArticleSummary = msg.content.includes('已完成公众号') &&
                                   msg.content.includes('创作') &&
                                   msg.content.includes('你可以前往')

            if (isArticleSummary) {
              console.log('[文章渲染] 检测到文章 summary，不渲染文本（文章已在 mediaList 中渲染）')
              return null
            }

            // 清理消息内容，移除图片链接等调试信息
            const cleanedContent = cleanMessageContent(msg.content)
            return (
              <View className="text-message">
                <MarkdownRender content={cleanedContent} />
              </View>
            )
          }

          return null
        })()}

        {/* 技能缺失提示和添加技能按钮 */}
        {(() => {
          // 检测技能缺失错误消息 - 支持多种错误格式
          const contentStr = typeof msg.content === 'string' ? cleanMessageContent(msg.content) : ''

          // 检测多种可能的技能缺失错误格式
          const isSkillMissing =
            contentStr.includes('您的分身尚未添加该功能') ||
            contentStr.includes('未配置') ||
            (contentStr.includes('技能') && (contentStr.includes('未添加') || contentStr.includes('缺少') || contentStr.includes('需要')))

          if (!isSkillMissing) return null

          // 提取技能名称（从错误消息中）
          let skillName = ''

          // 尝试匹配引号中的技能名称
          const quotedNameMatch = contentStr.match(/"([^"]+)"/)
          if (quotedNameMatch) {
            skillName = quotedNameMatch[1]
          } else {
            // 尝试匹配"未配置xxx"格式
            const unconfiguredMatch = contentStr.match(/未配置(.+)/)
            if (unconfiguredMatch) {
              skillName = unconfiguredMatch[1].trim()
            }
          }

          return (
            <View className="skill-missing-action-bar">
              <Text className="skill-missing-hint">⚠️ 检测到缺少技能</Text>
              <Button
                className="add-skill-btn"
                onClick={() => {
                  // 跳转到技能广场，传递分身ID
                  const currentAvatarId = avatar?.id || ''
                  Taro.navigateTo({
                    url: `/pages/skills-square/index?avatarId=${currentAvatarId}&from=mindchat`
                  })
                }}
              >
                <Text className="add-skill-btn-text">
                  {skillName ? `添加"${skillName}"技能` : '添加技能'}
                </Text>
              </Button>
            </View>
          )
        })()}

        {/* 发布按钮 - 当有待发布内容时显示 */}
        {msg.metadata?.agent_result?.requiresConfig && 
         msg.metadata?.agent_result?.configPlatform && 
         msg.metadata?.media && 
         msg.metadata.media.length > 0 && (
          <View className="publish-action-bar">
            <Button
              className="publish-btn"
              onClick={() => {
                // 恢复待发布内容
                const mediaList = msg.metadata?.media || []
                const article = mediaList.find((m: MessageMedia) => m.type === 'article')
                const images = mediaList.filter((m: MessageMedia) => m.type === 'image').map((m: MessageMedia) => m.url).filter(Boolean) as string[]
                
                setPendingPublish({
                  platform: msg.metadata?.agent_result?.configPlatform as PlatformType,
                  content: {
                    title: article?.title,
                    content: article?.content,
                    coverImage: article?.coverImage,
                    images
                  }
                })
                setShowPublishConfirm(true)
              }}
            >
              <Text className="publish-btn-text">
                {['wechat_mp'].includes(msg.metadata?.agent_result?.configPlatform as PlatformType) 
                  ? `🚀 发布到${getPlatformName(msg.metadata?.agent_result?.configPlatform as PlatformType)}`
                  : '⚡ 一键发布'
                }
              </Text>
            </Button>
          </View>
        )}
      </View>
    )
  }

  if (!isLoggedIn) return null

  return (
    <View className="mind-chat-page">
      <View className="bg-glow" />
      <View className="grid-overlay" />

      {/* 顶部导航 */}
      <View 
        className="chat-header" 
        style={{ paddingTop: `${statusBarHeight}px` }}
      >
        <View className="header-left">
          <View className="history-btn" onClick={() => setShowHistory(true)}>
            <History size={22} color="#00f5ff" />
          </View>
          <View className="avatar-info">
            {avatar ? (
              <>
                <View className="avatar-avatar">
                  {avatar.avatar_url ? (
                    <Image
                      src={avatar.avatar_url}
                      className="avatar-img"
                      mode="aspectFill"
                      onError={() => {
                        // 图片加载失败时不做处理
                      }}
                    />
                  ) : (
                    <Sparkles size={24} color="#00f5ff" />
                  )}
                </View>
                <View className="avatar-text">
                  <Text className="avatar-name">{avatar.name}</Text>
                  <View className="avatar-status">
                    <View className="status-dot" />
                    <Text className="status-text">Agent 就绪</Text>
                  </View>
                </View>
              </>
            ) : (
              <Text className="no-avatar">选择AI分身</Text>
            )}
          </View>
        </View>
        <View className="header-right">
          <View className="agent-badge">
            <Zap size={16} color="#00ff88" />
            <Text className="agent-badge-text">Agent</Text>
          </View>
        </View>
      </View>

      {/* 心智成长面板 */}
      <View className={`learn-panel ${learnPanelCollapsed ? 'collapsed' : ''}`}>
        <View className="learn-panel-header" onClick={() => setLearnPanelCollapsed(!learnPanelCollapsed)}>
          <Brain size={20} color="#00f5ff" />
          <Text className="learn-panel-title">心智成长</Text>
          <View className="learn-panel-toggle">
            {learnPanelCollapsed ? <ChevronDown size={18} color="#00f5ff" /> : <ChevronUp size={18} color="#00f5ff" />}
          </View>
        </View>
        
        {!learnPanelCollapsed && (
        <>
        <View className="learn-stats-row">
          <View className="learn-stat-item clickable" onClick={() => setShowLearningDetail('dialog')}>
            <MessageCircle size={16} color="#bf00ff" />
            <Text className="learn-stat-value">{learningStats.messageCount}</Text>
            <Text className="learn-stat-label">对话</Text>
          </View>
          <View className="learn-stat-item clickable" onClick={() => setShowLearningDetail('days')}>
            <TrendingUp size={16} color="#00ff88" />
            <Text className="learn-stat-value">{learningStats.learningDays}</Text>
            <Text className="learn-stat-label">天数</Text>
          </View>
          <View className="learn-stat-item clickable" onClick={() => setShowLearningDetail('mastery')}>
            <Target size={16} color="#ff00aa" />
            <Text className="learn-stat-value">{learningStats.masteryLevel}%</Text>
            <Text className="learn-stat-label">掌握</Text>
          </View>
          <View className="learn-stat-item clickable" onClick={() => setShowLearningDetail('level')}>
            <Award size={16} color="#00f5ff" />
            <Text className="learn-stat-value">Lv.{avatar?.level || 1}</Text>
            <Text className="learn-stat-label">等级</Text>
          </View>
        </View>
        
        {/* 用户画像 - 始终显示 */}
        {(learningStats.userIdentity?.occupation || learningStats.userIdentity?.education || learningStats.userIdentity?.personalityType || learningStats.userIdentity?.lifeEvents?.length) && (
          <View className="learn-identity-section clickable" onClick={() => setShowLearningDetail('identity')}>
            <Text className="learn-section-title">我的画像</Text>
            <View className="learn-identity-cards">
              {learningStats.userIdentity?.occupation && (
                <View className="learn-identity-card">
                  <Text className="learn-identity-label">职业</Text>
                  <Text className="learn-identity-value">{learningStats.userIdentity.occupation}</Text>
                </View>
              )}
              {learningStats.userIdentity?.education && (
                <View className="learn-identity-card">
                  <Text className="learn-identity-label">学历</Text>
                  <Text className="learn-identity-value">{learningStats.userIdentity.education}</Text>
                </View>
              )}
              {learningStats.userIdentity?.personalityType && (
                <View className="learn-identity-card">
                  <Text className="learn-identity-label">性格</Text>
                  <Text className="learn-identity-value">{learningStats.userIdentity.personalityType}</Text>
                </View>
              )}
              {learningStats.userIdentity?.lifeEvents && learningStats.userIdentity.lifeEvents.length > 0 && (
                <View className="learn-identity-card full-width">
                  <Text className="learn-identity-label">生活大事</Text>
                  <Text className="learn-identity-value">{learningStats.userIdentity.lifeEvents.join('、')}</Text>
                </View>
              )}
            </View>
          </View>
        )}
        
        {/* 展开/折叠更多按钮 */}
        <View className="learn-expand-btn" onClick={() => setLearnPanelExpanded(!learnPanelExpanded)}>
          <Text className="learn-expand-text">{learnPanelExpanded ? '收起详情' : '展开更多'}</Text>
          {learnPanelExpanded ? <ChevronUp size={16} color="#00f5ff" /> : <ChevronDown size={16} color="#00f5ff" />}
        </View>
        
        {/* 详细内容 - 默认折叠，可滚动 */}
        {learnPanelExpanded && (
        <ScrollView className="learn-panel-content" scrollY style={{ height: '300rpx' }}>
        <View className="learn-progress-section clickable" onClick={() => setShowLearningDetail('mastery')}>
          <Text className="learn-progress-label">成长进度</Text>
          <View className="learn-progress-bar">
            <View 
              className="learn-progress-fill" 
              style={{ width: `${learningStats.masteryLevel}%` }}
            />
          </View>
          <Text className="learn-progress-hint">
            {learningStats.masteryLevel < 20 
              ? '继续对话，我会更了解你' 
              : learningStats.masteryLevel < 50 
                ? '我已经开始学习你的风格了' 
                : learningStats.masteryLevel < 80 
                  ? '越来越像你了！' 
                  : '我们已经心意相通了 🎉'}
          </Text>
        </View>
        
        {/* 风格匹配度 */}
        {(learningStats.styleMatch || 0) > 0 && (
          <View className="learn-style-section clickable" onClick={() => setShowLearningDetail('style')}>
            <Text className="learn-style-label">风格匹配度</Text>
            <View className="learn-style-bar">
              <View 
                className="learn-style-fill" 
                style={{ width: `${learningStats.styleMatch}%` }}
              />
            </View>
            <Text className="learn-style-value">{learningStats.styleMatch}%</Text>
          </View>
        )}
        
        {/* 兴趣话题 */}
        {learningStats.interests && learningStats.interests.length > 0 && (
          <View className="learn-interests-section clickable" onClick={() => setShowLearningDetail('interests')}>
            <Text className="learn-section-title">兴趣话题</Text>
            <View className="learn-tags">
              {learningStats.interests.slice(0, 5).map((interest, idx) => (
                <View key={idx} className="learn-tag">
                  <Text className="learn-tag-text">{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        
        {/* 常用表达 */}
        {learningStats.commonPhrases && learningStats.commonPhrases.length > 0 && (
          <View className="learn-phrases-section clickable" onClick={() => setShowLearningDetail('phrases')}>
            <Text className="learn-section-title">你的常用表达</Text>
            <View className="learn-phrases">
              {learningStats.commonPhrases.slice(0, 3).map((phrase, idx) => (
                <Text key={idx} className="learn-phrase">&ldquo;{phrase}&rdquo;</Text>
              ))}
            </View>
          </View>
        )}

        {/* 分身能力 */}
        <View
          className="learn-capabilities-section clickable"
          onClick={() => {
            fetchAvatarCapabilities()
            setShowLearningDetail('capabilities')
          }}
        >
          <Text className="learn-section-title">分身能力</Text>
          <View className="learn-capabilities-preview">
            <View className="capability-item">
              <Brain size={16} color="#00f5ff" />
              <Text className="capability-label">记忆</Text>
              <Text className="capability-value">{avatarCapabilities?.memory?.total || 0} 条</Text>
            </View>
            <View className="capability-item">
              <Sparkles size={16} color="#00f5ff" />
              <Text className="capability-label">技能</Text>
              <Text className="capability-value">{avatarCapabilities?.skills?.length || 0} 个</Text>
            </View>
            <View className="capability-item">
              <Target size={16} color="#00f5ff" />
              <Text className="capability-label">思考</Text>
              <Text className="capability-value">{avatarCapabilities?.thoughts?.length || 0} 次</Text>
            </View>
          </View>
        </View>
        </ScrollView>
        )}
        </>
        )}
      </View>
      
      {/* 学习详情弹窗 - 等级详情使用独立组件 */}
      {showLearningDetail && showLearningDetail !== 'level' && (
        <View className="learning-detail-overlay" onClick={() => setShowLearningDetail(null)}>
          <View className="learning-detail-modal" onClick={e => e.stopPropagation()}>
            <View className="learning-detail-header">
              <Text className="learning-detail-title">
                {showLearningDetail === 'dialog' && '对话统计'}
                {showLearningDetail === 'days' && '学习天数'}
                {showLearningDetail === 'mastery' && '掌握度分析'}
                {showLearningDetail === 'identity' && '我的画像'}
                {showLearningDetail === 'style' && '风格分析'}
                {showLearningDetail === 'interests' && '兴趣话题'}
                {showLearningDetail === 'phrases' && '常用表达'}
                {showLearningDetail === 'capabilities' && '分身能力'}
              </Text>
              <View className="learning-detail-close" onClick={() => setShowLearningDetail(null)}>
                <X size={24} color="rgba(255,255,255,0.6)" />
              </View>
            </View>
            <ScrollView className="learning-detail-content" scrollY>
              {/* 对话统计详情 */}
              {showLearningDetail === 'dialog' && (
                <View className="detail-section">
                  <View className="detail-stat-card">
                    <Text className="detail-stat-value">{learningStats.messageCount}</Text>
                    <Text className="detail-stat-label">累计对话数</Text>
                  </View>
                  <View className="detail-stat-card">
                    <Text className="detail-stat-value">{learningStats.avgMessageLength.toFixed(0)}</Text>
                    <Text className="detail-stat-label">平均消息长度</Text>
                  </View>
                  <Text className="detail-hint">
                    每一次对话都是我学习你的机会。对话越多，我越了解你的说话风格、思维方式和个性特点。
                  </Text>
                  <Text className="detail-tip">
                    💡 提示：多分享你的想法、观点和经历，可以帮助我更快地学习你的风格。
                  </Text>
                </View>
              )}
              
              {/* 学习天数详情 */}
              {showLearningDetail === 'days' && (
                <View className="detail-section">
                  <View className="detail-stat-card large">
                    <Text className="detail-stat-value">{learningStats.learningDays}</Text>
                    <Text className="detail-stat-label">学习天数</Text>
                  </View>
                  <Text className="detail-hint">
                    我已经连续学习你 {learningStats.learningDays} 天了！每天的学习都让我更了解你。
                  </Text>
                  <View className="detail-milestones">
                    <View className="milestone-item">
                      <View className="milestone-dot completed" />
                      <Text className="milestone-text">第1天：初次相识</Text>
                    </View>
                    <View className="milestone-item">
                      <View className={`milestone-dot ${learningStats.learningDays >= 7 ? 'completed' : ''}`} />
                      <Text className="milestone-text">第7天：渐入佳境</Text>
                    </View>
                    <View className="milestone-item">
                      <View className={`milestone-dot ${learningStats.learningDays >= 30 ? 'completed' : ''}`} />
                      <Text className="milestone-text">第30天：心有灵犀</Text>
                    </View>
                    <View className="milestone-item">
                      <View className={`milestone-dot ${learningStats.learningDays >= 100 ? 'completed' : ''}`} />
                      <Text className="milestone-text">第100天：心意相通</Text>
                    </View>
                  </View>
                </View>
              )}
              
              {/* 掌握度详情 */}
              {showLearningDetail === 'mastery' && (
                <View className="detail-section">
                  <View className="detail-stat-card large">
                    <Text className="detail-stat-value">{learningStats.masteryLevel}%</Text>
                    <Text className="detail-stat-label">风格掌握度</Text>
                  </View>
                  <View className="detail-progress-section">
                    <View className="detail-progress-bar">
                      <View className="detail-progress-fill" style={{ width: `${learningStats.masteryLevel}%` }} />
                    </View>
                  </View>
                  <Text className="detail-hint">
                    掌握度反映了我在学习你的说话风格、思维方式和个性特点方面的进度。
                  </Text>
                  <View className="detail-breakdown">
                    <Text className="detail-breakdown-title">学习维度</Text>
                    <View className="breakdown-item">
                      <Text className="breakdown-label">语气风格</Text>
                      <View className="breakdown-bar">
                        <View className="breakdown-fill" style={{ width: `${Math.min(100, (learningStats.toneProfile?.formal || 0.5) * 100)}%` }} />
                      </View>
                    </View>
                    <View className="breakdown-item">
                      <Text className="breakdown-label">性格特征</Text>
                      <View className="breakdown-bar">
                        <View className="breakdown-fill" style={{ width: `${Math.min(100, (learningStats.personalityTraits?.extraversion || 0.5) * 100)}%` }} />
                      </View>
                    </View>
                    <View className="breakdown-item">
                      <Text className="breakdown-label">沟通风格</Text>
                      <View className="breakdown-bar">
                        <View className="breakdown-fill" style={{ width: `${Math.min(100, (learningStats.communicationStyle?.direct || 0.5) * 100)}%` }} />
                      </View>
                    </View>
                  </View>
                </View>
              )}
              
              {/* 用户画像详情 */}
              {showLearningDetail === 'identity' && (
                <View className="detail-section">
                  <Text className="detail-section-title">我认识的你</Text>
                  {learningStats.userIdentity?.occupation && (
                    <View className="identity-detail-card">
                      <Text className="identity-detail-label">职业身份</Text>
                      <Text className="identity-detail-value">{learningStats.userIdentity.occupation}</Text>
                    </View>
                  )}
                  {learningStats.userIdentity?.education && (
                    <View className="identity-detail-card">
                      <Text className="identity-detail-label">学历背景</Text>
                      <Text className="identity-detail-value">{learningStats.userIdentity.education}</Text>
                    </View>
                  )}
                  {learningStats.userIdentity?.personalityType && (
                    <View className="identity-detail-card">
                      <Text className="identity-detail-label">性格特点</Text>
                      <Text className="identity-detail-value">{learningStats.userIdentity.personalityType}</Text>
                    </View>
                  )}
                  {learningStats.userIdentity?.lifeEvents && learningStats.userIdentity.lifeEvents.length > 0 && (
                    <View className="identity-detail-card">
                      <Text className="identity-detail-label">生活大事</Text>
                      <View className="life-events-list">
                        {learningStats.userIdentity.lifeEvents.map((event, idx) => (
                          <Text key={idx} className="life-event-item">• {event}</Text>
                        ))}
                      </View>
                    </View>
                  )}
                  <Text className="detail-hint">
                    我会记住你告诉我的重要信息，在对话中自然地体现对你的了解。
                  </Text>
                </View>
              )}
              
              {/* 风格分析详情 */}
              {showLearningDetail === 'style' && (
                <View className="detail-section">
                  <Text className="detail-section-title">你的风格画像</Text>
                  {learningStats.toneProfile && (
                    <View className="style-analysis-card">
                      <Text className="style-analysis-label">语气风格</Text>
                      <View className="style-bars">
                        <View className="style-bar-item">
                          <Text className="style-bar-label">正式</Text>
                          <View className="style-bar">
                            <View className="style-bar-fill" style={{ width: `${(learningStats.toneProfile?.formal || 0) * 100}%` }} />
                          </View>
                          <Text className="style-bar-value">{Math.round((learningStats.toneProfile?.formal || 0) * 100)}%</Text>
                        </View>
                        <View className="style-bar-item">
                          <Text className="style-bar-label">随性</Text>
                          <View className="style-bar">
                            <View className="style-bar-fill" style={{ width: `${(learningStats.toneProfile?.casual || 0) * 100}%` }} />
                          </View>
                          <Text className="style-bar-value">{Math.round((learningStats.toneProfile?.casual || 0) * 100)}%</Text>
                        </View>
                        <View className="style-bar-item">
                          <Text className="style-bar-label">幽默</Text>
                          <View className="style-bar">
                            <View className="style-bar-fill" style={{ width: `${(learningStats.toneProfile?.humorous || 0) * 100}%` }} />
                          </View>
                          <Text className="style-bar-value">{Math.round((learningStats.toneProfile?.humorous || 0) * 100)}%</Text>
                        </View>
                      </View>
                    </View>
                  )}
                  {learningStats.personalityTraits && (
                    <View className="style-analysis-card">
                      <Text className="style-analysis-label">性格特质（大五人格）</Text>
                      <View className="style-bars">
                        <View className="style-bar-item">
                          <Text className="style-bar-label">开放性</Text>
                          <View className="style-bar">
                            <View className="style-bar-fill" style={{ width: `${(learningStats.personalityTraits?.openness || 0) * 100}%` }} />
                          </View>
                        </View>
                        <View className="style-bar-item">
                          <Text className="style-bar-label">外向性</Text>
                          <View className="style-bar">
                            <View className="style-bar-fill" style={{ width: `${(learningStats.personalityTraits?.extraversion || 0) * 100}%` }} />
                          </View>
                        </View>
                        <View className="style-bar-item">
                          <Text className="style-bar-label">尽责性</Text>
                          <View className="style-bar">
                            <View className="style-bar-fill" style={{ width: `${(learningStats.personalityTraits?.conscientiousness || 0) * 100}%` }} />
                          </View>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              )}
              
              {/* 兴趣话题详情 */}
              {showLearningDetail === 'interests' && (
                <View className="detail-section">
                  <Text className="detail-section-title">你感兴趣的话题</Text>
                  <View className="interests-cloud">
                    {learningStats.interests?.map((interest, idx) => (
                      <View key={idx} className="interest-tag-large">
                        <Text className="interest-tag-text">{interest}</Text>
                      </View>
                    ))}
                  </View>
                  <Text className="detail-hint">
                    我会关注你感兴趣的话题，在对话中主动提及相关内容。
                  </Text>
                </View>
              )}
              
              {/* 常用表达详情 */}
              {showLearningDetail === 'phrases' && (
                <View className="detail-section">
                  <Text className="detail-section-title">你的常用表达</Text>
                  <View className="phrases-list">
                    {learningStats.commonPhrases?.map((phrase, idx) => (
                      <View key={idx} className="phrase-item">
                        <Text className="phrase-text">&ldquo;{phrase}&rdquo;</Text>
                      </View>
                    ))}
                  </View>
                  <Text className="detail-hint">
                    我会学习你的口头禅和常用表达，让对话更自然。
                  </Text>
                </View>
              )}

              {/* 分身能力详情 */}
              {showLearningDetail === 'capabilities' && (
                <View className="detail-section">
                  {/* 记忆能力 */}
                  <Text className="detail-section-title">记忆能力</Text>
                  <View className="detail-stat-card">
                    <Text className="detail-stat-value">{avatarCapabilities?.memory?.total || 0}</Text>
                    <Text className="detail-stat-label">总记忆条数</Text>
                  </View>
                  <View className="memory-types">
                    {Object.entries(avatarCapabilities?.memory?.byType || {}).map(([type, count]: [string, any]) => (
                      <View key={type} className="memory-type-item">
                        <Text className="memory-type-name">{getMemoryTypeName(type)}</Text>
                        <Text className="memory-type-count">{count}</Text>
                      </View>
                    ))}
                  </View>
                  <Text className="detail-hint">
                    我会记住你分享的重要信息，包括你的喜好、经历和约定。
                  </Text>

                  {/* 技能能力 */}
                  <Text className="detail-section-title" style={{ marginTop: '24px' }}>技能掌握</Text>
                  {avatarCapabilities?.skills?.length > 0 ? (
                    <View className="skills-list">
                      {avatarCapabilities.skills.map((skill: any) => (
                        <View key={skill.id} className="skill-item">
                          <View className="skill-header">
                            <Text className="skill-name">{skill.skill_name}</Text>
                            <Text className="skill-level">Lv.{skill.skill_level}</Text>
                          </View>
                          <View className="skill-meta">
                            <Text className="skill-meta-item">使用 {skill.usage_count} 次</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className="empty-hint">还没有掌握技能，多和我对话吧！</Text>
                  )}
                  <Text className="detail-hint">
                    通过对话和学习，我会逐渐掌握各种技能，提供更智能的帮助。
                  </Text>

                  {/* 思考过程 */}
                  <Text className="detail-section-title" style={{ marginTop: '24px' }}>最近思考</Text>
                  {avatarCapabilities?.thoughts?.length > 0 ? (
                    <View className="thoughts-list">
                      {avatarCapabilities.thoughts.map((thought: any) => (
                        <View key={thought.id} className="thought-item">
                          <View className="thought-header">
                            <Text className="thought-action">{thought.action}</Text>
                            <Text className="thought-intent">{getIntentDisplayName(thought.intent)}</Text>
                          </View>
                          <Text className="thought-time">{formatTime(new Date(thought.createdAt))}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className="empty-hint">还没有思考记录，快开始对话吧！</Text>
                  )}
                  <Text className="detail-hint">
                    我会在每次对话中仔细思考，分析你的需求并提供最佳回答。
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* 等级详情弹窗 - 使用统一样式 */}
      {showLearningDetail === 'level' && (
        <LevelDetailDialog 
          open
          onClose={() => setShowLearningDetail(null)}
          currentLevel={avatar?.level || 1}
          currentExp={avatar?.exp || 0}
        />
      )}
      
      {/* 学习特效提示 */}
      {showLearningEffect && learningProgress && (
        <View className="learning-effect-overlay">
          <View className="learning-effect-card">
            <View className="learning-effect-icon">
              <Brain size={32} color="#00f5ff" />
            </View>
            <Text className="learning-effect-title">正在学习你的风格...</Text>
            <Text className="learning-effect-desc">
              对话数：{learningProgress.oldCount} → {learningProgress.newCount}
            </Text>
            <View className="learning-effect-exp">
              <Text className="exp-text">+{learningProgress.expGained} 经验</Text>
            </View>
            <View className="learning-effect-progress">
              <View className="learning-progress-bar">
                <View className="learning-progress-fill" style={{ width: `${Math.min(100, learningProgress.newCount * 5)}%` }} />
              </View>
              <Text className="learning-progress-text">掌握度 {Math.min(100, learningProgress.newCount * 5)}%</Text>
            </View>
          </View>
        </View>
      )}

      {/* 历史记录抽屉 */}
      {showHistory && (
        <View className="history-drawer-mask" onClick={() => setShowHistory(false)}>
          <View className="history-drawer" onClick={e => e.stopPropagation()}>
            <View className="drawer-header">
              <Text className="drawer-title">历史对话</Text>
              <View className="drawer-close" onClick={() => setShowHistory(false)}>
                <X size={24} color="rgba(255,255,255,0.6)" />
              </View>
            </View>
            <ScrollView className="drawer-content" scrollY>
              {conversations.length === 0 ? (
                <View className="empty-history">
                  <Bot size={48} color="rgba(255,255,255,0.2)" />
                  <Text className="empty-text">暂无历史对话</Text>
                </View>
              ) : (
                conversations.map(conv => (
                  <View 
                    key={conv.id} 
                    className={`history-item ${conversation?.id === conv.id ? 'active' : ''}`}
                    onClick={() => switchConversation(conv)}
                  >
                    <View className="history-icon">
                      <Sparkles size={18} color="#00f5ff" />
                    </View>
                    <View className="history-info">
                      <Text className="history-title">{conv.title || '新对话'}</Text>
                      <Text className="history-time">{formatTime(conv.updated_at)}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* 消息区域 */}
      <ScrollView 
        className="messages-scroll"
        scrollY
        scrollTop={scrollTop}
        scrollIntoView={scrollIntoView}
        scrollWithAnimation
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={() => {
          setRefreshing(true)
          loadMoreMessages()
        }}
      >
        {/* 加载更多提示 */}
        {isLoadingMore && (
          <View className="loading-more-tip">
            <Text className="loading-more-text">加载中...</Text>
          </View>
        )}
        {!hasMoreMessages && messages.length > 0 && (
          <View className="no-more-tip">
            <Text className="no-more-text">没有更多消息了</Text>
          </View>
        )}
        {messages.length === 0 ? (
          <View className="empty-chat">
            <View className="empty-icon">
              <View className="empty-avatar-glow">
                {avatar?.avatar_url ? (
                  <Image
                    src={avatar.avatar_url}
                    className="empty-avatar-img"
                    mode="aspectFill"
                    onError={() => {
                      // 图片加载失败时不做处理
                    }}
                  />
                ) : (
                  <Sparkles size={64} color="#00f5ff" />
                )}
              </View>
            </View>
            <Text className="empty-title">我是{avatar?.name || 'AI分身'}</Text>
            <Text className="empty-desc">我可以帮你写文章、生成图片、发布内容</Text>
            <View className="empty-hints">
              <Text className="hint-item">「帮我写一篇公众号文章」</Text>
              <Text className="hint-item">「生成一张风景图片」</Text>
              <Text className="hint-item">「发布到小红书」</Text>
            </View>
          </View>
        ) : (
          messages.map((msg, index) => (
            <View
              key={msg.id}
              id={`msg-${index}`}
              className={`message-item ${msg.role}`}
            >
              {msg.role === 'assistant' && (
                <View className="message-avatar">
                  {avatar?.avatar_url ? (
                    <Image
                      src={avatar.avatar_url}
                      className="msg-avatar-img"
                      mode="aspectFill"
                      onError={() => {
                        // 图片加载失败时不做处理
                      }}
                    />
                  ) : (
                    <Sparkles size={24} color="#00f5ff" />
                  )}
                </View>
              )}
              <View className="message-bubble">
                {renderMessageContent(msg)}
                <View className="message-footer">
                  <Text className="message-time">
                    {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {msg.role === 'assistant' && (
                    <View
                      className="message-action"
                      onClick={() => copyMessage(typeof msg.content === 'string' ? msg.content : '')}
                    >
                      <Copy size={14} color="rgba(255,255,255,0.4)" />
                    </View>
                  )}
                </View>
              </View>
              {msg.role === 'user' && (
                <View className="message-user-avatar">
                  {userInfo?.avatar ? (
                    <Image
                      src={userInfo.avatar}
                      className="msg-avatar-img"
                      mode="aspectFill"
                      onError={() => {
                        // 图片加载失败时不做处理
                      }}
                    />
                  ) : (
                    <Text className="user-avatar-text">{userInfo?.nickname?.[0] || 'U'}</Text>
                  )}
                </View>
              )}
            </View>
          ))
        )}
        
        {/* Agent 实时状态显示 */}
        {loading && (
          <View id="msg-loading" className="message-item assistant">
            <View className="message-avatar">
              {avatar?.avatar_url ? (
                <Image
                  src={avatar.avatar_url}
                  className="msg-avatar-img"
                  mode="aspectFill"
                  onError={() => {
                    // 图片加载失败时不做处理
                  }}
                />
              ) : (
                <Sparkles size={24} color="#00f5ff" />
              )}
            </View>
            <View className="message-bubble typing">
              <View className="typing-status">
                <Loader size={18} color="#00f5ff" className="spinning" />
                <Text className="status-message">{currentStatus || '思考中...'}</Text>
              </View>
              {/* 进度百分比 - 只在任务进行中显示 */}
              {taskProgress > 0 && taskProgress < 100 && (
                <View className="task-progress">
                  <View className="progress-bar">
                    <View
                      className="progress-fill"
                      style={{ width: `${taskProgress}%` }}
                    />
                  </View>
                  <Text className="progress-text">{taskProgress}%</Text>
                </View>
              )}
              {agentSteps.length > 0 && (
                <View className="agent-steps-live">
                  {agentSteps.map((step, idx) => (
                    <View key={idx} className={`step-live ${step.status}`}>
                      <Text className="step-live-name">{step.displayName}</Text>
                      {step.status === 'running' ? (
                        <Loader size={14} color="#00f5ff" className="spinning" />
                      ) : step.status === 'success' ? (
                        <Check size={14} color="#00ff88" />
                      ) : (
                        <X size={14} color="#ff4444" />
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}
        
        {/* 底部锚点 */}
        <View id="scroll-bottom-anchor" className="messages-bottom" />
      </ScrollView>

      {/* 底部输入栏 */}
      <View className="input-bar">
        {/* 🔴 重新设计：媒体预览栏 - 悬浮式设计 */}
        {(uploadedImages.length > 0 || uploadedVideos.length > 0) && (
          <View className="media-preview-bar">
            <ScrollView scrollX className="media-preview-scroll" scrollWithAnimation>
              {uploadedImages.map((imageUrl, idx) => (
                <View key={`img-${idx}`} className="media-preview-item">
                  <Image src={imageUrl} className="media-preview-image" mode="aspectFill" />
                  <View className="media-preview-overlay">
                    <View className="media-preview-remove" onClick={() => handleRemoveImage(idx)}>
                      <X size={14} color="#ffffff" />
                    </View>
                  </View>
                </View>
              ))}
              {uploadedVideos.map((videoUrl, idx) => (
                <View key={`video-${idx}`} className="media-preview-item">
                  <Video
                    src={videoUrl}
                    className="media-preview-video"
                    controls={false}
                    objectFit="cover"
                  />
                  <View className="media-preview-overlay">
                    <View className="media-preview-play-icon">
                      <Play size={18} color="#ffffff" />
                    </View>
                    <View className="media-preview-remove" onClick={() => handleRemoveVideo(idx)}>
                      <X size={14} color="#ffffff" />
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 🔴 重新设计：主输入区域 */}
        <View className="input-main">
          {/* 🔴 重新设计：左侧按钮组 - 语音 + 附件 */}
          <View className="input-left">
            <View className="icon-button voice-button" onClick={toggleVoiceMode}>
              {isVoiceMode ? (
                <Keyboard size={18} color="#00f5ff" />
              ) : (
                <Mic size={18} color="#00f5ff" />
              )}
            </View>
            {!isVoiceMode && (
              <>
                <View className="icon-button attachment-button" onClick={handleUploadImage}>
                  <ImageIcon size={18} color="rgba(255,255,255,0.7)" />
                </View>
                <View className="icon-button attachment-button" onClick={handleUploadVideo}>
                  <VideoIcon size={18} color="rgba(255,255,255,0.7)" />
                </View>
                <View className="icon-button attachment-button" onClick={navigateToSkillsSquare}>
                  <Wrench size={18} color="rgba(255,255,255,0.7)" />
                </View>
              </>
            )}
          </View>

          {/* 🔴 重新设计：中间输入框 */}
          <View className="input-center">
            {isVoiceMode ? (
              <View
                className={`voice-input-wrapper ${isRecording ? 'recording' : ''}`}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                onTouchCancel={stopRecording}
              >
                {isRecording ? (
                  <View className="recording-content">
                    <View className="recording-animation">
                      <View className="recording-dot" />
                      <View className="recording-dot" />
                      <View className="recording-dot" />
                    </View>
                    <Text className="recording-time">{formatRecordingTime(recordingTime)}</Text>
                    <Text className="recording-hint">松开发送</Text>
                  </View>
                ) : (
                  <View className="voice-idle">
                    <Mic size={24} color="rgba(255,255,255,0.6)" />
                    <Text className="voice-idle-text">按住说话</Text>
                  </View>
                )}
              </View>
            ) : (
              <View className="text-input-wrapper">
                <Textarea
                  ref={textareaRef}
                  className="text-input"
                  placeholder="说点什么..."
                  placeholderClass="text-input-placeholder"
                  value={inputText}
                  maxlength={1000}
                  onInput={(e: any) => {
                    let newValue = ''
                    if (e.detail && e.detail.value !== undefined) {
                      newValue = e.detail.value
                    } else if (e.target && e.target.value !== undefined) {
                      newValue = e.target.value
                    } else if (typeof e === 'string') {
                      newValue = e
                    }
                    setInputText(newValue)
                  }}
                  onConfirm={() => sendMessage()}
                  confirmType="send"
                  adjustPosition
                  autoHeight
                  cursorSpacing={80}
                  onBlur={(e: any) => {
                    let newValue = inputText
                    if (e.detail && e.detail.value !== undefined) {
                      newValue = e.detail.value
                    } else if (e.target && e.target.value !== undefined) {
                      newValue = e.target.value
                    }
                    setInputText(newValue)
                  }}
                  style={{ minHeight: '64rpx', maxHeight: '280rpx' }}
                />
              </View>
            )}
          </View>

          {/* 🔴 重新设计：右侧圆形发送按钮 */}
          <View className="input-right">
            {!isVoiceMode && (
              <View
                className={`send-button ${inputText && inputText.trim() ? 'active' : ''}`}
                onClick={() => sendMessage()}
              >
                <Send size={18} color={inputText.trim() ? '#0a0a0f' : 'rgba(255,255,255,0.4)'} />
              </View>
            )}
          </View>
        </View>
      </View>
      
      {/* 平台配置弹窗 */}
      {configPlatform && (
        <PlatformConfigDialog
          open={showConfigDialog}
          platform={configPlatform}
          onClose={() => {
            setShowConfigDialog(false)
            setConfigPlatform(null)
            setPendingMessage(null)  // 清除待重试消息
          }}
          onSuccess={() => {
            setShowConfigDialog(false)
            setConfigPlatform(null)
            showToast({ title: '配置成功，正在重新执行任务...', icon: 'success' })
            
            // 自动重试之前失败的任务
            if (pendingMessage) {
              const messageToRetry = pendingMessage
              setPendingMessage(null)  // 清除待重试消息
              setTimeout(() => {
                sendMessage(messageToRetry)
              }, 500)
            }
          }}
        />
      )}
      
      {/* 发布确认弹窗 */}
      <Dialog open={showPublishConfirm} onOpenChange={(isOpen) => { if (!isOpen) setShowPublishConfirm(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <Text>确认发布</Text>
            </DialogTitle>
          </DialogHeader>
          
          <View className="publish-preview">
            <Text className="publish-platform">
              将发布到：{pendingPublish ? getPlatformName(pendingPublish.platform) : ''}
            </Text>
            
            {pendingPublish?.content.title && (
              <View className="publish-title">
                <Text className="publish-label">标题：</Text>
                <Text className="publish-value">{pendingPublish.content.title}</Text>
              </View>
            )}
            
            {pendingPublish?.content.coverImage && (
              <View className="publish-cover">
                <Text className="publish-label">封面图：</Text>
                <Image src={pendingPublish.content.coverImage} className="publish-cover-img" mode="widthFix" />
              </View>
            )}
            
            {pendingPublish?.content.images && pendingPublish.content.images.length > 0 && (
              <View className="publish-images">
                <Text className="publish-label">图片：{pendingPublish.content.images.length}张</Text>
              </View>
            )}
          </View>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowPublishConfirm(false)} className="mr-2">
              <Text>取消</Text>
            </Button>
            <Button
              onClick={() => {
                setShowPublishConfirm(false)
                handlePublish()
              }}
            >
              <Text>确认发布</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 发布引导弹窗（用于无 API 的平台） */}
      {publishGuideData && (
        <PublishGuideDialog
          open={showPublishGuide}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setShowPublishGuide(false)
              setPendingPublish(null)
            }
          }}
          platform={publishGuideData.platform}
          content={publishGuideData.content}
        />
      )}
      
      {/* H5链接弹窗（小程序环境） */}
      <Dialog open={showH5PublishDialog} onOpenChange={setShowH5PublishDialog}>
        <DialogContent className="h5-publish-dialog">
          <DialogHeader>
            <DialogTitle>一键发布</DialogTitle>
          </DialogHeader>
          <View className="h5-publish-content">
            <Text className="h5-publish-tip">
              请复制下方链接，在浏览器中打开即可调起APP发布
            </Text>
            <View className="h5-url-box">
              <Text className="h5-url-text">{h5PublishUrl}</Text>
            </View>
            <Button
              className="copy-url-btn"
              onClick={() => {
                Taro.setClipboardData({
                  data: h5PublishUrl,
                  success: () => {
                    showToast({ title: '链接已复制', icon: 'success' })
                  }
                })
              }}
            >
              <Copy size={18} color="#fff" />
              <Text className="copy-url-btn-text">复制链接</Text>
            </Button>
          </View>
          <DialogFooter>
            <Button className="dialog-cancel-btn" onClick={() => setShowH5PublishDialog(false)}>
              <Text className="dialog-btn-text">关闭</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 经验值飘字特效 */}
      {showExpPopup && (
        <ExpPopup
          exp={expPopupValue}
          onComplete={() => setShowExpPopup(false)}
        />
      )}
      
      {/* 升级特效 */}
      {showLevelUp && levelUpData && (
        <LevelUpEffect
          oldLevel={levelUpData.oldLevel}
          newLevel={levelUpData.newLevel}
          onComplete={() => setShowLevelUp(false)}
        />
      )}
    </View>
  )
}
