import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef, useCallback } from 'react'
import * as Network from '@/network'
import { ArrowLeft, Upload, RefreshCw, Download, Eye } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
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
  const [failedRecords, setFailedRecords] = useState<PalmRecord[]>([])
  const [previewImage, setPreviewImage] = useState<string>('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const pollingStartRef = useRef<number>(0) // 记录轮询开始时间，用于超时检测

  // 每次进入页面加载历史，并检查是否有外部传入的图片
  useDidShow(() => {
    // 优先从 storage 读取外部传入的手掌图片（来自分身对话页面）
    const externalImage = Taro.getStorageSync('__palm_image_url__')
    if (externalImage && !selectedImage) {
      console.log('[PalmReading] 接收外部图片:', externalImage)
      setSelectedImage(externalImage)
      // 清除 storage，避免下次进入时残留
      Taro.removeStorageSync('__palm_image_url__')
    }
    loadHistory(true)
  })

  // 页面离开时停止轮询
  Taro.useDidHide(() => {
    stopPolling()
  })

  // 加载历史记录
  const loadHistory = async (reset = false) => {
    const currentPage = reset ? 1 : page
    try {
      const res = await Network.request({
        url: '/api/palm-reading/history',
        data: { page: currentPage, limit: 10 },
      })
      const result = res?.data?.data
      const records: PalmRecord[] = result?.records || []
      const total: number = result?.total || 0

      // 分离成功记录和失败记录
      const completed = records.filter((r) => r.status === 'completed')
      const failed = records.filter((r) => r.status === 'failed')

      if (reset) {
        setHistory(completed)
        setFailedRecords(failed)
        setPage(1)
      } else {
        setHistory((prev) => [...prev, ...completed])
        setFailedRecords((prev) => [...prev, ...failed])
      }
      setHasMore(completed.length + failed.length < total)
      setLoadingMore(false)

      // 检查是否有进行中的任务，自动恢复轮询（取最新一个）
      const processing = records.filter((r) => r.status === 'pending' || r.status === 'processing')
      if (processing.length > 0 && !isProcessing) {
        const latestProcessing = processing.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]
        console.log('[PalmReading] 恢复轮询任务:', latestProcessing.id)
        setTaskStatus(latestProcessing.status)
        setTaskProgress(latestProcessing.progress || '继续生成中...')
        startPolling(latestProcessing.id)
      }
    } catch (e) {
      console.error('加载历史失败:', e)
      setLoadingMore(false)
    }
  }

  // 加载更多
  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    setPage((prev) => prev + 1)
    loadHistory(false)
  }

  // 清空全部历史
  const handleClearHistory = () => {
    Taro.showModal({
      title: '确认清空',
      content: '确定要清空所有解读记录吗？此操作不可恢复。',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            await Network.request({
              url: '/api/palm-reading',
              method: 'DELETE',
            })
            setHistory([])
            setFailedRecords([])
            setHasMore(false)
            Taro.showToast({ title: '已清空', icon: 'success' })
          } catch {
            Taro.showToast({ title: '清空失败', icon: 'error' })
          }
        }
      },
    })
  }

  // 删除单条记录
  const handleDeleteRecord = (id: string) => {
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            await Network.request({
              url: `/api/palm-reading/${id}`,
              method: 'DELETE',
            })
            setHistory((prev) => prev.filter((r) => r.id !== id))
            setFailedRecords((prev) => prev.filter((r) => r.id !== id))
            Taro.showToast({ title: '已删除', icon: 'success' })
          } catch {
            Taro.showToast({ title: '删除失败', icon: 'error' })
          }
        }
      },
    })
  }

  // 重试失败任务
  const handleRetry = (record: PalmRecord) => {
    setSelectedImage(record.palm_image_url)
    setTaskStatus('')
    setTaskProgress('')
    setErrorMessage('')
    // 删除旧的失败记录
    setFailedRecords((prev) => prev.filter((r) => r.id !== record.id))
    setHistory((prev) => prev.filter((r) => r.id !== record.id))
  }

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  const startPolling = (taskId: string) => {
    stopPolling()
    pollingStartRef.current = Date.now()
    pollingRef.current = setInterval(async () => {
      try {
        // 超时检测：超过10分钟自动标记失败
        const elapsed = (Date.now() - pollingStartRef.current) / 1000
        if (elapsed > 600) {
          stopPolling()
          setTaskStatus('failed')
          setErrorMessage('生成超时，请重试')
          Taro.showToast({ title: '生成超时', icon: 'error' })
          return
        }

        const res = await Network.request({ url: `/api/palm-reading/progress/${taskId}` })
        const data = res?.data?.data
        if (!data) return

        setTaskStatus(data.status)
        setTaskProgress(data.progress)

        if (data.status === 'completed') {
          stopPolling()
          setTaskStatus('')
          loadHistory(true)
          Taro.showToast({ title: '生成完成', icon: 'success' })
        } else if (data.status === 'failed') {
          stopPolling()
          // 立即设置 taskStatus='failed'，隐藏"进行中"卡片
          setTaskStatus('failed')
          setErrorMessage(data.error_message || '生成失败')
          Taro.showToast({ title: '生成失败', icon: 'error' })
        }
      } catch (e) {
        console.error('轮询失败:', e)
      }
    }, 3000)
  }

  const handleChooseImage = useCallback(() => {
    const isMiniApp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT
    if (isMiniApp) {
      Taro.chooseMessageFile({
        count: 1,
        type: 'image',
        success: async (res: { tempFiles: Array<{ path: string }> }) => {
          const tempFilePath = res.tempFiles[0].path
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
    } else {
      // H5 端：使用 Taro.chooseImage
      Taro.chooseImage({
        count: 1,
        sourceType: ['album', 'camera'],
        success: async (res: { tempFilePaths: string[] }) => {
          const tempFilePath = res.tempFilePaths[0]
          setErrorMessage('')

          Taro.showLoading({ title: '上传图片中...' })
          try {
            let imageUrl = tempFilePath
            console.log('[PalmReading] H5原始路径:', tempFilePath)
            if (!tempFilePath.startsWith('http://') && !tempFilePath.startsWith('https://')) {
              const uploadRes = await Network.uploadFile({
                url: '/api/upload/image',
                filePath: tempFilePath,
                name: 'file',
              })
              console.log('[PalmReading] H5上传原始结果:', JSON.stringify(uploadRes))
              let parsedData = (uploadRes as any)?.data
              if (typeof parsedData === 'string') {
                try { parsedData = JSON.parse(parsedData) } catch (e) { /* ignore */ }
              }
              imageUrl = parsedData?.data?.url || parsedData?.url || tempFilePath
              console.log('[PalmReading] H5解析后URL:', imageUrl)
            }
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
    }
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

  const hasAnyRecords = history.length > 0 || failedRecords.length > 0

  return (
    <View className="palm-reading-page">
      {/* 顶部导航 */}
      <View className="page-header">
        <View className="header-left" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={20} color="#ffffff" />
        </View>
        <Text className="header-title">掌相阅读</Text>
      </View>

      <View className="page-content">
        {/* 上传区域 */}
        <View className="upload-section">
          {selectedImage ? (
            <View className="selected-image-wrapper" onClick={handleChooseImage}>
              <Image className="selected-image" src={selectedImage} mode="aspectFill" />
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
        {/* 生成进度 / 失败状态（taskStatus 非空且未完成时显示） */}
        {taskStatus && taskStatus !== 'completed' && (
          <View className="section">
            {taskStatus === 'failed' ? (
              <View className="generating-failed-card">
                <View className="generating-header">
                  <Text className="generating-title error-title">生成失败</Text>
                </View>
                <Text className="generating-hint error">{errorMessage || '生成失败，请重试'}</Text>
                <View className="generating-actions">
                  <Button
                    size="sm"
                    className="btn-primary"
                    onClick={() => handleGenerate()}
                    disabled={!selectedImage}
                  >
                    <Text>重新生成</Text>
                  </Button>
                  <Button
                    size="sm"
                    className="btn-ghost"
                    onClick={() => {
                      setTaskStatus('')
                      setErrorMessage('')
                    }}
                  >
                    <Text>关闭</Text>
                  </Button>
                </View>
              </View>
            ) : (
              <View className="generating-card">
                <View className="generating-header">
                  <View className="loading-spinner" />
                  <Text className="generating-title">AI正在绘制掌相指南</Text>
                </View>
                <Text className="generating-hint">{taskProgress}</Text>
                <View className="generating-actions">
                  <Button
                    size="sm"
                    className="btn-ghost"
                    onClick={() => {
                      stopPolling()
                      setTaskStatus('')
                      setTaskProgress('')
                    }}
                  >
                    <Text>取消</Text>
                  </Button>
                </View>
              </View>
            )}
          </View>
        )}

        {/* 进行中记录（仅在有完成记录时展示，方便查看进度） */}
        {hasAnyRecords && (
          <View className="section">
            <Text className="section-title">进行中</Text>
            {history
              .filter((r) => r.status === 'pending' || r.status === 'processing')
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((record) => (
                <View className="record-card processing" key={record.id}>
                  <View className="record-images">
                    <View className="record-image-item">
                      <Image className="record-img" src={record.palm_image_url} mode="aspectFill" />
                      <Text className="record-img-label">原图</Text>
                    </View>
                    <View className="record-image-item processing-preview">
                      <View className="processing-placeholder">
                        <View className="loading-spinner small" />
                        <Text className="processing-text-sm">生成中...</Text>
                      </View>
                    </View>
                  </View>
                  <View className="record-actions">
                    <Text className="record-time">
                      {new Date(record.created_at).toLocaleString('zh-CN')}
                    </Text>
                  </View>
                </View>
              ))}
          </View>
        )}

        {/* 失败记录 */}
        {failedRecords.length > 0 && (
          <View className="section">
            <Text className="section-title">生成失败</Text>
            {failedRecords.map((record) => (
              <View className="record-card failed" key={record.id}>
                <View className="record-images">
                  <View className="record-image-item">
                    <Image className="record-img" src={record.palm_image_url} mode="aspectFill" />
                    <Text className="record-img-label">原图</Text>
                  </View>
                  <View className="record-image-item failed-preview">
                    <Text className="failed-icon">✗</Text>
                    <Text className="failed-text-sm">生成失败</Text>
                  </View>
                </View>
                <View className="record-actions">
                  <Text className="record-time">
                    {new Date(record.created_at).toLocaleString('zh-CN')}
                  </Text>
                  <View className="record-btns">
                    <View className="action-btn" onClick={() => handleRetry(record)}>
                      <RefreshCw size={14} color="#f97316" />
                      <Text className="action-text orange">重新生成</Text>
                    </View>
                    <View className="action-btn" onClick={() => handleDeleteRecord(record.id)}>
                      <Text className="action-text red">删除</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 解读记录 */}
        {history.length > 0 && (
          <View className="section">
            <View className="section-header">
              <Text className="section-title">解读记录</Text>
              <View className="clear-btn" onClick={handleClearHistory}>
                <Text className="clear-btn-text">清空</Text>
              </View>
            </View>
            {history.map((record) => (
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
                      <View className="action-btn" onClick={() => handleDeleteRecord(record.id)}>
                        <Text className="action-text red">删除</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            ))}
            {/* 加载更多 */}
            {hasMore && (
              <View className="load-more-btn" onClick={handleLoadMore}>
                <Text className="load-more-text">{loadingMore ? '加载中...' : '加载更多'}</Text>
              </View>
            )}
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
