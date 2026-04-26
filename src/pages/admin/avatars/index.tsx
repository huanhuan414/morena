import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import Taro from '@tarojs/taro'
import { Search, Eye, Ban, MessageSquare } from 'lucide-react-taro'
import AdminLayout from '@/components/admin/Layout'
import * as Network from '@/network'
import './index.css'

interface Avatar {
  id: string
  name: string
  avatar_url?: string
  description?: string
  status: 'active' | 'banned' | 'pending_review'
  user_id: string
  user_phone?: string
  created_at: string
  is_public: boolean
  price: number
  order_count: number
  rating: number
}

export default function AvatarManagement() {
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [total, setTotal] = useState(0)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page] = useState(1)

  useEffect(() => {
    fetchAvatars()
  }, [page, searchKeyword, statusFilter])

  const fetchAvatars = async () => {
    try {
      const res = await Network.request({
        url: '/api/admin/avatars',
        data: { 
          page, 
          limit: 20, 
          keyword: searchKeyword,
          status: statusFilter === 'all' ? undefined : statusFilter
        }
      })
      
      if (res.data.code === 200) {
        setAvatars(res.data.data.list)
        setTotal(res.data.data.total)
      }
    } catch (err) {
      console.error('获取分身列表失败:', err)
    }
  }

  const handleToggleStatus = async (avatarId: string, currentStatus: string) => {
    const action = currentStatus === 'active' ? '下架' : '上架'
    
    Taro.showModal({
      title: `确认${action}`,
      content: `确定要${action}该分身吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await Network.request({
              url: '/api/admin/avatars/toggle-status',
              method: 'POST',
              data: { 
                avatar_id: avatarId, 
                status: currentStatus === 'active' ? 'banned' : 'active'
              }
            })
            
            if (result.data.code === 200) {
              Taro.showToast({ title: `${action}成功`, icon: 'success' })
              fetchAvatars()
            }
          } catch (err) {
            Taro.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  }

  const handleViewDetail = (avatarId: string) => {
    Taro.navigateTo({ url: `/pages/admin/avatars/detail?id=${avatarId}` })
  }

  const handleViewChats = (avatarId: string) => {
    Taro.navigateTo({ url: `/pages/admin/avatars/chats?avatar_id=${avatarId}` })
  }

  const statusOptions = [
    { key: 'all', label: '全部' },
    { key: 'active', label: '正常' },
    { key: 'pending_review', label: '待审核' },
    { key: 'banned', label: '已下架' }
  ]

  return (
    <AdminLayout title="分身管理">
      <View className="avatars-page">
        {/* 搜索和筛选 */}
        <View className="page-header">
          <View className="search-box">
            <Search size={18} color="#9ca3af" />
            <Input
              className="search-input"
              placeholder="搜索分身名称/用户"
              value={searchKeyword}
              onInput={(e: any) => setSearchKeyword(e.detail?.value || '')}
              onConfirm={fetchAvatars}
            />
          </View>
          <View className="header-stats">
            <Text className="stat-text">共 {total} 个分身</Text>
          </View>
        </View>

        {/* 状态筛选 */}
        <View className="filter-tabs">
          {statusOptions.map(option => (
            <View 
              key={option.key}
              className={`filter-tab ${statusFilter === option.key ? 'active' : ''}`}
              onClick={() => setStatusFilter(option.key)}
            >
              <Text className="filter-tab-text">{option.label}</Text>
            </View>
          ))}
        </View>

        {/* 分身列表 */}
        <View className="data-table">
          <View className="table-header">
            <Text className="th col-avatar">分身信息</Text>
            <Text className="th col-user">所属用户</Text>
            <Text className="th col-price">价格</Text>
            <Text className="th col-stats">订单/评分</Text>
            <Text className="th col-status">状态</Text>
            <Text className="th col-date">创建时间</Text>
            <Text className="th col-action">操作</Text>
          </View>
          
          <ScrollView className="table-body" scrollY>
            {avatars.map(avatar => (
              <View key={avatar.id} className="table-row">
                <View className="td col-avatar">
                  <View className="avatar-info">
                    {avatar.avatar_url ? (
                      <Image src={avatar.avatar_url} className="avatar-img-sm" mode="aspectFill" />
                    ) : (
                      <View className="avatar-placeholder-sm">
                        <Text className="avatar-text-sm">{avatar.name?.[0] || 'A'}</Text>
                      </View>
                    )}
                    <View className="avatar-meta">
                      <Text className="avatar-name">{avatar.name}</Text>
                      {avatar.is_public && <Text className="public-tag">公开</Text>}
                    </View>
                  </View>
                </View>
                <Text className="td col-user">{avatar.user_phone || '-'}</Text>
                <Text className="td col-price">¥{avatar.price || 0}</Text>
                <Text className="td col-stats">{avatar.order_count}单 / {avatar.rating}分</Text>
                <View className="td col-status">
                  <View className={`status-badge ${avatar.status}`}>
                    <Text className="status-text">
                      {avatar.status === 'active' ? '正常' : 
                       avatar.status === 'pending_review' ? '待审核' : '已下架'}
                    </Text>
                  </View>
                </View>
                <Text className="td col-date">{new Date(avatar.created_at).toLocaleDateString('zh-CN')}</Text>
                <View className="td col-action">
                  <View className="action-btns">
                    <View className="action-btn view" onClick={() => handleViewDetail(avatar.id)}>
                      <Eye size={16} color="#3b82f6" />
                    </View>
                    <View className="action-btn chat" onClick={() => handleViewChats(avatar.id)}>
                      <MessageSquare size={16} color="#8b5cf6" />
                    </View>
                    <View 
                      className={`action-btn ${avatar.status === 'active' ? 'ban' : 'unban'}`}
                      onClick={() => handleToggleStatus(avatar.id, avatar.status)}
                    >
                      {avatar.status === 'active' ? (
                        <Ban size={16} color="#ef4444" />
                      ) : (
                        <Text style={{ color: '#10b981', fontSize: '16px' }}>✓</Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </AdminLayout>
  )
}
