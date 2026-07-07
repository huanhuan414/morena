import { useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Image, ScrollView, Text, Video, View } from '@tarojs/components'
import { ArrowLeft, Camera, ExternalLink } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

type MaterialItem = {
  type: 'text' | 'image' | 'video'
  content: string
}

type AssignedMaterialGroup = {
  mode?: 'shared' | 'exclusive'
  sourceMode?: string
  items?: MaterialItem[]
  prompt?: string
}

type TaskStep = {
  id: string
  stepType?: string
  step_type?: string
  stepTitle?: string
  step_title?: string
  stepDesc?: string
  step_desc?: string
  mainContent?: string
  main_content?: string
  mediaList?: any[]
  media_list?: any[]
  extConfig?: Record<string, string>
  ext_config?: Record<string, string>
  isMaterial?: boolean
  materialType?: 'text' | 'image' | 'video'
  assignedMaterial?: AssignedMaterialGroup
}

const getStepType = (step: TaskStep) => step.stepType || step.step_type || ''
const getStepTitle = (step: TaskStep) => step.stepTitle || step.step_title || ''
const getStepDesc = (step: TaskStep) => step.stepDesc || step.step_desc || ''
const getMainContent = (step: TaskStep) => step.mainContent || step.main_content || ''
const getMediaList = (step: TaskStep) => step.mediaList || step.media_list || []
const getExtConfig = (step: TaskStep) => step.extConfig || step.ext_config || {}

export default function OrderAcceptTask() {
  const router = useRouter()
  const statusBarHeight = getStatusBarHeight()
  const requestId = String(router.params?.requestId || router.params?.id || '')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [steps, setSteps] = useState<TaskStep[]>([])
  const [stepResults, setStepResults] = useState<Record<string, any>>({})

  const fetchTaskView = async () => {
    if (!requestId) return
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/order-processing/${requestId}/task-view`,
      })
      const data = res.data?.data
      if (res.data?.code === 200 && data) {
        setSteps(Array.isArray(data.steps) ? data.steps : [])
        setStepResults(data.stepResults || {})
      } else {
        Taro.showToast({ title: res.data?.message || '获取任务失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[接单任务] 获取失败:', error)
      Taro.showToast({ title: '获取任务失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTaskView()
  }, [requestId])

  const saveStepResult = async (step: TaskStep, valueType: string, value: any) => {
    const stepId = step.id
    const next = {
      ...(stepResults || {}),
      [stepId]: {
        stepId,
        stepType: getStepType(step),
        valueType,
        value,
      },
    }
    setStepResults(next)
    try {
      const res = await Network.request({
        url: `/api/order-processing/${requestId}/step-results`,
        method: 'PUT',
        data: {
          stepId,
          stepType: getStepType(step),
          valueType,
          value,
        },
      })
      if (res.data?.code !== 200) {
        Taro.showToast({ title: res.data?.message || '保存失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[接单任务] 保存失败:', error)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  const handleUploadImage = async (step: TaskStep) => {
    try {
      const selected = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      if (!selected.tempFilePaths.length) return
      Taro.showLoading({ title: '上传中...', mask: true })
      const result = await Network.uploadFile({
        url: '/api/upload/image',
        filePath: selected.tempFilePaths[0],
        name: 'file',
      })
      Taro.hideLoading()

      let uploadData: any = result?.data
      if (typeof uploadData === 'string') {
        try { uploadData = JSON.parse(uploadData) } catch { uploadData = null }
      }
      const url = uploadData?.data?.url
      if (uploadData?.code === 200 && url) {
        await saveStepResult(step, 'image', [url])
        Taro.showToast({ title: '上传成功', icon: 'success' })
      } else {
        Taro.showToast({ title: '上传失败', icon: 'none' })
      }
    } catch (error) {
      Taro.hideLoading()
      console.error('[接单任务] 图片上传失败:', error)
      Taro.showToast({ title: '上传失败', icon: 'none' })
    }
  }

  const copyText = (text: string) => {
    if (!text) return
    Taro.setClipboardData({ data: text, success: () => Taro.showToast({ title: '已复制', icon: 'success' }) })
  }

  const openUrl = (url: string) => {
    if (!url) return
    Taro.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}` })
  }

  const requestAlbumPermission = async () => {
    try {
      const res = await Taro.authorize({ scope: 'scope.writePhotosAlbum' })
      return res?.errMsg === 'authorize:ok'
    } catch {
      return false
    }
  }

  const handleSaveImage = async (imageUrl: string) => {
    if (!imageUrl) return
    const hasPermission = await requestAlbumPermission()
    if (!hasPermission) {
      Taro.showModal({
        title: '提示',
        content: '需要相册权限才能保存图片，请前往设置开启',
        showCancel: true,
        success: (res) => {
          if (res.confirm) Taro.openSetting()
        },
      })
      return
    }

    Taro.showLoading({ title: '保存中...', mask: true })
    try {
      const res: any = await Network.downloadFile({ url: imageUrl })
      if (res.statusCode === 200) {
        Taro.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            Taro.hideLoading()
            Taro.showToast({ title: '已保存到相册', icon: 'success' })
          },
          fail: () => {
            Taro.hideLoading()
            Taro.showToast({ title: '保存失败', icon: 'none' })
          },
        })
      } else {
        Taro.hideLoading()
        Taro.showToast({ title: '下载图片失败', icon: 'none' })
      }
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '下载图片失败', icon: 'none' })
    }
  }

  const handleSaveVideo = async (videoUrl: string) => {
    if (!videoUrl) return
    const hasPermission = await requestAlbumPermission()
    if (!hasPermission) {
      Taro.showModal({
        title: '提示',
        content: '需要相册权限才能保存视频，请前往设置开启',
        showCancel: true,
        success: (res) => {
          if (res.confirm) Taro.openSetting()
        },
      })
      return
    }

    Taro.showLoading({ title: '保存中...', mask: true })
    try {
      const res: any = await Network.downloadFile({ url: videoUrl })
      if (res.statusCode === 200) {
        Taro.saveVideoToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            Taro.hideLoading()
            Taro.showToast({ title: '已保存到相册', icon: 'success' })
          },
          fail: () => {
            Taro.hideLoading()
            Taro.showToast({ title: '保存失败', icon: 'none' })
          },
        })
      } else {
        Taro.hideLoading()
        Taro.showToast({ title: '下载视频失败', icon: 'none' })
      }
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '下载视频失败', icon: 'none' })
    }
  }

  const handlePublishTask = async () => {
    if (!requestId || submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: '发布中...', mask: true })
    try {
      const res = await Network.request({
        url: `/api/order-processing/${requestId}/task-submit`,
        method: 'POST',
        data: { stepResults },
      })
      Taro.hideLoading()
      if (res.data?.code === 200) {
        Taro.showToast({ title: '发布成功', icon: 'success' })
        setTimeout(() => {
          Taro.redirectTo({ url: '/package-avatar/pages/generated-content/index' })
        }, 600)
      } else {
        Taro.showToast({ title: res.data?.message || '发布失败', icon: 'none' })
      }
    } catch (error) {
      Taro.hideLoading()
      console.error('[接单任务] 发布失败:', error)
      Taro.showToast({ title: '发布失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const renderMaterialContent = (step: TaskStep, extConfig: Record<string, string>) => {
    const materialGroup = step.assignedMaterial || {}
    const items = materialGroup.items || []
    const hasPrompt = !!materialGroup.prompt && items.length === 0

    if (items.length === 0 && !hasPrompt) return null

    if (hasPrompt) {
      return (
        <View className="accept-ai-box">
          <Text className="accept-ai-text">{materialGroup.prompt}</Text>
        </View>
      )
    }

    return (
      <View className="accept-material-grid">
        {items.map((item, index) => (
          <View key={`${step.id}-${index}`} className="accept-material-item">
            {item.type === 'text' && (
              <>
                <Text className="accept-material-text">{item.content}</Text>
                {extConfig.copy_button_text && (
                  <Button variant="outline" className="accept-mini-btn" onClick={() => copyText(item.content)}>
                    <Text className="accept-mini-btn-text">{extConfig.copy_button_text}</Text>
                  </Button>
                )}
              </>
            )}
            {item.type === 'image' && (
              <>
                <Image src={item.content} className="accept-material-image" mode="aspectFill" />
                {extConfig.save_button_image && (
                  <Button className="accept-mini-btn accept-material-action" onClick={() => handleSaveImage(item.content)}>
                    <Text className="accept-action-btn-text">{extConfig.save_button_image}</Text>
                  </Button>
                )}
              </>
            )}
            {item.type === 'video' && (
              <>
                <Video src={item.content} className="accept-material-video" controls />
                {extConfig.save_button_video && (
                  <Button className="accept-mini-btn accept-material-action" onClick={() => handleSaveVideo(item.content)}>
                    <Text className="accept-action-btn-text">{extConfig.save_button_video}</Text>
                  </Button>
                )}
              </>
            )}
          </View>
        ))}
      </View>
    )
  }

  const renderStepContent = (step: TaskStep) => {
    const stepType = getStepType(step)
    const mainContent = getMainContent(step)
    const mediaList = getMediaList(step)
    const extConfig = getExtConfig(step)
    const result = stepResults[step.id] || {}
    const sampleImage = mediaList.find((item: any) => item.type === 'sample_image' || item.type === 'image' || item.type === 'qrcode')?.url
    const video = mediaList.find((item: any) => item.type === 'video')?.url

    return (
      <>
        {step.isMaterial && renderMaterialContent(step, extConfig)}
        {mainContent && ['input_url', 'collect_url'].includes(stepType) && (
          <View className="accept-url-box">
            <Text className="accept-url-text">{mainContent}</Text>
            <View className="accept-action-row">
              {extConfig.open_button_text && (
                <Button className="accept-action-btn" onClick={() => openUrl(mainContent)}>
                  <ExternalLink size={14} color="#fff" />
                  <Text className="accept-action-btn-text">{extConfig.open_button_text}</Text>
                </Button>
              )}
              {extConfig.copy_button_text && (
                <Button variant="outline" className="accept-action-btn" onClick={() => copyText(mainContent)}>
                  <Text className="accept-action-btn-secondary">{extConfig.copy_button_text}</Text>
                </Button>
              )}
            </View>
          </View>
        )}
        {mainContent && stepType === 'copy_data' && (
          <View className="accept-copy-box">
            <Text className="accept-copy-text">{mainContent}</Text>
            {extConfig.copy_button_text && (
              <Button className="accept-action-btn" onClick={() => copyText(mainContent)}>
                <Text className="accept-action-btn-text">{extConfig.copy_button_text}</Text>
              </Button>
            )}
          </View>
        )}
        {sampleImage && <Image src={sampleImage} className="accept-image" mode="widthFix" />}
        {sampleImage && extConfig.save_button_image && (
          <Button className="accept-action-btn" onClick={() => handleSaveImage(sampleImage)}>
            <Text className="accept-action-btn-text">{extConfig.save_button_image}</Text>
          </Button>
        )}
        {video && <Video src={video} className="accept-video" controls />}
        {video && extConfig.save_button_video && (
          <Button className="accept-action-btn" onClick={() => handleSaveVideo(video)}>
            <Text className="accept-action-btn-text">{extConfig.save_button_video}</Text>
          </Button>
        )}
        {stepType === 'collect_image' && (
          <View className="accept-collect-box">
            <View className="accept-upload" onClick={() => handleUploadImage(step)}>
              {Array.isArray(result.value) && result.value[0] ? (
                <Image src={result.value[0]} className="accept-uploaded-image" mode="widthFix" />
              ) : (
                extConfig.upload_button_image && (
                  <View className="accept-upload-placeholder">
                    <Camera size={40} color="#1677ff" />
                    <Text className="accept-upload-text">{extConfig.upload_button_image}</Text>
                  </View>
                )
              )}
            </View>
          </View>
        )}
        {stepType === 'collect_info' && (
          <Input
            className="accept-input"
            placeholder="请输入需要提交的信息"
            value={result.value || ''}
            onInput={(event) => saveStepResult(step, 'text', event.detail.value)}
          />
        )}
        {stepType === 'collect_url' && (
          <Input
            className="accept-input"
            placeholder="请输入提交链接"
            value={result.value || ''}
            onInput={(event) => saveStepResult(step, 'url', event.detail.value)}
          />
        )}
      </>
    )
  }

  return (
    <View className="accept-page">
      <View className="accept-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="accept-header-content">
          <View className="accept-back" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <Text className="accept-header-title">发布任务引导</Text>
          <Text className="accept-header-desc">按步骤完成任务并提交验收信息</Text>
        </View>
      </View>

      <ScrollView scrollY className="accept-content">
        {loading ? (
          <View className="accept-empty"><Text className="accept-empty-text">加载中...</Text></View>
        ) : (
          <View className="accept-section">
            {/* <Text className="accept-section-title">发布步骤</Text> */}
            <View className="accept-step-list">
              {steps.map((step, index) => (
                <View key={step.id} className="accept-step-card">
                  <View className="accept-step-header">
                    <View className="accept-step-index">
                      <Text className="accept-step-index-text">{index + 1}</Text>
                    </View>
                    <View className="accept-step-info">
                      <Text className="accept-step-name">{getStepTitle(step)}</Text>
                      {getStepDesc(step) && <Text className="accept-step-desc">{getStepDesc(step)}</Text>}
                    </View>
                  </View>
                  <View className="accept-step-content">
                    {renderStepContent(step)}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
      <View
        className="accept-bottom-bar"
        style={{ position: 'fixed', display: 'flex' }}
      >
        <Button className="accept-submit-btn" onClick={handlePublishTask} disabled={loading || submitting}>
          <Text className="accept-submit-text">{submitting ? '发布中...' : '发布'}</Text>
        </Button>
      </View>
    </View>
  )
}
