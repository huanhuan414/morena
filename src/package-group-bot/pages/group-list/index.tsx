import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
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
  ChevronRight,
  Building2,
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
  wecom: { name: '企业微信', color: '#07c160' },
  feishu: { name: '飞书', color: '#3370ff' },
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
    platform: 'wecom' as 'wecom' | 'feishu',
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
        method: 'PUT',
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
    if (!addForm.groupName || !addForm.webhookUrl) return
    try {
      const res = await Network.request({
        url: '/api/group-bot/groups',
        method: 'POST',
        data: { ...addForm, avatarId, avatarName },
      })
      console.log('[group-list] addGroup response:', res.data)
      if (res.data?.code === 200) {
        setShowAddDialog(false)
        setAddForm({ groupName: '', platform: 'wecom', webhookUrl: '' })
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
    return PLATFORM_MAP[platform] || { name: '未知', color: '#999' }
  }

  const formatTime = (timeStr: string) => {
    if (!timeStr) return ''
    const date = new Date(timeStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    return `${Math.floor(diff / 86400000)}天前`
  }

  return (
    <View className="bot-list-page">
      <PageHeader title={avatarName ? `${avatarName} · 群聊值守` : '群聊值守'} showBack background="#f8fafc" />

      <ScrollView scrollY className="bot-list-scroll">
        {/* 统计概览 */}
        <View className="px-4 pt-4 pb-2">
          <View className="flex flex-row gap-3">
            <View className="flex-1 bg-white rounded-xl p-3 shadow-sm">
              <Text className="block text-xs text-gray-400">值守群数</Text>
              <Text className="block text-2xl font-bold text-gray-800 mt-1">{groups.length}</Text>
            </View>
            <View className="flex-1 bg-white rounded-xl p-3 shadow-sm">
              <Text className="block text-xs text-gray-400">今日消息</Text>
              <Text className="block text-2xl font-bold text-blue-600 mt-1">
                {groups.reduce((sum, g) => sum + g.todayMessages, 0)}
              </Text>
            </View>
            <View className="flex-1 bg-white rounded-xl p-3 shadow-sm">
              <Text className="block text-xs text-gray-400">分身回复</Text>
              <Text className="block text-2xl font-bold text-green-600 mt-1">
                {groups.reduce((sum, g) => sum + g.todayReplies, 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* 群列表 */}
        <View className="px-4 pt-2 pb-4">
          <View className="flex flex-row items-center justify-between mb-3">
            <Text className="block text-sm font-semibold text-gray-700">我的群</Text>
            <View onClick={() => setShowAddDialog(true)}>
              <View className="flex flex-row items-center">
                <Plus size={16} color="#3b82f6" />
                <Text className="block text-sm text-blue-500 ml-1">添加群</Text>
              </View>
            </View>
          </View>

          {loading ? (
            <View className="flex items-center justify-center py-12">
              <Text className="block text-gray-400">加载中...</Text>
            </View>
          ) : groups.length === 0 ? (
            <View className="flex items-center justify-center py-12">
              <View className="text-center">
                <Users size={48} color="#d1d5db" className="mx-auto" />
                <Text className="block text-gray-400 mt-3">还没有接入任何群</Text>
                <Text className="block text-gray-300 text-sm mt-1">添加企业微信群或飞书群，让分身帮你值守</Text>
                <View className="mt-4 mx-auto" style={{ width: '160px' }}>
                  <Button size="sm" onClick={() => setShowAddDialog(true)}>
                    <Text>添加群</Text>
                  </Button>
                </View>
              </View>
            </View>
          ) : (
            groups.map(group => {
              const platformInfo = getPlatformInfo(group.platform)
              return (
                <View key={group.id} className="mb-3" onClick={() => goToGroupChat(group.id)}>
                  <Card>
                    <CardContent className="p-4">
                      <View className="flex flex-row items-center">
                        {/* 群头像 */}
                        <View
                          className="w-12 h-12 rounded-xl flex items-center justify-center mr-3"
                          style={{ backgroundColor: platformInfo.color + '15' }}
                        >
                          <Building2 size={24} color={platformInfo.color} />
                        </View>

                        {/* 群信息 */}
                        <View className="flex-1">
                          <View className="flex flex-row items-center">
                            <Text className="block font-semibold text-gray-800">{group.groupName}</Text>
                            <Badge
                              variant="outline"
                              className="ml-2"
                              style={{ borderColor: platformInfo.color, color: platformInfo.color }}
                            >
                              <Text className="text-xs">{platformInfo.name}</Text>
                            </Badge>
                          </View>
                          <View className="flex flex-row items-center mt-1">
                            <Text className="block text-xs text-gray-400">
                              {group.avatarName} 值守
                            </Text>
                            <Text className="block text-xs text-gray-300 mx-2">|</Text>
                            <Text className="block text-xs text-gray-400">
                              {group.memberCount}人
                            </Text>
                          </View>
                          {group.lastMessagePreview && (
                            <Text className="block text-xs text-gray-400 mt-1 truncate">
                              {group.lastMessagePreview}
                            </Text>
                          )}
                        </View>

                        {/* 右侧状态 */}
                        <View className="flex flex-col items-end">
                          <View className="flex flex-row items-center mb-2">
                            <Switch
                              checked={group.status === 'active'}
                              onCheckedChange={() => toggleGroupStatus(group.id, group.status)}
                            />
                          </View>
                          <View className="flex flex-row items-center">
                            {group.status === 'active' ? (
                              <Wifi size={12} color="#22c55e" />
                            ) : (
                              <WifiOff size={12} color="#d1d5db" />
                            )}
                            <Text
                              className="block text-xs ml-1"
                              style={{ color: group.status === 'active' ? '#22c55e' : '#d1d5db' }}
                            >
                              {group.status === 'active' ? '值守中' : '已暂停'}
                            </Text>
                          </View>
                          <Text className="block text-xs text-gray-300 mt-1">
                            {formatTime(group.lastMessageAt)}
                          </Text>
                        </View>
                      </View>

                      {/* 今日统计条 */}
                      {group.status === 'active' && (
                        <View className="flex flex-row mt-3 pt-3 border-t border-gray-100">
                          <View className="flex-1">
                            <Text className="block text-xs text-gray-400">今日消息</Text>
                            <Text className="block text-sm font-semibold text-gray-700">
                              {group.todayMessages}
                            </Text>
                          </View>
                          <View className="flex-1">
                            <Text className="block text-xs text-gray-400">分身回复</Text>
                            <Text className="block text-sm font-semibold text-green-600">
                              {group.todayReplies}
                            </Text>
                          </View>
                          <View className="flex-1">
                            <Text className="block text-xs text-gray-400">回复率</Text>
                            <Text className="block text-sm font-semibold text-blue-600">
                              {group.todayMessages > 0
                                ? Math.round((group.todayReplies / group.todayMessages) * 100)
                                : 0}
                              %
                            </Text>
                          </View>
                          <View className="flex items-center">
                            <ChevronRight size={16} color="#d1d5db" />
                          </View>
                        </View>
                      )}
                    </CardContent>
                  </Card>
                </View>
              )
            })
          )}
        </View>

        {/* 接入说明 */}
        <View className="px-4 pb-8">
          <Card>
            <CardContent className="p-4">
              <Text className="block text-sm font-semibold text-gray-700 mb-2">如何接入</Text>
              <View className="mb-2">
                <View className="flex flex-row items-start">
                  <Text className="block text-xs text-blue-500 font-bold mr-2">1</Text>
                  <Text className="block text-xs text-gray-500">企业微信管理后台 → 应用管理 → 创建自建应用</Text>
                </View>
              </View>
              <View className="mb-2">
                <View className="flex flex-row items-start">
                  <Text className="block text-xs text-blue-500 font-bold mr-2">2</Text>
                  <Text className="block text-xs text-gray-500">配置接收消息回调URL，指向平台提供的Webhook地址</Text>
                </View>
              </View>
              <View className="mb-2">
                <View className="flex flex-row items-start">
                  <Text className="block text-xs text-blue-500 font-bold mr-2">3</Text>
                  <Text className="block text-xs text-gray-500">将应用添加到目标群聊，分身即可开始值守</Text>
                </View>
              </View>
              <View>
                <View className="flex flex-row items-start">
                  <Text className="block text-xs text-blue-500 font-bold mr-2">4</Text>
                  <Text className="block text-xs text-gray-500">在群里@分身，分身用你的风格自动回复</Text>
                </View>
              </View>
            </CardContent>
          </Card>
        </View>
      </ScrollView>

      {/* 添加群对话框 */}
      {showAddDialog && (
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <View className="p-6">
            <Text className="block text-lg font-bold text-gray-800 mb-4">添加群</Text>

            <View className="mb-4">
              <Text className="block text-sm text-gray-600 mb-2">平台</Text>
              <View className="flex flex-row gap-3">
                <View
                  className={`flex-1 rounded-xl p-3 border-2 ${
                    addForm.platform === 'wecom' ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}
                  onClick={() => setAddForm(prev => ({ ...prev, platform: 'wecom' }))}
                >
                  <Text
                    className="block text-center text-sm font-semibold"
                    style={{ color: addForm.platform === 'wecom' ? '#07c160' : '#9ca3af' }}
                  >
                    企业微信
                  </Text>
                </View>
                <View
                  className={`flex-1 rounded-xl p-3 border-2 ${
                    addForm.platform === 'feishu' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                  onClick={() => setAddForm(prev => ({ ...prev, platform: 'feishu' }))}
                >
                  <Text
                    className="block text-center text-sm font-semibold"
                    style={{ color: addForm.platform === 'feishu' ? '#3370ff' : '#9ca3af' }}
                  >
                    飞书
                  </Text>
                </View>
              </View>
            </View>

            <View className="mb-4">
              <Text className="block text-sm text-gray-600 mb-2">群名称</Text>
              <View className="bg-gray-50 rounded-xl px-4 py-3">
                <Input
                  className="w-full bg-transparent"
                  placeholder="输入群名称"
                  value={addForm.groupName}
                  onInput={e => setAddForm(prev => ({ ...prev, groupName: e.detail.value }))}
                />
              </View>
            </View>

            <View className="mb-6">
              <Text className="block text-sm text-gray-600 mb-2">Webhook URL</Text>
              <View className="bg-gray-50 rounded-xl px-4 py-3">
                <Input
                  className="w-full bg-transparent"
                  placeholder={addForm.platform === 'wecom' ? '企业微信Webhook地址' : '飞书事件回调URL'}
                  value={addForm.webhookUrl}
                  onInput={e => setAddForm(prev => ({ ...prev, webhookUrl: e.detail.value }))}
                />
              </View>
              <Text className="block text-xs text-gray-400 mt-1">
                在{addForm.platform === 'wecom' ? '企业微信管理后台' : '飞书开放平台'}获取
              </Text>
            </View>

            <View className="flex flex-row gap-3">
              <View className="flex-1">
                <Button variant="outline" className="w-full" onClick={() => setShowAddDialog(false)}>
                  <Text>取消</Text>
                </Button>
              </View>
              <View className="flex-1">
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
