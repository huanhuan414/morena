import { View, Text, Image } from '@tarojs/components'
import { useLoad, useDidShow , login as taroLogin, navigateTo, switchTab } from '@tarojs/taro'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { Sparkles, Zap, Users, ClipboardList, ChevronRight, Plus } from 'lucide-react-taro'
import './index.css'

interface Avatar {
  id: string
  name: string
  avatar_url: string
  level: number
  exp: number
  status: string
}

interface Stats {
  avatarCount: number
  taskCount: number
  postCount: number
  followingCount: number
  followerCount: number
}

export default function HomePage() {
  const { userInfo, isLoggedIn, login } = useUserStore()
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useLoad(() => {
    console.log('Home page loaded.')
  })

  useDidShow(() => {
    if (isLoggedIn) {
      fetchData()
    } else {
      autoLogin()
    }
  })

  const autoLogin = async () => {
    try {
      const { code } = await taroLogin()
      await login(code)
      await fetchData()
    } catch (error) {
      console.error('自动登录失败:', error)
      setLoading(false)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [avatarsRes, statsRes] = await Promise.all([
        Network.request({ url: '/api/avatar' }),
        Network.request({ url: '/api/user/stats' })
      ])
      
      if (avatarsRes.data?.code === 200) {
        setAvatars(avatarsRes.data.data || [])
      }
      if (statsRes.data?.code === 200) {
        setStats(statsRes.data.data)
      }
    } catch (error) {
      console.error('获取数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isLoggedIn && !loading) {
    return (
      <View className="home-container flex flex-col items-center justify-center min-h-screen bg-slate-900 px-4">
        <View className="text-center mb-8">
          <View className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <Sparkles size={40} color="#fff" />
          </View>
          <Text className="block text-2xl font-bold text-white mb-2">莫瑞娜</Text>
          <Text className="block text-slate-400">AI原生人机共生协同平台</Text>
        </View>
        <Button 
          className="w-full max-w-xs bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full py-6"
          onClick={autoLogin}
        >
          <Text className="text-lg">微信一键登录</Text>
        </Button>
      </View>
    )
  }

  return (
    <View className="home-container min-h-screen bg-slate-900 pb-20">
      {/* 顶部渐变背景 */}
      <View className="h-48 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-600 relative overflow-hidden">
        <View className="absolute inset-0">
          <View className="absolute top-10 left-10 w-32 h-32 bg-white bg-opacity-20 rounded-full blur-3xl" />
          <View className="absolute bottom-10 right-10 w-40 h-40 bg-purple-400 bg-opacity-30 rounded-full blur-3xl" />
        </View>
        <View className="relative z-10 p-4 pt-12">
          <View className="flex items-center justify-between">
            <View>
              <Text className="block text-white text-xl font-semibold mb-1">
                {userInfo?.nickname || '莫瑞娜用户'}
              </Text>
              <Text className="block text-white text-white-opacity-70 text-sm">
                Lv.{userInfo?.level || 1} · {userInfo?.exp || 0} 经验
              </Text>
            </View>
            {userInfo?.avatar && (
              <View className="w-12 h-12 rounded-full overflow-hidden border-2 border-white border-opacity-30">
                <Image src={userInfo.avatar} className="w-full h-full" mode="aspectFill" />
              </View>
            )}
          </View>
        </View>
      </View>

      {/* 统计卡片 */}
      <View className="px-4 -mt-6 relative z-20">
        <View className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <View className="grid grid-cols-4 gap-4">
            <StatItem icon={<Users size={20} color="#818cf8" />} label="分身" value={stats?.avatarCount || 0} />
            <StatItem icon={<ClipboardList size={20} color="#818cf8" />} label="任务" value={stats?.taskCount || 0} />
            <StatItem icon={<Zap size={20} color="#818cf8" />} label="动态" value={stats?.postCount || 0} />
            <StatItem icon={<Sparkles size={20} color="#818cf8" />} label="积分" value={userInfo?.credits || 0} />
          </View>
        </View>
      </View>

      {/* 我的分身 */}
      <View className="px-4 mt-6">
        <View className="flex items-center justify-between mb-3">
          <Text className="text-lg font-semibold text-white">我的分身</Text>
          <Button 
            variant="ghost" 
            size="sm"
            className="text-indigo-400"
            onClick={() => navigateTo({ url: '/pages/chat/index?create=true' })}
          >
            <Plus size={18} color="#818cf8" />
            <Text className="ml-1 text-indigo-400">创建</Text>
          </Button>
        </View>
        
        {loading ? (
          <View className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </View>
        ) : avatars.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6 text-center">
              <Sparkles size={48} color="#64748b" className="mx-auto mb-3" />
              <Text className="block text-slate-400 mb-2">还没有创建分身</Text>
              <Button 
                className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
                onClick={() => navigateTo({ url: '/pages/chat/index?create=true' })}
              >
                创建第一个AI分身
              </Button>
            </CardContent>
          </Card>
        ) : (
          <View className="space-y-3">
            {avatars.map(avatar => (
              <Card 
                key={avatar.id}
                className="bg-slate-800 border-slate-700"
                onClick={() => navigateTo({ url: `/pages/chat/index?avatarId=${avatar.id}` })}
              >
                <CardContent className="p-4">
                  <View className="flex items-center">
                    <View className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mr-3">
                      {avatar.avatar_url ? (
                        <Image src={avatar.avatar_url} className="w-full h-full rounded-full" mode="aspectFill" />
                      ) : (
                        <Text className="text-white text-xl font-bold">{avatar.name[0]}</Text>
                      )}
                    </View>
                    <View className="flex-1">
                      <View className="flex items-center">
                        <Text className="text-white font-medium">{avatar.name}</Text>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Lv.{avatar.level}
                        </Badge>
                      </View>
                      <Text className="text-slate-400 text-sm mt-1">
                        {avatar.exp} 经验 · {avatar.status === 'active' ? '活跃中' : '休息中'}
                      </Text>
                    </View>
                    <ChevronRight size={20} color="#64748b" />
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </View>

      {/* 快捷入口 */}
      <View className="px-4 mt-6">
        <Text className="text-lg font-semibold text-white mb-3">快捷入口</Text>
        <View className="grid grid-cols-2 gap-3">
          <QuickEntry 
            icon={<ClipboardList size={24} color="#818cf8" />}
            title="任务管理"
            desc="查看所有任务"
            onClick={() => switchTab({ url: '/pages/task/index' })}
          />
          <QuickEntry 
            icon={<Users size={24} color="#a855f7" />}
            title="社交广场"
            desc="发现精彩内容"
            onClick={() => switchTab({ url: '/pages/social/index' })}
          />
        </View>
      </View>
    </View>
  )
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <View className="text-center">
      <View className="mb-1">{icon}</View>
      <Text className="block text-white font-semibold text-lg">{value}</Text>
      <Text className="block text-slate-400 text-xs">{label}</Text>
    </View>
  )
}

function QuickEntry({ icon, title, desc, onClick }: { 
  icon: React.ReactNode
  title: string
  desc: string
  onClick: () => void 
}) {
  return (
    <Card 
      className="bg-slate-800 border-slate-700"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <View className="flex items-center">
          <View className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center mr-3">
            {icon}
          </View>
          <View>
            <Text className="block text-white font-medium text-sm">{title}</Text>
            <Text className="block text-slate-400 text-xs">{desc}</Text>
          </View>
        </View>
      </CardContent>
    </Card>
  )
}
