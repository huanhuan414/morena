import { useMemo, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { ScrollView, Text, View, Image, Input as TaroInput, Video } from '@tarojs/components'
import { ArrowLeft, Camera } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

type StepItem = {
  id: string
  group: string
  label: string
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
  }
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

  const handleSubmit = () => {
    const results: Record<string, any> = {}
    steps.forEach(step => {
      if (step.label === '收集截图') {
        results[step.id] = { type: 'image', value: uploadedImages[step.id] }
      } else if (step.label === '收集信息') {
        results[step.id] = { type: 'text', value: inputTexts[step.id] }
      } else if (step.label === '收集链接') {
        results[step.id] = { type: 'url', value: inputUrls[step.id] }
      }
    })
    console.log('提交结果:', results)
    Taro.showToast({ title: '提交成功', icon: 'success' })
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
                    </View>
                  )}

                  {step.data?.image && (
                    <Image src={step.data.image} className="preview-image" mode="widthFix" />
                  )}

                  {step.data?.video && (
                    <Video src={step.data.video} className="preview-video" controls />
                  )}

                  {step.data?.copyData && (
                    <View className="preview-copy-box">
                      <Text className="preview-copy-label">复制数据：</Text>
                      <Text className="preview-copy-text">{step.data.copyData}</Text>
                    </View>
                  )}

                  {step.data?.exampleImage && (
                    <View className="preview-example-box preview-example-box-image">
                      <Text className="preview-example-label">示例截图：</Text>
                      <Image src={step.data.exampleImage} className="preview-example-image" mode="widthFix" />
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
                      <Text className="preview-ai-material-text">AI将根据素材说明自动生成文案内容</Text>
                    </View>
                  ) : step.data?.materials && step.data.materials.length > 0 ? (
                    <View className="preview-material-box">
                      {step.data.materials[0].type === 'text' && (
                        <Text className="preview-material-text">{step.data.materials[0].content}</Text>
                      )}
                      {step.data.materials[0].type === 'image' && (
                        <Image src={step.data.materials[0].content} className="preview-image" mode="widthFix" />
                      )}
                      {step.data.materials[0].type === 'video' && (
                        <Video src={step.data.materials[0].content} className="preview-video" controls />
                      )}
                      {step.data.materials.length > 1 && (
                        <Text className="preview-material-more">+{step.data.materials.length - 1}个素材</Text>
                      )}
                    </View>
                  ) : null}
                </View>

                {step.label === '收集截图' && (
                  <View className="preview-collect-box">
                    <View className="preview-collect-label">上传截图</View>
                    <View className="preview-image-upload" onClick={() => handleUploadImage(step.id)}>
                      {uploadedImages[step.id] ? (
                        <Image src={uploadedImages[step.id]} className="preview-uploaded-image" mode="widthFix" />
                      ) : (
                        <View className="preview-upload-placeholder">
                          <Camera size={48} color="#1677ff" />
                          <Text className="preview-upload-text">上传图片</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {step.label === '收集信息' && (
                  <View className="preview-collect-box">
                    <View className="preview-collect-label">填写信息</View>
                    <View className="preview-input-wrap">
                      <TaroInput
                        className="preview-collect-input"
                        placeholder="请输入信息"
                        value={inputTexts[step.id] || ''}
                        onInput={(e) => setInputTexts(prev => ({ ...prev, [step.id]: e.detail.value }))}
                      />
                    </View>
                  </View>
                )}

                {step.label === '收集链接' && (
                  <View className="preview-collect-box">
                    <View className="preview-collect-label">填写链接</View>
                    <View className="preview-input-wrap">
                      <TaroInput
                        className="preview-collect-input"
                        placeholder="请输入链接地址"
                        value={inputUrls[step.id] || ''}
                        onInput={(e) => setInputUrls(prev => ({ ...prev, [step.id]: e.detail.value }))}
                      />
                    </View>
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