// @ts-nocheck
import { useState, useEffect } from 'react'
import { View, Text, Image, Navigator } from '@tarojs/components'
import { Bell, Settings, Plus, ShoppingCart, Sparkles, Wrench, Package, Share2 } from 'lucide-react-taro'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import './index.css'

// 顶部通栏组件
const TopHeader = ({ userInfo, avatarStatus }) => {
  return (
    <View className="top-header">
      <View className="header-left">
        <Image
          className="avatar"
          src={userInfo?.avatar || 'https://via.placeholder.com/72'}
          mode="aspectFill"
        />
        <Text className="nickname">{userInfo?.nickname || '未登录'}</Text>
        <View className={`status-tag ${avatarStatus === 'active' ? 'active' : 'inactive'}`}>
          <Text className="status-text">{avatarStatus === 'active' ? '在线' : '离线'}</Text>
        </View>
      </View>
      <View className="header-right">
        <Bell size={24} color="#666" />
        <Navigator url="/pages/profile/settings/index" hoverClass="none">
          <Settings size={24} color="#666" />
        </Navigator>
      </View>
    </View>
  )
}

// 数据卡片组件
const DataCard = ({ title, value, hint, icon }) => {
  return (
    <View className="data-card">
      <View className="card-header">
        <Text className="card-title">{title}</Text>
      </View>
      <View className="card-body">
        <Text className="card-value">{value}</Text>
      </View>
      <View className="card-footer">
        <Text className="card-hint">{hint}</Text>
      </View>
    </View>
  )
}

// 快捷功能按钮组件
const QuickButton = ({ icon, label, onClick }) => {
  return (
    <View className="quick-btn" onClick={onClick}>
      <View className="quick-icon">
        {icon}
      </View>
      <Text className="quick-label">{label}</Text>
    </View>
  )
}

// 主页面
export default function Index() {
  const [userInfo, setUserInfo] = useState({
    nickname: '用户',
    avatar: '',
    avatarCount: 0,
    pendingOrders: 0,
    generatedContent: 0,
    totalEarnings: '0.00'
  })
  const [avatarStatus, setAvatarStatus] = useState('inactive')

  useEffect(() => {
    loadUserData()
    loadAvatarStatus()
  }, [])

  const loadUserData = async () => {
    try {
      const res = await Network.request({
        url: '/api/user/profile'
      })
      if (res.data?.code === 200) {
        setUserInfo({
          nickname: res.data.data?.nickname || '用户',
          avatar: res.data.data?.avatar || '',
          avatarCount: res.data.data?.avatarCount || 0,
          pendingOrders: res.data.data?.pendingOrders || 0,
          generatedContent: res.data.data?.generatedContent || 0,
          totalEarnings: res.data.data?.totalEarnings || '0.00'
        })
      }
    } catch (err) {
      console.log('加载用户数据失败', err)
    }
  }

  const loadAvatarStatus = async () => {
    try {
      const res = await Network.request({
        url: '/api/avatar/active',
        header: {
          'x-user-id': 'user_demo'
        }
      })
      if (res.data?.code === 200 && res.data.data?.length > 0) {
        setAvatarStatus(res.data.data[0]?.status || 'inactive')
      }
    } catch (err) {
      console.log('加载分身状态失败', err)
    }
  }

  const navigateTo = (url) => {
    Taro.navigateTo({ url })
  }

  return (
    <View className="page-container">
      {/* 顶部通栏 */}
      <TopHeader userInfo={userInfo} avatarStatus={avatarStatus} />

      {/* 主内容区 */}
      <View className="main-content">
        {/* 数据卡片区 */}
        <View className="data-cards">
          <View className="cards-row">
            <DataCard
              title="我的分身数量"
              value={userInfo.avatarCount}
              hint="点击直达管理"
            />
            <DataCard
              title="待接单订单"
              value={userInfo.pendingOrders}
              hint="查看订单详情"
            />
          </View>
          <View className="cards-row">
            <DataCard
              title="已生成内容"
              value={userInfo.generatedContent}
              hint="查看内容库"
            />
            <DataCard
              title="累计收益"
              value={'¥' + userInfo.totalEarnings}
              hint="前往提现"
            />
          </View>
        </View>

        {/* 快捷功能区 */}
        <View className="quick-section">
          <View className="section-header">
            <Text className="section-title">快捷功能</Text>
          </View>
          <View className="quick-grid">
            <View className="quick-row">
              <QuickButton
                icon={<Plus size={32} color="#7B3FE4" />}
                label="创建新分身"
                onClick={() => navigateTo('/pages/avatar/avatar-create/index')}
              />
              <QuickButton
                icon={<ShoppingCart size={32} color="#7B3FE4" />}
                label="订单广场接单"
                onClick={() => navigateTo('/pages/order/order-acceptance/index')}
              />
              <QuickButton
                icon={<Sparkles size={32} color="#7B3FE4" />}
                label="AI自动做内容"
                onClick={() => navigateTo('/pages/content-generate/index')}
              />
            </View>
            <View className="quick-row">
              <QuickButton
                icon={<Wrench size={32} color="#7B3FE4" />}
                label="分身技能中心"
                onClick={() => navigateTo('/pages/skills-square/index')}
              />
              <QuickButton
                icon={<Package size={32} color="#7B3FE4" />}
                label="内容素材库"
                onClick={() => navigateTo('/pages/generated-content/index')}
              />
              <QuickButton
                icon={<Share2 size={32} color="#7B3FE4" />}
                label="自动分发管理"
                onClick={() => navigateTo('/pages/content-distribution/index')}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}
