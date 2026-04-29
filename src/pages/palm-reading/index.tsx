import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { chooseImage, showToast, showLoading, hideLoading } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Upload, Sparkles, Download } from 'lucide-react-taro'
import * as Network from '@/network'
import './index.css'

export default function PalmReadingPage() {
  const [palmImage, setPalmImage] = useState<string>('')
  const [generatedImage, setGeneratedImage] = useState<string>('')
  const [analysis, setAnalysis] = useState<string>('')
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
        setPalmImage(tempFilePath)
        setGeneratedImage('')
        setAnalysis('')
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
      showLoading({ title: 'AI分析中...', mask: true })

      console.log('[PalmReading] 开始生成掌相阅读指南')

      // 先上传图片到 TOS
      let uploadedImageUrl = palmImage
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

      if (res.data?.code === 200 && res.data?.data) {
        const data = res.data.data
        if (data.generatedImageUrl) {
          setGeneratedImage(data.generatedImageUrl)
        }
        if (data.analysis) {
          setAnalysis(data.analysis)
        }
        showToast({ title: '分析完成', icon: 'success' })
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
      const downloadRes = await Network.downloadFile({
        url: generatedImage
      })

      if (downloadRes.statusCode === 200 && downloadRes.tempFilePath) {
        await Taro.saveImageToPhotosAlbum({
          filePath: downloadRes.tempFilePath
        })
        showToast({ title: '保存成功', icon: 'success' })
      } else {
        showToast({ title: '保存失败', icon: 'none' })
      }
    } catch (error: any) {
      console.error('[PalmReading] 保存失败:', error)
      showToast({ title: '保存失败', icon: 'none' })
    } finally {
      hideLoading()
    }
  }

  // 将分析文本按段落分割渲染
  const renderAnalysis = () => {
    if (!analysis) return null

    const sections = analysis.split(/(?=【)/).filter(Boolean)

    return sections.map((section, index) => {
      const titleMatch = section.match(/【(.+?)】/)
      const title = titleMatch ? titleMatch[1] : ''
      const content = titleMatch ? section.replace(/【.+?】\n?/, '') : section

      if (!content.trim()) return null

      return (
        <View key={index} className="analysis-section">
          {title && <Text className="analysis-section-title">{title}</Text>}
          {content.trim().split('\n').map((line, i) => {
            const trimmedLine = line.trim()
            if (!trimmedLine) return null
            // 检测是否是子标题（如 "- 事业运"）
            const isSubTitle = /^[-•]/.test(trimmedLine)
            return (
              <Text key={i} className={`analysis-line ${isSubTitle ? 'sub-title' : ''}`}>
                {trimmedLine}
              </Text>
            )
          })}
        </View>
      )
    })
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
            上传您的手掌照片，AI 将识别掌纹并生成专业的掌相解读，包括性格分析、运势解读和生活建议。
          </Text>
        </View>

        {/* 上传区域 */}
        <View className="upload-section">
          <Text className="section-title">上传手掌照片</Text>
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

        {/* 生成按钮 */}
        {palmImage && (
          <View className="generate-section">
            <Button
              className="generate-btn"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              <Sparkles size={20} color="#fff" />
              <Text>{isGenerating ? 'AI 分析中...' : '开始掌相分析'}</Text>
            </Button>
          </View>
        )}

        {/* 结果展示：掌相分析文字 */}
        {analysis && (
          <View className="result-section">
            <Text className="section-title">掌相解读</Text>

            {/* 原始手掌图 + 生成图并排 */}
            <View className="image-compare">
              <View className="compare-item">
                <Image
                  className="compare-image"
                  src={palmImage}
                  mode="aspectFill"
                  onClick={() => handlePreviewImage(palmImage)}
                />
                <Text className="compare-label">原始手掌</Text>
              </View>
              {generatedImage && (
                <View className="compare-item">
                  <Image
                    className="compare-image"
                    src={generatedImage}
                    mode="aspectFill"
                    onClick={() => handlePreviewImage(generatedImage)}
                  />
                  <Text className="compare-label">掌相分析图</Text>
                </View>
              )}
            </View>

            {/* 文字分析 */}
            <View className="analysis-card">
              {renderAnalysis()}
            </View>

            {/* 保存按钮 */}
            {generatedImage && (
              <View className="result-actions">
                <Button
                  className="save-btn"
                  size="sm"
                  onClick={handleSaveImage}
                >
                  <Download size={18} color="#fff" />
                  <Text>保存分析图</Text>
                </Button>
              </View>
            )}
          </View>
        )}

        {/* 底部说明 */}
        <View className="tips-section">
          <Text className="tips-title">使用提示</Text>
          <Text className="tips-item">• 请确保手掌照片清晰，掌纹可见</Text>
          <Text className="tips-item">• 避免强光直射，保持光线均匀</Text>
          <Text className="tips-item">• 建议使用自然光拍摄</Text>
          <Text className="tips-item">• 分析过程约需30秒，请耐心等待</Text>
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
