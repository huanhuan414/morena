import { View, Text, Image, ScrollView } from '@tarojs/components'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Search, Plus, Pencil, Zap, Trash2, Activity } from 'lucide-react-taro'
import { Switch } from '@/components/ui/switch'
import './index.css'

// 模拟分身数据
const mockMyAvatars = [
  { 
    id: '1', 
    name: '数字合伙人 - 晓晨',
    role: '知识博主',
    status: '在线',
    task: '正在录制《AI趋势》视频',
    income: '128.00',
    image: 'https://api.dicebear.com/7.x/personas/svg?seed=alex&backgroundColor=b6e3f4',
    color: 'emerald'
  },
  { 
    id: '2', 
    name: '虚拟导师 - 莉莎',
    role: '职场专家',
    status: '忙碌',
    task: '处理粉丝提问中 (32条)',
    income: '450.50',
    image: 'https://api.dicebear.com/7.x/personas/svg?seed=lisa&backgroundColor=ffdfbf',
    color: 'amber'
  },
  { 
    id: '3', 
    name: '带货达人 - 阿飞',
    role: '美妆主播',
    status: '离线',
    task: '暂无任务',
    income: '0.00',
    image: 'https://api.dicebear.com/7.x/personas/svg?seed=jack&backgroundColor=c0aede',
    color: 'slate'
  }
]

export default function CloneList() {
  const [avatars, setAvatars] = useState(mockMyAvatars)

  const toggleHosting = (id: string) => {
    setAvatars(avatars.map(a => 
      a.id === id ? { ...a, status: a.status === '在线' ? '离线' : '在线' } : a
    ))
  }

  return (
    <View className="clone-container">
      {/* Header & Search */}
      <View className="header-search">
        <View className="search-wrapper">
          <Search size={32} color="#9CA3AF" className="search-icon" />
          <View className="search-input">搜索分身...</View>
        </View>
        <View className="add-btn" onClick={() => Taro.navigateTo({ url: '/pages/avatar/avatar-create/index' })}>
          <Plus size={28} color="#fff" />
          <Text className="add-btn-text">新增分身</Text>
        </View>
      </View>

      {/* List */}
      <ScrollView scrollY className="clone-list">
        {avatars.map((clone) => (
          <View key={clone.id} className="clone-card">
            {/* Image & Main Info Overlay */}
            <View className="clone-image-wrapper">
              <Image src={clone.image} className="clone-image" mode="aspectFill" />
              <View className="clone-gradient" />
              
              {/* Status Badge */}
              <View className="status-badge">
                <View className={`status-dot ${clone.status === '在线' ? 'online animate-pulse' : clone.status === '忙碌' ? 'busy' : 'offline'}`} />
                <Text className="status-text">{clone.status}</Text>
              </View>

              {/* Task Label */}
              <View className="task-badge">
                <Activity size={24} color="#fff" />
                <Text className="task-text">{clone.task}</Text>
              </View>

              {/* Info Text */}
              <View className="clone-info">
                <View className="clone-info-left">
                  <Text className="clone-name">{clone.name}</Text>
                  <View className="role-badge">
                    <Text className="role-text">{clone.role}</Text>
                  </View>
                </View>
                <View className="clone-info-right">
                  <Text className="income-label">今日收益</Text>
                  <Text className="income-value">¥{clone.income}</Text>
                </View>
              </View>
            </View>

            {/* Actions */}
            <View className="clone-actions">
              <View className="action-btn">
                <Pencil size={28} color="#6366F1" />
                <Text className="action-text">形象</Text>
              </View>
              <View className="action-btn">
                <Zap size={28} color="#F59E0B" />
                <Text className="action-text">能力</Text>
              </View>
              <View className="action-btn">
                <Trash2 size={28} color="#EF4444" />
                <Text className="action-text">删除</Text>
              </View>
              <View className="hosting-toggle-wrapper">
                <Switch 
                  checked={clone.status === '在线'}
                  onCheckedChange={() => toggleHosting(clone.id)}
                  className="hosting-switch"
                />
                <Text className="toggle-label">托管</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}
