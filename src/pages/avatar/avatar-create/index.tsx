// @ts-nocheck
import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import { ChevronLeft, Upload, Video, Camera, Zap, User, Palette } from 'lucide-react-taro'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import './index.css'

// 顶部导航
const TopNav = ({ title, onBack }) => {
  return (
    <View className="top-nav">
      <View className="nav-left" onClick={onBack}>
        <ChevronLeft size={28} color="#333" />
      </View>
      <Text className="nav-title">{title}</Text>
      <View className="nav-right"></View>
    </View>
  )
}

// 步骤流程条
const StepIndicator = ({ currentStep }) => {
  const steps = [
    { label: '形象克隆' },
    { label: '人设定制' },
    { label: '能力开通' }
  ]

  return (
    <View className="step-indicator">
      {steps.map((step, index) => (
        <View key={index} className={`step-item ${currentStep >= index + 1 ? 'active' : ''}`}>
          <View className={`step-node ${currentStep >= index + 1 ? 'filled' : 'outline'}`}>
            {currentStep > index + 1 ? (
              <Text className="step-check">✓</Text>
            ) : (
              <Text className="step-num">{index + 1}</Text>
            )}
          </View>
          <Text className={`step-label ${currentStep >= index + 1 ? 'active' : ''}`}>{step.label}</Text>
        </View>
      ))}
    </View>
  )
}

// 步骤1：形象克隆
const StepOne = ({ onUpload, onVideo, onCamera, onSmartClone }) => {
  return (
    <View className="step-content">
      <View className="upload-options">
        <View className="upload-btn" onClick={onUpload}>
          <Upload size={24} color="#7B3FE4" />
          <Text className="upload-label">上传照片</Text>
        </View>
        <View className="upload-btn" onClick={onVideo}>
          <Video size={24} color="#7B3FE4" />
          <Text className="upload-label">上传视频</Text>
        </View>
        <View className="upload-btn" onClick={onCamera}>
          <Camera size={24} color="#7B3FE4" />
          <Text className="upload-label">实时拍摄</Text>
        </View>
      </View>

      <View className="smart-clone-btn" onClick={onSmartClone}>
        <Zap size={24} color="#FFF" />
        <Text className="smart-clone-text">一键智能克隆</Text>
      </View>

      <Text className="clone-hint">10秒生成真人仿真分身，表情、神态、音色复刻</Text>
    </View>
  )
}

// 步骤2：人设定制
const StepTwo = ({ formData, onChange }) => {
  const tags = ['网红', '生活博主', '职场达人', '泛娱乐', '知识博主']
  const voices = ['原声复刻', '温柔女声', '磁性男声', '甜美萝莉', '成熟御姐']

  return (
    <View className="step-content">
      {/* 分身昵称 */}
      <View className="form-group">
        <Text className="form-label">分身昵称</Text>
        <View className="input-wrapper">
          <Input
            className="form-input"
            placeholder="输入分身昵称"
            placeholderClass="input-placeholder"
            value={formData.name}
            onInput={(e) => onChange('name', e.detail.value)}
          />
        </View>
      </View>

      {/* 人设标签 */}
      <View className="form-group">
        <Text className="form-label">人设标签</Text>
        <View className="tags-scroll">
          {tags.map((tag, index) => (
            <View
              key={index}
              className={`tag-item ${formData.tags.includes(tag) ? 'selected' : ''}`}
              onClick={() => {
                const newTags = formData.tags.includes(tag)
                  ? formData.tags.filter(t => t !== tag)
                  : [...formData.tags, tag]
                onChange('tags', newTags)
              }}
            >
              <Text className={`tag-text ${formData.tags.includes(tag) ? 'selected' : ''}`}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 音色选择 */}
      <View className="form-group">
        <Text className="form-label">音色选择</Text>
        <View className="voice-select">
          {voices.map((voice, index) => (
            <View
              key={index}
              className={`voice-item ${formData.voice === voice ? 'selected' : ''}`}
              onClick={() => onChange('voice', voice)}
            >
              <Text className={`voice-text ${formData.voice === voice ? 'selected' : ''}`}>{voice}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 形象微调 */}
      <View className="form-group">
        <Text className="form-label">形象微调</Text>
        <View className="template-btns">
          <View className="template-btn" onClick={() => onChange('makeup', !formData.makeup)}>
            <Palette size={20} color={formData.makeup ? '#FFF' : '#7B3FE4'} />
            <Text className={`template-text ${formData.makeup ? 'selected' : ''}`}>妆容模板</Text>
          </View>
          <View className="template-btn" onClick={() => onChange('outfit', !formData.outfit)}>
            <User size={20} color={formData.outfit ? '#FFF' : '#7B3FE4'} />
            <Text className={`template-text ${formData.outfit ? 'selected' : ''}`}>穿搭模板</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

// 步骤3：能力开通
const StepThree = ({ settings, onToggle }) => {
  const options = [
    { key: 'autoOrder', label: '自动接单', desc: '自动接收平台订单' },
    { key: 'autoContent', label: '自动生成内容', desc: 'AI自动创作内容' },
    { key: 'autoDistribute', label: '自动全平台分发', desc: '一键分发到各大平台' },
    { key: 'unlockAll', label: '解锁全部技能', desc: '开通所有高级技能' }
  ]

  return (
    <View className="step-content">
      <View className="settings-list">
        {options.map((option, index) => (
          <View key={index} className="setting-item">
            <View className="setting-info">
              <Text className="setting-label">{option.label}</Text>
              <Text className="setting-desc">{option.desc}</Text>
            </View>
            <View
              className={`toggle-switch ${settings[option.key] ? 'active' : ''}`}
              onClick={() => onToggle(option.key)}
            >
              <View className="toggle-dot"></View>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

// 主页面
export default function AvatarCreate() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    tags: [],
    voice: '原声复刻',
    makeup: false,
    outfit: false,
    settings: {
      autoOrder: false,
      autoContent: false,
      autoDistribute: false,
      unlockAll: false
    }
  })

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    } else {
      Taro.navigateBack()
    }
  }

  const updateFormData = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const toggleSetting = (key) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [key]: !prev.settings[key]
      }
    }))
  }

  const handleUpload = () => {
    Taro.chooseImage({
      count: 1,
      sourceType: ['album'],
      success: (res) => {
        console.log('选择照片成功', res.tempFilePaths)
        Taro.showToast({ title: '照片已选择', icon: 'success' })
      }
    })
  }

  const handleVideo = () => {
    Taro.chooseVideo({
      sourceType: ['album'],
      maxDuration: 60,
      success: (res) => {
        console.log('选择视频成功', res.tempFilePath)
        Taro.showToast({ title: '视频已选择', icon: 'success' })
      }
    })
  }

  const handleCamera = () => {
    Taro.chooseImage({
      sourceType: ['camera'],
      success: (res) => {
        console.log('拍摄成功', res.tempFilePaths)
        Taro.showToast({ title: '照片已拍摄', icon: 'success' })
      }
    })
  }

  const handleSmartClone = () => {
    // 模拟智能克隆
    Taro.showLoading({ title: '克隆中...' })
    setTimeout(() => {
      Taro.hideLoading()
      setCurrentStep(2)
    }, 1000)
  }

  const handleNext = async () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    } else {
      // 提交创建分身
      await submitCreate()
    }
  }

  const submitCreate = async () => {
    setIsLoading(true)
    Taro.showLoading({ title: '生成分身...' })
    try {
      const res = await Network.request({
        url: '/api/avatar',
        method: 'POST',
        header: {
          'x-user-id': 'user_demo'
        },
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
          Taro.navigateTo({ url: '/pages/avatar/avatar-manage/index' })
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
      <TopNav title="创建真人分身" onBack={handleBack} />

      {/* 步骤流程条 */}
      <StepIndicator currentStep={currentStep} />

      {/* 步骤内容 */}
      {currentStep === 1 && (
        <StepOne
          onUpload={handleUpload}
          onVideo={handleVideo}
          onCamera={handleCamera}
          onSmartClone={handleSmartClone}
        />
      )}

      {currentStep === 2 && (
        <StepTwo
          formData={formData}
          onChange={updateFormData}
        />
      )}

      {currentStep === 3 && (
        <StepThree
          settings={formData.settings}
          onToggle={toggleSetting}
        />
      )}

      {/* 底部按钮 */}
      <View className="bottom-action">
        <View
          className={`main-btn ${isLoading ? 'loading' : ''}`}
          onClick={!isLoading ? handleNext : undefined}
        >
          <Text className="btn-text">
            {currentStep === 3 ? '立即生成分身' : '下一步'}
          </Text>
        </View>
      </View>
    </View>
  )
}
