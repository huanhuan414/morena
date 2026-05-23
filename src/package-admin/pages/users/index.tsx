import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import Taro from '@tarojs/taro'
import { Search, Eye, Ban } from 'lucide-react-taro'
import AdminLayout from '@/components/admin/Layout'
import { Network } from '@/network'
import './index.css'

interface User {
  id: string
  phone: string
  nickname: string
  avatar?: string
  status: 'active' | 'banned'
  created_at: string
  balance: number
  avatar_count: number
  order_count: number
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [page] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetchUsers()
  }, [page, searchKeyword])

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchKeyword((prev) => (prev === searchInput ? prev : searchInput))
    }, 300)
    return () => {
      clearTimeout(timer)
    }
  }, [searchInput])

  const fetchUsers = async (keyword?: string) => {
    try {
      const kw = keyword ?? searchKeyword
      const res = await Network.request({
        url: '/api/admin/users',
        data: { page, limit: 20, keyword: kw },
        dedupKey: `admin/users?page=${page}&limit=20&keyword=${kw}`,
      })
      
      if (res.data.code === 200) {
        setUsers(res.data.data.list)
        setTotal(res.data.data.total)
      }
    } catch (err) {
      console.error('获取用户列表失败:', err)
    }
  }

  const handleBanUser = async (userId: string, currentStatus: string) => {
    const action = currentStatus === 'active' ? '禁用' : '解禁'
    
    Taro.showModal({
      title: `确认${action}`,
      content: `确定要${action}该用户吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await Network.request({
              url: '/api/admin/users/ban',
              method: 'POST',
              data: { 
                user_id: userId, 
                action: currentStatus === 'active' ? 'ban' : 'unban' 
              }
            })
            
            if (result.data.code === 200) {
              Taro.showToast({ title: `${action}成功`, icon: 'success' })
              fetchUsers()
            }
          } catch (err) {
            Taro.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  }

  const handleViewDetail = (userId: string) => {
    Taro.navigateTo({ url: `/package-admin/pages/users/detail/index?id=${userId}` })
  }

  const handlePageChange = (newPage: number) => {
    if (newPage < 1) return
    Taro.navigateTo({ url: `/package-admin/pages/users/index?page=${newPage}` })
  }

  return (
    <AdminLayout title="用户管理">
      <View className="users-page">
        {/* 搜索栏 */}
        <View className="page-header">
          <View className="search-box">
            <Search size={18} color="#9ca3af" />
            <Input
              className="search-input"
              placeholder="搜索用户手机号/昵称"
              value={searchInput}
              onInput={(e) => setSearchInput(e.detail.value)}
              onConfirm={() => {
                setSearchKeyword(searchInput)
                fetchUsers(searchInput)
              }}
            />
          </View>
          <View className="header-stats">
            <Text className="stat-text">共 {total} 位用户</Text>
          </View>
        </View>

        {/* 用户列表 */}
        <View className="data-table">
          <View className="table-header">
            <Text className="th col-user">用户信息</Text>
            <Text className="th col-phone">手机号</Text>
            <Text className="th col-stats">分身/订单</Text>
            <Text className="th col-balance">余额</Text>
            <Text className="th col-status">状态</Text>
            <Text className="th col-date">注册时间</Text>
            <Text className="th col-action">操作</Text>
          </View>
          
          <ScrollView className="table-body" scrollY>
            {users.map(user => (
              <View key={user.id} className="table-row">
                <View className="td col-user">
                  <View className="user-info">
                    {user.avatar ? (
                      <Image src={user.avatar} className="user-avatar-sm" mode="aspectFill" />
                    ) : (
                      <View className="avatar-placeholder-sm">
                        <Text className="avatar-text-sm">{user.nickname?.[0] || 'U'}</Text>
                      </View>
                    )}
                    <Text className="user-nickname">{user.nickname || '未设置昵称'}</Text>
                  </View>
                </View>
                <Text className="td col-phone">{user.phone}</Text>
                <Text className="td col-stats">{user.avatar_count || 0} / {user.order_count || 0}</Text>
                <Text className="td col-balance">¥{(user.balance || 0).toFixed(2)}</Text>
                <View className="td col-status">
                  <View className={`status-badge ${user.status}`}>
                    <Text className="status-text">{user.status === 'active' ? '正常' : '已禁用'}</Text>
                  </View>
                </View>
                <Text className="td col-date">{new Date(user.created_at).toLocaleDateString('zh-CN')}</Text>
                <View className="td col-action">
                  <View className="action-btns">
                    <View className="action-btn view" onClick={() => handleViewDetail(user.id)}>
                      <Eye size={16} color="#3b82f6" />
                    </View>
                    <View 
                      className={`action-btn ${user.status === 'active' ? 'ban' : 'unban'}`}
                      onClick={() => handleBanUser(user.id, user.status)}
                    >
                      {user.status === 'active' ? (
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

        {/* 分页 */}
        <View className="pagination">
          <View 
            className={`page-btn ${page === 1 ? 'disabled' : ''}`}
            onClick={() => handlePageChange(page - 1)}
          >
            <Text className="page-btn-text">上一页</Text>
          </View>
          <Text className="page-info">第 {page} 页</Text>
          <View 
            className="page-btn"
            onClick={() => handlePageChange(page + 1)}
          >
            <Text className="page-btn-text">下一页</Text>
          </View>
        </View>
      </View>
    </AdminLayout>
  )
}
