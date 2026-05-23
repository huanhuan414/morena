import { useState, useEffect } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import {
  ArrowLeft,
  Camera,
  Check,
  Sparkles,
  Crown,
  Coins,
  Bot,
  PenTool,
  Film,
  Mic,
  Camera as CameraIcon,
  Hand,
  Eye,
  CircleDollarSign,
  Zap,
  ArrowRight,
  Target,
} from 'lucide-react-taro'
import { getStatusBarHeight } from '@/utils/safe-area'
import { CONTENT_STYLES, NICHE_TAGS } from '@/constants/avatar-tags'
import './index.css'

// 分身技能列表（来自技能广场）
const AVATAR_SKILLS = [
  { key: 'content_writing', name: '微信公众号爆款图文生成', desc: '微信公众号爆款图文', icon: PenTool, color: '#8B5CF6', earning: '可赚2-5元/条' },
  { key: 'image_gen', name: '图片生成', desc: 'AI绘画/海报设计', icon: CameraIcon, color: '#06B6D4', earning: '可赚2-6元/张' },
  { key: 'video_gen', name: '视频生成', desc: '短视频/分镜脚本', icon: Film, color: '#EC4899', earning: '可赚3-8元/条' },
  { key: 'palm_reading', name: '看手相', desc: '手相面相趣味解读', icon: Hand, color: '#10B981', earning: '可赚5-15元/次' },
  { key: 'fashion_advice', name: '衣品改造', desc: '穿搭建议/风格推荐', icon: Eye, color: '#F43F5E', earning: '可赚3-10元/次' },
]

// 创建分身的好处
const BENEFITS = [
  { icon: Coins, title: '自动接单赚钱', desc: '开启托管后分身24h替你接单', color: '#F59E0B' },
  { icon: Bot, title: 'AI智能创作', desc: '一键生成文案/图片/视频', color: '#8B5CF6' },
  { icon: Sparkles, title: '越用越强', desc: '接单越多，创作能力越强', color: '#3B82F6' },
  { icon: CircleDollarSign, title: '随时提现', desc: '收益实时到账，秒提现', color: '#10B981' },
]

const STEP_LABELS = ['形象设定', '风格定位', '技能选择']
const AVATAR_CREATE_DRAFT_KEY = 'avatar_create_draft_v3'
const MIND_CHAT_FOCUS_AVATAR_KEY = 'mind_chat_focus_avatar'

export default function AvatarCreate() {
  const statusBarHeight = getStatusBarHeight()
  const [quotaSummary, setQuotaSummary] = useState({
    avatarCount: 0,
    maxAvatars: 1,
    remainingAvatars: 1,
    planName: '',
  })
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    photo: '',
    photoUrl: '',
    name: '',
    contentStyles: [] as string[],   // 内容风格 (替代原personality tags)
    niches: [] as string[],           // 专业领域
    skills: [] as string[],
  })

  // 提交状态
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [draftReady, setDraftReady] = useState(false)

  useLoad((options) => {
    const avatarCount = Number(options?.avatarCount ?? 0)
    const maxAvatars = Number(options?.maxAvatars ?? 1)
    const remainingAvatars = Number(
      options?.remainingAvatars ?? (maxAvatars === -1 ? -1 : Math.max(maxAvatars - avatarCount, 0))
    )

    setQuotaSummary({
      avatarCount,
      maxAvatars,
      remainingAvatars,
      planName: String(options?.planName || ''),
    })

    const savedDraft = Taro.getStorageSync(AVATAR_CREATE_DRAFT_KEY)
    if (
      savedDraft
      && typeof savedDraft === 'object'
      && (
        savedDraft?.formData?.photo
        || savedDraft?.formData?.photoUrl
        || savedDraft?.formData?.name
        || savedDraft?.formData?.contentStyles?.length
        || savedDraft?.formData?.niches?.length
        || savedDraft?.formData?.skills?.length
      )
    ) {
      Taro.showModal({
        title: '继续上次创建',
        content: '检测到你有未完成的分身创建草稿，是否继续上次填写内容？',
        confirmText: '继续创建',
        cancelText: '重新开始',
        success: (res) => {
          if (res.confirm) {
            setFormData(prev => ({
              ...prev,
              ...savedDraft.formData,
            }))
            setCurrentStep(
              Math.min(Math.max(Number(savedDraft.currentStep || 1), 1), STEP_LABELS.length)
            )
          } else {
            Taro.removeStorageSync(AVATAR_CREATE_DRAFT_KEY)
            setFormData({
              photo: '',
              photoUrl: '',
              name: '',
              contentStyles: [],
              niches: [],
              skills: [],
            })
            setCurrentStep(1)
          }
          setDraftReady(true)
        },
        fail: () => {
          setDraftReady(true)
        }
      })
      return
    }

    setDraftReady(true)
  })

  useEffect(() => {
    if (!draftReady || isSubmitting) return

    const hasDraftContent = Boolean(
      formData.photo
      || formData.photoUrl
      || formData.name.trim()
      || formData.contentStyles.length
      || formData.niches.length
      || formData.skills.length
    )

    if (!hasDraftContent) {
      Taro.removeStorageSync(AVATAR_CREATE_DRAFT_KEY)
      return
    }

    Taro.setStorageSync(AVATAR_CREATE_DRAFT_KEY, {
      currentStep,
      formData,
      updatedAt: Date.now(),
    })
  }, [draftReady, currentStep, formData, isSubmitting])

  // 返回处理
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    } else {
      Taro.navigateBack()
    }
  }

  // 更新表单数据
  const updateFormData = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  // 图片上传
  const handleUploadPhoto = () => {
    const isMiniApp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT
    if (!isMiniApp) {
      Taro.chooseImage({
        count: 1,
        sourceType: ['album'],
        success: async (res: any) => {
          const tempFilePath = res.tempFilePaths[0]
          updateFormData('photo', tempFilePath)
          await uploadPhotoToServer(tempFilePath)
        },
        fail: () => {
          Taro.showToast({ title: '请选择图片', icon: 'none' })
        }
      })
      return
    }

    Taro.showActionSheet({
      itemList: ['拍照', '从相册选择', '从微信聊天记录选择'],
      success: async (res: any) => {
        const tapIndex = res.tapIndex
        const chooseCallback = async (imageRes: any) => {
          const tempFilePath = imageRes.tempFilePaths[0]
          updateFormData('photo', tempFilePath)
          await uploadPhotoToServer(tempFilePath)
        }

        if (tapIndex === 0) {
          Taro.chooseImage({ count: 1, sourceType: ['camera'], success: chooseCallback })
        } else if (tapIndex === 1) {
          Taro.chooseImage({ count: 1, sourceType: ['album'], success: chooseCallback })
        } else if (tapIndex === 2) {
          if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
            Taro.chooseMessageFile({
              count: 1, type: 'image',
              success: async (msgRes: any) => {
                const tempFilePath = msgRes.tempFilePaths[0]
                updateFormData('photo', tempFilePath)
                await uploadPhotoToServer(tempFilePath)
              },
              fail: () => { Taro.showToast({ title: '请从相册选择', icon: 'none' }) }
            })
          } else {
            Taro.chooseImage({ count: 1, sourceType: ['album'], success: chooseCallback })
          }
        }
      }
    })
  }

  // 上传照片到服务器
  const uploadPhotoToServer = async (tempFilePath: string) => {
    Taro.showLoading({ title: '上传中...' })
    try {
      const uploadRes = await Network.uploadFile({
        url: '/api/upload',
        filePath: tempFilePath,
        name: 'file',
      })
      console.log('[上传] 响应:', uploadRes)
      let resData = uploadRes.data
      if (typeof resData === 'string') {
        try { resData = JSON.parse(resData) } catch (e) { console.error('[上传] JSON解析失败:', e) }
      }
      let imageUrl = ''
      if ((resData as any)?.data?.url) {
        imageUrl = (resData as any).data.url
      } else if ((resData as any)?.url) {
        imageUrl = (resData as any).url
      } else if ((resData as any)?.data?.fileUrl) {
        imageUrl = (resData as any).data.fileUrl
      }
      if (imageUrl) {
        updateFormData('photoUrl', imageUrl)
        Taro.showToast({ title: '照片上传成功', icon: 'success' })
      } else {
        Taro.showToast({ title: '照片已选择', icon: 'success' })
      }
    } catch (err) {
      console.error('[上传] 失败:', err)
      Taro.showToast({ title: '上传失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  // 切换内容风格选择
  const toggleStyle = (key: string) => {
    if (formData.contentStyles.includes(key)) {
      updateFormData('contentStyles', formData.contentStyles.filter(s => s !== key))
    } else if (formData.contentStyles.length < 2) {
      updateFormData('contentStyles', [...formData.contentStyles, key])
    } else {
      Taro.showToast({ title: '最多选择2个内容风格', icon: 'none' })
    }
  }

  // 切换专业领域选择
  const toggleNiche = (key: string) => {
    if (formData.niches.includes(key)) {
      updateFormData('niches', formData.niches.filter(n => n !== key))
    } else if (formData.niches.length < 3) {
      updateFormData('niches', [...formData.niches, key])
    } else {
      Taro.showToast({ title: '最多选择3个专业领域', icon: 'none' })
    }
  }

  // 切换技能选择
  const toggleSkill = (key: string) => {
    if (formData.skills.includes(key)) {
      updateFormData('skills', formData.skills.filter(s => s !== key))
    } else {
      updateFormData('skills', [...formData.skills, key])
    }
  }

  // 下一步
  const handleNext = () => {
    if (currentStep === 1 && !formData.photo) {
      Taro.showToast({ title: '请先上传照片', icon: 'none' })
      return
    }
    if (currentStep === 1 && !formData.name.trim()) {
      Taro.showToast({ title: '请输入分身昵称', icon: 'none' })
      return
    }
    if (currentStep < STEP_LABELS.length) {
      setCurrentStep(currentStep + 1)
    } else {
      handleSubmit()
    }
  }

  // 提交创建
  const handleSubmit = async () => {
    if (!formData.photo) {
      Taro.showToast({ title: '请上传照片', icon: 'none' })
      return
    }
    if (!formData.name.trim()) {
      Taro.showToast({ title: '请输入分身昵称', icon: 'none' })
      return
    }

    // 后端权益校验 — 检查分身数量限制
    try {
      const userStr = Taro.getStorageSync('userInfo')
      const userId = userStr ? (typeof userStr === 'string' ? JSON.parse(userStr).id : userStr.id) : ''
      const checkRes = await Network.request({
        url: `/api/subscription/check?userId=${userId}&type=check_avatars&currentCount=0`,
      })
      if (checkRes.data?.code === 200 && !checkRes.data?.data?.allowed) {
        Taro.showModal({
          title: '配额不足',
          content: '当前套餐分身数量已达上限，升级会员可创建更多分身',
          confirmText: '去升级',
          success: (res) => {
            if (res.confirm) {
              Taro.navigateTo({ url: '/package-avatar/pages/subscription/index' })
            }
          },
        })
        return
      }
    } catch (e) {
      console.warn('[avatar-create] 权益校验失败，继续创建:', e)
    }

    setIsSubmitting(true)
    Taro.showLoading({ title: '创建中...' })

    try {
      // 将内容风格+专业领域组装到 personality 对象中，与后端兼容
      const personality = {
        tags: formData.contentStyles.map(key => CONTENT_STYLES.find(s => s.key === key)?.name || key),
        niches: formData.niches.map(key => NICHE_TAGS.find(n => n.key === key)?.name || key),
        contentStyles: formData.contentStyles,
        nicheKeys: formData.niches,
      }

      const submitData = {
        name: formData.name,
        photo: formData.photoUrl || formData.photo,
        avatar_url: formData.photoUrl || formData.photo,
        tags: personality.tags,
        personality,
        skills: formData.skills.reduce((acc, key) => {
          acc[key] = true
          return acc
        }, {} as Record<string, boolean>),
        abilities: { chat: true, reading: true, analysis: true },
      }

      console.log('提交创建分身:', submitData)

      const res = await Network.request({
        url: '/api/avatar',
        method: 'POST',
        data: submitData,
      })

      console.log('创建分身响应:', res.data)

      Taro.hideLoading()

      if (res.data?.code === 200 || res.data?.code === 201) {
        const createdAvatarId = String(
          res.data?.data?.id
          || res.data?.data?.avatarId
          || res.data?.data?.avatar_id
          || ''
        )
        Taro.removeStorageSync(AVATAR_CREATE_DRAFT_KEY)
        setFormData({
          photo: '',
          photoUrl: '',
          name: '',
          contentStyles: [],
          niches: [],
          skills: [],
        })
        setCurrentStep(1)
        if (createdAvatarId) {
          console.log('[avatar-create] Setting onboarding storage, avatarId =', createdAvatarId)
          Taro.setStorageSync('onboarding_new_avatar_id', createdAvatarId)
          Taro.setStorageSync(MIND_CHAT_FOCUS_AVATAR_KEY, { avatarId: createdAvatarId, ts: Date.now() })
          console.log('[avatar-create] Storage set, verifying:', Taro.getStorageSync('onboarding_new_avatar_id'))
        } else {
          console.log('[avatar-create] WARNING: createdAvatarId is empty!')
        }
        Taro.showToast({ title: '创建成功！', icon: 'success' })
        setTimeout(() => {
          console.log('[avatar-create] Switching to mind-chat tab...')
          Taro.switchTab({ url: '/pages/mind-chat/index' })
        }, 1500)
      } else {
        Taro.showToast({
          title: res.data?.msg || '创建失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('创建分身失败:', err)
      Taro.hideLoading()
      Taro.showToast({ title: '创建失败', icon: 'none' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // 获取预估收益
  const getEstimatedEarning = () => {
    if (formData.skills.length === 0) return '0'
    const avgEarning = 3
    return `${formData.skills.length * avgEarning}-${formData.skills.length * avgEarning * 3}`
  }

  // 获取风格+领域匹配的商单提示
  const getMatchHint = () => {
    const styles = formData.contentStyles
    const niches = formData.niches
    if (styles.length === 0 && niches.length === 0) return '选择后可查看适合你的商单类型'
    const parts: string[] = []
    if (styles.length > 0) {
      const styleNames = styles.map(k => CONTENT_STYLES.find(s => s.key === k)?.name).filter(Boolean)
      parts.push(`${styleNames.join('/')}风格`)
    }
    if (niches.length > 0) {
      const nicheNames = niches.map(k => NICHE_TAGS.find(n => n.key === k)?.name).filter(Boolean)
      parts.push(`${nicheNames.join('/')}领域`)
    }
    return `适合接 ${parts.join(' + ')} 的商单`
  }

  // 渲染步骤1 - 形象设定
  const renderStep1 = () => (
    <View className="step-content">
      {/* 创建好处 - 核心价值主张 */}
      <View className="benefits-card">
        <View className="benefits-header">
          <Sparkles size={18} color="#8B5CF6" />
          <Text className="benefits-title">创建分身，你能获得什么</Text>
        </View>
        <View className="benefits-grid">
          {BENEFITS.map(b => (
            <View key={b.title} className="benefit-item">
              <View className="benefit-icon-wrap" style={{ background: `${b.color}15` }}>
                <b.icon size={20} color={b.color} />
              </View>
              <Text className="benefit-item-title">{b.title}</Text>
              <Text className="benefit-item-desc">{b.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 上传照片 */}
      <View className="form-section">
        <Text className="section-title">
          分身形象
          <Text className="title-hint">（必填）</Text>
        </Text>
        {formData.photo ? (
          <View className="photo-uploaded" onClick={handleUploadPhoto}>
            <Image
              className="photo-uploaded-img"
              src={formData.photo}
              mode="aspectFill"
            />
            <View className="photo-uploaded-info">
              <Text className="photo-uploaded-title">{formData.name || '我的AI分身'}</Text>
              <Text className="photo-uploaded-hint">点击更换照片</Text>
            </View>
          </View>
        ) : (
          <View className="upload-area" onClick={handleUploadPhoto}>
            <View className="upload-icon-bg">
              <Camera size={40} color="#8B5CF6" />
            </View>
            <Text className="upload-title">上传分身照片</Text>
            <Text className="upload-hint">照片将作为分身的形象展示给其他用户</Text>
            <Text className="upload-tip">建议使用清晰正面照，支持拍照/相册/聊天记录</Text>
          </View>
        )}
      </View>

      {/* 分身名称 */}
      <View className="form-section">
        <Text className="section-title">
          分身昵称
          <Text className="title-hint">（必填）</Text>
        </Text>
        <View className="input-box">
          <Input
            className="name-input"
            placeholder="给分身起个响亮的名字"
            placeholderClass="placeholder"
            value={formData.name}
            onInput={(e) => updateFormData('name', e.detail.value)}
            maxlength={20}
          />
        </View>
        <Text className="input-sub-hint">好名字让分身更有辨识度，更容易被用户关注</Text>
      </View>
    </View>
  )

  // 渲染步骤2 - 风格定位（内容风格 + 专业领域）
  const renderStep2 = () => (
    <View className="step-content">
      {/* 匹配提示卡 */}
      <View className="match-tip-card">
        <Target size={20} color="#8B5CF6" />
        <View className="match-tip-info">
          <Text className="match-tip-title">定位越准，接单越快</Text>
          <Text className="match-tip-desc">{getMatchHint()}</Text>
        </View>
      </View>

      {/* 内容风格 */}
      <View className="form-section">
        <View className="section-header">
          <Text className="section-title-inline">内容风格</Text>
          <Text className="section-subtitle">决定你接什么类型的商单（最多2个）</Text>
        </View>
        <View className="style-list">
          {CONTENT_STYLES.map(style => {
            const isSelected = formData.contentStyles.includes(style.key)
            return (
              <View
                key={style.key}
                className={`style-card ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleStyle(style.key)}
              >
                <View className="style-card-header">
                  <View className="style-dot" style={{ background: style.color }} />
                  <Text className="style-name">{style.name}</Text>
                  <View className={`style-check ${isSelected ? 'checked' : ''}`}>
                    {isSelected && <Check size={14} color="#fff" />}
                  </View>
                </View>
                <Text className="style-desc">{style.desc}</Text>
                <View className="style-match-info">
                  {style.matchPlatforms.map(p => {
                    const platformNames: Record<string, string> = {
                      xiaohongshu: '小红书',
                      douyin: '抖音',
                      wechat_mp: '公众号',
                      wechat_moments: '朋友圈',
                    }
                    return (
                      <View key={p} className="style-platform-tag" style={{ background: `${style.color}12`, borderColor: `${style.color}30` }}>
                        <Text className="style-platform-text" style={{ color: style.color }}>{platformNames[p] || p}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            )
          })}
        </View>
      </View>

      {/* 专业领域 */}
      <View className="form-section">
        <View className="section-header">
          <Text className="section-title-inline">专业领域</Text>
          <Text className="section-subtitle">商单会优先匹配你擅长的领域（最多3个）</Text>
        </View>
        <View className="niche-grid">
          {NICHE_TAGS.map(niche => {
            const isSelected = formData.niches.includes(niche.key)
            return (
              <View
                key={niche.key}
                className={`niche-item ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleNiche(niche.key)}
              >
                <Text className="niche-icon">{niche.icon}</Text>
                <Text className={`niche-name ${isSelected ? 'selected' : ''}`}>{niche.name}</Text>
              </View>
            )
          })}
        </View>
        <Text className="input-sub-hint">
          {formData.niches.length > 0
            ? `已选领域：${formData.niches.map(k => NICHE_TAGS.find(n => n.key === k)?.name).join('、')}，对应商单将优先派给你`
            : '选择领域后，相关商单会优先匹配给你'
        }
        </Text>
      </View>
    </View>
  )

  // 渲染步骤3 - 技能选择
  const renderStep3 = () => (
    <View className="step-content">
      {/* 技能收益提示 */}
      <View className="earning-tip-card">
        <CircleDollarSign size={20} color="#F59E0B" />
        <View className="earning-tip-info">
          <Text className="earning-tip-title">选择技能 = 选择赚钱方式</Text>
          <Text className="earning-tip-desc">
            已选 <Text className="earning-highlight">{formData.skills.length}</Text> 项技能，
            预估日收益 <Text className="earning-highlight">¥{getEstimatedEarning()}</Text>
          </Text>
        </View>
      </View>

      {/* 技能选择列表 */}
      <View className="form-section">
        <View className="section-header">
          <Text className="section-title-inline">选择分身技能</Text>
          <Text className="section-subtitle">技能越多，接单范围越广</Text>
        </View>
        <View className="skills-list">
          {AVATAR_SKILLS.map(skill => {
            const isSelected = formData.skills.includes(skill.key)
            const SkillIcon = skill.icon
            return (
              <View
                key={skill.key}
                className={`skill-card ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleSkill(skill.key)}
              >
                <View className="skill-left">
                  <View className="skill-icon-wrap" style={{ background: `${skill.color}15` }}>
                    <SkillIcon size={22} color={skill.color} />
                  </View>
                  <View className="skill-info">
                    <Text className="skill-name">{skill.name}</Text>
                    <Text className="skill-desc">{skill.desc}</Text>
                  </View>
                </View>
                <View className="skill-right">
                  <Text className="skill-earning">{skill.earning}</Text>
                  <View className={`skill-check ${isSelected ? 'checked' : ''}`}>
                    {isSelected && <Check size={16} color="#fff" />}
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      </View>

      {/* 推荐组合 */}
      <View className="combo-card">
        <View className="combo-header">
          <Zap size={16} color="#F59E0B" />
          <Text className="combo-title">热门赚钱组合</Text>
        </View>
        <View className="combo-list">
          <View className="combo-item" onClick={() => updateFormData('skills', ['content_writing', 'video_gen', 'image_gen'])}>
            <Text className="combo-name">内容创作 + 视频生成 + 图片生成</Text>
            <Text className="combo-earning">预估 ¥10-50/天</Text>
          </View>
          <View className="combo-item" onClick={() => updateFormData('skills', ['palm_reading', 'outfit_advice', 'image_gen'])}>
            <Text className="combo-name">看手相 + 衣品改造 + 图片生成</Text>
            <Text className="combo-earning">预估 ¥15-60/天</Text>
          </View>
          <View className="combo-item" onClick={() => updateFormData('skills', ['content_writing', 'audio_gen', 'music_rec'])}>
            <Text className="combo-name">内容创作 + 音频生成 + 音乐推荐</Text>
            <Text className="combo-earning">预估 ¥8-35/天</Text>
          </View>
        </View>
      </View>

      {/* 创建预览 */}
      <View className="preview-summary">
        <View className="preview-avatar">
          {formData.photo ? (
            <Image className="preview-avatar-img" src={formData.photo} mode="aspectFill" />
          ) : (
            <View className="preview-avatar-placeholder">
              <Bot size={32} color="#8B5CF6" />
            </View>
          )}
          <View className="preview-avatar-info">
            <Text className="preview-name">{formData.name || '我的AI分身'}</Text>
            <View className="preview-tags-row">
              {formData.contentStyles.slice(0, 2).map(key => {
                const s = CONTENT_STYLES.find(st => st.key === key)
                return s ? (
                  <View key={key} className="preview-skill-tag" style={{ background: `${s.color}15`, borderColor: `${s.color}30` }}>
                    <Text className="preview-skill-text" style={{ color: s.color }}>{s.name}</Text>
                  </View>
                ) : null
              })}
              {formData.niches.slice(0, 2).map(key => {
                const n = NICHE_TAGS.find(ni => ni.key === key)
                return n ? (
                  <View key={key} className="preview-skill-tag" style={{ background: `${n.color}15`, borderColor: `${n.color}30` }}>
                    <Text className="preview-skill-text" style={{ color: n.color }}>{n.icon} {n.name}</Text>
                  </View>
                ) : null
              })}
              {formData.skills.slice(0, 2).map(key => {
                const s = AVATAR_SKILLS.find(sk => sk.key === key)
                return s ? (
                  <View key={key} className="preview-skill-tag" style={{ background: `${s.color}15`, borderColor: `${s.color}30` }}>
                    <Text className="preview-skill-text" style={{ color: s.color }}>{s.name}</Text>
                  </View>
                ) : null
              })}
            </View>
          </View>
        </View>
        <View className="preview-earning-row">
          <Text className="preview-earning-label">预估日收益</Text>
          <Text className="preview-earning-value">
            {formData.skills.length > 0 ? `¥${getEstimatedEarning()}` : '选择技能后显示'}
          </Text>
        </View>
      </View>

      {/* 声音复刻提示 - 引导到创建后 */}
      <View
        className="voice-post-card"
        onClick={() => {
          Taro.showToast({ title: '创建分身后即可配置', icon: 'none' })
        }}
      >
        <View className="voice-post-left">
          <Mic size={20} color="#8B5CF6" />
          <View className="voice-post-info">
            <Text className="voice-post-title">声音复刻</Text>
            <Text className="voice-post-desc">创建分身后，可录制30秒音频复刻你的声音</Text>
          </View>
        </View>
        <ArrowRight size={16} color="#94A3B8" />
      </View>
    </View>
  )

  return (
    <View className="create-page">
      {/* 顶部渐变背景 */}
      <View className="page-header" style={{ paddingTop: `${statusBarHeight + 10}px` }}>
        <View className="header-decoration">
          <View className="deco-circle circle-1" />
          <View className="deco-circle circle-2" />
        </View>

        <View className="header-content">
          <View className="back-btn" onClick={handleBack}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <Text className="header-title">创建AI分身</Text>
          <View className="header-right" />
        </View>

        {/* 价值主张 */}
        <View className="value-prop">
          <Text className="value-prop-title">0成本创建，让AI替你赚钱</Text>
          <Text className="value-prop-desc">只需3步，创建专属分身开启自动接单</Text>
        </View>

        {/* 步骤指示器 */}
        <View className="step-indicator">
          {STEP_LABELS.map((_, index) => (
            <View key={index} style={{ display: 'flex', alignItems: 'center' }}>
              <View
                className={`step-item ${index + 1 === currentStep ? 'active' : ''} ${index + 1 < currentStep ? 'completed' : ''}`}
              >
                <View className="step-node">
                  {index + 1 < currentStep ? (
                    <Check size={20} color="#8B5CF6" />
                  ) : (
                    index + 1
                  )}
                </View>
              </View>
              {index < STEP_LABELS.length - 1 && (
                <View className={`step-line ${index + 1 < currentStep ? 'active' : ''}`} />
              )}
            </View>
          ))}
        </View>

        <View className="step-labels">
          {STEP_LABELS.map((label, index) => (
            <Text
              key={label}
              className={`step-label ${index + 1 === currentStep ? 'active' : ''}`}
            >
              {label}
            </Text>
          ))}
        </View>
      </View>

      {/* 内容区域 */}
      <ScrollView className="page-content" scrollY>
        {/* 配额提示 */}
        {quotaSummary.maxAvatars !== -1 && quotaSummary.remainingAvatars <= 1 && (
          <View className="quota-tip-bar">
            <Crown size={16} color="#F59E0B" />
            <Text className="quota-tip-text">
              {quotaSummary.remainingAvatars <= 0
                ? '当前配额已用完，升级订阅可创建更多分身'
                : `还可创建${quotaSummary.remainingAvatars}个分身，升级订阅解锁更多`}
            </Text>
            <View className="quota-tip-btn" onClick={() => Taro.navigateTo({ url: '/package-avatar/pages/subscription/index' })}>
              <Text className="quota-tip-btn-text">升级</Text>
            </View>
          </View>
        )}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </ScrollView>

      {/* 底部按钮 */}
      <View className="bottom-action">
        <View
          className="main-btn"
          onClick={handleNext}
        >
          <Text className="btn-text">
            {currentStep === 1
              ? '下一步 · 风格定位'
              : currentStep === 2
                ? '下一步 · 选择技能'
                : isSubmitting
                  ? '创建中...'
                  : formData.skills.length > 0
                    ? `创建分身 · 预估¥${getEstimatedEarning()}/天`
                    : '创建分身'}
          </Text>
        </View>
        {currentStep === 1 && (
          <Text className="bottom-hint">0元创建，创建后可随时修改</Text>
        )}
      </View>
    </View>
  )
}
