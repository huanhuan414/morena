import { View, Text, ScrollView } from '@tarojs/components'
import { useState } from 'react'
import * as Network from '@/network'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import Taro from '@tarojs/taro'
import {
  Sparkles,
  Wand,
  Save,
  ArrowLeft,
  Lightbulb,
  Check,
  Loader,
  X,
  Target,
  Zap,
  BookOpen,
  Palette,
  Settings as SettingsIcon
} from 'lucide-react-taro'
import './index.css'

interface GeneratedSkill {
  name: string
  description: string
  category: string
  tags: string[]
  capabilities: any
  icon?: string
  requirements?: string
}

const PRESET_TEMPLATES = [
  {
    name: '内容创作助手',
    description: '帮助用户创作各种类型的内容，包括文章、笔记、视频脚本等',
    prompt: '创建一个内容创作助手技能，能够根据用户需求创作文章、小红书笔记、视频脚本等内容'
  },
  {
    name: '社交媒体运营',
    description: '管理多平台社交媒体账号，自动发布内容和互动',
    prompt: '创建一个社交媒体运营技能，能够在多个平台发布内容并进行互动管理'
  },
  {
    name: '数据分析专家',
    description: '分析各种数据并提供洞察和建议',
    prompt: '创建一个数据分析专家技能，能够处理和分析数据并提供专业的洞察报告'
  },
  {
    name: '学习辅导老师',
    description: '帮助学生解答问题，提供学习指导',
    prompt: '创建一个学习辅导老师技能，能够解答各学科问题并提供学习建议'
  },
  {
    name: '生活助手',
    description: '帮助处理日常生活中的各种事务',
    prompt: '创建一个生活助手技能，能够处理日程管理、提醒、信息查询等日常生活事务'
  }
]

const SKILL_CATEGORIES = [
  { name: '内容创作', icon: BookOpen, color: '#00f5ff' },
  { name: '平台发布', icon: Zap, color: '#ff6b6b' },
  { name: '平台管理', icon: SettingsIcon, color: '#ffd700' },
  { name: '数据分析', icon: Target, color: '#bf00ff' },
  { name: '生活服务', icon: Palette, color: '#00ff88' },
  { name: '教育辅导', icon: Lightbulb, color: '#ff9500' }
]

const AVAILABLE_ICONS = [
  '🎯', '🚀', '💡', '⚡', '🎨', '🎬', '📝', '🔥', '💎', '🌟',
  '🎪', '🎭', '🎨', '🎸', '🎺', '🎹', '🎲', '🎮', '🎯', '🎲'
]

export default function SkillCreate() {
  const [step, setStep] = useState<'template' | 'input' | 'generated'>('template')
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [editingSkill, setEditingSkill] = useState<GeneratedSkill | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedIcon, setSelectedIcon] = useState<string>('🎯')
  const [customTags, setCustomTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // 选择模板
  const handleSelectTemplate = (template: any) => {
    setSelectedTemplate(template)
    setStep('input')
    setPrompt(template.prompt)
  }

  // 自定义描述
  const handleCustomDescription = () => {
    setSelectedTemplate(null)
    setStep('input')
  }

  // 生成技能
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Taro.showToast({ title: '请输入技能描述', icon: 'none' })
      return
    }

    try {
      setGenerating(true)

      // 调用 AI 生成接口
      const res = await Network.request({
        url: '/api/skills/ai-generate',
        method: 'POST',
        data: { prompt }
      })

      if (res.data?.code === 200) {
        const skill = res.data.data.skill as GeneratedSkill
        setEditingSkill({
          ...skill,
          icon: skill.icon || '🎯'
        })
        setSelectedCategory(skill.category || '')
        setCustomTags(skill.tags || [])
        setSelectedIcon(skill.icon || '🎯')
        setStep('generated')
      } else {
        Taro.showToast({ title: res.data?.message || '生成失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[SkillCreate] 生成技能失败:', error)
      Taro.showToast({ title: '生成失败', icon: 'none' })
    } finally {
      setGenerating(false)
    }
  }

  // 添加标签
  const handleAddTag = () => {
    const tag = tagInput.trim()
    if (tag && !customTags.includes(tag)) {
      if (customTags.length >= 5) {
        Taro.showToast({ title: '最多添加5个标签', icon: 'none' })
        return
      }
      setCustomTags([...customTags, tag])
      setTagInput('')
    }
  }

  // 删除标签
  const handleRemoveTag = (tag: string) => {
    setCustomTags(customTags.filter(t => t !== tag))
  }

  // 保存技能
  const handleSave = () => {
    if (!editingSkill) return

    if (!editingSkill.name || !editingSkill.description) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }

    setShowConfirmDialog(true)
  }

  // 确认保存
  const handleConfirmSave = async () => {
    if (!editingSkill) return

    try {
      setSaving(true)

      const res = await Network.request({
        url: '/api/skills',
        method: 'POST',
        data: {
          ...editingSkill,
          category: selectedCategory,
          icon: selectedIcon,
          tags: customTags,
          status: 'active',
          price: 0
        }
      })

      if (res.data?.code === 200) {
        Taro.showToast({ title: '技能创建成功！', icon: 'success' })
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        Taro.showToast({ title: res.data?.message || '保存失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[SkillCreate] 保存技能失败:', error)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
      setShowConfirmDialog(false)
    }
  }

  // 返回
  const handleBack = () => {
    if (step === 'generated') {
      setStep('input')
    } else if (step === 'input') {
      setStep('template')
      setSelectedTemplate(null)
    } else {
      Taro.navigateBack()
    }
  }

  return (
    <View className="skill-create-container">
      {/* 头部导航 */}
      <View className="create-header">
        <View className="header-nav" onClick={handleBack}>
          <ArrowLeft size={20} color="#ffffff" />
          <Text className="header-nav-text">返回</Text>
        </View>
        <Text className="header-title">创建技能</Text>
        <View className="header-spacer" />
      </View>

      {/* 步骤1：选择模板 */}
      {step === 'template' && (
        <View className="step-container">
          <View className="step-intro">
            <Wand size={32} color="#00f5ff" className="intro-icon" />
            <Text className="intro-title">创建新技能</Text>
            <Text className="intro-desc">选择一个模板快速开始，或者自定义描述</Text>
          </View>

          <ScrollView className="template-list" scrollY>
            {PRESET_TEMPLATES.map((template, index) => {
              const categoryIcon = SKILL_CATEGORIES[index % SKILL_CATEGORIES.length]
              const Icon = categoryIcon.icon
              return (
                <View
                  key={index}
                  className="template-card"
                  onClick={() => handleSelectTemplate(template)}
                >
                  <View className="template-icon" style={{ background: `linear-gradient(135deg, ${categoryIcon.color}22, ${categoryIcon.color}44)` }}>
                    <Icon size={24} color={categoryIcon.color} />
                  </View>
                  <View className="template-content">
                    <Text className="template-name">{template.name}</Text>
                    <Text className="template-desc">{template.description}</Text>
                  </View>
                  <Sparkles size={16} color="rgba(255,255,255,0.4)" />
                </View>
              )
            })}
          </ScrollView>

          <View className="custom-section">
            <Button className="custom-btn" variant="outline" onClick={handleCustomDescription}>
              <Lightbulb size={18} color="#00f5ff" />
              <Text>自定义描述</Text>
            </Button>
          </View>
        </View>
      )}

      {/* 步骤2：输入描述 */}
      {step === 'input' && (
        <View className="step-container">
          <View className="input-header">
            <Text className="input-title">描述你的技能</Text>
            <Text className="input-subtitle">
              {selectedTemplate ? '基于' + selectedTemplate.name + '模板' : '详细描述你想要创建的技能'}
            </Text>
          </View>

          <View className="input-content">
            <View className="prompt-container">
              <Text className="prompt-label">技能描述</Text>
              <Textarea
                className="prompt-textarea"
                placeholder="请详细描述你想要创建的技能，包括它的功能、使用场景等..."
                value={prompt}
                onInput={(e) => setPrompt(e.detail.value)}
                maxlength={500}
              />
              <Text className="prompt-count">{prompt.length}/500</Text>
            </View>

            <View className="tips-section">
              <View className="tip-item">
                <Check size={16} color="#00ff88" />
                <Text className="tip-text">描述越详细，生成的技能越精准</Text>
              </View>
              <View className="tip-item">
                <Check size={16} color="#00ff88" />
                <Text className="tip-text">可以指定技能的应用场景和目标用户</Text>
              </View>
              <View className="tip-item">
                <Check size={16} color="#00ff88" />
                <Text className="tip-text">AI会自动生成技能的名称、标签等</Text>
              </View>
            </View>
          </View>

          <View className="input-actions">
            <Button className="generate-btn" onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <>
                  <Loader size={18} color="#fff" className="spinning" />
                  <Text>生成中...</Text>
                </>
              ) : (
                <>
                  <Sparkles size={18} color="#fff" />
                  <Text>生成技能</Text>
                </>
              )}
            </Button>
          </View>
        </View>
      )}

      {/* 步骤3：生成结果 */}
      {step === 'generated' && editingSkill && (
        <ScrollView className="step-container scroll" scrollY>
          <View className="result-header">
            <Check size={24} color="#00ff88" />
            <Text className="result-title">技能已生成</Text>
            <Text className="result-subtitle">你可以调整以下信息后保存</Text>
          </View>

          {/* 基本信息 */}
          <View className="result-section">
            <Text className="section-title">基本信息</Text>

            <View className="form-item">
              <Text className="form-label">技能名称</Text>
              <Input
                className="form-input"
                value={editingSkill.name}
                onInput={(e) => setEditingSkill({ ...editingSkill, name: e.detail.value })}
                placeholder="技能名称"
              />
            </View>

            <View className="form-item">
              <Text className="form-label">技能描述</Text>
              <Textarea
                className="form-textarea"
                value={editingSkill.description}
                onInput={(e) => setEditingSkill({ ...editingSkill, description: e.detail.value })}
                placeholder="技能描述"
                maxlength={200}
              />
            </View>

            <View className="form-item">
              <Text className="form-label">技能分类</Text>
              <View className="category-grid">
                {SKILL_CATEGORIES.map((cat) => {
                  const Icon = cat.icon
                  return (
                    <View
                      key={cat.name}
                      className={`category-option ${selectedCategory === cat.name ? 'active' : ''}`}
                      style={{ borderColor: selectedCategory === cat.name ? cat.color : 'rgba(255,255,255,0.1)' }}
                      onClick={() => setSelectedCategory(cat.name)}
                    >
                      <Icon size={20} color={selectedCategory === cat.name ? cat.color : 'rgba(255,255,255,0.6)'} />
                      <Text className="category-option-text">{cat.name}</Text>
                    </View>
                  )
                })}
              </View>
            </View>

            <View className="form-item">
              <Text className="form-label">技能图标</Text>
              <View className="icon-grid">
                {AVAILABLE_ICONS.map((icon) => (
                  <View
                    key={icon}
                    className={`icon-option ${selectedIcon === icon ? 'active' : ''}`}
                    onClick={() => setSelectedIcon(icon)}
                  >
                    <Text className="icon-option-text">{icon}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* 标签设置 */}
          <View className="result-section">
            <Text className="section-title">技能标签</Text>
            <View className="tags-input">
              <Input
                className="tag-input-field"
                value={tagInput}
                onInput={(e) => setTagInput(e.detail.value)}
                placeholder="输入标签后按回车添加"
                onConfirm={handleAddTag}
              />
              <Button className="tag-add-btn" size="sm" onClick={handleAddTag}>
                添加
              </Button>
            </View>
            <View className="tags-list">
              {customTags.map((tag, index) => (
                <View key={index} className="tag-item">
                  <Text className="tag-text">{tag}</Text>
                  <X size={14} color="rgba(255,255,255,0.5)" onClick={() => handleRemoveTag(tag)} />
                </View>
              ))}
              {customTags.length === 0 && (
                <Text className="tags-empty">暂无标签，最多添加5个</Text>
              )}
            </View>
          </View>

          {/* 保存按钮 */}
          <View className="result-actions">
            <Button className="save-btn" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader size={18} color="#fff" className="spinning" />
                  <Text>保存中...</Text>
                </>
              ) : (
                <>
                  <Save size={18} color="#fff" />
                  <Text>保存技能</Text>
                </>
              )}
            </Button>
          </View>
        </ScrollView>
      )}

      {/* 保存确认弹窗 */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认创建技能</DialogTitle>
          </DialogHeader>

          <View className="confirm-content">
            <View className="confirm-skill-preview">
              <View className="confirm-skill-icon" style={{ background: `linear-gradient(135deg, #00f5ff22, #00f5ff44)` }}>
                <Text className="confirm-skill-emoji">{selectedIcon}</Text>
              </View>
              <View className="confirm-skill-info">
                <Text className="confirm-skill-name">{editingSkill?.name}</Text>
                <Text className="confirm-skill-desc">{editingSkill?.description}</Text>
              </View>
            </View>

            <View className="confirm-details">
              <View className="confirm-detail-row">
                <Text className="confirm-detail-label">分类</Text>
                <Text className="confirm-detail-value">{selectedCategory}</Text>
              </View>
              <View className="confirm-detail-row">
                <Text className="confirm-detail-label">标签</Text>
                <View className="confirm-detail-tags">
                  {customTags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="confirm-tag">
                      {tag}
                    </Badge>
                  ))}
                  {customTags.length === 0 && (
                    <Text className="confirm-detail-empty">无</Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmSave}>
              确认创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  )
}
