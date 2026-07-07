import { useMemo, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { ScrollView, Text, View, Image, Input as TaroInput, Video } from '@tarojs/components'
import { ArrowLeft, Camera } from 'lucide-react-taro'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

type StepItem = {
  id: string
  group: string
  label: string
  type: string
  description?: string
  data?: {
    url?: string
    image?: string
    video?: string
    copyData?: string
    exampleImage?: string
    exampleText?: string
    exampleUrl?: string
    materials?: { type: 'text' | 'image' | 'video'; content: string }[]
    distributeMode?: 'shared' | 'exclusive'
    useAiMaterial?: boolean
    aiPrompt?: string
  }
  extConfig?: Record<string, string>
}

const getStepsStorageKey = (orderId: string) => `order_steps_${orderId || 'draft'}`

export default function OrderStepPreview() {
  const router = useRouter()
  const statusBarHeight = getStatusBarHeight()
  const orderId = String(router.params?.orderId || '')
  const storageKey = useMemo(() => getStepsStorageKey(orderId), [orderId])

  const [steps] = useState<StepItem[]>(() => {
    const stored = Taro.getStorageSync(storageKey)
    return Array.isArray(stored) ? stored : []
  })

  const [uploadedImages, setUploadedImages] = useState<Record<string, string>>({})
  const [inputTexts, setInputTexts] = useState<Record<string, string>>({})
  const [inputUrls, setInputUrls] = useState<Record<string, string>>({})

  const handleUploadImage = async (stepId: string) => {
    try {
      const res = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      if (!res.tempFilePaths.length) return

      Taro.showLoading({ title: '上传中...', mask: true })
      const result = await Network.uploadFile({ url: '/api/upload/image', filePath: res.tempFilePaths[0], name: 'file' })
      Taro.hideLoading()

      let uploadData: any = result?.data
      if (typeof uploadData === 'string') {
        try {
          uploadData = JSON.parse(uploadData)
        } catch {
          uploadData = null
        }
      }

      if (uploadData?.code === 200 && uploadData?.data?.url) {
        setUploadedImages(prev => ({ ...prev, [stepId]: uploadData.data.url }))
        Taro.showToast({ title: '上传成功', icon: 'success' })
      } else {
        Taro.showToast({ title: '上传失败', icon: 'none' })
      }
    } catch (e) {
      Taro.hideLoading()
      console.error('[图片上传] 错误:', e)
      Taro.showToast({ title: '上传失败', icon: 'none' })
    }
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
    const hasPermission = await requestAlbumPermission()
    if (!hasPermission) {
      Taro.showModal({
        title: '提示',
        content: '需要相册权限才能保存图片，请前往设置开启',
        showCancel: true,
        success: (res) => {
          if (res.confirm) {
            Taro.openSetting()
          }
        }
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
          }
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
    const hasPermission = await requestAlbumPermission()
    if (!hasPermission) {
      Taro.showModal({
        title: '提示',
        content: '需要相册权限才能保存视频，请前往设置开启',
        showCancel: true,
        success: (res) => {
          if (res.confirm) {
            Taro.openSetting()
          }
        }
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
          }
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

  const copyText = (text: string) => {
    if (!text) return
    Taro.setClipboardData({
      data: text,
      success: () => Taro.showToast({ title: '已复制', icon: 'success' }),
    })
  }

  return (
    <View className="preview-page">
      <View className="preview-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="preview-header-decoration">
          <View className="preview-deco-circle preview-circle-1" />
          <View className="preview-deco-circle preview-circle-2" />
        </View>
        <View className="preview-header-content">
          <View className="preview-back" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="preview-header-center">
            <Text className="preview-header-title">发布任务</Text>
            <Text className="preview-header-desc">AI分身帮你创作，省时省力出爆款</Text>
          </View>
        </View>
      </View>

      <ScrollView scrollY className="preview-content">
        <View className="preview-section">
          <Text className="preview-section-title">任务步骤预览</Text>
          <View className="preview-step-list">
            {steps.map((step, index) => (
              <View key={step.id} className="preview-step-card">
                <View className="preview-step-header">
                  <View className="preview-step-index">
                    <Text className="preview-step-index-text">{index + 1}</Text>
                  </View>
                  <View className="preview-step-info">
                    <Text className="preview-step-name">步骤一：{step.label}</Text>
                    {step.description && (
                      <Text className="preview-step-desc">{step.description}</Text>
                    )}
                  </View>
                </View>

                <View className="preview-step-content">
                  {step.data?.url && (
                    <View className="preview-url-box">
                      <Text className="preview-url-text">{step.data.url}</Text>
                      <View className="preview-url-actions">
                        {step.extConfig?.open_button_text && (
                          <View className="preview-url-btn preview-url-btn-open" onClick={() => Taro.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(step.data!.url!)}` })}>
                            <Text className="preview-url-btn-text">{step.extConfig.open_button_text}</Text>
                          </View>
                        )}
                        {step.extConfig?.copy_button_text && (
                          <View className="preview-url-btn preview-url-btn-copy" onClick={() => copyText(step.data!.url!)}>
                            <Text className="preview-url-btn-text">{step.extConfig.copy_button_text}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {step.data?.image && (
                    <Image src={step.data.image} className="preview-image" mode="widthFix" />
                  )}
                  {step.data?.image && step.type === 'upload_qrcode' && (
                    <>
                      <View />
                      {step.extConfig?.save_button_image && (
                        <View className="preview-save-btn" onClick={() => handleSaveImage(step.data!.image!)}>
                          <Text className="preview-save-btn-text">{step.extConfig.save_button_image}</Text>
                        </View>
                      )}
                      <View />
                    </>
                  )}

                  {step.data?.video && (
                    <Video src={step.data.video} className="preview-video" controls />
                  )}

                  {step.data?.copyData && (
                    <View className="preview-copy-box">
                      <View className="preview-copy-content">
                        <Text className="preview-copy-label">复制数据：</Text>
                        <Text className="preview-copy-text">{step.data.copyData}</Text>
                      </View>
                      {step.extConfig?.copy_button_text && (
                        <View className="preview-copy-btn" onClick={() => copyText(step.data!.copyData!)}>
                          <Text className="preview-copy-btn-text">{step.extConfig.copy_button_text}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {step.data?.exampleImage && (
                    <View className="preview-example-box preview-example-box-image">
                      <Text className="preview-example-label">示例截图：</Text>
                      <Image src={step.data.exampleImage} className="preview-example-image" mode="widthFix" />
                    </View>
                  )}
                  {step.type === 'collect_image' && !step.data?.exampleImage && (
                    <View />
                  )}
                  {step.type === 'collect_image' && (
                    <View className="preview-collect-box">
                      <View className="preview-collect-label">上传截图</View>
                      <View className="preview-image-upload" onClick={() => handleUploadImage(step.id)}>
                        {uploadedImages[step.id] ? (
                          <Image src={uploadedImages[step.id]} className="preview-uploaded-image" mode="widthFix" />
                        ) : (
                          <View className="preview-upload-placeholder">
                            <Camera size={48} color="#1677ff" />
                            <Text className="preview-upload-text">{step.extConfig?.upload_button_image || '上传图片'}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {step.data?.exampleText && (
                    <View className="preview-example-box">
                      <Text className="preview-example-label">示例：{step.data.exampleText}</Text>
                    </View>
                  )}

                  {step.data?.exampleUrl && (
                    <View className="preview-example-box">
                      <Text className="preview-example-label">示例链接：{step.data.exampleUrl}</Text>
                    </View>
                  )}

                  {step.data?.useAiMaterial ? (
                    <View className="preview-ai-material-hint">
                      <Text className="preview-ai-material-text">
                        {step.data.aiPrompt ? `AI将根据"${step.data.aiPrompt}"生成文案内容` : 'AI将根据素材说明自动生成文案内容'}
                      </Text>
                    </View>
                  ) : step.data?.materials && step.data.materials.length > 0 ? (
                    <View className="preview-material-box">
                      {step.data.materials![0].type === 'text' && (
                        <>
                          <Text className="preview-material-text">{step.data.materials![0].content}</Text>
                          {step.extConfig?.copy_button_text && (
                            <View className="preview-material-action">
                              <View className="preview-material-btn preview-material-btn-copy" onClick={() => copyText(step.data!.materials![0].content)}>
                                <Text className="preview-material-btn-text">{step.extConfig.copy_button_text}</Text>
                              </View>
                            </View>
                          )}
                        </>
                      )}
                      {step.data.materials![0].type === 'image' && (
                        <>
                          <Image src={step.data.materials![0].content} className="preview-image" mode="widthFix" />
                          {step.extConfig?.save_button_image && (
                            <View className="preview-material-action">
                              <View className="preview-material-btn preview-material-btn-save" onClick={() => handleSaveImage(step.data!.materials![0].content)}>
                                <Text className="preview-material-btn-text">{step.extConfig.save_button_image}</Text>
                              </View>
                            </View>
                          )}
                        </>
                      )}
                      {step.data.materials![0].type === 'video' && (
                        <>
                          <Video src={step.data.materials![0].content} className="preview-video" controls />
                          {step.extConfig?.save_button_video && (
                            <View className="preview-material-action">
                              <View className="preview-material-btn preview-material-btn-save" onClick={() => handleSaveVideo(step.data!.materials![0].content)}>
                                <Text className="preview-material-btn-text">{step.extConfig.save_button_video}</Text>
                              </View>
                            </View>
                          )}
                        </>
                      )}
                      {step.data.materials!.length > 1 && (
                        <Text className="preview-material-more">+{step.data.materials!.length - 1}个素材</Text>
                      )}
                    </View>
                  ) : null}
                </View>

                {step.type === 'collect_info' && (
                  <View className="preview-collect-box">
                    <TaroInput
                      className="preview-collect-input"
                      placeholder="请提供商家要求的收集信息"
                      value={inputTexts[step.id] || ''}
                      onInput={(e) => setInputTexts(prev => ({ ...prev, [step.id]: e.detail.value }))}
                    />
                  </View>
                )}

                {step.type === 'collect_url' && (
                  <View className="preview-collect-box">
                    <TaroInput
                      className="preview-collect-input"
                      placeholder="请提供商家要求的收集链接"
                      value={inputUrls[step.id] || ''}
                      onInput={(e) => setInputUrls(prev => ({ ...prev, [step.id]: e.detail.value }))}
                    />
                    {step.extConfig?.upload_button_image && (
                      <View className="preview-copy-btn" onClick={() => copyText(inputUrls[step.id] || '')}>
                        <Text className="preview-copy-btn-text">{step.extConfig.upload_button_image}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* <View className="preview-bottom-bar">
        <Button className="preview-submit-btn" onClick={handleSubmit}>
          <Text className="preview-submit-text">提交任务</Text>
        </Button>
      </View> */}
    </View>
  )
}
