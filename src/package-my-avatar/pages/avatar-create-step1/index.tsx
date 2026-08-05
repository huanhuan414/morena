import { useCallback, useState } from 'react'
import { View, Text, Image, Textarea } from '@tarojs/components'
import Taro, { getSetting, openSetting, useLoad } from '@tarojs/taro'
import { ArrowLeft, Camera, ChevronRight, Calendar, User, Briefcase, MapPin } from 'lucide-react-taro'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { reverseGeocodeFromMiniProgram } from '@/utils/amap'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

/** ai_avatar.tags_json 结构 */
interface AvatarTagsJson {
  age?: string
  gender?: string
  occupation?: string
  location?: string
  tags?: string[]
}

/** 年龄选项 */
const AGE_OPTIONS = [
  '18岁以下', '18-24岁', '25-30岁', '31-35岁',
  '36-40岁', '41-50岁', '50岁以上',
]

/** 性别选项 */
const GENDER_OPTIONS = ['男', '女']

/** 职业选项 */
const OCCUPATION_OPTIONS = [
  '学生', '上班族', '自由职业', '创业者', '宝妈',
  '老师', '设计师', '程序员', '运营', '其他',
]


export default function AvatarCreateStep1Page() {
  const statusBarHeight = getStatusBarHeight()

  const [editAvatarId, setEditAvatarId] = useState<number>(0)
  const [avatarName, setAvatarName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [localPhoto, setLocalPhoto] = useState('')
  const [description, setDescription] = useState('')
  const [tagsJson, setTagsJson] = useState<AvatarTagsJson>({})
  const [existingSkillType, setExistingSkillType] = useState('')

  const [showAgePicker, setShowAgePicker] = useState(false)
  const [showGenderPicker, setShowGenderPicker] = useState(false)
  const [showOccupationPicker, setShowOccupationPicker] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditMode = editAvatarId > 0

  /** 加载已有分身数据用于编辑回填 */
  const loadAvatarDetail = useCallback(async (id: number) => {
    try {
      Taro.showLoading({ title: '加载中...' })
      const res = await Network.request({ url: `/api/ai-avatar/${id}` })
      Taro.hideLoading()

      const detail = (res.data as any)?.data
      if (!detail) {
        Taro.showToast({ title: '分身不存在', icon: 'none' })
        return
      }

      setAvatarName(detail.avatarName || '')
      setAvatarUrl(detail.avatarUrl || '')
      if (detail.avatarUrl) setLocalPhoto(detail.avatarUrl)
      setDescription(detail.description || '')
      const tags = detail.tagsJson
      setTagsJson(tags && typeof tags === 'object' ? tags : {})
      if (detail.skillType) setExistingSkillType(detail.skillType)
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '加载分身信息失败', icon: 'none' })
    }
  }, [])

  useLoad((options) => {
    const id = Number(options?.avatarId || 0)
    if (id > 0) {
      setEditAvatarId(id)
      void loadAvatarDetail(id)
    }
  })

  /** 更新标签字段 */
  const updateTag = (key: keyof AvatarTagsJson, value: string) => {
    setTagsJson(prev => ({ ...prev, [key]: value }))
  }

  /** 获取地理位置（调用微信定位 + 逆地理编码，精确到城市区级） */
  const handleGetLocation = async () => {
    if (isLocating) return
    setIsLocating(true)

    try {
      Taro.showLoading({ title: '定位中...' })

      const locationRes = await Taro.getFuzzyLocation({ type: 'gcj02' })
      const { latitude, longitude } = locationRes

      const addressInfo = await reverseGeocodeFromMiniProgram(latitude, longitude)
      const location = addressInfo.city + addressInfo.district

      updateTag('location', location || addressInfo.formattedAddress)
      Taro.hideLoading()
      Taro.showToast({ title: '定位成功', icon: 'success' })
    } catch (err: any) {
      Taro.hideLoading()
      const errMsg = err?.errMsg || err?.message || ''

      if (errMsg.includes('cancel')) {
        setIsLocating(false)
        return
      }

      const settingRes = await getSetting()
      const hasLocationAuth = settingRes.authSetting['scope.userFuzzyLocation']

      if (hasLocationAuth === false) {
        const modalRes = await Taro.showModal({
          title: '定位权限',
          content: '需要定位权限来获取分身位置，请在设置中开启',
          confirmText: '去设置',
          cancelText: '取消',
        })
        if (modalRes.confirm) {
          await openSetting()
        }
      } else if (
        errMsg.includes('LOCATIONSWITCHOFF') ||
        errMsg.includes('system permission') ||
        errMsg.includes('location off') ||
        errMsg.includes('switch is off')
      ) {
        Taro.showModal({
          title: '开启定位服务',
          content: '请先在手机系统中开启定位服务（GPS），然后重试',
          showCancel: false,
          confirmText: '我知道了',
        })
      } else if (errMsg.includes('timeout')) {
        Taro.showToast({ title: '定位超时，请重试', icon: 'none' })
      } else {
        Taro.showToast({ title: '定位失败，请重试', icon: 'none' })
      }
    } finally {
      setIsLocating(false)
    }
  }

  /** 选择头像照片 */
  const handleChooseAvatar = () => {
    const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP

    if (!isWeapp) {
      Taro.chooseImage({
        count: 1,
        sourceType: ['album'],
        success: async (res) => {
          const tempFilePath = res.tempFilePaths[0]
          setLocalPhoto(tempFilePath)
          await uploadAvatar(tempFilePath)
        },
      })
      return
    }

    Taro.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: (res) => {
        const sourceType: ('camera' | 'album')[] = res.tapIndex === 0 ? ['camera'] : ['album']
        Taro.chooseImage({
          count: 1,
          sourceType,
          success: async (imgRes) => {
            const tempFilePath = imgRes.tempFilePaths[0]
            setLocalPhoto(tempFilePath)
            await uploadAvatar(tempFilePath)
          },
        })
      },
    })
  }

  /** 上传头像到服务器 */
  const uploadAvatar = async (filePath: string) => {
    Taro.showLoading({ title: '上传中...' })
    try {
      const uploadRes = await Network.uploadFile({
        url: '/api/upload',
        filePath,
        name: 'file',
      })
      let resData = uploadRes.data
      if (typeof resData === 'string') {
        try { resData = JSON.parse(resData) } catch { /* ignore */ }
      }
      const imageUrl =
        (resData as any)?.data?.url ||
        (resData as any)?.url ||
        (resData as any)?.data?.fileUrl || ''
      if (imageUrl) {
        setAvatarUrl(imageUrl)
        Taro.showToast({ title: '上传成功', icon: 'success' })
      }
    } catch {
      Taro.showToast({ title: '上传失败，请重试', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  /** 表单校验 */
  const validateForm = (): boolean => {
    if (!avatarName.trim()) {
      Taro.showToast({ title: '请输入分身昵称', icon: 'none' })
      return false
    }
    if (!tagsJson.age) {
      Taro.showToast({ title: '请选择年龄', icon: 'none' })
      return false
    }
    if (!tagsJson.gender) {
      Taro.showToast({ title: '请选择性别', icon: 'none' })
      return false
    }
    if (!tagsJson.occupation) {
      Taro.showToast({ title: '请选择职业', icon: 'none' })
      return false
    }
    if (!tagsJson.location) {
      Taro.showToast({ title: '请选择地理位置', icon: 'none' })
      return false
    }
    return true
  }

  /** 下一步 - 保存/更新分身基础信息 */
  const handleNext = async () => {
    if (!validateForm()) return
    if (isSubmitting) return

    setIsSubmitting(true)
    Taro.showLoading({ title: '保存中...' })

    try {
      const submitData = {
        avatar_name: avatarName.trim(),
        avatar_url: avatarUrl || undefined,
        description: description.trim() || undefined,
        tags_json: Object.keys(tagsJson).length > 0 ? tagsJson : undefined,
        skill_type: (isEditMode && existingSkillType) ? existingSkillType : '文字生成',
      }

      const res = isEditMode
        ? await Network.request({
            url: `/api/ai-avatar/${editAvatarId}`,
            method: 'PUT',
            data: submitData,
          })
        : await Network.request({
            url: '/api/ai-avatar',
            method: 'POST',
            data: submitData,
          })

      Taro.hideLoading()

      if (res.data?.code === 200) {
        const avatarId = isEditMode ? editAvatarId : (res.data as any)?.data?.id
        Taro.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => {
          if (avatarId) {
            Taro.navigateTo({
              url: `/package-my-avatar/pages/avatar-create-step2/index?avatarId=${avatarId}`,
            })
          } else {
            Taro.navigateBack()
          }
        }, 1500)
      } else {
        Taro.showToast({ title: res.data?.msg || '保存失败', icon: 'none' })
      }
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '网络错误，请重试', icon: 'none' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <View className="acs-page">
      {/* 顶部导航 */}
      <View className="acs-header" style={{ paddingTop: `${statusBarHeight + 10}px` }}>
        <View className="acs-back" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={20} color="#1a1a2e" />
        </View>
        <Text className="acs-header-title">{isEditMode ? '编辑分身信息（1/3）' : '创建分身（1/3）'}</Text>
        <View className="acs-header-right" />
      </View>

      {/* 进度条 */}
      <View className="acs-progress">
        <View className="acs-progress-bar">
          <View className="acs-progress-fill" style={{ width: '33.3%' }} />
        </View>
      </View>

      {/* 主内容 */}
      <View className="acs-content">
        {/* 标题区 */}
        <View className="acs-title-section">
          <Text className="acs-main-title">设置分身基础信息</Text>
          <Text className="acs-sub-title">完善基础信息可以让你的分身更具个性和吸引力</Text>
        </View>

        {/* 头像上传 */}
        <View className="acs-avatar-section" onClick={handleChooseAvatar}>
          <View className="acs-avatar-wrap">
            {localPhoto ? (
              <Image className="acs-avatar-img" src={localPhoto} mode="aspectFill" />
            ) : (
              <View className="acs-avatar-placeholder">
                <User size={60} color="#a78bfa" />
              </View>
            )}
            <View className="acs-avatar-camera">
              <Camera size={22} color="#ffffff" />
            </View>
          </View>
          <Text className="acs-avatar-hint">点击上传分身头像</Text>
          <Text className="acs-avatar-sub-hint">支持JPG/PNG，建议尺寸1:1</Text>
        </View>

        {/* 分身昵称 */}
        <View className="acs-form-section">
          <Text className="acs-form-label">
            分身昵称
            <Text className="acs-form-required">*</Text>
          </Text>
          <View className="acs-input-wrap">
            <Input
              className="acs-input"
              placeholder="给你的分身取个名字吧~"
              placeholderClass="placeholder"
              value={avatarName}
              onInput={(e) => setAvatarName(e.detail.value)}
              maxlength={20}
            />
            <Text className="acs-input-count">{avatarName.length}/20</Text>
          </View>
        </View>

        {/* 分身标签 */}
        <View className="acs-tags-section">
          <View className="acs-tags-header">
            <Text className="acs-tags-label">
              分身标签
              <Text className="acs-tags-required">*</Text>
            </Text>
          </View>

          {/* 年龄 */}
          <View className="acs-tag-item" onClick={() => setShowAgePicker(true)}>
            <View className="acs-tag-left">
              <View className="acs-tag-icon-wrap">
                <Calendar size={20} color="#7c3aed" />
              </View>
              <Text className="acs-tag-name">年龄</Text>
            </View>
            <View className="acs-tag-right">
              <Text className={`acs-tag-value ${tagsJson.age ? 'is-filled' : ''}`}>
                {tagsJson.age || '请选择'}
              </Text>
              <ChevronRight size={16} color="#9ca3af" />
            </View>
          </View>

          {/* 性别 */}
          <View className="acs-tag-item" onClick={() => setShowGenderPicker(true)}>
            <View className="acs-tag-left">
              <View className="acs-tag-icon-wrap">
                <User size={20} color="#7c3aed" />
              </View>
              <Text className="acs-tag-name">性别</Text>
            </View>
            <View className="acs-tag-right">
              <Text className={`acs-tag-value ${tagsJson.gender ? 'is-filled' : ''}`}>
                {tagsJson.gender || '请选择'}
              </Text>
              <ChevronRight size={16} color="#9ca3af" />
            </View>
          </View>

          {/* 职业 */}
          <View className="acs-tag-item" onClick={() => setShowOccupationPicker(true)}>
            <View className="acs-tag-left">
              <View className="acs-tag-icon-wrap">
                <Briefcase size={20} color="#7c3aed" />
              </View>
              <Text className="acs-tag-name">职业</Text>
            </View>
            <View className="acs-tag-right">
              <Text className={`acs-tag-value ${tagsJson.occupation ? 'is-filled' : ''}`}>
                {tagsJson.occupation || '请选择'}
              </Text>
              <ChevronRight size={16} color="#9ca3af" />
            </View>
          </View>

          {/* 地理位置 */}
          <View className="acs-tag-item" onClick={handleGetLocation}>
            <View className="acs-tag-left">
              <View className="acs-tag-icon-wrap">
                <MapPin size={20} color="#7c3aed" />
              </View>
              <Text className="acs-tag-name">地理位置</Text>
            </View>
            <View className="acs-tag-right">
              <Text className={`acs-tag-value ${tagsJson.location ? 'is-filled' : ''}`}>
                {isLocating ? '定位中...' : (tagsJson.location || '请选择')}
              </Text>
              <ChevronRight size={16} color="#9ca3af" />
            </View>
          </View>
        </View>

        {/* 个性描述 */}
        <View className="acs-form-section">
          <Text className="acs-form-label">个性描述（选填）</Text>
          <View className="acs-textarea-wrap">
            <Textarea
              className="acs-textarea"
              placeholder="描述分身的性格、特长等..."
              placeholderClass="placeholder"
              value={description}
              onInput={(e) => setDescription(e.detail.value)}
              maxlength={100}
              style={{ width: '100%', minHeight: '100px', backgroundColor: 'transparent' }}
            />
            <Text className="acs-textarea-count">{description.length}/100</Text>
          </View>
        </View>
      </View>

      {/* 底部按钮 */}
      <View className="acs-footer">
        <View
          className={`acs-submit-btn ${isSubmitting ? 'disabled' : ''}`}
          onClick={handleNext}
        >
          <Text className="acs-submit-text">
            {isSubmitting ? '保存中...' : '下一步'}
          </Text>
        </View>
        <Text className="acs-footer-hint">此信息仅对你可见，可随时在分身设置中修改</Text>
      </View>

      {/* 年龄选择弹窗 */}
      {showAgePicker && (
        <View className="acs-picker-mask" onClick={() => setShowAgePicker(false)}>
          <View className="acs-picker-panel" onClick={(e) => e.stopPropagation()}>
            <View className="acs-picker-header">
              <Text className="acs-picker-title">选择年龄</Text>
              <View className="acs-picker-close" onClick={() => setShowAgePicker(false)}>
                <Text className="acs-picker-close-text">✕</Text>
              </View>
            </View>
            <View className="acs-picker-options">
              {AGE_OPTIONS.map(option => (
                <View
                  key={option}
                  className={`acs-picker-option ${tagsJson.age === option ? 'selected' : ''}`}
                  onClick={() => { updateTag('age', option); setShowAgePicker(false) }}
                >
                  <Text className="acs-picker-option-name">{option}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* 性别选择弹窗 */}
      {showGenderPicker && (
        <View className="acs-picker-mask" onClick={() => setShowGenderPicker(false)}>
          <View className="acs-picker-panel" onClick={(e) => e.stopPropagation()}>
            <View className="acs-picker-header">
              <Text className="acs-picker-title">选择性别</Text>
              <View className="acs-picker-close" onClick={() => setShowGenderPicker(false)}>
                <Text className="acs-picker-close-text">✕</Text>
              </View>
            </View>
            <View className="acs-picker-options">
              {GENDER_OPTIONS.map(option => (
                <View
                  key={option}
                  className={`acs-picker-option ${tagsJson.gender === option ? 'selected' : ''}`}
                  onClick={() => { updateTag('gender', option); setShowGenderPicker(false) }}
                >
                  <Text className="acs-picker-option-name">{option}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* 职业选择弹窗 */}
      {showOccupationPicker && (
        <View className="acs-picker-mask" onClick={() => setShowOccupationPicker(false)}>
          <View className="acs-picker-panel" onClick={(e) => e.stopPropagation()}>
            <View className="acs-picker-header">
              <Text className="acs-picker-title">选择职业</Text>
              <View className="acs-picker-close" onClick={() => setShowOccupationPicker(false)}>
                <Text className="acs-picker-close-text">✕</Text>
              </View>
            </View>
            <View className="acs-picker-options">
              {OCCUPATION_OPTIONS.map(option => (
                <View
                  key={option}
                  className={`acs-picker-option ${tagsJson.occupation === option ? 'selected' : ''}`}
                  onClick={() => { updateTag('occupation', option); setShowOccupationPicker(false) }}
                >
                  <Text className="acs-picker-option-name">{option}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

    </View>
  )
}
