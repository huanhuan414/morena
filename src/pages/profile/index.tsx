import { View, Text, Image } from '@tarojs/components'
import { useLoad, useDidShow , navigateTo, reLaunch, showModal } from '@tarojs/taro'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { Settings, ChevronRight, LogOut, Sparkles, Zap, Bell, Shield, Info } from 'lucide-react-taro'
import './index.css'

export default function ProfilePage() {
  const { userInfo, logout, isLoggedIn } = useUserStore()
  const [stats, setStats] = useState({
    avatarCount: 0,
    taskCount: 0,
    postCount: 0,
    followingCount: 0,
    followerCount: 0
  })

  useLoad(() => {})

  useDidShow(() => {
    if (isLoggedIn) {
      fetchStats()
    }
  })

  const fetchStats = async () => {
    try {
      const res = await Network.request({ url: '/api/user/stats' })
      if (res.data?.code === 200) {
        setStats(res.data.data)
      }
    } catch (error) {
      console.error('获取统计失败:', error)
    }
  }

  const handleLogout = () => {
    showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          logout()
          reLaunch({ url: '/pages/home/index' })
        }
      }
    })
  }

  const menuItems = [
    {
      title: '分身管理',
      icon: <Sparkles size={20} color="#818cf8" />,
      path: '/pages/chat/index',
      desc: '管理你的AI分身'
    },
    {
      title: '任务中心',
      icon: <Zap size={20} color="#a855f7" />,
      path: '/pages/task/index',
      desc: '查看任务进度'
    },
    {
      title: '消息通知',
      icon: <Bell size={20} color="#f59e0b" />,
      desc: '查看系统通知'
    },
    {
      title: '账户安全',
      icon: <Shield size={20} color="#10b981" />,
      desc: '隐私与安全设置'
    },
    {
      title: '帮助中心',
      icon: <Info size={20} color="#3b82f6" />,
      desc: '常见问题解答'
    },
    {
      title: '关于我们',
      icon: <Info size={20} color="#64748b" />,
      desc: '版本信息'
    }
  ]

  return (
    <View className="profile-container min-h-screen bg-slate-900 pb-20">
      {/* 用户信息卡片 */}
      <View className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-600 pt-12 pb-8 px-4">
        <View className="flex items-center">
          <View className="w-16 h-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center mr-4 border-2 border-white border-opacity-30">
            {userInfo?.avatar ? (
              <Image src={userInfo.avatar} className="w-full h-full rounded-full" mode="aspectFill" />
            ) : (
              <Text className="text-white text-2xl font-bold">
                {userInfo?.nickname?.[0] || 'U'}
              </Text>
            )}
          </View>
          <View className="flex-1">
            <View className="flex items-center">
              <Text className="text-white text-xl font-semibold">{userInfo?.nickname || '莫瑞娜用户'}</Text>
              <Badge variant="secondary" className="ml-2 bg-white bg-opacity-20 text-white">
                Lv.{userInfo?.level || 1}
              </Badge>
            </View>
            <Text className="text-white text-white-opacity-70 text-sm mt-1">
              {userInfo?.bio || 'AI原生人机共生协同平台'}
            </Text>
          </View>
          <Button variant="ghost" size="icon" onClick={() => navigateTo({ url: '/pages/profile/settings' })}>
            <Settings size={24} color="#fff" />
          </Button>
        </View>

        {/* 统计 */}
        <View className="grid grid-cols-4 gap-4 mt-6 bg-white bg-opacity-10 rounded-xl p-4">
          <StatItem label="分身" value={stats.avatarCount} />
          <StatItem label="任务" value={stats.taskCount} />
          <StatItem label="动态" value={stats.postCount} />
          <StatItem label="积分" value={userInfo?.credits || 0} />
        </View>
      </View>

      {/* 经验进度 */}
      <View className="px-4 -mt-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <View className="flex items-center justify-between mb-2">
              <Text className="text-slate-400 text-sm">成长值</Text>
              <Text className="text-indigo-400 text-sm">
                {userInfo?.exp || 0} / {(userInfo?.level || 1) * 100}
              </Text>
            </View>
            <View className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <View 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                style={{ width: `${((userInfo?.exp || 0) % 100)}%` }}
              />
            </View>
            <Text className="text-slate-500 text-xs mt-2">
              距离 Lv.{(userInfo?.level || 1) + 1} 还需 {((userInfo?.level || 1) * 100 - (userInfo?.exp || 0))} 经验
            </Text>
          </CardContent>
        </Card>
      </View>

      {/* 菜单列表 */}
      <View className="px-4 mt-4">
        <Card className="bg-slate-800 border-slate-700 overflow-hidden">
          {menuItems.map((item, idx) => (
            <View 
              key={idx}
              className={`flex items-center p-4 ${idx > 0 ? 'border-t border-slate-700' : ''}`}
              onClick={() => item.path && navigateTo({ url: item.path })}
            >
              <View className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center mr-3">
                {item.icon}
              </View>
              <View className="flex-1">
                <Text className="text-white text-sm font-medium">{item.title}</Text>
                <Text className="text-slate-500 text-xs">{item.desc}</Text>
              </View>
              <ChevronRight size={20} color="#64748b" />
            </View>
          ))}
        </Card>
      </View>

      {/* 退出登录 */}
      <View className="px-4 mt-6">
        <Button 
          variant="outline"
          className="w-full border-slate-700 text-slate-400"
          onClick={handleLogout}
        >
          <LogOut size={18} color="#94a3b8" className="mr-2" />
          退出登录
        </Button>
      </View>

      {/* 版本信息 */}
      <View className="mt-8 text-center">
        <Text className="text-slate-600 text-xs">莫瑞娜 v1.0.0</Text>
        <Text className="text-slate-700 text-xs mt-1">AI原生人机共生协同平台</Text>
      </View>
    </View>
  )
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <View className="text-center">
      <Text className="block text-white text-xl font-bold">{value}</Text>
      <Text className="block text-white text-white-opacity-60 text-xs">{label}</Text>
    </View>
  )
}
