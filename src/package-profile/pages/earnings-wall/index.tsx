import Taro, { useLoad, navigateBack } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { ArrowLeft, Trophy, TrendingUp, Sparkles, Medal, Crown, Zap, Flame, Star } from 'lucide-react-taro'
import * as Network from '@/network'
import { formatLocal } from '@/utils/format'
import './index.css'

interface EarningsRecord {
  avatarId: string
  avatarName: string
  totalEarnings: number
  completedOrders: number
  rank: number
  platform?: string
  skill?: string
  growth?: string
  isSample?: boolean
}

interface EarningsStats {
  totalPlatformEarnings: number
  totalAvatars: number
  totalCompletedOrders: number
  averageEarnings: number
}

// 精心设计的示例数据 — 专业感+诱惑力，不用random
const SAMPLE_RECORDS: EarningsRecord[] = [
  { avatarId: 'sample-1', avatarName: '小红书种草王', totalEarnings: 12860, completedOrders: 86, rank: 1, platform: '小红书', skill: '图文爆款生成', growth: '+38%', isSample: true },
  { avatarId: 'sample-2', avatarName: '短视频快枪手', totalEarnings: 9740, completedOrders: 63, rank: 2, platform: '抖音', skill: '视频生成', growth: '+25%', isSample: true },
  { avatarId: 'sample-3', avatarName: '美妆测评官', totalEarnings: 8520, completedOrders: 54, rank: 3, platform: '小红书', skill: '图片生成', growth: '+22%', isSample: true },
  { avatarId: 'sample-4', avatarName: '潮流穿搭师', totalEarnings: 7350, completedOrders: 49, rank: 4, platform: '抖音', skill: '衣品改造', growth: '+19%', isSample: true },
  { avatarId: 'sample-5', avatarName: '手相解读师', totalEarnings: 6280, completedOrders: 89, rank: 5, platform: '微信', skill: '看手相', growth: '+31%', isSample: true },
  { avatarId: 'sample-6', avatarName: '好物推荐官', totalEarnings: 5430, completedOrders: 37, rank: 6, platform: '微博', skill: '图文爆款生成', growth: '+15%', isSample: true },
  { avatarId: 'sample-7', avatarName: '美食探店主', totalEarnings: 4680, completedOrders: 31, rank: 7, platform: '小红书', skill: '图片生成', growth: '+12%', isSample: true },
  { avatarId: 'sample-8', avatarName: '旅行记录者', totalEarnings: 3950, completedOrders: 27, rank: 8, platform: 'B站', skill: '视频生成', growth: '+18%', isSample: true },
  { avatarId: 'sample-9', avatarName: '数码测评家', totalEarnings: 3210, completedOrders: 22, rank: 9, platform: 'B站', skill: '图文爆款生成', growth: '+10%', isSample: true },
  { avatarId: 'sample-10', avatarName: '生活分享家', totalEarnings: 2540, completedOrders: 18, rank: 10, platform: '抖音', skill: '衣品改造', growth: '+8%', isSample: true },
]

const SAMPLE_STATS: EarningsStats = {
  totalPlatformEarnings: 64560,
  totalAvatars: 386,
  totalCompletedOrders: 476,
  averageEarnings: 1674
}

// 技能对应的渐变色
const SKILL_COLORS: Record<string, { bg: string; text: string }> = {
  '图文爆款生成': { bg: 'linear-gradient(135deg, #8B5CF6, #6366F1)', text: '#8B5CF6' },
  '图片生成': { bg: 'linear-gradient(135deg, #EC4899, #F43F5E)', text: '#EC4899' },
  '视频生成': { bg: 'linear-gradient(135deg, #3B82F6, #2563EB)', text: '#3B82F6' },
  '看手相': { bg: 'linear-gradient(135deg, #F59E0B, #D97706)', text: '#F59E0B' },
  '衣品改造': { bg: 'linear-gradient(135deg, #10B981, #059669)', text: '#10B981' },
}

export default function EarningsWallPage() {
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<EarningsRecord[]>([])
  const [stats, setStats] = useState<EarningsStats>(SAMPLE_STATS)
  const [isRealData, setIsRealData] = useState(false)
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
      console.log('[EarningsWall] API响应:', res.data)

      if (res.data?.code === 200 && res.data?.data) {
        const apiData = res.data.data
        const apiRecords = apiData.records || apiData.items || []

        if (apiRecords.length > 0) {
          // 有真实数据 — 使用真实数据
          const mapped: EarningsRecord[] = apiRecords.map((r: any, i: number) => ({
            avatarId: r.avatarId || r.avatar_id || `real-${i}`,
            avatarName: r.avatarName || r.avatar_name || '匿名分身',
            totalEarnings: Number(r.totalEarnings || r.total || r.total_earnings || 0),
            completedOrders: Number(r.completedOrders || r.completed_orders || 0),
            rank: i + 1,
            platform: r.platform || '',
            skill: r.skill || '',
            growth: r.growth || '',
            isSample: false,
          }))
          setRecords(mapped)
          setIsRealData(true)

          const totalEarnings = mapped.reduce((s, r) => s + r.totalEarnings, 0)
          setStats({
            totalPlatformEarnings: totalEarnings,
            totalAvatars: mapped.length,
            totalCompletedOrders: mapped.reduce((s, r) => s + r.completedOrders, 0),
            averageEarnings: mapped.length > 0 ? Math.floor(totalEarnings / mapped.length) : 0,
          })
          return
        }
      }

      // 无真实数据 — 使用精心设计的示例数据
      setRecords(SAMPLE_RECORDS)
      setStats(SAMPLE_STATS)
      setIsRealData(false)
    } catch (error) {
      console.error('[EarningsWall] 获取数据失败:', error)
      setRecords(SAMPLE_RECORDS)
      setStats(SAMPLE_STATS)
      setIsRealData(false)
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={24} color="#FFD700" />
    if (rank === 2) return <Medal size={24} color="#C0C0C0" />
    if (rank === 3) return <Medal size={24} color="#CD7F32" />
    return null
  }

  const getSkillColor = (skill?: string) => {
    if (!skill) return { bg: 'linear-gradient(135deg, #8B5CF6, #6366F1)', text: '#8B5CF6' }
    return SKILL_COLORS[skill] || { bg: 'linear-gradient(135deg, #8B5CF6, #6366F1)', text: '#8B5CF6' }
  }

  return (
    <View className="ew-page">
      {/* 头部渐变区 */}
      <View className="ew-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="ew-header-decor1" />
        <View className="ew-header-decor2" />

        <View className="ew-nav">
          <View className="ew-nav-back" onClick={() => navigateBack()}>
            <ArrowLeft size={22} color="#fff" />
          </View>
          <Text className="ew-nav-title">收益排行榜</Text>
          <View className="ew-nav-right" />
        </View>

        <View className="ew-hero">
          <View className="ew-hero-icon">
            <Trophy size={40} color="#FFD700" />
          </View>
          <Text className="ew-hero-title">分身收益光荣榜</Text>
          <Text className="ew-hero-sub">AI替你创作，24h不间断赚钱</Text>
        </View>

        <View className="ew-stats-bar">
          <View className="ew-stat">
            <Text className="ew-stat-val">¥{formatLocal(stats.totalPlatformEarnings)}</Text>
            <Text className="ew-stat-label">平台总收益</Text>
          </View>
          <View className="ew-stat-div" />
          <View className="ew-stat">
            <Text className="ew-stat-val">{stats.totalAvatars}</Text>
            <Text className="ew-stat-label">赚钱分身</Text>
          </View>
          <View className="ew-stat-div" />
          <View className="ew-stat">
            <Text className="ew-stat-val">¥{formatLocal(stats.averageEarnings)}</Text>
            <Text className="ew-stat-label">人均收益</Text>
          </View>
        </View>
      </View>

      <View className="ew-body">
        {/* 示例数据提示 */}
        {!isRealData && (
          <View className="ew-sample-tip">
            <Sparkles size={14} color="#8B5CF6" />
            <Text className="ew-sample-tip-text">以下为平台示范收益，创建分身即可开始赚钱</Text>
          </View>
        )}

        {/* Top 3 领奖台 */}
        <View className="ew-section">
          <View className="ew-section-head">
            <Flame size={18} color="#8B5CF6" />
            <Text className="ew-section-title">收益之星</Text>
            {records[0]?.growth && (
              <View className="ew-growth-tag">
                <TrendingUp size={12} color="#10B981" />
                <Text className="ew-growth-text">涨幅 {records[0].growth}</Text>
              </View>
            )}
          </View>

          <View className="ew-podium">
            {/* 第2名 */}
            {records[1] && (
              <View className="ew-podium-item ew-podium-2">
                <View className="ew-podium-medal">{getRankIcon(2)}</View>
                <View className="ew-podium-avatar ew-podium-avatar-2">
                  <Text className="ew-podium-init">{records[1].avatarName.charAt(0)}</Text>
                </View>
                <Text className="ew-podium-name">{records[1].avatarName}</Text>
                <Text className="ew-podium-earn">¥{formatLocal(records[1].totalEarnings)}</Text>
                {records[1].skill && (
                  <View className="ew-podium-skill" style={{ background: getSkillColor(records[1].skill).bg }}>
                    <Text className="ew-podium-skill-text">{records[1].skill}</Text>
                  </View>
                )}
              </View>
            )}

            {/* 第1名 */}
            {records[0] && (
              <View className="ew-podium-item ew-podium-1">
                <View className="ew-podium-crown">
                  <Crown size={28} color="#FFD700" />
                </View>
                <View className="ew-podium-avatar ew-podium-avatar-1">
                  <Text className="ew-podium-init ew-podium-init-1">{records[0].avatarName.charAt(0)}</Text>
                </View>
                <Text className="ew-podium-name">{records[0].avatarName}</Text>
                <Text className="ew-podium-earn ew-podium-earn-1">¥{formatLocal(records[0].totalEarnings)}</Text>
                {records[0].skill && (
                  <View className="ew-podium-skill" style={{ background: getSkillColor(records[0].skill).bg }}>
                    <Text className="ew-podium-skill-text">{records[0].skill}</Text>
                  </View>
                )}
              </View>
            )}

            {/* 第3名 */}
            {records[2] && (
              <View className="ew-podium-item ew-podium-3">
                <View className="ew-podium-medal">{getRankIcon(3)}</View>
                <View className="ew-podium-avatar ew-podium-avatar-3">
                  <Text className="ew-podium-init">{records[2].avatarName.charAt(0)}</Text>
                </View>
                <Text className="ew-podium-name">{records[2].avatarName}</Text>
                <Text className="ew-podium-earn">¥{formatLocal(records[2].totalEarnings)}</Text>
                {records[2].skill && (
                  <View className="ew-podium-skill" style={{ background: getSkillColor(records[2].skill).bg }}>
                    <Text className="ew-podium-skill-text">{records[2].skill}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* 排行列表 */}
        <View className="ew-section">
          <View className="ew-section-head">
            <TrendingUp size={18} color="#8B5CF6" />
            <Text className="ew-section-title">全部排名</Text>
          </View>

          <View className="ew-list">
            {records.slice(3).map((record) => {
              const skillColor = getSkillColor(record.skill)
              return (
                <View key={record.avatarId} className="ew-list-item">
                  <View className="ew-list-rank">
                    <Text className="ew-list-rank-num">{record.rank}</Text>
                  </View>

                  <View className="ew-list-avatar">
                    <Text className="ew-list-avatar-init">{record.avatarName.charAt(0)}</Text>
                  </View>

                  <View className="ew-list-info">
                    <Text className="ew-list-name">{record.avatarName}</Text>
                    <View className="ew-list-tags">
                      {record.platform && (
                        <View className="ew-list-platform-tag">
                          <Text className="ew-list-platform-text">{record.platform}</Text>
                        </View>
                      )}
                      {record.skill && (
                        <View className="ew-list-skill-tag" style={{ backgroundColor: `${skillColor.text}15` }}>
                          <Text className="ew-list-skill-text" style={{ color: skillColor.text }}>{record.skill}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View className="ew-list-earn-wrap">
                    <Text className="ew-list-earn">¥{formatLocal(record.totalEarnings)}</Text>
                    <View className="ew-list-meta">
                      <Text className="ew-list-orders">{record.completedOrders}单</Text>
                      {record.growth && (
                        <Text className="ew-list-growth">{record.growth}</Text>
                      )}
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        </View>

        {/* 你也能上榜 激励卡 */}
        <View className="ew-cta-section">
          <View className="ew-cta-card">
            <View className="ew-cta-left">
              <View className="ew-cta-icon">
                <Zap size={20} color="#fff" />
              </View>
              <View className="ew-cta-text">
                <Text className="ew-cta-title">下一个上榜的就是你</Text>
                <Text className="ew-cta-desc">创建AI分身，24h自动接单赚钱</Text>
              </View>
            </View>
            <View className="ew-cta-btn" onClick={() => Taro.switchTab({ url: '/pages/mind-chat/index' })}>
              <Text className="ew-cta-btn-text">立即创建</Text>
            </View>
          </View>
        </View>

        {/* 收益真相 */}
        <View className="ew-truth-section">
          <View className="ew-section-head">
            <Star size={18} color="#F59E0B" />
            <Text className="ew-section-title">他们是怎么赚钱的</Text>
          </View>
          <View className="ew-truth-list">
            <View className="ew-truth-item">
              <View className="ew-truth-num-wrap">
                <Text className="ew-truth-num">1</Text>
              </View>
              <View className="ew-truth-content">
                <Text className="ew-truth-title">创建分身，装配技能</Text>
                <Text className="ew-truth-desc">选好技能，AI就能帮你自动创作内容</Text>
              </View>
            </View>
            <View className="ew-truth-item">
              <View className="ew-truth-num-wrap ew-truth-num-2">
                <Text className="ew-truth-num">2</Text>
              </View>
              <View className="ew-truth-content">
                <Text className="ew-truth-title">开启托管，自动接单</Text>
                <Text className="ew-truth-desc">24h不间断，有单就接，你只管躺赚</Text>
              </View>
            </View>
            <View className="ew-truth-item">
              <View className="ew-truth-num-wrap ew-truth-num-3">
                <Text className="ew-truth-num">3</Text>
              </View>
              <View className="ew-truth-content">
                <Text className="ew-truth-title">持续收益，越用越强</Text>
                <Text className="ew-truth-desc">分身越接越多，等级越高，收益越多</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {loading && (
        <View className="ew-loading">
          <View className="ew-loading-spinner" />
          <Text className="ew-loading-text">加载中...</Text>
        </View>
      )}
    </View>
  )
}
