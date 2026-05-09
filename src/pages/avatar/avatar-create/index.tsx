// @ts-nocheck
import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import { ChevronLeft, Upload, User } from 'lucide-react-taro'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import './index.css'

// 步骤标签
const STEPS = ['上传照片', '基础设置', '能力选择']

// 人设标签选项
const PERSONA_TAGS = [
  '网红博主', '生活分享', '职场导师', '知识专家', 
  '情感导师', '美妆达人', '健身教练', '美食博主',
  '旅行达人', '科技极客', '育儿专家', '财经分析'
]

// 音色选项
const VOICE_OPTIONS = [
  { label: '原声复刻', desc: '克隆你的真实声音' },
  { label: '温柔女声', desc: '亲切温柔的表达' },
  { label: '磁性男声', desc: '低沉有魅力的声音' },
  { label: '甜美萝莉', desc: '清新可爱的声音' },
  { label: '成熟御姐', desc: '知性优雅的声音' }
]

// 能力选项
const ABILITY_OPTIONS = [
  { key: 'autoOrder', label: '自动接单', desc: '自动接收并处理平台订单', icon: '📋' },
  { key: 'autoContent', label: '内容创作', desc: 'AI智能生成高质量内容', icon: '✍️' },
  { key: 'autoPublish', label: '自动发布', desc: '一键分发到各大平台', icon: '🚀' }
]

export default function AvatarCreate() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    photo: null as string | null,
    name: '',
    tags: [] as string[],
    voice: '原声复刻',
    abilities: {
      autoOrder: true,
      autoContent: true,
      autoPublish: false
    }
  })

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

  // 上传照片
  const handleUploadPhoto = () => {
    Taro.chooseImage({
      count: 1,
      sourceType: ['album', 'camera'],
      success: (res) => {
        console.log('选择照片成功', res.tempFilePaths)
        updateFormData('photo', res.tempFilePaths[0])
        Taro.showToast({ title: '照片已选择', icon: 'success' })
      }
    })
  }

  // 切换标签选择
  const toggleTag = (tag: string) => {
    const newTags = formData.tags.includes(tag)
      ? formData.tags.filter(t => t !== tag)
      : [...formData.tags, tag]
    updateFormData('tags', newTags)
  }

  // 切换能力开关
  const toggleAbility = (key: string) => {
    updateFormData('abilities', {
      ...formData.abilities,
      [key]: !formData.abilities[key as keyof typeof formData.abilities]
    })
  }

  // 下一步
  const handleNext = () => {
    if (currentStep === 1 && !formData.photo) {
      Taro.showToast({ title: '请先上传照片', icon: 'none' })
      return
    }
    if (currentStep === 2 && !formData.name.trim()) {
      Taro.showToast({ title: '请输入分身昵称', icon: 'none' })
      return
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    } else {
      submitCreate()
    }
  }

  // 提交创建
  const submitCreate = async () => {
    setIsLoading(true)
    Taro.showLoading({ title: '生成分身中...' })
    try {
      const res = await Network.request({
        url: '/api/avatar',
        method: 'POST',
        header: { 'x-user-id': 'user_demo' },
        data: {
          name: formData.name || '我的分身',
          description: formData.tags.join(','),
          gender: 'female'
        }
      })
      Taro.hideLoading()
      if (res.data?.code === 200) {
        Taro.showToast({ title: '分身创建成功', icon: 'success' })
        setTimeout(() => {
          Taro.switchTab({ url: '/pages/mind-chat/index' })
        }, 1500)
      } else {
        Taro.showToast({ title: res.data?.msg || '创建失败', icon: 'none' })
      }
    } catch (err) {
      Taro.hideLoading()
      Taro.showToast({ title: '创建失败', icon: 'none' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <View className="create-page">
      {/* 顶部导航 */}
      <View className="page-header">
        <View className="header-back" onClick={handleBack}>
          <ChevronLeft size={28} color="#333" />
        </View>
        <Text className="header-title">创建分身</Text>
        <View className="header-right"></View>
      </View>

      {/* 步骤指示器 */}
      <View className="step-indicator">
        {STEPS.map((step, index) => (
          <View 
            key={index} 
            className={`step-item ${currentStep > index + 1 ? 'completed' : currentStep === index + 1 ? 'active' : ''}`}
          >
            <View className="step-line left" />
            <View className="step-node">
              {currentStep > index + 1 ? '✓' : index + 1}
            </View>
            <Text className="step-label">{step}</Text>
            <View className="step-line right" />
          </View>
        ))}
      </View>

      {/* 步骤1：上传照片 */}
      {currentStep === 1 && (
        <View className="step-content">
          <View className="upload-area" onClick={handleUploadPhoto}>
            {formData.photo ? (
              <View className="photo-preview">
                <View className="preview-placeholder">
                  <User size={80} color="#CBD5E1" />
                  <Text className="preview-text">点击更换照片</Text>
                </View>
              </View>
            ) : (
              <View className="upload-placeholder">
                <Upload size={60} color="#8B5CF6" />
                <Text className="upload-title">点击上传照片</Text>
                <Text className="upload-hint">上传清晰正脸照片，效果更佳</Text>
              </View>
            )}
          </View>
          
          <View className="tips-card">
            <Text className="tips-title">照片要求</Text>
            <Text className="tips-item">• 清晰正脸照片，五官可见</Text>
            <Text className="tips-item">• 光线充足，表情自然</Text>
            <Text className="tips-item">• 建议半身或全身照</Text>
          </View>
        </View>
      )}

      {/* 步骤2：基础设置 */}
      {currentStep === 2 && (
        <View className="step-content">
          {/* 分身昵称 */}
          <View className="form-section">
            <Text className="section-title">分身昵称</Text>
            <View className="input-box">
              <Input
                className="name-input"
                placeholder="给你的分身起个名字"
                placeholderClass="input-placeholder"
                value={formData.name}
                onInput={(e) => updateFormData('name', e.detail.value)}
                maxlength={20}
              />
            </View>
          </View>

          {/* 人设标签 */}
          <View className="form-section">
            <Text className="section-title">人设标签 <Text className="title-hint">选择1-3个</Text></Text>
            <View className="tags-grid">
              {PERSONA_TAGS.map((tag, index) => (
                <View
                  key={index}
                  className={`persona-tag ${formData.tags.includes(tag) ? 'selected' : ''}`}
                  onClick={() => {
                    if (formData.tags.length >= 3 && !formData.tags.includes(tag)) {
                      Taro.showToast({ title: '最多选择3个标签', icon: 'none' })
                      return
                    }
                    toggleTag(tag)
                  }}
                >
                  <Text className={`tag-text ${formData.tags.includes(tag) ? 'selected' : ''}`}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 音色选择 */}
          <View className="form-section">
            <Text className="section-title">音色选择</Text>
            <View className="voice-list">
              {VOICE_OPTIONS.map((voice, index) => (
                <View
                  key={index}
                  className={`voice-item ${formData.voice === voice.label ? 'selected' : ''}`}
                  onClick={() => updateFormData('voice', voice.label)}
                >
                  <View className="voice-info">
                    <Text className="voice-label">{voice.label}</Text>
                    <Text className="voice-desc">{voice.desc}</Text>
                  </View>
                  <View className={`voice-check ${formData.voice === voice.label ? 'active' : ''}`} />
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* 步骤3：能力选择 */}
      {currentStep === 3 && (
        <View className="step-content">
          <View className="form-section">
            <Text className="section-title">能力配置 <Text className="title-hint">开通更多能力</Text></Text>
            <View className="ability-list">
              {ABILITY_OPTIONS.map((ability, index) => (
                <View key={index} className="ability-item">
                  <Text className="ability-icon">{ability.icon}</Text>
                  <View className="ability-info">
                    <Text className="ability-label">{ability.label}</Text>
                    <Text className="ability-desc">{ability.desc}</Text>
                  </View>
                  <View 
                    className={`ability-toggle ${formData.abilities[ability.key as keyof typeof formData.abilities] ? 'active' : ''}`}
                    onClick={() => toggleAbility(ability.key)}
                  >
                    <View className="toggle-dot" />
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="summary-card">
            <Text className="summary-title">创建预览</Text>
            <View className="summary-row">
              <Text className="summary-label">分身名称</Text>
              <Text className="summary-value">{formData.name || '未设置'}</Text>
            </View>
            <View className="summary-row">
              <Text className="summary-label">人设标签</Text>
              <Text className="summary-value">{formData.tags.length > 0 ? formData.tags.join('、') : '未选择'}</Text>
            </View>
            <View className="summary-row">
              <Text className="summary-label">声音音色</Text>
              <Text className="summary-value">{formData.voice}</Text>
            </View>
          </View>
        </View>
      )}

      {/* 底部按钮 */}
      <View className="bottom-action">
        <View 
          className={`main-btn ${isLoading ? 'loading' : ''}`}
          onClick={!isLoading ? handleNext : undefined}
        >
          <Text className="btn-text">
            {currentStep === 3 ? '立即创建' : '下一步'}
          </Text>
        </View>
      </View>
    </View>
  )
}
