import Taro, { useLoad, navigateBack } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { ArrowLeft, Trophy, TrendingUp, Sparkles, Medal, Crown, Zap } from 'lucide-react-taro'
import * as Network from '@/network'
import './index.css'

interface EarningsRecord {
  avatarId: string
  avatarName: string
  avatarAvatar?: string
  totalEarnings: number
  completedOrders: number
  rank: number
  platform?: string
}

interface EarningsStats {
  totalPlatformEarnings: number
  totalAvatars: number
  totalCompletedOrders: number
  averageEarnings: number
}

export default function EarningsWallPage() {
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<EarningsRecord[]>([])
  const [stats, setStats] = useState<EarningsStats>({
    totalPlatformEarnings: 0,
    totalAvatars: 0,
    totalCompletedOrders: 0,
    averageEarnings: 0
  })
  const [statusBarHeight, setStatusBarHeight] = useState(20)

  useLoad(() => {
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
    fetchEarningsData()
  })

  const fetchEarningsData = async () => {
    try {
      setLoading(true)
      const res = await Network.request({
        url: '/api/earnings/leaderboard',
        method: 'GET'
      })
      
      if (res.data?.code === 200) {
        setRecords(res.data.data?.records || [])
        setStats(res.data.data?.stats || {
          totalPlatformEarnings: 0,
          totalAvatars: 0,
          totalCompletedOrders: 0,
          averageEarnings: 0
        })
      } else {
        // 使用模拟数据
        setRecords(generateMockData())
      }
    } catch (error) {
      console.error('[EarningsWall] 获取数据失败:', error)
      setRecords(generateMockData())
    } finally {
      setLoading(false)
    }
  }

  // 生成模拟数据
  const generateMockData = (): EarningsRecord[] => {
    const mockRecords: EarningsRecord[] = []
    const names = [
      '创作达人小王', '内容女王Lisa', '短视频新星', '图文专家',
      '种草博主', '好物推荐官', '生活分享家', '时尚达人',
      '美食探索家', '旅行博主', '美妆达人', '科技测评师'
    ]
    const platforms = ['抖音', '小红书', '微博', 'B站', '微信']

    for (let i = 0; i < 12; i++) {
      const earnings = Math.floor(Math.random() * 5000) + 500
      mockRecords.push({
        avatarId: `mock-${i}`,
        avatarName: names[i],
        avatarAvatar: undefined,
        totalEarnings: earnings,
        completedOrders: Math.floor(earnings / 50),
        rank: i + 1,
        platform: platforms[Math.floor(Math.random() * platforms.length)]
      })
    }
    
    // 按收益排序
    mockRecords.sort((a, b) => b.totalEarnings - a.totalEarnings)
    mockRecords.forEach((record, index) => {
      record.rank = index + 1
    })
    
    const total = mockRecords.reduce((sum, r) => sum + r.totalEarnings, 0)
    setStats({
      totalPlatformEarnings: total,
      totalAvatars: mockRecords.length,
      totalCompletedOrders: mockRecords.reduce((sum, r) => sum + r.completedOrders, 0),
      averageEarnings: Math.floor(total / mockRecords.length)
    })
    
    return mockRecords
  }

  // 获取排名图标
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={24} color="#FFD700" />
    if (rank === 2) return <Medal size={24} color="#C0C0C0" />
    if (rank === 3) return <Medal size={24} color="#CD7F32" />
    return null
  }

  return (
    <View className="earnings-wall-page">
      {/* 顶部导航 */}
      <View className="nav-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="nav-content">
          <View className="back-btn" onClick={() => navigateBack()}>
            <ArrowLeft size={24} color="#1f2937" />
          </View>
          <Text className="nav-title">收益排行榜</Text>
          <View className="nav-right"></View>
        </View>
      </View>

      {/* 英雄区域 */}
      <View className="hero-section">
        <View className="hero-bg">
          <View className="hero-particles">
            {[...Array(20)].map((_, i) => (
              <View key={i} className="particle" style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${3 + Math.random() * 2}s`
              }}
              />
            ))}
          </View>
        </View>
        
        <View className="hero-content">
          <View className="hero-icon">
            <Trophy size={48} color="#7B3FE4" />
          </View>
          <Text className="hero-title">光荣榜</Text>
          <Text className="hero-subtitle">平台分身收益排行榜</Text>
          
          {/* 统计数据 */}
          <View className="stats-row">
            <View className="stat-item">
              <Text className="stat-value">¥{stats.totalPlatformEarnings.toLocaleString()}</Text>
              <Text className="stat-label">总收益</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-item">
              <Text className="stat-value">{stats.totalAvatars}</Text>
              <Text className="stat-label">参与分身</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-item">
              <Text className="stat-value">{stats.totalCompletedOrders}</Text>
              <Text className="stat-label">完成订单</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Top 3 榜单 */}
      <View className="top-three-section">
        <View className="section-header">
          <Sparkles size={20} color="#7B3FE4" />
          <Text className="section-title">Top 3</Text>
        </View>
        
        <View className="top-three-container">
          {/* 第二名 */}
          {records[1] && (
            <View className="top-avatar top-2">
              <View className="avatar-medal">
                {getRankIcon(2)}
              </View>
              <View className="avatar-avatar">
                <Text className="avatar-initial">{records[1].avatarName.charAt(0)}</Text>
              </View>
              <Text className="avatar-name">{records[1].avatarName}</Text>
              <Text className="avatar-earnings">¥{records[1].totalEarnings.toLocaleString()}</Text>
            </View>
          )}
          
          {/* 第一名 */}
          {records[0] && (
            <View className="top-avatar top-1">
              <View className="crown-wrapper">
                <Crown size={32} color="#FFD700" />
              </View>
              <View className="avatar-avatar avatar-1">
                <Text className="avatar-initial avatar-initial-1">{records[0].avatarName.charAt(0)}</Text>
              </View>
              <Text className="avatar-name">{records[0].avatarName}</Text>
              <Text className="avatar-earnings">¥{records[0].totalEarnings.toLocaleString()}</Text>
            </View>
          )}
          
          {/* 第三名 */}
          {records[2] && (
            <View className="top-avatar top-3">
              <View className="avatar-medal">
                {getRankIcon(3)}
              </View>
              <View className="avatar-avatar">
                <Text className="avatar-initial">{records[2].avatarName.charAt(0)}</Text>
              </View>
              <Text className="avatar-name">{records[2].avatarName}</Text>
              <Text className="avatar-earnings">¥{records[2].totalEarnings.toLocaleString()}</Text>
            </View>
          )}
        </View>
      </View>

      {/* 排行榜列表 */}
      <View className="ranking-list-section">
        <View className="section-header">
          <TrendingUp size={20} color="#7B3FE4" />
          <Text className="section-title">全部排名</Text>
        </View>
        
        <View className="ranking-list">
          {records.slice(3).map((record, index) => (
            <View key={record.avatarId} className={`ranking-item ${index % 2 === 0 ? 'even' : 'odd'}`}>
              <View className="rank-badge">
                <Text className="rank-number">{record.rank}</Text>
              </View>
              
              <View className="avatar-info">
                <View className="avatar-icon">
                  <Text className="avatar-initial-small">{record.avatarName.charAt(0)}</Text>
                </View>
                <View className="avatar-details">
                  <Text className="avatar-name-small">{record.avatarName}</Text>
                  <Text className="avatar-platform">{record.platform}</Text>
                </View>
              </View>
              
              <View className="earnings-info">
                <Text className="earnings-value">¥{record.totalEarnings.toLocaleString()}</Text>
                <Text className="orders-count">{record.completedOrders}单</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 激励标语 */}
      <View className="motivation-section">
        <View className="motivation-card">
          <Zap size={24} color="#F59E0B" />
          <View className="motivation-text">
            <Text className="motivation-title">下一个上榜的就是你!</Text>
            <Text className="motivation-desc">加入分身计划，开启你的创作变现之旅</Text>
          </View>
        </View>
      </View>

      {loading && (
        <View className="loading-overlay">
          <View className="loading-spinner" />
          <Text className="loading-text">加载中...</Text>
        </View>
      )}
    </View>
  )
}
