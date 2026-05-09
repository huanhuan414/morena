// @ts-nocheck
import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import { ChevronLeft, Upload, Mic, Sparkles } from 'lucide-react-taro'
import Taro from '@tarojs/taro'
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
  { label: '温柔女声', desc: '亲切温柔的表达', color: '#F472B6' },
  { label: '磁性男声', desc: '低沉有魅力的声音', color: '#6366F1' },
  { label: '甜美萝莉', desc: '清新可爱的声音', color: '#F59E0B' },
  { label: '成熟御姐', desc: '知性优雅的声音', color: '#10B981' }
]

// 能力选项
const ABILITY_OPTIONS = [
  { key: 'autoOrder', label: '自动接单', desc: '自动接收并处理平台订单', icon: '📋', color: '#8B5CF6' },
  { key: 'autoContent', label: '内容创作', desc: 'AI智能生成高质量内容', icon: '✍️', color: '#06B6D4' },
  { key: 'autoPublish', label: '自动发布', desc: '一键分发到各大平台', icon: '🚀', color: '#F59E0B' }
]

export default function AvatarCreate() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    photo: null as string | null,
    name: '',
    tags: [] as string[],
    voice: '',
    voiceUrl: '',
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
        updateFormData('photo', res.tempFilePaths[0])
        Taro.showToast({ title: '照片已选择', icon: 'success' })
      }
    })
  }

  // 原声复刻 - 录音
  const handleRecordVoice = () => {
    Taro.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['mp3', 'wav', 'm4a', 'ogg'],
      success: (res) => {
        updateFormData('voice', '原声复刻')
        updateFormData('voiceUrl', res.tempFiles[0].tempFilePath)
        Taro.showToast({ title: '声音已选择', icon: 'success' })
      },
      fail: () => {
        // 用户取消选择，使用默认
      }
    })
  }

  // 切换标签选择
  const toggleTag = (tag: string) => {
    if (formData.tags.includes(tag)) {
      updateFormData('tags', formData.tags.filter(t => t !== tag))
    } else if (formData.tags.length < 3) {
      updateFormData('tags', [...formData.tags, tag])
    } else {
      Taro.showToast({ title: '最多选择3个标签', icon: 'none' })
    }
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
    if (currentStep === 2 && !formData.voice) {
      Taro.showToast({ title: '请选择音色', icon: 'none' })
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
    setTimeout(() => {
      Taro.hideLoading()
      Taro.showToast({ title: '分身创建成功', icon: 'success' })
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/mind-chat/index' })
      }, 1500)
    }, 1500)
  }

  return (
    <View className="create-page">
      {/* 顶部渐变背景 */}
      <View className="page-header">
        <View className="header-bg" />
        <View className="header-decoration">
          <View className="deco-circle circle-1" />
          <View className="deco-circle circle-2" />
        </View>
        
        <View className="header-content">
          <View className="back-btn" onClick={handleBack}>
            <ChevronLeft size={24} color="#fff" />
          </View>
          <Text className="header-title">创建分身</Text>
          <View className="header-right" />
        </View>

        {/* 步骤指示器 */}
        <View className="step-indicator">
          {STEPS.map((step, index) => (
            <View 
              key={index} 
              className={`step-item ${currentStep > index + 1 ? 'completed' : ''} ${currentStep === index + 1 ? 'active' : ''}`}
            >
              {index > 0 && <View className={`step-line ${currentStep > index ? 'active' : ''}`} />}
              <View className="step-node">
                {currentStep > index + 1 ? '✓' : index + 1}
              </View>
              {index < STEPS.length - 1 && <View className={`step-line right ${currentStep > index + 1 ? 'active' : ''}`} />}
            </View>
          ))}
        </View>
        <View className="step-labels">
          {STEPS.map((step, index) => (
            <Text key={index} className={`step-label ${currentStep === index + 1 ? 'active' : ''}`}>{step}</Text>
          ))}
        </View>
      </View>

      {/* 内容区域 */}
      <View className="page-content">
        {/* 步骤1：上传照片 */}
        {currentStep === 1 && (
          <View className="step-content">
            <View className="upload-card">
              <View className="upload-area" onClick={handleUploadPhoto}>
                {formData.photo ? (
                  <View className="photo-preview">
                    <View className="preview-placeholder">
                      <Upload size={60} color="#8B5CF6" />
                      <Text className="preview-text">点击更换照片</Text>
                    </View>
                  </View>
                ) : (
                  <View className="upload-placeholder">
                    <View className="upload-icon-bg">
                      <Upload size={48} color="#8B5CF6" />
                    </View>
                    <Text className="upload-title">点击上传照片</Text>
                    <Text className="upload-hint">上传清晰正脸照片，效果更佳</Text>
                  </View>
                )}
              </View>
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
                    onClick={() => toggleTag(tag)}
                  >
                    <Text className={`tag-text ${formData.tags.includes(tag) ? 'selected' : ''}`}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 音色选择 */}
            <View className="form-section">
              <Text className="section-title">音色选择</Text>
              
              {/* 原声复刻选项 */}
              <View 
                className={`voice-card clone-card ${formData.voice === '原声复刻' ? 'selected' : ''}`}
                onClick={handleRecordVoice}
              >
                <View className="voice-card-header">
                  <View className="voice-icon-bg clone">
                    <Mic size={24} color="#fff" />
                  </View>
                  <View className="voice-card-info">
                    <Text className="voice-card-title">原声复刻</Text>
                    <Text className="voice-card-desc">克隆你的真实声音</Text>
                  </View>
                  <View className={`voice-check-circle ${formData.voice === '原声复刻' ? 'active' : ''}`}>
                    {formData.voice === '原声复刻' && <View className="check-inner" />}
                  </View>
                </View>
                {formData.voice === '原声复刻' && (
                  <View className="clone-area">
                    <View className="clone-status">
                      <Sparkles size={16} color="#8B5CF6" />
                      <Text className="clone-text">声音已复刻成功</Text>
                    </View>
                    <View className="clone-upload" onClick={(e) => { e.stopPropagation(); handleRecordVoice(); }}>
                      <Upload size={14} color="#8B5CF6" />
                      <Text className="clone-upload-text">重新上传声音</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* 其他音色选项 */}
              <View className="voice-grid">
                {VOICE_OPTIONS.map((voice, index) => (
                  <View
                    key={index}
                    className={`voice-card ${formData.voice === voice.label ? 'selected' : ''}`}
                    onClick={() => { updateFormData('voice', voice.label); updateFormData('voiceUrl', ''); }}
                  >
                    <View className="voice-icon-bg" style={{ background: voice.color }}>
                      <Mic size={20} color="#fff" />
                    </View>
                    <Text className="voice-grid-label">{voice.label}</Text>
                    <View className={`voice-check-circle small ${formData.voice === voice.label ? 'active' : ''}`}>
                      {formData.voice === voice.label && <View className="check-inner" />}
                    </View>
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
              <Text className="section-title">能力配置</Text>
              <View className="ability-list">
                {ABILITY_OPTIONS.map((ability, index) => (
                  <View key={index} className="ability-card">
                    <View className="ability-icon-bg" style={{ background: ability.color }}>
                      <Text className="ability-emoji">{ability.icon}</Text>
                    </View>
                    <View className="ability-info">
                      <Text className="ability-label">{ability.label}</Text>
                      <Text className="ability-desc">{ability.desc}</Text>
                    </View>
                    <View 
                      className={`toggle-switch ${formData.abilities[ability.key as keyof typeof formData.abilities] ? 'active' : ''}`}
                      onClick={() => toggleAbility(ability.key)}
                    >
                      <View className="toggle-handle" />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* 创建预览 */}
            <View className="preview-card">
              <Text className="preview-title">创建预览</Text>
              <View className="preview-row">
                <Text className="preview-label">分身名称</Text>
                <Text className="preview-value">{formData.name || '未设置'}</Text>
              </View>
              <View className="preview-row">
                <Text className="preview-label">人设标签</Text>
                <Text className="preview-value">{formData.tags.length > 0 ? formData.tags.join('、') : '未选择'}</Text>
              </View>
              <View className="preview-row">
                <Text className="preview-label">声音音色</Text>
                <Text className="preview-value">{formData.voice || '未选择'}</Text>
              </View>
              <View className="preview-row">
                <Text className="preview-label">开启能力</Text>
                <Text className="preview-value">
                  {[formData.abilities.autoOrder && '自动接单', formData.abilities.autoContent && '内容创作', formData.abilities.autoPublish && '自动发布'].filter(Boolean).join('、') || '无'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

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
