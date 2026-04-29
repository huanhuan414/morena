import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef, useCallback } from 'react'
import * as Network from '@/network'
import { ArrowLeft, Upload, RefreshCw, Download, Eye } from 'lucide-react-taro'
import './index.css'

interface PalmRecord {
  id: string
  palm_image_url: string
  generated_image_url: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: string
  error_message: string | null
  created_at: string
}

export default function PalmReading() {
  const [selectedImage, setSelectedImage] = useState<string>('')
  const [taskStatus, setTaskStatus] = useState<string>('')
  const [taskProgress, setTaskProgress] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [history, setHistory] = useState<PalmRecord[]>([])
  const [previewImage, setPreviewImage] = useState<string>('')
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // 每次进入页面加载历史，并检查是否有外部传入的图片
  useDidShow(() => {
    // 检查 URL 参数是否有外部传入的手掌图片
    const pages = Taro.getCurrentPages()
    const currentPage = pages[pages.length - 1]
    if (currentPage) {
      const { palmImageUrl } = (currentPage as any).options || {}
      if (palmImageUrl && !selectedImage) {
        const decodedUrl = decodeURIComponent(palmImageUrl)
        console.log('[PalmReading] 接收外部图片:', decodedUrl)
        setSelectedImage(decodedUrl)
      }
    }
    loadHistory()
  })

  // 页面离开时停止轮询
  Taro.useDidHide(() => {
    stopPolling()
  })

  const loadHistory = async () => {
    try {
      const res = await Network.request({ url: '/api/palm-reading/history' })
      const records = res?.data?.data || []
      setHistory(records)

      // 不再自动恢复旧任务的轮询
      // 只有当前会话创建的任务才会轮询
    } catch (e) {
      console.error('加载历史失败:', e)
    }
  }

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  const startPolling = (taskId: string) => {
    stopPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const res = await Network.request({ url: `/api/palm-reading/progress/${taskId}` })
        const data = res?.data?.data
        if (!data) return

        setTaskStatus(data.status)
        setTaskProgress(data.progress)

        if (data.status === 'completed') {
          stopPolling()
          loadHistory()
          Taro.showToast({ title: '生成完成', icon: 'success' })
        } else if (data.status === 'failed') {
          stopPolling()
          setErrorMessage(data.error_message || '生成失败')
          Taro.showToast({ title: '生成失败', icon: 'error' })
        }
      } catch (e) {
        console.error('轮询失败:', e)
      }
    }, 3000)
  }

  const handleChooseImage = useCallback(() => {
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0]
        setErrorMessage('')

        // 上传图片到TOS
        Taro.showLoading({ title: '上传图片中...' })
        try {
          let imageUrl = tempFilePath
          console.log('[PalmReading] 原始路径:', tempFilePath)
          if (!tempFilePath.startsWith('http://') && !tempFilePath.startsWith('https://')) {
            const uploadRes = await Network.uploadFile({
              url: '/api/upload/image',
              filePath: tempFilePath,
              name: 'file',
            })
            console.log('[PalmReading] 上传原始结果:', JSON.stringify(uploadRes))
            // Taro.uploadFile 返回 data 为 JSON 字符串，需要 parse
            let parsedData = (uploadRes as any)?.data
            if (typeof parsedData === 'string') {
              try { parsedData = JSON.parse(parsedData) } catch (e) { /* ignore */ }
            }
            imageUrl = parsedData?.data?.url || parsedData?.url || tempFilePath
            console.log('[PalmReading] 解析后URL:', imageUrl)
          }
          // 二次检查：如果imageUrl还不是http开头，说明上传失败
          if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
            Taro.hideLoading()
            Taro.showToast({ title: '图片上传失败，请重试', icon: 'error' })
            return
          }
          setSelectedImage(imageUrl)
          Taro.hideLoading()
        } catch (e) {
          Taro.hideLoading()
          Taro.showToast({ title: '上传失败', icon: 'error' })
        }
      },
    })
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!selectedImage) {
      Taro.showToast({ title: '请先上传手掌图片', icon: 'none' })
      return
    }

    try {
      const res = await Network.request({
        url: '/api/palm-reading/create',
        method: 'POST',
        data: { imageUrl: selectedImage },
      })

      const data = res?.data?.data
      if (!data?.id) {
        Taro.showToast({ title: '创建任务失败', icon: 'error' })
        return
      }

      setTaskStatus('pending')
      setTaskProgress('任务已创建')
      setErrorMessage('')
      startPolling(data.id)
    } catch (e) {
      Taro.showToast({ title: '请求失败', icon: 'error' })
    }
  }, [selectedImage])

  const handlePreview = useCallback((url: string) => {
    setPreviewImage(url)
  }, [])

  const handleClosePreview = useCallback(() => {
    setPreviewImage('')
  }, [])

  const handleSaveImage = useCallback((url: string) => {
    const env = Taro.getEnv()
    const isMiniApp = env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT

    if (isMiniApp) {
      // 小程序：下载文件后保存到相册
      Taro.showLoading({ title: '保存中...' })
      Network.downloadFile({
        url,
        success: (downloadRes: any) => {
          if (downloadRes.statusCode === 200) {
            Taro.saveImageToPhotosAlbum({
              filePath: downloadRes.tempFilePath,
              success: () => {
                Taro.hideLoading()
                Taro.showToast({ title: '已保存到相册', icon: 'success' })
              },
              fail: () => {
                Taro.hideLoading()
                Taro.showToast({ title: '保存失败，请授权相册权限', icon: 'none' })
              },
            })
          } else {
            Taro.hideLoading()
            Taro.showToast({ title: '下载失败', icon: 'error' })
          }
        },
        fail: () => {
          Taro.hideLoading()
          Taro.showToast({ title: '下载失败', icon: 'error' })
        },
      })
    } else {
      // H5：通过 a 标签下载
      try {
        const link = document.createElement('a')
        link.href = url
        link.download = `palm-reading-${Date.now()}.png`
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        Taro.showToast({ title: '已开始下载', icon: 'success' })
      } catch {
        // a 标签下载失败时，尝试新窗口打开
        window.open(url, '_blank')
        Taro.showToast({ title: '请在打开的页面中保存图片', icon: 'none' })
      }
    }
  }, [])

  const isProcessing = taskStatus === 'pending' || taskStatus === 'processing'

  const completedRecords = history.filter((r) => r.status === 'completed')

  return (
    <View className="palm-reading-page">
      {/* 顶部导航 */}
      <View className="page-header">
        <View className="header-left" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={20} color="#ffffff" />
        </View>
        <Text className="header-title">掌象阅读</Text>
      </View>

      <View className="page-content">
        {/* 上传区域 */}
        <View className="upload-section">
          {selectedImage ? (
            <View className="selected-image-wrapper" onClick={handleChooseImage}>
              <Image className="selected-image" src={selectedImage} mode="widthFix" />
              <View className="change-image-btn">
                <RefreshCw size={14} color="#fff" />
                <Text className="change-text">重新选择</Text>
              </View>
            </View>
          ) : (
            <View className="upload-area" onClick={handleChooseImage}>
              <Upload size={40} color="#8b5cf6" />
              <Text className="upload-title">上传手掌图片</Text>
              <Text className="upload-desc">请拍摄清晰的手掌正面照片</Text>
            </View>
          )}

          <View
            className={`generate-btn ${!selectedImage || isProcessing ? 'disabled' : ''}`}
            onClick={!selectedImage || isProcessing ? undefined : handleGenerate}
          >
            <Text className="generate-btn-text">
              {isProcessing ? taskProgress : '开始解读'}
            </Text>
          </View>
        </View>

        {/* 进度提示 */}
        {isProcessing && (
          <View className="progress-section">
            <View className="progress-loading">
              <View className="loading-spinner" />
              <Text className="progress-text">{taskProgress}</Text>
            </View>
            <Text className="progress-hint">AI 正在分析你的手掌并生成解读指南，通常需要1-5分钟</Text>
          </View>
        )}

        {/* 失败提示 */}
        {taskStatus === 'failed' && errorMessage && (
          <View className="error-section">
            <Text className="error-text">{errorMessage}</Text>
            <View className="retry-btn" onClick={handleGenerate}>
              <Text className="retry-text">重新生成</Text>
            </View>
          </View>
        )}


        {completedRecords.length > 0 && (
          <View className="section">
            <Text className="section-title">解读记录</Text>
            {completedRecords.map((record) => (
              <View className="record-card completed" key={record.id}>
                <View className="record-images">
                  <View className="record-image-item" onClick={() => handlePreview(record.palm_image_url)}>
                    <Image className="record-img" src={record.palm_image_url} mode="aspectFill" />
                    <Text className="record-img-label">原图</Text>
                  </View>
                  <View className="record-image-item" onClick={() => record.generated_image_url && handlePreview(record.generated_image_url)}>
                    <Image className="record-img" src={record.generated_image_url || ''} mode="aspectFill" />
                    <Text className="record-img-label">解读</Text>
                  </View>
                </View>
                <View className="record-actions">
                  <Text className="record-time">
                    {new Date(record.created_at).toLocaleString('zh-CN')}
                  </Text>
                  {record.generated_image_url && (
                    <View className="record-btns">
                      <View className="action-btn" onClick={() => handlePreview(record.generated_image_url!)}>
                        <Eye size={14} color="#8b5cf6" />
                        <Text className="action-text">查看</Text>
                      </View>
                      <View className="action-btn" onClick={() => handleSaveImage(record.generated_image_url!)}>
                        <Download size={14} color="#8b5cf6" />
                        <Text className="action-text">保存</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}


      </View>

      {/* 图片预览弹窗 */}
      {previewImage && (
        <View className="preview-overlay" onClick={handleClosePreview}>
          <Image className="preview-image" src={previewImage} mode="aspectFit" />
          <View className="preview-close" onClick={handleClosePreview}>
            <Text className="close-text">关闭</Text>
          </View>
          <View className="preview-save" onClick={() => handleSaveImage(previewImage)}>
            <Download size={16} color="#fff" />
            <Text className="save-text">保存</Text>
          </View>
        </View>
      )}
    </View>
  )
}
