import { Image, Input, ScrollView, Text, Textarea, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  Eye,
  Heart,
  Layers,
  PenLine,
  Sparkles,
  Star,
  X,
} from 'lucide-react-taro'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'

import './index.css'

type PromptVariable = {
  key: string
  name: string
  type: string
  required: boolean
  options?: string[]
}

type TemplatePageData = {
  template: {
    id: number
    templateName: string
    templateDescription: string
    coverUrl: string
    skillType: string
    tags: string[]
    status: string
    displayStatus: string
    useCount: number
    favoriteCount: number
    creatorIncomePoints: number
    versionNo: number
    promptText: string
    promptVariables: PromptVariable[]
    materialConfig: any
    outputConfig: any
    outputType: string
    totalCost: number
    testedAt: string | null
    templateSource: string
  }
  avatar: {
    id: number
    avatarName: string
    avatarUrl: string
    description: string
    skillType: string
    status: string
  } | null
  modelApi: {
    id: number
    modelName: string
    providerName: string
    description: string
    iconUrl: string
    skillType: string
    modelCostPoints: number
  } | null
  works: WorkItem[]
  workStats: {
    totalWorks: number
    totalViews: number
    totalFavorites: number
  }
  isOwner: boolean
}

type WorkItem = {
  id: number
  title: string
  description: string
  skillType: string
  coverUrl: string
  images: string[]
  videoUrl: string
  contentText: string
  payPoints: number
  viewCount: number
  favoriteCount: number
  successCount: number
  createdAt: string
}

type EditForm = {
  templateName: string
  templateDescription: string
  tags: string
  creatorIncomePoints: string
  coverUrl: string
}

type ApiResponse<T> = {
  code?: number
  msg?: string
  data?: T | null
}

const formatCount = (value: number) => {
  const normalized = Number(value || 0)
  if (normalized >= 10000) {
    return `${(normalized / 10000).toFixed(normalized >= 100000 ? 1 : 2).replace(/\.0+$/, '')}w`
  }
  return normalized.toLocaleString('zh-CN')
}

/**
 * 模版详情页
 * 展示模版完整信息、参数配置、历史生成作品
 */
export default function TemplateDetailPage() {
  const statusBarHeight = getStatusBarHeight()
  const [templateId, setTemplateId] = useState<number>(0)
  const [avatarId, setAvatarId] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<TemplatePageData | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({ templateName: '', templateDescription: '', tags: '', creatorIncomePoints: '0', coverUrl: '' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const loadDetail = useCallback(async (tplId: number) => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/ai-avatar/templates/${encodeURIComponent(String(tplId))}/page-detail`,
      })
      console.log('[TemplateDetailPage] response:', res.data)
      const responseBody = res.data as ApiResponse<TemplatePageData>
      if (responseBody?.code !== 200 || !responseBody.data) {
        throw new Error(responseBody?.msg || '获取模版详情失败')
      }
      setData(responseBody.data)
    } catch (error) {
      console.error('[TemplateDetailPage] load failed:', error)
      void Taro.showToast({
        title: error instanceof Error ? error.message : '加载失败',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useLoad((options) => {
    const tplId = Number(options?.templateId || 0)
    const avId = Number(options?.avatarId || 0)
    if (tplId > 0) {
      setTemplateId(tplId)
      void loadDetail(tplId)
    }
    if (avId > 0) setAvatarId(avId)
  })

  const goToTemplateUse = () => {
    void Taro.navigateTo({
      url: `/package-my-avatar/pages/template-use/index?templateId=${encodeURIComponent(String(templateId))}&avatarId=${encodeURIComponent(String(avatarId))}`,
    })
  }

  const openEditDialog = () => {
    if (!data) return
    const { template } = data
    setEditForm({
      templateName: template.templateName,
      templateDescription: template.templateDescription || '',
      tags: Array.isArray(template.tags) ? template.tags.join('、') : '',
      creatorIncomePoints: String(template.creatorIncomePoints || 0),
      coverUrl: template.coverUrl || '',
    })
    setEditOpen(true)
  }

  const handleChooseCover = async () => {
    if (uploading) return
    try {
      const chooseRes = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      const tempPath = chooseRes.tempFilePaths[0]
      if (!tempPath) return

      setUploading(true)
      Taro.showLoading({ title: '上传中...' })
      const uploadRes = await Network.uploadFile({
        url: '/api/upload/image',
        filePath: tempPath,
        name: 'file',
      })
      Taro.hideLoading()
      setUploading(false)

      const resData = typeof uploadRes.data === 'string' ? JSON.parse(uploadRes.data) : uploadRes.data
      const imageUrl = resData?.data?.url || resData?.url || ''
      if (imageUrl) {
        setEditForm(prev => ({ ...prev, coverUrl: imageUrl }))
      } else {
        void Taro.showToast({ title: '上传失败', icon: 'none' })
      }
    } catch {
      Taro.hideLoading()
      setUploading(false)
      void Taro.showToast({ title: '上传失败', icon: 'none' })
    }
  }

  const handleSaveEdit = async () => {
    if (saving || !data) return
    const name = editForm.templateName.trim()
    if (!name) {
      void Taro.showToast({ title: '请输入模版名称', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      const tagsArr = editForm.tags.split(/[、,，]/).map(t => t.trim()).filter(Boolean)
      const res = await Network.request({
        url: `/api/ai-avatar/templates/${encodeURIComponent(String(templateId))}/update`,
        method: 'PUT',
        data: {
          template_name: name,
          template_description: editForm.templateDescription.trim(),
          tags_json: tagsArr,
          creator_income_points: Number(editForm.creatorIncomePoints) || 0,
          cover_url: editForm.coverUrl || null,
        },
      })
      const responseBody = res.data as ApiResponse<any>
      if (responseBody?.code !== 200) {
        throw new Error(responseBody?.msg || '保存失败')
      }
      setEditOpen(false)
      void Taro.showToast({ title: '保存成功', icon: 'success' })
      void loadDetail(templateId)
    } catch (error) {
      void Taro.showToast({
        title: error instanceof Error ? error.message : '保存失败',
        icon: 'none',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View className="td-page">
        <View className="td-header" style={{ paddingTop: `${statusBarHeight + 10}px` }}>
          <View className="td-back" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={19} color="#4C3B78" />
          </View>
          <Text className="td-header-title">模版详情</Text>
        </View>
        <View className="td-loading">
          <Text className="td-loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (!data) {
    return (
      <View className="td-page">
        <View className="td-header" style={{ paddingTop: `${statusBarHeight + 10}px` }}>
          <View className="td-back" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={19} color="#4C3B78" />
          </View>
          <Text className="td-header-title">模版详情</Text>
        </View>
        <View className="td-loading">
          <Text className="td-loading-text">模版信息加载失败</Text>
        </View>
      </View>
    )
  }

  const { template, avatar, works, isOwner } = data
  const sourceLabel = template.templateSource === '官方复制' ? '官方模版' : template.templateSource

  return (
    <View className="td-page">
      <View className="td-header" style={{ paddingTop: `${statusBarHeight + 10}px` }}>
        <View className="td-back" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={19} color="#4C3B78" />
        </View>
        <Text className="td-header-title">模版详情</Text>
      </View>

      {/* 分身信息头 */}
      {avatar && (
        <View className="td-avatar-section">
          <View className="td-avatar-row">
            <View className="td-avatar-img">
              {avatar.avatarUrl ? (
                <Image src={avatar.avatarUrl} mode="aspectFill" />
              ) : (
                <View className="td-avatar-fallback">
                  <Sparkles size={24} color="#8B5CF6" />
                </View>
              )}
            </View>
            <View className="td-avatar-info">
              <View className="td-avatar-name-row">
                <Text className="td-avatar-name">{avatar.avatarName}</Text>
                <Badge className={`td-avatar-cert${template.status === '已启用' ? ' is-certified' : ' is-uncertified'}`}>
                  <Text>{template.status === '已启用' ? '已认证' : '未认证'}</Text>
                </Badge>
              </View>
              <Text className="td-avatar-skill">技能：{avatar.skillType}</Text>
              <Text className="td-avatar-desc">{avatar.description || '暂无介绍'}</Text>
            </View>
          </View>
        </View>
      )}

      {/* 模版信息卡片（含价格+标签） */}
      <View className="td-template-card">
        <View className="td-tpl-header">
          <View className="td-tpl-cover">
            {template.coverUrl ? (
              <Image src={template.coverUrl} mode="aspectFill" className="td-tpl-cover-img" />
            ) : (
              <View className="td-tpl-cover-fallback">
                <Sparkles size={32} color="#8B5CF6" />
              </View>
            )}
          </View>
          <View className="td-tpl-info">
            <View className="td-tpl-name-row">
              <Text className="td-tpl-name">{template.templateName}</Text>
              <Badge className="td-tpl-source-badge">
                <Text>{sourceLabel}</Text>
              </Badge>
            </View>
            <Text className="td-tpl-desc">{template.templateDescription || '暂无描述'}</Text>
          </View>
        </View>

        <View className="td-tpl-meta">
          <View className="td-tpl-meta-row">
            <Text className="td-tpl-meta-label">价格</Text>
            <Text className="td-tpl-meta-value is-price">{template.totalCost} 积分 / 次</Text>
          </View>
        </View>

        {Array.isArray(template.tags) && template.tags.length > 0 && (
          <View className="td-tpl-tags-section">
            <Text className="td-tpl-tags-title">模版标签</Text>
            <View className="td-tags">
              {template.tags.map((tag) => (
                <View key={tag} className="td-tag">
                  <Text>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* 参数预览 */}
      {Array.isArray(template.promptVariables) && template.promptVariables.length > 0 && (
        <View className="td-section td-section-bordered">
          <Text className="td-section-title">参数预览（使用默认参数）</Text>
          <View>
            {template.promptVariables.map((v) => (
              <View key={v.key} className="td-param-row">
                <Text className="td-param-name">
                  {v.name}
                  <Text className="td-param-required">（{v.required ? '必填' : '选填'}）</Text>
                </Text>
                <Text className="td-param-hint">
                  {v.options?.length
                    ? v.options.join(' / ')
                    : `请填写${v.name}`}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 历史效果参考 */}
      <View className="td-section td-section-bordered">
        <View className="td-section-title-row">
          <Text className="td-section-title" style={{ marginBottom: 0 }}>历史效果参考</Text>
          {works.length > 3 && (
            <View className="td-section-more">
              <Text>查看更多</Text>
              <ChevronRight size={14} color="#16a34a" />
            </View>
          )}
        </View>

        {works.length > 0 ? (
          <View className="td-work-list">
            {works.slice(0, 5).map((work) => (
              <View key={work.id} className="td-work-item">
                <View className="td-work-cover">
                  {work.coverUrl ? (
                    <Image src={work.coverUrl} mode="aspectFill" className="td-work-cover-img" />
                  ) : work.contentText ? (
                    <Text className="td-work-cover-text">{work.contentText}</Text>
                  ) : (
                    <View className="td-work-cover-fallback">
                      <Sparkles size={20} color="#8B5CF6" />
                    </View>
                  )}
                </View>
                <View className="td-work-info">
                  <Text className="td-work-title">{work.title || work.contentText || '生成作品'}</Text>
                  <View className="td-work-bottom">
                    <Text className="td-work-meta">生成时间 {work.createdAt}</Text>
                    <Text className="td-work-meta">使用次数 {formatCount(work.viewCount)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="td-empty-works">
            <Layers size={28} color="#C4B5FD" />
            <Text className="td-empty-works-text">暂无生成记录</Text>
          </View>
        )}
      </View>

      {/* 底部统计（去掉平均转化率，只保留使用次数和收藏数） */}
      <View className="td-bottom-stats">
        <View className="td-bottom-stats-grid is-two-col">
          <View className="td-bottom-stat">
            <View className="td-bottom-stat-icon">
              <Eye size={14} color="#7c3aed" />
            </View>
            <Text className="td-bottom-stat-value">{formatCount(template.useCount)}</Text>
            <Text className="td-bottom-stat-label">使用次数</Text>
          </View>
          <View className="td-bottom-stat">
            <View className="td-bottom-stat-icon">
              <Heart size={14} color="#EF4444" />
            </View>
            <Text className="td-bottom-stat-value">{formatCount(template.favoriteCount)}</Text>
            <Text className="td-bottom-stat-label">收藏数</Text>
          </View>
        </View>
      </View>

      {/* 底部固定操作栏 */}
      <View className="td-bar">
        {isOwner ? (
          <Button variant="outline" className="td-bar-collect" onClick={openEditDialog}>
            <PenLine size={16} color="#7C3AED" />
            <Text>编辑模板</Text>
          </Button>
        ) : (
          <Button variant="outline" className="td-bar-collect">
            <Star size={16} color="#7C3AED" />
            <Text>收藏模板</Text>
          </Button>
        )}
        <Button className="td-bar-use" onClick={goToTemplateUse}>
          <Text>立即使用模板</Text>
        </Button>
      </View>

      {/* 全屏编辑面板（从下往上滑出） */}
      {editOpen && (
        <View className="td-edit-overlay">
          <View className="td-edit-panel">
            {/* 编辑面板顶部导航 */}
            <View className="td-edit-header" style={{ paddingTop: `${statusBarHeight + 10}px` }}>
              <View className="td-edit-close" onClick={() => setEditOpen(false)}>
                <X size={18} color="#6b7280" />
              </View>
              <Text className="td-edit-header-title">编辑模版</Text>
              <View className="td-edit-header-right" />
            </View>

            <ScrollView scrollY className="td-edit-scroll">
              {/* 封面上传区 */}
              <View className="td-edit-cover-section" onClick={() => void handleChooseCover()}>
                {editForm.coverUrl ? (
                  <Image src={editForm.coverUrl} mode="aspectFill" className="td-edit-cover-preview" />
                ) : (
                  <View className="td-edit-cover-empty">
                    <View className="td-edit-cover-icon-circle">
                      <Camera size={28} color="#7c3aed" />
                    </View>
                    <Text className="td-edit-cover-hint">点击上传模版封面</Text>
                    <Text className="td-edit-cover-sub">建议尺寸 750×750，支持 JPG/PNG</Text>
                  </View>
                )}
                {editForm.coverUrl && (
                  <View className="td-edit-cover-change">
                    <Camera size={14} color="#fff" />
                    <Text className="td-edit-cover-change-text">更换</Text>
                  </View>
                )}
              </View>

              {/* 表单区域 */}
              <View className="td-edit-form-card">
                <View className="td-edit-field">
                  <Text className="td-edit-label">模版名称</Text>
                  <View className="td-edit-input-wrap">
                    <Input
                      value={editForm.templateName}
                      onInput={(e) => setEditForm(prev => ({ ...prev, templateName: e.detail.value }))}
                      placeholder="请输入模版名称"
                      maxlength={30}
                    />
                  </View>
                </View>

                <View className="td-edit-field">
                  <Text className="td-edit-label">模版介绍</Text>
                  <View className="td-edit-textarea-wrap">
                    <Textarea
                      value={editForm.templateDescription}
                      onInput={(e) => setEditForm(prev => ({ ...prev, templateDescription: e.detail.value }))}
                      placeholder="请输入模版介绍"
                      maxlength={200}
                      style={{ width: '100%', minHeight: '100px', backgroundColor: 'transparent' }}
                    />
                  </View>
                  <Text className="td-edit-char-count">{editForm.templateDescription.length}/200</Text>
                </View>

                <View className="td-edit-field">
                  <Text className="td-edit-label">模版标签</Text>
                  <View className="td-edit-input-wrap">
                    <Input
                      value={editForm.tags}
                      onInput={(e) => setEditForm(prev => ({ ...prev, tags: e.detail.value }))}
                      placeholder="多个标签用顿号分隔，如：文字、写作、笑话"
                      maxlength={100}
                    />
                  </View>
                </View>

                {template.templateSource !== '官方复制' && (
                  <View className="td-edit-field">
                    <Text className="td-edit-label">模版价格（积分/次）</Text>
                    <View className="td-edit-input-wrap">
                      <Input
                        type="number"
                        value={editForm.creatorIncomePoints}
                        onInput={(e) => setEditForm(prev => ({ ...prev, creatorIncomePoints: e.detail.value }))}
                        placeholder="请输入价格"
                      />
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* 底部保存按钮 */}
            <View className="td-edit-footer">
              <Button
                className="td-edit-save-btn"
                disabled={saving}
                onClick={() => void handleSaveEdit()}
              >
                <Text>{saving ? '保存中...' : '保存修改'}</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
