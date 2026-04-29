import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { chooseImage, showToast, showLoading, hideLoading } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Upload, Sparkles, Download, Share2 } from 'lucide-react-taro'
import * as Network from '@/network'
import './index.css'

export default function PalmReadingPage() {
  const [palmImage, setPalmImage] = useState<string>('')
  const [generatedImage, setGeneratedImage] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewImageVisible, setPreviewImageVisible] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState('')

  // 上传手掌图片
  const handleChooseImage = () => {
    chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0]
        console.log('[PalmReading] 选择图片成功:', tempFilePath)

        // 先展示图片
        setPalmImage(tempFilePath)
        setGeneratedImage('')
      },
      fail: (err) => {
        console.error('[PalmReading] 选择图片失败:', err)
        showToast({ title: '选择图片失败', icon: 'none' })
      }
    })
  }

  // 生成掌相阅读指南
  const handleGenerate = async () => {
    if (!palmImage) {
      showToast({ title: '请先上传手掌图片', icon: 'none' })
      return
    }

    try {
      setIsGenerating(true)
      showLoading({ title: '生成中...', mask: true })

      console.log('[PalmReading] 开始生成掌相阅读指南')

      // 先上传图片到 TOS，确保第三方API能访问
      let uploadedImageUrl = palmImage

      // 只有已经是完整 http(s) URL 的才不需要上传
      const isAlreadyUploaded = palmImage.startsWith('http://') || palmImage.startsWith('https://')
      if (!isAlreadyUploaded) {
        console.log('[PalmReading] 上传图片到 TOS...', palmImage)
        const uploadRes = await Network.uploadFile({
          url: '/api/upload/image',
          filePath: palmImage,
          name: 'file'
        })

        console.log('[PalmReading] 上传结果:', uploadRes)

        if (uploadRes.statusCode === 200 && uploadRes.data) {
          const uploadData = typeof uploadRes.data === 'string' ? JSON.parse(uploadRes.data) : uploadRes.data
          if (uploadData.code === 200 && uploadData.data?.url) {
            uploadedImageUrl = uploadData.data.url
            console.log('[PalmReading] 图片上传成功:', uploadedImageUrl)
          }
        }
      }

      // 调用掌相阅读生成接口
      const res = await Network.request({
        url: '/api/palm-reading/generate',
        method: 'POST',
        data: {
          imageUrl: uploadedImageUrl
        }
      })

      console.log('[PalmReading] 生成结果:', res.data)

      if (res.data?.code === 200 && res.data?.data?.generatedImageUrl) {
        setGeneratedImage(res.data.data.generatedImageUrl)
        showToast({ title: '生成成功', icon: 'success' })
      } else {
        showToast({ title: res.data?.message || '生成失败', icon: 'none' })
      }
    } catch (error: any) {
      console.error('[PalmReading] 生成失败:', error)
      showToast({ title: `生成失败: ${error.message || '未知错误'}`, icon: 'none' })
    } finally {
      setIsGenerating(false)
      hideLoading()
    }
  }

  // 预览图片
  const handlePreviewImage = (url: string) => {
    setPreviewImageUrl(url)
    setPreviewImageVisible(true)
  }

  // 保存图片
  const handleSaveImage = async () => {
    if (!generatedImage) return

    try {
      showLoading({ title: '保存中...', mask: true })

      // 下载图片
      const downloadRes = await Network.downloadFile({
        url: generatedImage
      })

      console.log('[PalmReading] 下载结果:', downloadRes)

      if (downloadRes.statusCode === 200 && downloadRes.tempFilePath) {
        // 保存到相册
        const saveRes = await Taro.saveImageToPhotosAlbum({
          filePath: downloadRes.tempFilePath
        })

        console.log('[PalmReading] 保存结果:', saveRes)

        showToast({ title: '保存成功', icon: 'success' })
      } else {
        showToast({ title: '保存失败', icon: 'none' })
      }
    } catch (error: any) {
      console.error('[PalmReading] 保存失败:', error)
      showToast({ title: `保存失败: ${error.message || '未知错误'}`, icon: 'none' })
    } finally {
      hideLoading()
    }
  }

  // 分享图片
  const handleShareImage = () => {
    if (!generatedImage) return

    showToast({ title: '请使用系统分享功能', icon: 'none' })
  }

  return (
    <View className="palm-reading-container">
      {/* 头部 */}
      <View className="header">
        <View className="back-button" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={24} color="#1f2937" />
        </View>
        <Text className="header-title">掌象阅读</Text>
        <View className="header-spacer" />
      </View>

      <ScrollView className="content" scrollY>
        {/* 说明 */}
        <View className="info-card">
          <View className="info-header">
            <Sparkles size={20} color="#8b5cf6" />
            <Text className="info-title">AI 智能掌相分析</Text>
          </View>
          <Text className="info-text">
            上传您的手掌照片，AI 将为您生成专业的掌相阅读指南。系统会智能分析掌纹，提供详细的性格解读和人生指引。
          </Text>
        </View>

        {/* 上传区域 */}
        <View className="upload-section">
          <Text className="section-title">1. 上传手掌照片</Text>
          <Text className="section-desc">请确保手掌清晰可见，光线充足</Text>

          {palmImage ? (
            <View className="image-preview-wrapper">
              <Image
                className="preview-image"
                src={palmImage}
                mode="aspectFill"
                onClick={() => handlePreviewImage(palmImage)}
              />
              <Button
                className="change-image-btn"
                size="sm"
                onClick={handleChooseImage}
              >
                <Upload size={16} color="#fff" />
                <Text>更换图片</Text>
              </Button>
            </View>
          ) : (
            <View className="upload-placeholder" onClick={handleChooseImage}>
              <Upload size={48} color="#9ca3af" />
              <Text className="upload-text">点击上传手掌照片</Text>
              <Text className="upload-tip">支持拍照或从相册选择</Text>
            </View>
          )}
        </View>

        {/* 生成区域 */}
        {palmImage && (
          <View className="generate-section">
            <Text className="section-title">2. 生成掌相指南</Text>
            <Text className="section-desc">AI 将根据您的手掌照片生成专属指南</Text>

            <Button
              className="generate-btn"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              <Sparkles size={20} color="#fff" />
              <Text>{isGenerating ? '生成中...' : '开始生成'}</Text>
            </Button>
          </View>
        )}

        {/* 结果展示 */}
        {generatedImage && (
          <View className="result-section">
            <Text className="section-title">3. 掌相阅读指南</Text>
            <Text className="section-desc">您的专属掌相分析结果</Text>

            <View className="result-image-wrapper">
              <Image
                className="result-image"
                src={generatedImage}
                mode="widthFix"
                onClick={() => handlePreviewImage(generatedImage)}
              />
            </View>

            <View className="result-actions">
              <Button
                className="action-btn"
                size="sm"
                onClick={handleSaveImage}
              >
                <Download size={18} color="#1890ff" />
                <Text>保存图片</Text>
              </Button>
              <Button
                className="action-btn"
                size="sm"
                onClick={handleShareImage}
              >
                <Share2 size={18} color="#1890ff" />
                <Text>分享</Text>
              </Button>
            </View>
          </View>
        )}

        {/* 底部说明 */}
        <View className="tips-section">
          <Text className="tips-title">使用提示</Text>
          <Text className="tips-item">• 请确保手掌照片清晰，掌纹可见</Text>
          <Text className="tips-item">• 避免强光直射，保持光线均匀</Text>
          <Text className="tips-item">• 建议使用自然光拍摄</Text>
          <Text className="tips-item">• 生成过程可能需要几秒钟，请耐心等待</Text>
        </View>
      </ScrollView>

      {/* 图片预览 */}
      {previewImageVisible && (
        <View className="preview-overlay" onClick={() => setPreviewImageVisible(false)}>
          <Image
            className="preview-full-image"
            src={previewImageUrl}
            mode="aspectFit"
          />
          <View className="preview-close">
            <Text>点击关闭</Text>
          </View>
        </View>
      )}
    </View>
  )
}
