import { useCallback, useRef, useState } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { ArrowLeft, Check, ChevronRight, FileText, Palette, Film, LayoutDashboard, Plus, Sparkles, CirclePlus } from 'lucide-react-taro'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

/** 4种数据库技能类型（name 直接对应 skill_type 字段值） */
const SKILL_TYPES = [
  { key: '文字生成', name: '文字生成', desc: '生成各类文案与文章', icon: FileText, color: '#8B5CF6' },
  { key: '图片生成', name: '图片生成', desc: '生成图片与设计素材', icon: Palette, color: '#06B6D4' },
  { key: '视频生成', name: '视频生成', desc: '生成短视频脚本与分镜', icon: Film, color: '#EC4899' },
  { key: '图文生成', name: '图文生成', desc: '生成策划与增长方案', icon: LayoutDashboard, color: '#F59E0B' },
]

type TemplateItem = {
  id: number
  templateName: string
  templateDescription: string
  coverUrl: string
  skillType: string
  tags: string[]
  creatorIncomePoints: number
  useCount: number
  favoriteCount: number
}

type PageView = 'skill_select' | 'template_list'

export default function AvatarCreateStep2Page() {
  const statusBarHeight = getStatusBarHeight()
  const [avatarId, setAvatarId] = useState<number>(0)
  const [pageView, setPageView] = useState<PageView>('skill_select')
  const [selectedSkill, setSelectedSkill] = useState('')
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([])
  const boundSourceIdsRef = useRef<number[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditMode = avatarId > 0

  /** 编辑模式初始化：从已绑定模板接口获取 sourceIds 和 skillType */
  const loadEditData = useCallback(async (id: number) => {
    try {
      const res = await Network.request({ url: `/api/ai-avatar/${id}/templates` })
      const resData = (res.data as any)?.data
      const ids = resData?.sourceTemplateIds
      if (Array.isArray(ids) && ids.length > 0) {
        boundSourceIdsRef.current = ids
      }
      const skill = resData?.skillType
      if (skill) {
        setSelectedSkill(skill)
      }
    } catch {
      console.error('[step2] 加载编辑数据失败')
    }
  }, [])

  useLoad((options) => {
    const id = Number(options?.avatarId || 0)
    if (id > 0) {
      setAvatarId(id)
      void loadEditData(id)
    }
  })

  /** 加载模板列表，编辑模式下自动勾选已绑定模板 */
  const loadTemplates = useCallback(async (skillType: string, preselectedIds?: number[]) => {
    setLoadingTemplates(true)
    try {
      const res = await Network.request({
        url: '/api/ai-avatar/templates',
        data: { skill_type: skillType },
      })
      const data = (res.data as any)?.data
      if (Array.isArray(data)) {
        setTemplates(data)
        if (preselectedIds && preselectedIds.length > 0) {
          const matchedIds = data
            .filter((tpl: TemplateItem) => preselectedIds.includes(tpl.id))
            .map((tpl: TemplateItem) => tpl.id)
          setSelectedTemplateIds(matchedIds)
        }
      }
    } catch {
      Taro.showToast({ title: '加载模板失败', icon: 'none' })
    } finally {
      setLoadingTemplates(false)
    }
  }, [])

  /** 选择技能类型 */
  const handleSelectSkill = (skillKey: string) => {
    setSelectedSkill(skillKey)
  }

  /** 下一步 → 进入模板列表 */
  const handleNextToTemplates = () => {
    if (!selectedSkill) {
      Taro.showToast({ title: '请选择技能类型', icon: 'none' })
      return
    }
    setPageView('template_list')
    const preselect = isEditMode ? boundSourceIdsRef.current : undefined
    if (!preselect || preselect.length === 0) {
      setSelectedTemplateIds([])
    }
    void loadTemplates(selectedSkill, preselect)
  }

  /** 跳过 */
  const handleSkip = () => {
    if (isEditMode) {
      Taro.redirectTo({ url: '/package-my-avatar/pages/my-avatar/index' })
    } else {
      Taro.showToast({ title: '跳过成功，稍后可在分身管理中添加', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 1500)
    }
  }

  /** 切换模板选中状态 */
  const toggleTemplate = (id: number) => {
    setSelectedTemplateIds(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  /** 执行保存/同步 */
  const doSaveTemplates = async () => {
    if (isSubmitting) return

    setIsSubmitting(true)
    Taro.showLoading({ title: '保存中...' })

    try {
      const res = isEditMode
        ? await Network.request({
            url: `/api/ai-avatar/${avatarId}/templates`,
            method: 'PUT',
            data: { templateIds: selectedTemplateIds },
          })
        : await Network.request({
            url: `/api/ai-avatar/${avatarId}/templates`,
            method: 'POST',
            data: { templateIds: selectedTemplateIds },
          })

      Taro.hideLoading()
      const resData = (res.data as any)

      if (resData?.code === 200) {
        Taro.showToast({ title: '保存成功', icon: 'success' })
        if (isEditMode) {
          const pendingCount = resData?.data?.pendingTestCount || 0
          const pendingId = resData?.data?.pendingTestTemplateId || 0
          setTimeout(() => {
            if (pendingCount === 1 && pendingId > 0) {
              Taro.redirectTo({
                url: `/package-my-avatar/pages/skill-certify/index?templateId=${pendingId}&avatarId=${avatarId}`,
              })
            } else {
              Taro.redirectTo({ url: '/package-my-avatar/pages/my-avatar/index' })
            }
          }, 1500)
        } else {
          const copiedIds: number[] = resData?.data?.copiedIds || []
          const firstTemplateId = copiedIds[0] || selectedTemplateIds[0]
          setTimeout(() => {
            if (firstTemplateId && avatarId) {
              Taro.navigateTo({
                url: `/package-my-avatar/pages/skill-certify/index?templateId=${firstTemplateId}&avatarId=${avatarId}`,
              })
            } else {
              Taro.navigateBack({ delta: 2 })
            }
          }, 1500)
        }
      } else {
        Taro.showToast({ title: resData?.msg || '保存失败', icon: 'none' })
      }
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '网络错误，请重试', icon: 'none' })
    } finally {
      setIsSubmitting(false)
    }
  }

  /** 确认添加/同步模板到分身 */
  const handleConfirmAdd = async () => {
    if (selectedTemplateIds.length === 0) {
      Taro.showToast({ title: '请至少选择一个模板', icon: 'none' })
      return
    }
    if (!avatarId) {
      Taro.showToast({ title: '分身信息异常', icon: 'none' })
      return
    }

    const currentBound = boundSourceIdsRef.current
    if (isEditMode && currentBound.length > 0) {
      const toRemove = currentBound.filter(id => !selectedTemplateIds.includes(id))
      if (toRemove.length > 0) {
        const modalRes = await Taro.showModal({
          title: '确认修改模版',
          content: `有 ${toRemove.length} 个未选中的模版将被删除，确定继续吗？`,
          confirmText: '确定',
          cancelText: '取消',
        })
        if (!modalRes.confirm) return
      }
    }

    void doSaveTemplates()
  }

  /** 返回处理：从step2返回step1时携带avatarId保持编辑模式 */
  const handleBack = () => {
    if (pageView === 'template_list') {
      setPageView('skill_select')
      setSelectedTemplateIds([])
    } else {
      if (avatarId > 0) {
        Taro.redirectTo({
          url: `/package-my-avatar/pages/avatar-create-step1/index?avatarId=${avatarId}`,
        })
      } else {
        Taro.navigateBack()
      }
    }
  }

  /** 格式化使用次数：12.5w 次使用 */
  const formatUseCount = (count: number) => {
    if (count >= 10000) return `${(count / 10000).toFixed(1)}w`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
    return String(count || 0)
  }

  /** 格式化价格：¥0.10/次 */
  const formatPrice = (points: number) => {
    return `¥${(points / 100).toFixed(2)}/次`
  }

  /** 跳转创建自定义模板页面 */
  const handleCreateCustomTemplate = () => {
    Taro.showToast({ title: '自定义模板功能开发中', icon: 'none' })
  }

  // ===== 渲染：技能类型选择 =====
  const renderSkillSelect = () => (
    <View className="acs2-skill-section">
      <Text className="acs2-title">为分身选择技能类型</Text>
      <Text className="acs2-subtitle">一个分身仅支持 1 种技能类型，选定后可配置多个模板。</Text>

      <View className="acs2-skill-grid">
        {SKILL_TYPES.map(skill => {
          const isSelected = selectedSkill === skill.key
          const IconComp = skill.icon
          return (
            <View
              key={skill.key}
              className={`acs2-skill-card ${isSelected ? 'selected' : ''}`}
              onClick={() => handleSelectSkill(skill.key)}
            >
              <View className="acs2-skill-icon" style={{ background: `${skill.color}15` }}>
                <IconComp size={28} color={skill.color} />
              </View>
              <Text className="acs2-skill-name">{skill.name}</Text>
              <Text className="acs2-skill-desc">{skill.desc}</Text>
              <Text className="acs2-skill-select-btn">
                {isSelected ? '已选择 ✓' : '选择该类型'}
              </Text>
            </View>
          )
        })}
      </View>

      <View className="acs2-skill-hint">
        <Sparkles size={16} color="#7c3aed" />
        <Text className="acs2-skill-hint-text">
          1 个分身 = 1种技能类型 = 多个模板{'\n'}
          技能类型是大类能力，模板是该类型下的具体应用。
        </Text>
      </View>
    </View>
  )

  // ===== 渲染：模板库列表（设计图二列横向卡片布局） =====
  const renderTemplateList = () => {
    const skillInfo = SKILL_TYPES.find(s => s.key === selectedSkill)

    return (
      <View>
        {/* 模板库头部信息 */}
        <View className="acs2-tpl-header">
          <View className="acs2-tpl-type-row">
            <View className="acs2-tpl-type-icon">
              <FileText size={20} color="#7c3aed" />
            </View>
            <View className="acs2-tpl-type-info">
              <Text className="block text-base font-bold text-gray-900">当前技能类型：{skillInfo?.name || selectedSkill}</Text>
              <Text className="block text-xs text-gray-500 mt-1">
                本分身仅可使用{skillInfo?.name || selectedSkill}类模板，{'\n'}可添加多个平台模板与自定义模板。
              </Text>
            </View>
          </View>
        </View>

        {/* 模板列表（两列） */}
        {loadingTemplates ? (
          <View style={{ padding: '60rpx 0', textAlign: 'center' }}>
            <Text className="block text-sm text-gray-400">加载中...</Text>
          </View>
        ) : templates.length === 0 ? (
          <View style={{ padding: '80rpx 0', textAlign: 'center' }}>
            <Text className="block text-sm text-gray-400">暂无可用模板</Text>
          </View>
        ) : (
          <View className="acs2-tpl-list">
            {templates.map(tpl => {
              const isSelected = selectedTemplateIds.includes(tpl.id)
              return (
                <View
                  key={tpl.id}
                  className={`acs2-tpl-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleTemplate(tpl.id)}
                >
                  {/* 封面图 */}
                  <View className="acs2-tpl-item-cover">
                    {tpl.coverUrl ? (
                      <Image className="acs2-tpl-item-img" src={tpl.coverUrl} mode="aspectFill" />
                    ) : (
                      <View className="acs2-tpl-item-placeholder">
                        <FileText size={20} color="#a78bfa" />
                      </View>
                    )}
                  </View>
                  {/* 信息区 */}
                  <View className="acs2-tpl-item-body">
                    <Text className="acs2-tpl-item-name">{tpl.templateName}</Text>
                    {/* 标签 */}
                    {Array.isArray(tpl.tags) && tpl.tags.length > 0 && (
                      <View className="acs2-tpl-item-tags">
                        {tpl.tags.slice(0, 3).map((tag, idx) => (
                          <Text key={idx} className="acs2-tpl-item-tag">{tag}</Text>
                        ))}
                      </View>
                    )}
                    {/* 使用次数 */}
                    <Text className="acs2-tpl-item-usage">
                      {formatUseCount(tpl.useCount)} 次使用
                    </Text>
                    {/* 价格 */}
                    <Text className="acs2-tpl-item-price">
                      {formatPrice(tpl.creatorIncomePoints)}
                    </Text>
                    {/* 添加按钮 */}
                    <View className={`acs2-tpl-item-btn ${isSelected ? 'added' : ''}`}>
                      {isSelected ? (
                        <>
                          <Text className="acs2-tpl-item-btn-text-added">已添加</Text>
                          <Check size={14} color="#7c3aed" />
                        </>
                      ) : (
                        <>
                          <Text className="acs2-tpl-item-btn-text">添加模板</Text>
                          <CirclePlus size={14} color="#7c3aed" />
                        </>
                      )}
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* 创建自定义模板入口 */}
        <View className="acs2-custom-entry" onClick={handleCreateCustomTemplate}>
          <View className="acs2-custom-left">
            <Plus size={18} color="#7c3aed" />
            <View>
              <Text className="acs2-custom-text">创建自定义模板</Text>
              <Text className="acs2-custom-desc">在{skillInfo?.name || selectedSkill}类下，创建你自己的专属模板</Text>
            </View>
          </View>
          <ChevronRight size={16} color="#9ca3af" />
        </View>
      </View>
    )
  }

  return (
    <View className="acs2-page">
      {/* 顶部导航 */}
      <View className="acs2-header" style={{ paddingTop: `${statusBarHeight + 10}px` }}>
        <View className="acs2-back" onClick={handleBack}>
          <ArrowLeft size={20} color="#1a1a2e" />
        </View>
        <Text className="acs2-header-title">
          {isEditMode
            ? (pageView === 'template_list' ? '编辑模版（3/3）' : '编辑技能（2/3）')
            : '创建分身（2/3）'}
        </Text>
        <View className="acs2-header-right" />
      </View>

      {/* 进度条 */}
      <View className="acs2-progress">
        <View className="acs2-progress-bar">
          <View className="acs2-progress-fill" style={{
            width: isEditMode
              ? (pageView === 'template_list' ? '100%' : '66.6%')
              : '66.6%',
          }} />
        </View>
      </View>

      {/* 主内容 */}
      <ScrollView scrollY className="acs2-content">
        <View className="acs2-content-inner">
          {pageView === 'skill_select' && renderSkillSelect()}
          {pageView === 'template_list' && renderTemplateList()}
        </View>
      </ScrollView>

      {/* 底部操作区 */}
      <View className="acs2-footer">
        {pageView === 'skill_select' ? (
          <>
            <View className="acs2-skill-footer">
              <View className="acs2-skip-btn" onClick={handleSkip}>
                <Text>跳过，暂不设置</Text>
              </View>
              <View
                className={`acs2-next-btn ${!selectedSkill ? 'disabled' : ''}`}
                onClick={handleNextToTemplates}
              >
                <Text className="acs2-next-btn-text">下一步</Text>
              </View>
            </View>
            <Text className="acs2-footer-hint">稍后你可在分身管理中添加或更换技能。</Text>
          </>
        ) : (
          <>
            <View className="acs2-footer-row">
              <View className="acs2-footer-selected">
                <Text className="acs2-footer-info">
                  已选模板：<Text className="acs2-footer-count">{selectedTemplateIds.length}</Text> 个
                </Text>
                {/* 已选模板缩略图 */}
                {selectedTemplateIds.length > 0 && (
                  <View className="acs2-footer-thumbs">
                    {templates
                      .filter(t => selectedTemplateIds.includes(t.id))
                      .slice(0, 3)
                      .map(t => (
                        <View key={t.id} className="acs2-footer-thumb">
                          {t.coverUrl ? (
                            <Image className="acs2-footer-thumb-img" src={t.coverUrl} mode="aspectFill" />
                          ) : (
                            <View className="acs2-footer-thumb-placeholder" />
                          )}
                        </View>
                      ))}
                  </View>
                )}
              </View>
              <View
                className={`acs2-footer-btn ${selectedTemplateIds.length === 0 || isSubmitting ? 'disabled' : ''}`}
                onClick={handleConfirmAdd}
              >
                <Text className="acs2-footer-btn-text">
                  {isSubmitting ? '保存中...' : (isEditMode ? '确认编辑分身模版' : '确认添加到分身')}
                </Text>
              </View>
            </View>
            <Text className="acs2-footer-hint">
              一个分身仅能选择一种技能类型，但可添加多个该类型模板。
            </Text>
          </>
        )}
      </View>
    </View>
  )
}
