import Taro, { useLoad, useRouter, navigateBack, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, RichText } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import { ArrowLeft, FileText, Image as ImageIcon, Video, Share2, Check, Sparkles, X, PenTool, Copy, Eye } from 'lucide-react-taro'
import './index.css'

// 平台名称映射
const PLATFORM_NAMES: Record<string, string> = {
  wechat_mp: '微信公众号',
  wechat_moments: '微信朋友圈',
  wechat_video: '微信视频号',
  xiaohongshu: '小红书',
  douyin: '抖音',
  weibo: '微博',
  bilibili: 'B站',
  kuaishou: '快手'
}

// 简单的 Markdown 解析器
const parseMarkdown = (text: string): string => {
  if (!text) return ''

  let html = text

  // 转义 HTML 特殊字符
  html = html.replace(/&/g, '&amp;')
  html = html.replace(/</g, '&lt;')
  html = html.replace(/>/g, '&gt;')

  // 标题
  html = html.replace(/^### (.+)$/gm, '<text class="md-h3">$1</text>\n')
  html = html.replace(/^## (.+)$/gm, '<text class="md-h2">$1</text>\n')
  html = html.replace(/^# (.+)$/gm, '<text class="md-h1">$1</text>\n')

  // 粗体
  html = html.replace(/\*\*(.+?)\*\*/g, '<text class="md-bold">$1</text>')

  // 斜体
  html = html.replace(/\*(.+?)\*/g, '<text class="md-italic">$1</text>')

  // 无序列表
  html = html.replace(/^- (.+)$/gm, '<text class="md-li">• $1</text>')

  // 链接
  html = html.replace(/\[([^\]]+)\]\([^)]+\)/g, '<text class="md-link">$1</text>')

  return html
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

  const handleCopy = () => {
    const text = selectedContent?.title + '\n\n' + selectedContent?.content
    Taro.setClipboardData({
      data: text,
      success: () => showToast({ title: '已复制', icon: 'success' })
    })
  }

  if (loading) {
    return (
      <View className="generated-content-page">
        {/* 背景装饰 */}
        <View className="bg-decoration bg-1" />
        <View className="bg-decoration bg-2" />

        <View className="page-header">
          <View className="header-left" onClick={() => navigateBack()}>
            <ArrowLeft size={20} color="rgba(255,255,255,0.8)" />
          </View>
          <Text className="header-title">生成内容</Text>
          <View className="header-right" />
        </View>

        <View className="loading-wrapper">
          <Sparkles size={48} color="#3b82f6" className="loading-icon" />
          <Text className="loading-title">AI 正在为您生成内容</Text>
          <Text className="loading-desc">这需要几秒钟，请稍候...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="generated-content-page">
      {/* 背景装饰 */}
      <View className="bg-decoration bg-1" />
      <View className="bg-decoration bg-2" />

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
          <View className="empty-icon">
            <X size={64} color="#94a3b8" />
          </View>
          <Text className="empty-title">暂无生成内容</Text>
          <Text className="empty-desc">请先接受订单，系统将自动生成内容</Text>
        </View>
      ) : (
        <>
          {/* 平台标签 */}
          <View className="platform-tabs-wrapper">
            <ScrollView className="platform-tabs" scrollX>
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
                    <View className="platform-tab-badge">
                      <Check size={12} color="#fff" />
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>

          <ScrollView className="content-scroll" scrollY>
            {selectedContent && (
              <>
                {/* 内容头部 */}
                <View className="content-header">
                  <View className="header-icon">
                    <FileText size={24} color="#3b82f6" />
                  </View>
                  <View className="header-info">
                    <Text className="header-title-text">{selectedContent.title || '未命名内容'}</Text>
                    <View className="header-meta">
                      <View className="meta-item">
                        <Eye size={14} color="#64748b" />
                        <Text className="meta-text">
                          {selectedContent.status === 'draft' && '草稿 - 可编辑'}
                          {selectedContent.status === 'approved' && '已批准'}
                          {selectedContent.status === 'published' && '已发布'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* 内容卡片 */}
                <View className="content-card">
                  {/* Markdown 内容 */}
                  <View className="content-body">
                    {isEditing ? (
                      <View className="edit-wrapper">
                        <Textarea
                          className="content-textarea"
                          value={editedContent}
                          onInput={(e) => setEditedContent(e.detail.value)}
                          maxlength={5000}
                          placeholder="在此编辑内容..."
                        />
                        <View className="edit-actions">
                          <Button className="action-btn cancel-btn" onClick={() => setIsEditing(false)}>
                            取消
                          </Button>
                          <Button className="action-btn save-btn" onClick={handleSave}>
                            <Check size={18} color="#fff" />
                            <Text className="btn-text">保存</Text>
                          </Button>
                        </View>
                      </View>
                    ) : (
                      <View className="content-display">
                        <RichText className="markdown-content" nodes={parseMarkdown(selectedContent.content)} />
                        {selectedContent.status === 'draft' && (
                          <Button className="edit-trigger" onClick={handleEdit}>
                            <PenTool size={16} color="#3b82f6" />
                            <Text className="edit-trigger-text">编辑内容</Text>
                          </Button>
                        )}
                      </View>
                    )}
                  </View>

                  {/* 标签 */}
                  {selectedContent.hashtags && selectedContent.hashtags.length > 0 && (
                    <View className="section-wrapper">
                      <Text className="section-title block">推荐标签</Text>
                      <View className="tags-container">
                        {selectedContent.hashtags.map((tag: string, index: number) => (
                          <View key={index} className="tag-item">
                            <Text className="tag-text">#{tag}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* 图片建议 */}
                  {selectedContent.image_suggestions && selectedContent.image_suggestions.length > 0 && (
                    <View className="section-wrapper">
                      <View className="section-header">
                        <ImageIcon size={18} color="#f59e0b" />
                        <Text className="section-title">图片建议</Text>
                      </View>
                      <View className="suggestions-grid">
                        {selectedContent.image_suggestions.map((suggestion: string, index: number) => (
                          <View key={index} className="suggestion-card">
                            <ImageIcon size={24} color="#f59e0b" />
                            <Text className="suggestion-text">{suggestion}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* 视频建议 */}
                  {selectedContent.video_suggestions && selectedContent.video_suggestions.length > 0 && (
                    <View className="section-wrapper">
                      <View className="section-header">
                        <Video size={18} color="#8b5cf6" />
                        <Text className="section-title">视频建议</Text>
                      </View>
                      <View className="suggestions-grid">
                        {selectedContent.video_suggestions.map((suggestion: string, index: number) => (
                          <View key={index} className="suggestion-card">
                            <Video size={24} color="#8b5cf6" />
                            <Text className="suggestion-text">{suggestion}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* 操作按钮 */}
                  <View className="actions-wrapper">
                    {selectedContent.status === 'draft' && (
                      <>
                        <Button className="action-btn approve-btn" onClick={handleApprove}>
                          <Check size={18} color="#fff" />
                          <Text className="btn-text">批准内容</Text>
                        </Button>
                        <Button className="action-btn edit-btn-style" onClick={handleEdit}>
                          <PenTool size={18} color="#3b82f6" />
                          <Text className="btn-text">继续编辑</Text>
                        </Button>
                      </>
                    )}
                    {selectedContent.status === 'approved' && (
                      <Button className="action-btn publish-btn">
                        <Share2 size={18} color="#fff" />
                        <Text className="btn-text">准备发布</Text>
                      </Button>
                    )}
                    <Button className="action-btn copy-btn" onClick={handleCopy}>
                      <Copy size={18} color="#64748b" />
                      <Text className="btn-text">复制内容</Text>
                    </Button>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </>
      )}
    </View>
  )
}
