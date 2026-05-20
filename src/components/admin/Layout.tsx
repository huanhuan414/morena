import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { 
  LayoutDashboard, Users, Bot, Wrench, ShoppingCart, 
  FileText, Wallet, Share2, Settings, LogOut, Menu, X
} from 'lucide-react-taro'
import './Layout.css'
import './Layout.pc.css'

interface LayoutProps {
  children: React.ReactNode
  title?: string
}

const menuItems = [
  { key: 'dashboard', label: '指标看板', icon: LayoutDashboard, path: '/package-admin/pages/dashboard/index' },
  { key: 'users', label: '用户管理', icon: Users, path: '/package-admin/pages/users/index' },
  { key: 'avatars', label: '分身管理', icon: Bot, path: '/package-admin/pages/avatars/index' },
  { key: 'skills', label: '技能管理', icon: Wrench, path: '/package-admin/pages/skills/index' },
  { key: 'orders', label: '订单管理', icon: ShoppingCart, path: '/package-admin/pages/orders/index' },
  { key: 'content', label: '内容管理', icon: FileText, path: '/package-admin/pages/content/index' },
  { key: 'finance', label: '财务管理', icon: Wallet, path: '/package-admin/pages/finance/index' },
  { key: 'referral', label: '推广管理', icon: Share2, path: '/package-admin/pages/referral/index' },
  { key: 'settings', label: '系统设置', icon: Settings, path: '/package-admin/pages/settings/index' },
]

export default function AdminLayout({ children, title = '管理后台' }: LayoutProps) {
  const [currentPath, setCurrentPath] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [adminInfo, setAdminInfo] = useState<any>(null)

  useEffect(() => {
    // 检查登录状态
    const token = Taro.getStorageSync('admin_token')
    const info = Taro.getStorageSync('admin_info')
    
    if (!token) {
      Taro.redirectTo({ url: '/package-admin/pages/login/index' })
      return
    }
    
    setAdminInfo(info)
    
    // 获取当前路径
    const pages = Taro.getCurrentPages()
    if (pages.length > 0) {
      const current = pages[pages.length - 1]
      const route = current.route || ''
      setCurrentPath(route)
      
      // 提取当前菜单key
      const currentItem = menuItems.find(item => route.includes(item.key))
      if (currentItem) {
        setCurrentPath(currentItem.key)
      }
    }
  }, [])

  const handleMenuClick = (item: typeof menuItems[0]) => {
    if (currentPath !== item.key) {
      Taro.redirectTo({ url: item.path })
    }
  }

  const handleLogout = () => {
    Taro.showModal({
      title: '确认退出',
      content: '确定要退出管理后台吗？',
      success: (res) => {
        if (res.confirm) {
          Taro.removeStorageSync('admin_token')
          Taro.removeStorageSync('admin_info')
          Taro.redirectTo({ url: '/package-admin/pages/login/index' })
        }
      }
    })
  }

  return (
    <View className={`admin-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* 侧边栏 */}
      <View className="admin-sidebar">
        <View className="sidebar-header">
          <Text className="sidebar-logo">莫瑞娜</Text>
          <Text className="sidebar-subtitle">管理后台</Text>
        </View>
        
        <ScrollView className="sidebar-menu" scrollY>
          {menuItems.map(item => {
            const Icon = item.icon
            const isActive = currentPath === item.key
            return (
              <View
                key={item.key}
                className={`menu-item ${isActive ? 'active' : ''}`}
                onClick={() => handleMenuClick(item)}
              >
                <Icon size={20} color={isActive ? '#7B3FE4' : '#6b7280'} />
                <Text className="menu-item-text">{item.label}</Text>
              </View>
            )
          })}
        </ScrollView>
        
        <View className="sidebar-footer">
          <View className="admin-info">
            <Text className="admin-name">{adminInfo?.username || '管理员'}</Text>
            <Text className="admin-role">{adminInfo?.role || '超级管理员'}</Text>
          </View>
          <View className="logout-btn" onClick={handleLogout}>
            <LogOut size={18} color="#ef4444" />
            <Text className="logout-text">退出</Text>
          </View>
        </View>
      </View>
      
      {/* 主内容区 */}
      <View className="admin-main">
        {/* 顶部栏 */}
        <View className="admin-header">
          <View className="header-left">
            <View className="menu-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
              {sidebarCollapsed ? <Menu size={24} color="#374151" /> : <X size={24} color="#374151" />}
            </View>
            <Text className="header-title">{title}</Text>
          </View>
          <View className="header-right">
            <Text className="header-time">{new Date().toLocaleString('zh-CN')}</Text>
          </View>
        </View>
        
        {/* 页面内容 */}
        <ScrollView className="admin-content" scrollY>
          {children}
        </ScrollView>
      </View>
    </View>
  )
}
