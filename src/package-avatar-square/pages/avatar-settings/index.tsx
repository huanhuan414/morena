import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  FileText,
  Globe,
  HeartPulse,
  LockKeyhole,
  PenLine,
  Power,
  RefreshCw,
  Sparkles,
  Type,
} from 'lucide-react-taro'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Network } from '@/network'

import './index.css'

type AvatarSettingsData = {
  id: number
  avatarName: string
  avatarUrl: string
  description: string
  publicStatus: string
  status: string
  skillType: string
  updatedAt: string
}

type ApiResponse<T> = {
  code?: number
  msg?: string
  data?: T | null
}

type EditingField = 'name' | 'description'

export default function AvatarSettingsPage() {
  const router = useRouter()
  const avatarId = router.params.id || ''
  const statusBarHeight = Taro.getWindowInfo().statusBarHeight || 20
  const pageStyle = { '--avs-status-bar-height': `${statusBarHeight}px` } as CSSProperties
  const [avatar, setAvatar] = useState<AvatarSettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingField, setEditingField] = useState<EditingField>('name')
  const [editorOpen, setEditorOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [descriptionDraft, setDescriptionDraft] = useState('')

  useEffect(() => {
    if (!avatarId) {
      setLoading(false)
      return
    }

    let active = true
    const loadSettings = async () => {
      setLoading(true)
      try {
        const res = await Network.request({
          url: `/api/avatar-square/${encodeURIComponent(avatarId)}/settings`,
        })
        console.log('[AvatarSettingsPage] settings response:', res.data)
        const responseBody = res.data as ApiResponse<AvatarSettingsData>
        if (!active) return
        if (responseBody?.code !== 200 || !responseBody.data) {
          throw new Error(responseBody?.msg || '获取分身设置失败')
        }

        setAvatar(responseBody.data)
        setNameDraft(responseBody.data.avatarName)
        setDescriptionDraft(responseBody.data.description)
        if (router.params.edit === 'name') {
          setEditingField('name')
          setEditorOpen(true)
        }
      } catch (error) {
        if (!active) return
        void Taro.showToast({
          title: error instanceof Error ? error.message : '获取失败',
          icon: 'none',
        })
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadSettings()
    return () => {
      active = false
    }
  }, [avatarId, router.params.edit])

  const saveUpdates = async (updates: Record<string, string>, successText: string) => {
    if (!avatarId || saving) return false
    setSaving(true)
    try {
      const res = await Network.request({
        url: `/api/avatar-square/${encodeURIComponent(avatarId)}/settings`,
        method: 'PUT',
        data: updates,
      })
      console.log('[AvatarSettingsPage] update response:', res.data)
      const responseBody = res.data as ApiResponse<AvatarSettingsData>
      if (responseBody?.code !== 200 || !responseBody.data) {
        throw new Error(responseBody?.msg || '保存失败')
      }

      setAvatar(responseBody.data)
      setNameDraft(responseBody.data.avatarName)
      setDescriptionDraft(responseBody.data.description)
      void Taro.showToast({ title: successText, icon: 'success' })
      return true
    } catch (error) {
      void Taro.showToast({
        title: error instanceof Error ? error.message : '保存失败',
        icon: 'none',
      })
      return false
    } finally {
      setSaving(false)
    }
  }

  const openEditor = (field: EditingField) => {
    if (!avatar) return
    setNameDraft(avatar.avatarName)
    setDescriptionDraft(avatar.description)
    setEditingField(field)
    setEditorOpen(true)
  }

  const saveEditor = async () => {
    if (editingField === 'name') {
      const nextName = nameDraft.trim()
      if (!nextName) {
        void Taro.showToast({ title: '请输入分身名称', icon: 'none' })
        return
      }
      const saved = await saveUpdates({ avatarName: nextName }, '名称已保存')
      if (saved) setEditorOpen(false)
      return
    }

    if (editingField === 'description') {
      const saved = await saveUpdates({ description: descriptionDraft.trim() }, '介绍已保存')
      if (saved) setEditorOpen(false)
    }
  }

  const uploadAvatar = async () => {
    if (saving) return
    try {
      const chooseResult = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      })
      const filePath = chooseResult.tempFilePaths[0]
      if (!filePath) return

      void Taro.showLoading({ title: '上传中' })
      const uploadResult = await Network.uploadFile({
        url: '/api/upload/avatar-image',
        filePath,
        name: 'file',
      })
      const rawBody = typeof uploadResult.data === 'string'
        ? JSON.parse(uploadResult.data) as ApiResponse<{ url?: string }>
        : uploadResult.data as ApiResponse<{ url?: string }>
      const avatarUrl = rawBody?.data?.url
      if (!avatarUrl) throw new Error(rawBody?.msg || '头像上传失败')

      await saveUpdates({ avatarUrl }, '头像已更新')
    } catch (error) {
      const message = error instanceof Error ? error.message : '头像上传失败'
      if (!message.includes('cancel')) {
        void Taro.showToast({ title: message, icon: 'none' })
      }
    } finally {
      Taro.hideLoading()
    }
  }

  const togglePublicStatus = async (checked: boolean) => {
    await saveUpdates({ publicStatus: checked ? '公开' : '私有' }, checked ? '已设为公开' : '已设为私有')
  }

  const toggleOnlineStatus = async (checked: boolean) => {
    await saveUpdates({ status: checked ? '已上线' : '已下线' }, checked ? '分身已上线' : '分身已下线')
  }

  const statusLocked = avatar?.status === '已封禁'

  return (
    <View className="avs-page" style={pageStyle}>
      <View className="avs-header">
        <Button variant="ghost" size="icon" className="avs-back" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={20} color="#6D4CD8" />
        </Button>
        <Text className="avs-header-title">分身设置</Text>
        <View className="avs-header-spacer" />
      </View>

      <ScrollView scrollY className="avs-scroll">
        <View className="avs-content">
          {loading ? (
            <View className="avs-state">
              <RefreshCw size={24} color="#8B5CF6" />
              <Text className="avs-state-text">正在加载分身设置...</Text>
            </View>
          ) : !avatar ? (
            <View className="avs-state">
              <LockKeyhole size={28} color="#94A3B8" />
              <Text className="avs-state-title">无法管理该分身</Text>
              <Text className="avs-state-text">分身不存在或当前账号无权管理</Text>
            </View>
          ) : (
            <>
              <Card className="avs-card">
                <CardContent className="avs-card-content">
                  <Button variant="ghost" className="avs-setting-row avs-avatar-row" onClick={() => void uploadAvatar()}>
                    <View className="avs-row-icon is-avatar"><Camera size={18} color="#7C3AED" /></View>
                    <View className="avs-row-copy">
                      <Text className="avs-row-title">分身头像</Text>
                      <Text className="avs-row-subtitle">展示你的分身形象</Text>
                    </View>
                    <View className="avs-avatar-wrap">
                      {avatar.avatarUrl ? (
                        <Image src={avatar.avatarUrl} mode="aspectFill" className="avs-avatar-image" />
                      ) : (
                        <View className="avs-avatar-empty"><Sparkles size={24} color="#8B5CF6" /></View>
                      )}
                      <View className="avs-camera-badge"><Camera size={12} color="#FFFFFF" /></View>
                    </View>
                    <ChevronRight size={18} color="#C4B5E8" />
                  </Button>
                </CardContent>
              </Card>

              <Card className="avs-card">
                <CardContent className="avs-card-content">
                  <Button variant="ghost" className="avs-setting-row" onClick={() => openEditor('name')}>
                    <View className="avs-row-icon"><Type size={18} color="#7C3AED" /></View>
                    <View className="avs-row-copy">
                      <Text className="avs-row-title">分身名称</Text>
                      <Text className="avs-row-subtitle">给你的分身起个名字</Text>
                    </View>
                    <Text className="avs-row-value">{avatar.avatarName}</Text>
                    <PenLine size={16} color="#8B5CF6" />
                  </Button>
                </CardContent>
              </Card>

              <Card className="avs-card">
                <CardContent className="avs-card-content avs-description-content">
                  <Button variant="ghost" className="avs-setting-row" onClick={() => openEditor('description')}>
                    <View className="avs-row-icon"><FileText size={18} color="#7C3AED" /></View>
                    <View className="avs-row-copy">
                      <Text className="avs-row-title">分身介绍</Text>
                      <Text className="avs-row-subtitle">介绍你的分身特点和擅长领域</Text>
                    </View>
                    <ChevronRight size={18} color="#C4B5E8" />
                  </Button>
                  <View className="avs-description-box" onClick={() => openEditor('description')}>
                    <Text className="avs-description-text">{avatar.description || '点击添加分身介绍'}</Text>
                    <Text className="avs-count">{avatar.description.length}/500</Text>
                  </View>
                </CardContent>
              </Card>

              <Card className="avs-card">
                <CardContent className="avs-card-content avs-skill-content">
                  <View className="avs-section-heading">
                    <View className="avs-row-icon"><HeartPulse size={18} color="#7C3AED" /></View>
                    <View className="avs-row-copy">
                      <Text className="avs-row-title">技能详情</Text>
                      <Text className="avs-row-subtitle">每个分身仅可绑定 1 个技能</Text>
                    </View>
                  </View>
                  <View className="avs-skill-box">
                    <View className="avs-skill-icon"><HeartPulse size={24} color="#22C55E" /></View>
                    <View className="avs-skill-copy">
                      <View className="avs-skill-title-row">
                        <Text className="avs-skill-title">治愈文案创作</Text>
                        <Badge variant="secondary" className="avs-skill-badge"><Text>插件技能</Text></Badge>
                      </View>
                      <Text className="avs-skill-description">擅长情感文案、治愈系文案创作，帮你输出温暖内容。</Text>
                    </View>
                    <ChevronRight size={18} color="#C4B5E8" />
                  </View>
                  <View className="avs-skill-static">
                    <RefreshCw size={14} color="#8B5CF6" />
                    <Text>更换技能（暂未开放）</Text>
                  </View>
                </CardContent>
              </Card>

              <Card className="avs-card avs-toggle-card">
                <CardContent className="avs-card-content">
                  <View className="avs-toggle-row">
                    <View className="avs-row-icon"><Globe size={18} color="#7C3AED" /></View>
                    <View className="avs-row-copy">
                      <Text className="avs-row-title">是否公开</Text>
                      <Text className="avs-row-subtitle">公开后其他用户可以查看和使用</Text>
                    </View>
                    <Text className="avs-toggle-value">{avatar.publicStatus}</Text>
                    <Switch
                      className="avs-switch"
                      checked={avatar.publicStatus === '公开'}
                      disabled={saving}
                      onCheckedChange={checked => void togglePublicStatus(checked)}
                    />
                  </View>
                </CardContent>
              </Card>

              <Card className={`avs-card avs-toggle-card${statusLocked ? ' is-locked' : ''}`}>
                <CardContent className="avs-card-content">
                  <View className="avs-toggle-row">
                    <View className="avs-row-icon"><Power size={18} color={statusLocked ? '#94A3B8' : '#7C3AED'} /></View>
                    <View className="avs-row-copy">
                      <Text className="avs-row-title">上线状态</Text>
                      <Text className="avs-row-subtitle">
                        {statusLocked ? '该分身已被封禁，无法修改上线状态' : '关闭后，分身将不会被他人使用'}
                      </Text>
                    </View>
                    <Text className="avs-toggle-value">{avatar.status}</Text>
                    <Switch
                      className="avs-switch"
                      checked={avatar.status === '已上线'}
                      disabled={saving || statusLocked}
                      onCheckedChange={checked => void toggleOnlineStatus(checked)}
                    />
                  </View>
                </CardContent>
              </Card>
            </>
          )}
        </View>
      </ScrollView>

      <Dialog open={editorOpen} onOpenChange={open => { if (!saving) setEditorOpen(open) }}>
        <DialogContent className="avs-dialog" overlayClassName="avs-dialog-overlay">
          <DialogHeader>
            <DialogTitle className="avs-dialog-title">
              <Text>{editingField === 'name' ? '修改分身名称' : '修改分身介绍'}</Text>
            </DialogTitle>
          </DialogHeader>
          {editingField === 'name' ? (
            <View className="avs-field-wrap">
              <Input
                value={nameDraft}
                className="avs-input"
                maxlength={50}
                placeholder="请输入分身名称"
                onInput={event => setNameDraft(event.detail.value)}
              />
              <Text className="avs-field-count">{nameDraft.length}/50</Text>
            </View>
          ) : (
            <View className="avs-field-wrap is-textarea">
              <Textarea
                value={descriptionDraft}
                className="avs-textarea"
                maxlength={500}
                placeholder="请输入分身介绍"
                onInput={event => setDescriptionDraft(event.detail.value)}
              />
              <Text className="avs-field-count">{descriptionDraft.length}/500</Text>
            </View>
          )}
          <View className="avs-dialog-actions">
            <Button variant="outline" className="avs-dialog-button" disabled={saving} onClick={() => setEditorOpen(false)}>
              <Text>取消</Text>
            </Button>
            <Button className="avs-dialog-button is-primary" disabled={saving} onClick={() => void saveEditor()}>
              <Text>{saving ? '保存中...' : '保存'}</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  )
}