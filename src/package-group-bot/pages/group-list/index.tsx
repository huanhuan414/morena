import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Plus,
  Users,
  Wifi,
  WifiOff,
  Building2,
  MessageCircle,
} from 'lucide-react-taro'
import { Network } from '@/network'
import './index.css'

interface GroupInfo {
  id: string
  avatarId: string
  avatarName: string
  avatarImage: string
  groupName: string
  platform: 'wecom' | 'feishu'
  status: 'active' | 'paused'
  memberCount: number
  todayMessages: number
  todayReplies: number
  lastMessageAt: string
  lastMessagePreview: string
}

const PLATFORM_MAP = {
  wecom: { name: '企业微信', color: '#07c160', bgColor: '#f0faf3' },
  feishu: { name: '飞书', color: '#3370ff', bgColor: '#eef3ff' },
}

const GroupList = () => {
  const router = Taro.getCurrentInstance().router
  const avatarId = router?.params?.avatarId || ''
  const avatarName = decodeURIComponent(router?.params?.avatarName || '')
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addForm, setAddForm] = useState({
    groupName: '',
    platform: 'feishu' as 'wecom' | 'feishu',
    webhookUrl: '',
  })

  useDidShow(() => {
    loadGroups()
  })

  const loadGroups = async () => {
    try {
      setLoading(true)
      const res = await Network.request({
        url: '/api/group-bot/groups',
        method: 'GET',
      })
      console.log('[group-list] loadGroups response:', res.data)
      if (res.data?.code === 200 && res.data?.data) {
        setGroups(res.data.data)
      }
    } catch (err) {
      console.error('[group-list] loadGroups error:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleGroupStatus = async (groupId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    try {
      const res = await Network.request({
        url: `/api/group-bot/groups/${groupId}/status`,
        method: 'POST',
        data: { status: newStatus },
      })
      console.log('[group-list] toggleStatus response:', res.data)
      if (res.data?.code === 200) {
        setGroups(prev =>
          prev.map(g => (g.id === groupId ? { ...g, status: newStatus as 'active' | 'paused' } : g))
        )
      }
    } catch (err) {
      console.error('[group-list] toggleStatus error:', err)
    }
  }

  const handleAddGroup = async () => {
    if (!addForm.groupName) return
    try {
      const res = await Network.request({
        url: '/api/group-bot/groups',
        method: 'POST',
        data: { ...addForm, avatarId, avatarName },
      })
      console.log('[group-list] addGroup response:', res.data)
      if (res.data?.code === 200) {
        setShowAddDialog(false)
        setAddForm({ groupName: '', platform: 'feishu', webhookUrl: '' })
        loadGroups()
      }
    } catch (err) {
      console.error('[group-list] addGroup error:', err)
    }
  }

  const goToGroupChat = (groupId: string) => {
    Taro.navigateTo({
      url: `/package-group-bot/pages/group-chat/index?groupId=${groupId}`,
    })
  }

  const getPlatformInfo = (platform: string) => {
    return PLATFORM_MAP[platform] || { name: '未知', color: '#999', bgColor: '#f5f5f5' }
  }

  return (
    <View className="bot-list-page">
      {/* 顶部 */}
      <View className="bot-header">
        <View className="bot-header-back" onClick={() => Taro.navigateBack()}>
          <Text className="bot-header-back-text">←</Text>
        </View>
        <Text className="bot-header-title">{avatarName ? `${avatarName} · 群聊值守` : '群聊值守'}</Text>
        <View className="bot-header-action" onClick={() => setShowAddDialog(true)}>
          <Plus size={20} color="#fff" />
        </View>
      </View>

      {/* 统计概览 */}
      <View className="bot-stats">
        <View className="bot-stat-item">
          <Text className="bot-stat-value">{groups.filter(g => g.status === 'active').length}</Text>
          <Text className="bot-stat-label">值守中</Text>
        </View>
        <View className="bot-stat-divider" />
        <View className="bot-stat-item">
          <Text className="bot-stat-value bot-stat-blue">
            {groups.reduce((sum, g) => sum + g.todayMessages, 0)}
          </Text>
          <Text className="bot-stat-label">今日消息</Text>
        </View>
        <View className="bot-stat-divider" />
        <View className="bot-stat-item">
          <Text className="bot-stat-value bot-stat-green">
            {groups.reduce((sum, g) => sum + g.todayReplies, 0)}
          </Text>
          <Text className="bot-stat-label">分身回复</Text>
        </View>
      </View>

      {/* 群列表 */}
      <View className="bot-section">
        <Text className="bot-section-title">我的群</Text>

        {loading ? (
          <View className="bot-empty">
            <Text className="bot-empty-text">加载中...</Text>
          </View>
        ) : groups.length === 0 ? (
          <View className="bot-empty">
            <Users size={48} color="#d1d5db" />
            <Text className="bot-empty-title">还没有接入任何群</Text>
            <Text className="bot-empty-desc">添加飞书群，让分身帮你值守</Text>
            <View className="bot-empty-btn">
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <Text>添加群</Text>
              </Button>
            </View>
          </View>
        ) : (
          groups.map(group => {
            const platformInfo = getPlatformInfo(group.platform)
            return (
              <View
                key={group.id}
                className="bot-card"
                onClick={() => goToGroupChat(group.id)}
              >
                {/* 卡片顶部：群信息 + 开关 */}
                <View className="bot-card-top">
                  <View className="bot-card-left">
                    {/* 平台图标 */}
                    <View
                      className="bot-card-icon"
                      style={{ backgroundColor: platformInfo.bgColor }}
                    >
                      <Building2 size={22} color={platformInfo.color} />
                    </View>
                    {/* 群名+标签 */}
                    <View className="bot-card-info">
                      <View className="bot-card-name-row">
                        <Text className="bot-card-name">{group.groupName}</Text>
                        <Badge
                          variant="outline"
                          style={{ borderColor: platformInfo.color, color: platformInfo.color, marginLeft: '8rpx' }}
                        >
                          <Text className="bot-card-badge-text">{platformInfo.name}</Text>
                        </Badge>
                      </View>
                      <View className="bot-card-meta">
                        <Text className="bot-card-meta-text">{group.avatarName} 值守</Text>
                        <Text className="bot-card-meta-dot">·</Text>
                        <Text className="bot-card-meta-text">{group.memberCount}人</Text>
                      </View>
                    </View>
                  </View>
                  {/* 开关 */}
                  <View className="bot-card-switch" onClick={(e) => { e.stopPropagation(); toggleGroupStatus(group.id, group.status) }}>
                    <Switch checked={group.status === 'active'} onCheckedChange={() => toggleGroupStatus(group.id, group.status)} />
                  </View>
                </View>

                {/* 状态条 */}
                <View className="bot-card-status">
                  {group.status === 'active' ? (
                    <View className="bot-card-status-active">
                      <Wifi size={12} color="#22c55e" />
                      <Text className="bot-card-status-text-active">值守中</Text>
                    </View>
                  ) : (
                    <View className="bot-card-status-paused">
                      <WifiOff size={12} color="#9ca3af" />
                      <Text className="bot-card-status-text-paused">已暂停</Text>
                    </View>
                  )}
                  {group.lastMessagePreview && (
                    <Text className="bot-card-last-msg">{group.lastMessagePreview}</Text>
                  )}
                </View>

                {/* 统计条 */}
                {group.status === 'active' && (
                  <View className="bot-card-stats">
                    <View className="bot-card-stat">
                      <MessageCircle size={14} color="#9ca3af" />
                      <Text className="bot-card-stat-text">消息 {group.todayMessages}</Text>
                    </View>
                    <View className="bot-card-stat">
                      <MessageCircle size={14} color="#22c55e" />
                      <Text className="bot-card-stat-text bot-card-stat-green">回复 {group.todayReplies}</Text>
                    </View>
                  </View>
                )}
              </View>
            )
          })
        )}
      </View>

      {/* 接入说明 */}
      <View className="bot-section">
        <Text className="bot-section-title">如何接入</Text>
        <View className="bot-guide">
          <View className="bot-guide-step">
            <Text className="bot-guide-num">1</Text>
            <Text className="bot-guide-text">飞书开放平台 → 创建企业自建应用 → 开启机器人能力</Text>
          </View>
          <View className="bot-guide-step">
            <Text className="bot-guide-num">2</Text>
            <Text className="bot-guide-text">开通消息权限，选择「长连接接收事件」，添加 im.message.receive_v1</Text>
          </View>
          <View className="bot-guide-step">
            <Text className="bot-guide-num">3</Text>
            <Text className="bot-guide-text">发布应用后，将机器人添加到飞书群</Text>
          </View>
          <View className="bot-guide-step">
            <Text className="bot-guide-num">4</Text>
            <Text className="bot-guide-text">群里@分身，分身用你的风格自动回复</Text>
          </View>
        </View>
      </View>

      {/* 添加群对话框 */}
      {showAddDialog && (
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <View className="bot-dialog">
            <Text className="bot-dialog-title">添加群</Text>

            <View className="bot-dialog-field">
              <Text className="bot-dialog-label">平台</Text>
              <View className="bot-dialog-platform">
                <View
                  className={`bot-dialog-platform-item ${addForm.platform === 'wecom' ? 'bot-dialog-platform-active-wecom' : 'bot-dialog-platform-inactive'}`}
                  onClick={() => setAddForm(prev => ({ ...prev, platform: 'wecom' }))}
                >
                  <Text className={`bot-dialog-platform-text ${addForm.platform === 'wecom' ? 'bot-dialog-platform-text-active' : ''}`}>企业微信</Text>
                </View>
                <View
                  className={`bot-dialog-platform-item ${addForm.platform === 'feishu' ? 'bot-dialog-platform-active-feishu' : 'bot-dialog-platform-inactive'}`}
                  onClick={() => setAddForm(prev => ({ ...prev, platform: 'feishu' }))}
                >
                  <Text className={`bot-dialog-platform-text ${addForm.platform === 'feishu' ? 'bot-dialog-platform-text-active' : ''}`}>飞书</Text>
                </View>
              </View>
            </View>

            <View className="bot-dialog-field">
              <Text className="bot-dialog-label">群名称</Text>
              <View className="bot-dialog-input-wrap">
                <Input
                  className="bot-dialog-input"
                  placeholder="输入群名称"
                  value={addForm.groupName}
                  onInput={e => setAddForm(prev => ({ ...prev, groupName: e.detail.value }))}
                />
              </View>
            </View>

            <View className="bot-dialog-field">
              <Text className="bot-dialog-label">Webhook URL（选填）</Text>
              <View className="bot-dialog-input-wrap">
                <Input
                  className="bot-dialog-input"
                  placeholder={addForm.platform === 'wecom' ? '企业微信Webhook地址' : '飞书事件回调URL'}
                  value={addForm.webhookUrl}
                  onInput={e => setAddForm(prev => ({ ...prev, webhookUrl: e.detail.value }))}
                />
              </View>
              <Text className="bot-dialog-hint">
                飞书使用长连接，无需填写Webhook
              </Text>
            </View>

            <View className="bot-dialog-actions">
              <View className="bot-dialog-action-btn">
                <Button variant="outline" className="w-full" onClick={() => setShowAddDialog(false)}>
                  <Text>取消</Text>
                </Button>
              </View>
              <View className="bot-dialog-action-btn">
                <Button className="w-full" onClick={handleAddGroup}>
                  <Text>添加</Text>
                </Button>
              </View>
            </View>
          </View>
        </Dialog>
      )}
    </View>
  )
}

export default GroupList
