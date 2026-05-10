import { useState, useEffect } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import {
  ArrowLeft,
  Camera,
  Check,
  Mic,
  MicOff,
  Sparkles,
  Headphones,
} from 'lucide-react-taro'
import './index.css'

// 预设音色列表
const PRESET_VOICES = [
  { id: 'warm_male', name: '温暖男声', emoji: '🎙️' },
  { id: 'gentle_female', name: '温柔女声', emoji: '🎧' },
  { id: 'youth_male', name: '活力男声', emoji: '🎵' },
  { id: 'youth_female', name: '甜美女声', emoji: '🎶' },
  { id: 'mature_female', name: '知性女声', emoji: '🎸' },
  { id: '磁性男声', name: '磁性男声', emoji: '🎤' },
]

// 人设标签
const PERSONA_TAGS = [
  '知识渊博', '幽默风趣', '温柔体贴', '严谨认真',
  '活泼开朗', '成熟稳重', '善解人意', '逻辑清晰'
]

// 能力列表
const ABILITIES = [
  { key: 'chat', label: '智能对话', desc: '实时对话交流', emoji: '💬', defaultEnabled: true },
  { key: 'reading', label: '掌相阅读', desc: '解读手相面相', emoji: '🔮', defaultEnabled: true },
  { key: 'analysis', label: '数据分析', desc: '深度分析洞察', emoji: '📊', defaultEnabled: false },
]

// 步骤标签
const STEP_LABELS = ['上传照片', '基础设置', '能力选择']

export default function AvatarCreate() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    photo: '',
    photoUrl: '', // 上传到后端的URL
    name: '',
    tags: [] as string[],
    voice: '', // 'clone' | 'preset'
    voiceUrl: '', // 复刻音频URL
    presetVoiceId: '', // 预设音色ID
    abilities: {
      chat: true,
      reading: true,
      analysis: false,
    } as Record<string, boolean>,
  })

  // 录音状态
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [recorderManager, setRecorderManager] = useState<any>(null)

  // 提交状态
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 检测小程序环境（组件级别，供所有函数使用）
  const isMiniApp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT

  // 初始化录音管理器
  useEffect(() => {
    // 仅在小程序环境初始化
    if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT) {
      const manager = Taro.getRecorderManager()
      
      manager.onStart(() => {
        setIsRecording(true)
        setRecordingTime(0)
      })

      manager.onStop((res) => {
        setIsRecording(false)
        if (res.duration > 0) {
          // 上传录音文件
          uploadVoiceFile(res.tempFilePath)
        }
      })

      manager.onError((err) => {
        console.error('录音错误:', err)
        setIsRecording(false)
        Taro.showToast({ title: '录音失败', icon: 'none' })
      })

      setRecorderManager(manager)
    }

    return () => {
      if (recorderManager) {
        recorderManager.stop()
      }
    }
  }, [])

  // 录音计时器
  useEffect(() => {
    let timer: any = null
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) {
            // 最长60秒
            recorderManager?.stop()
            return prev
          }
          return prev + 1
        })
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [isRecording, recorderManager])

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

  // 图片上传来源选择（支持拍照、相册、微信聊天记录）
  const handleUploadPhoto = () => {
    if (!isMiniApp) {
      // H5端只支持相册
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

    // 小程序端显示选择菜单
    Taro.showActionSheet({
      itemList: ['拍照', '从相册选择', '从微信聊天记录选择'],
      success: async (res: any) => {
        const tapIndex = res.tapIndex
        
        if (tapIndex === 0) {
          // 拍照
          Taro.chooseImage({
            count: 1,
            sourceType: ['camera'],
            success: async (imageRes: any) => {
              const tempFilePath = imageRes.tempFilePaths[0]
              updateFormData('photo', tempFilePath)
              await uploadPhotoToServer(tempFilePath)
            }
          })
        } else if (tapIndex === 1) {
          // 从相册选择
          Taro.chooseImage({
            count: 1,
            sourceType: ['album'],
            success: async (imageRes: any) => {
              const tempFilePath = imageRes.tempFilePaths[0]
              updateFormData('photo', tempFilePath)
              await uploadPhotoToServer(tempFilePath)
            }
          })
        } else if (tapIndex === 2) {
          // 从微信聊天记录选择（仅微信小程序支持）
          if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
            Taro.chooseMessageFile({
              count: 1,
              type: 'image',
              success: async (msgRes: any) => {
                const tempFilePath = msgRes.tempFilePaths[0]
                updateFormData('photo', tempFilePath)
                await uploadPhotoToServer(tempFilePath)
              },
              fail: () => {
                Taro.showToast({ title: '请从相册选择', icon: 'none' })
              }
            })
          } else {
            // 抖音小程序不支持，从相册选择
            Taro.chooseImage({
              count: 1,
              sourceType: ['album'],
              success: async (imageRes: any) => {
                const tempFilePath = imageRes.tempFilePaths[0]
                updateFormData('photo', tempFilePath)
                await uploadPhotoToServer(tempFilePath)
              }
            })
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
      
      console.log('照片上传响应:', uploadRes)
      
      if (uploadRes.data) {
        const resData = typeof uploadRes.data === 'string' 
          ? JSON.parse(uploadRes.data) 
          : uploadRes.data
        
        if (resData.code === 200 && resData.data?.url) {
          updateFormData('photoUrl', resData.data.url)
          Taro.showToast({ title: '照片上传成功', icon: 'success' })
        } else {
          const fileUrl = resData.data?.fileUrl || resData.url || resData.file_path
          if (fileUrl) {
            updateFormData('photoUrl', fileUrl)
            Taro.showToast({ title: '照片上传成功', icon: 'success' })
          } else {
            console.warn('上传响应格式异常:', resData)
            Taro.showToast({ title: '照片已选择', icon: 'success' })
          }
        }
      }
    } catch (err) {
      console.error('上传失败:', err)
      Taro.showToast({ title: '上传失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  // 录音开始/停止
  const handleToggleRecord = () => {
    // H5 环境不支持录音
    if (!isMiniApp) {
      Taro.showToast({ title: '录音功能仅在小程序中可用', icon: 'none' })
      return
    }

    if (isRecording) {
      recorderManager?.stop()
    } else {
      // 检查权限
      Taro.getSetting({
        success: (res) => {
          if (res.authSetting['scope.record']) {
            startRecording()
          } else {
            Taro.authorize({
              scope: 'scope.record',
              success: () => startRecording(),
              fail: () => {
                Taro.showToast({ title: '请授权录音权限', icon: 'none' })
              }
            })
          }
        }
      })
    }
  }

  // 开始录音
  const startRecording = () => {
    recorderManager?.start({
      duration: 60000, // 最长60秒
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3',
    })
  }

  // 上传录音文件并触发声音复刻
  const uploadVoiceFile = async (tempFilePath: string) => {
    Taro.showLoading({ title: '上传中...' })
    
    try {
      // 先上传录音文件到服务器
      const uploadRes = await Network.uploadFile({
        url: '/api/upload',
        filePath: tempFilePath,
        name: 'file',
      })
      
      console.log('录音上传响应:', uploadRes)
      
      let voiceUrl = ''
      
      if (uploadRes.data) {
        const resData = typeof uploadRes.data === 'string' 
          ? JSON.parse(uploadRes.data) 
          : uploadRes.data
        
        if (resData.code === 200 && resData.data?.url) {
          voiceUrl = resData.data.url
        } else {
          voiceUrl = resData.data?.fileUrl || resData.url || resData.file_path || ''
        }
      }
      
      // 如果上传成功，调用后端声音复刻接口
      if (voiceUrl) {
        console.log('开始声音复刻，音频URL:', voiceUrl)
        
        try {
          const cloneRes = await Network.request({
            url: '/api/voice-clone/start',
            method: 'POST',
            data: {
              audio_url: voiceUrl,
              user_id: 'anonymous' // 可以从全局状态获取实际user_id
            }
          })
          
          console.log('声音复刻响应:', cloneRes)
          
          if (cloneRes.data?.code === 200 && cloneRes.data?.data) {
            // 保存复刻声音ID
            updateFormData('voiceUrl', voiceUrl)
            updateFormData('presetVoiceId', cloneRes.data.data.voice_id)
            Taro.showToast({ title: '声音录制成功，复刻训练开始', icon: 'success' })
          } else {
            // 即使复刻接口失败，也保存录音URL
            updateFormData('voiceUrl', voiceUrl)
            Taro.showToast({ title: '声音录制成功', icon: 'success' })
          }
        } catch (cloneErr) {
          console.error('声音复刻接口调用失败:', cloneErr)
          // 复刻接口失败不影响录音保存
          updateFormData('voiceUrl', voiceUrl)
          Taro.showToast({ title: '声音录制成功', icon: 'success' })
        }
      } else {
        console.warn('录音上传响应格式异常:', uploadRes.data)
        Taro.showToast({ title: '声音已录制', icon: 'success' })
      }
    } catch (err) {
      console.error('录音上传失败:', err)
      Taro.showToast({ title: '声音上传失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
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
      [key]: !formData.abilities[key]
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

    setIsSubmitting(true)
    Taro.showLoading({ title: '创建中...' })

    try {
      // 构建提交数据
      const submitData = {
        name: formData.name,
        photo: formData.photoUrl || formData.photo, // 使用上传后的URL或本地路径
        tags: formData.tags,
        voice_type: formData.voice,
        voice_url: formData.voiceUrl || undefined,
        preset_voice_id: formData.presetVoiceId || undefined,
        abilities: formData.abilities,
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
        Taro.showToast({ title: '创建成功', icon: 'success' })
        setTimeout(() => {
          Taro.navigateBack()
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

  // 渲染步骤1 - 上传照片
  const renderStep1 = () => (
    <View className="step-content">
      <View className="upload-card">
        {formData.photo ? (
          <View className="photo-preview" onClick={handleUploadPhoto}>
            <Image 
              className="preview-img" 
              src={formData.photo} 
              mode="aspectFill"
            />
            <Text className="preview-text">点击更换照片</Text>
          </View>
        ) : (
          <View className="upload-area" onClick={handleUploadPhoto}>
            <View className="upload-placeholder">
              <View className="upload-icon-bg">
                <Camera size={48} color="#8B5CF6" />
              </View>
              <Text className="upload-title">上传照片</Text>
              <Text className="upload-hint">点击上传分身照片</Text>
            </View>
          </View>
        )}
      </View>

      <View className="tips-card">
        <Text className="tips-title">照片要求</Text>
        <Text className="tips-item">1. 请上传清晰正面照片</Text>
        <Text className="tips-item">2. 建议使用证件照或自拍</Text>
        <Text className="tips-item">3. 避免遮挡面部</Text>
        <Text className="tips-item">4. 支持 JPG、PNG 格式</Text>
      </View>
    </View>
  )

  // 渲染步骤2 - 基础设置
  const renderStep2 = () => (
    <View className="step-content">
      {/* 分身名称 */}
      <View className="form-section">
        <Text className="section-title">
          分身昵称
          <Text className="title-hint">（必填）</Text>
        </Text>
        <View className="input-box">
          <Input
            className="name-input"
            placeholder="给分身起个名字"
            placeholderClass="placeholder"
            value={formData.name}
            onInput={(e) => updateFormData('name', e.detail.value)}
            maxlength={20}
          />
        </View>
      </View>

      {/* 人设标签 */}
      <View className="form-section">
        <Text className="section-title">
          人设标签
          <Text className="title-hint">（选填，最多3个）</Text>
        </Text>
        <View className="tags-grid">
          {PERSONA_TAGS.map(tag => (
            <View
              key={tag}
              className={`persona-tag ${formData.tags.includes(tag) ? 'selected' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              <Text className={`tag-text ${formData.tags.includes(tag) ? 'selected' : ''}`}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* 音色选择 */}
      <View className="form-section">
        <Text className="section-title">
          声音选择
          <Text className="title-hint">（必选）</Text>
        </Text>

        {/* 原声复刻 */}
        <View 
          className={`clone-card ${formData.voice === 'clone' ? 'selected' : ''}`}
          onClick={() => updateFormData('voice', 'clone')}
        >
          <View className="voice-card-header">
            <View className="voice-icon-bg clone">
              <Mic size={32} color="#fff" />
            </View>
            <View className="voice-card-info">
              <Text className="voice-card-title">原声复刻</Text>
              <Text className="voice-card-desc">用您的声音训练专属音色</Text>
            </View>
            <View className={`voice-check-circle ${formData.voice === 'clone' ? 'active' : ''}`}>
              {formData.voice === 'clone' && <View className="check-inner" />}
            </View>
          </View>

          {formData.voice === 'clone' && (
            <View className="clone-area">
              {!isMiniApp ? (
                <View className="clone-status">
                  <Mic size={18} color="#9CA3AF" />
                  <Text className="clone-text" style={{ color: '#9CA3AF' }}>
                    请在微信/抖音小程序中录制声音
                  </Text>
                </View>
              ) : formData.voiceUrl ? (
                <View className="recording-status">
                  <Headphones size={20} color="#8B5CF6" />
                  <Text className="clone-text">声音已录制</Text>
                </View>
              ) : isRecording ? (
                <View className="recording-status">
                  <View className="recording-dot" />
                  <Text className="recording-time">{recordingTime}s</Text>
                </View>
              ) : (
                <View className="clone-status">
                  <Sparkles size={18} color="#8B5CF6" />
                  <Text className="clone-text">录制30秒音频</Text>
                </View>
              )}

              <View 
                className="clone-upload"
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleRecord()
                }}
              >
                {isRecording ? (
                  <>
                    <MicOff size={18} color="#EF4444" />
                    <Text className="clone-upload-text" style={{ color: '#EF4444' }}>停止</Text>
                  </>
                ) : formData.voiceUrl ? (
                  <>
                    <Mic size={18} color="#8B5CF6" />
                    <Text className="clone-upload-text">重新录制</Text>
                  </>
                ) : (
                  <>
                    <Mic size={18} color="#8B5CF6" />
                    <Text className="clone-upload-text">开始录制</Text>
                  </>
                )}
              </View>
            </View>
          )}
        </View>

        {/* 预设音色 */}
        <View 
          className={`clone-card ${formData.voice === 'preset' ? 'selected' : ''}`}
          onClick={() => updateFormData('voice', 'preset')}
        >
          <View className="voice-card-header">
            <View className="voice-icon-bg clone">
              <Sparkles size={32} color="#fff" />
            </View>
            <View className="voice-card-info">
              <Text className="voice-card-title">预设音色</Text>
              <Text className="voice-card-desc">选择系统提供的音色</Text>
            </View>
            <View className={`voice-check-circle ${formData.voice === 'preset' ? 'active' : ''}`}>
              {formData.voice === 'preset' && <View className="check-inner" />}
            </View>
          </View>
        </View>

        {/* 预设音色网格 */}
        {formData.voice === 'preset' && (
          <View className="voice-grid">
            {PRESET_VOICES.map(voice => (
              <View
                key={voice.id}
                className={`voice-card ${formData.presetVoiceId === voice.id ? 'selected' : ''}`}
                onClick={() => {
                  updateFormData('presetVoiceId', voice.id)
                }}
              >
                <View className={`voice-check-circle small ${formData.presetVoiceId === voice.id ? 'active' : ''}`}>
                  {formData.presetVoiceId === voice.id && <View className="check-inner" />}
                </View>
                <Text style={{ fontSize: '48rpx' }}>{voice.emoji}</Text>
                <Text className="voice-grid-label">{voice.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )

  // 渲染步骤3 - 能力选择
  const renderStep3 = () => (
    <View className="step-content">
      {/* 预览卡片 */}
      <View className="preview-card">
        <Text className="preview-title">创建预览</Text>
        <View className="preview-row">
          <Text className="preview-label">分身名称</Text>
          <Text className="preview-value">{formData.name || '-'}</Text>
        </View>
        <View className="preview-row">
          <Text className="preview-label">人设标签</Text>
          <Text className="preview-value">
            {formData.tags.length > 0 ? formData.tags.join('、') : '未设置'}
          </Text>
        </View>
        <View className="preview-row">
          <Text className="preview-label">音色类型</Text>
          <Text className="preview-value">
            {formData.voice === 'clone' ? '原声复刻' : formData.voice === 'preset' ? '预设音色' : '-'}
          </Text>
        </View>
      </View>

      {/* 能力列表 */}
      <View className="form-section">
        <Text className="section-title">分身能力</Text>
        <View className="ability-list">
          {ABILITIES.map(ability => (
            <View key={ability.key} className="ability-card">
              <View className="ability-icon-bg">
                <Text className="ability-emoji">{ability.emoji}</Text>
              </View>
              <View className="ability-info">
                <Text className="ability-label">{ability.label}</Text>
                <Text className="ability-desc">{ability.desc}</Text>
              </View>
              <View
                className={`toggle-switch ${formData.abilities[ability.key] ? 'active' : ''}`}
                onClick={() => toggleAbility(ability.key)}
              >
                <View className="toggle-handle" />
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className="tips-card">
        <Text className="tips-title">温馨提示</Text>
        <Text className="tips-item">分身创建后可在设置中修改配置</Text>
        <Text className="tips-item">声音复刻预计需要 5-10 分钟</Text>
        <Text className="tips-item">能力将根据分身类型自动开启</Text>
      </View>
    </View>
  )

  return (
    <View className="create-page">
      {/* 顶部渐变背景 */}
      <View className="page-header">
        <View className="header-decoration">
          <View className="deco-circle circle-1" />
          <View className="deco-circle circle-2" />
        </View>
        
        <View className="header-content">
          <View className="back-btn" onClick={handleBack}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <Text className="header-title">创建分身</Text>
          <View className="header-right" />
        </View>

        {/* 步骤指示器 */}
        <View className="step-indicator">
          {STEP_LABELS.map((label, index) => (
            <View key={label} style={{ display: 'flex', alignItems: 'center' }}>
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
      <View className="page-content">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </View>

      {/* 底部按钮 */}
      <View className="bottom-action">
        <View 
          className="main-btn"
          onClick={handleNext}
        >
          <Text className="btn-text">
            {currentStep < 3 ? '下一步' : isSubmitting ? '创建中...' : '创建分身'}
          </Text>
        </View>
      </View>
    </View>
  )
}
