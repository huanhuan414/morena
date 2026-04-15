import { useLoad, useRouter, navigateBack, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import { ArrowLeft, FileText, Image as ImageIcon, Video, Share2, Check, Sparkles, X, PenTool } from 'lucide-react-taro'
import './index.css'

// 平台名称映射
const PLATFORM_NAMES: Record<string, string> = {
  wechat_mp: '微信小程序',
  xiaohongshu: '小红书',
  douyin: '抖音',
  weibo: '微博',
  bilibili: 'B站',
  kuaishou: '快手'
}

export default function GeneratedContentPage() {
  const router = useRouter()
  const requestId = router.params.requestId
  const avatarId = router.params.avatarId

  const [contents, setContents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedContent, setSelectedContent] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')

  useLoad(() => {
    if (requestId && avatarId) {
      fetchGeneratedContent()
    } else {
      showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => navigateBack(), 1500)
    }
  })

  const fetchGeneratedContent = async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/content-generation/request/${requestId}/avatar/${avatarId}`
      })

      if (res.data?.code === 200) {
        setContents(res.data.data || [])
        if (res.data.data && res.data.data.length > 0) {
          setSelectedContent(res.data.data[0])
        }
      }
    } catch (error) {
      console.error('获取生成内容失败:', error)
      showToast({ title: '获取内容失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    if (selectedContent) {
      setEditedContent(selectedContent.content)
      setIsEditing(true)
    }
  }

  const handleSave = async () => {
    try {
      const res = await Network.request({
        url: `/api/order-dispatch/update-content`,
        method: 'POST',
        data: {
          contentId: selectedContent.id,
          content: editedContent
        }
      })

      if (res.data?.code === 200) {
        showToast({ title: '保存成功', icon: 'success' })
        setIsEditing(false)
        // 刷新内容
        fetchGeneratedContent()
      }
    } catch (error) {
      console.error('保存失败:', error)
      showToast({ title: '保存失败', icon: 'none' })
    }
  }

  const handleApprove = async () => {
    try {
      const res = await Network.request({
        url: `/api/content-generation/${selectedContent.id}/status`,
        method: 'POST',
        data: { status: 'approved' }
      })

      if (res.data?.code === 200) {
        showToast({ title: '已批准', icon: 'success' })
        fetchGeneratedContent()
      }
    } catch (error) {
      console.error('批准失败:', error)
      showToast({ title: '操作失败', icon: 'none' })
    }
  }

  if (loading) {
    return (
      <View className="generated-content-page">
        <View className="page-header">
          <View className="header-left" onClick={() => navigateBack()}>
            <ArrowLeft size={20} color="rgba(255,255,255,0.8)" />
          </View>
          <Text className="header-title">生成内容</Text>
          <View className="header-right" />
        </View>
        <View className="loading-container">
          <Sparkles size={32} color="#00f5ff" />
          <Text className="loading-text">AI正在为您生成内容...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="generated-content-page">
      {/* 头部 */}
      <View className="page-header">
        <View className="header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={20} color="rgba(255,255,255,0.8)" />
        </View>
        <Text className="header-title">生成内容</Text>
        <View className="header-right" />
      </View>

      {contents.length === 0 ? (
        <View className="empty-state">
          <X size={48} color="rgba(255,255,255,0.3)" />
          <Text className="empty-text">暂无生成内容</Text>
          <Text className="empty-desc">请先接受订单，系统将自动生成内容</Text>
        </View>
      ) : (
        <>
          {/* 平台标签 */}
          <View className="platform-tabs">
            {contents.map((content) => (
              <View
                key={content.id}
                className={`platform-tab ${selectedContent?.id === content.id ? 'active' : ''}`}
                onClick={() => setSelectedContent(content)}
              >
                <Text className="platform-tab-text">
                  {PLATFORM_NAMES[content.platform] || content.platform}
                </Text>
                {content.status === 'approved' && (
                  <Check size={12} color="#22c55e" />
                )}
              </View>
            ))}
          </View>

          <ScrollView className="content-scroll" scrollY>
            {/* 内容状态提示 */}
            {selectedContent && (
              <View className="content-status">
                <FileText size={16} color="#00f5ff" />
                <Text className="status-text">
                  {selectedContent.status === 'draft' && '草稿状态 - 可编辑'}
                  {selectedContent.status === 'approved' && '已批准'}
                  {selectedContent.status === 'published' && '已发布'}
                </Text>
              </View>
            )}

            {/* 内容卡片 */}
            {selectedContent && (
              <View className="content-card">
                {/* 标题 */}
                {selectedContent.title && (
                  <View className="content-title-section">
                    <Text className="content-title">{selectedContent.title}</Text>
                  </View>
                )}

                {/* 正文内容 */}
                <View className="content-body-section">
                  {isEditing ? (
                    <View className="edit-area">
                      <Text className="edit-label">编辑内容：</Text>
                      <Textarea
                        className="content-textarea"
                        value={editedContent}
                        onInput={(e) => setEditedContent(e.detail.value)}
                        maxlength={2000}
                      />
                      <View className="edit-actions">
                        <Button
                          className="edit-btn cancel"
                          onClick={() => setIsEditing(false)}
                        >
                          取消
                        </Button>
                        <Button
                          className="edit-btn save"
                          onClick={handleSave}
                        >
                          保存
                        </Button>
                      </View>
                    </View>
                  ) : (
                    <>
                      <Text className="content-body">
                        {selectedContent.content}
                      </Text>
                      {selectedContent.status === 'draft' && (
                        <Button
                          className="edit-trigger"
                          onClick={handleEdit}
                        >
                          <PenTool size={16} color="#00f5ff" />
                          <Text className="edit-trigger-text">编辑内容</Text>
                        </Button>
                      )}
                    </>
                  )}
                </View>

                {/* 标签 */}
                {selectedContent.hashtags && selectedContent.hashtags.length > 0 && (
                  <View className="hashtags-section">
                    <Text className="section-label">推荐标签</Text>
                    <View className="hashtags-list">
                      {selectedContent.hashtags.map((tag: string, index: number) => (
                        <View key={index} className="hashtag-item">
                          <Text className="hashtag-text">{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* 图片建议 */}
                {selectedContent.image_suggestions && selectedContent.image_suggestions.length > 0 && (
                  <View className="suggestions-section">
                    <View className="section-header">
                      <ImageIcon size={18} color="#f59e0b" />
                      <Text className="section-label">图片建议</Text>
                    </View>
                    <View className="suggestions-list">
                      {selectedContent.image_suggestions.map((suggestion: string, index: number) => (
                        <View key={index} className="suggestion-item">
                          <Text className="suggestion-text">{suggestion}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* 视频建议 */}
                {selectedContent.video_suggestions && selectedContent.video_suggestions.length > 0 && (
                  <View className="suggestions-section">
                    <View className="section-header">
                      <Video size={18} color="#8b5cf6" />
                      <Text className="section-label">视频建议</Text>
                    </View>
                    <View className="suggestions-list">
                      {selectedContent.video_suggestions.map((suggestion: string, index: number) => (
                        <View key={index} className="suggestion-item">
                          <Text className="suggestion-text">{suggestion}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* 操作按钮 */}
                <View className="action-buttons">
                  {selectedContent.status === 'draft' && (
                    <>
                      <Button
                        className="action-btn primary"
                        onClick={handleApprove}
                      >
                        <Check size={18} color="#fff" />
                        <Text className="action-btn-text">批准内容</Text>
                      </Button>
                      <Button
                        className="action-btn secondary"
                        onClick={handleEdit}
                      >
                        <PenTool size={18} color="#00f5ff" />
                        <Text className="action-btn-text">继续编辑</Text>
                      </Button>
                    </>
                  )}
                  {selectedContent.status === 'approved' && (
                    <Button
                      className="action-btn success"
                    >
                      <Share2 size={18} color="#fff" />
                      <Text className="action-btn-text">准备发布</Text>
                    </Button>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </>
      )}
    </View>
  )
}
