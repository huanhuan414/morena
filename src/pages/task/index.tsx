import { View, Text, ScrollView } from '@tarojs/components'
import { useLoad, useDidShow , redirectTo, showModal, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { ClipboardList, Plus, Clock, CircleCheck, CircleX, RefreshCw } from 'lucide-react-taro'
import './index.css'

interface Task {
  id: string
  title: string
  description: string
  type: string
  status: string
  progress: number
  result: Record<string, any>
  created_at: string
  completed_at?: string
  avatars?: {
    name: string
    avatar_url: string
  }
}

export default function TaskPage() {
  const { isLoggedIn } = useUserStore()
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState({ total: 0, pending: 0, inProgress: 0, completed: 0 })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  useLoad(() => {
    if (!isLoggedIn) {
      redirectTo({ url: '/pages/home/index' })
    }
  })

  useDidShow(() => {
    fetchTasks()
    fetchStats()
  })

  const fetchTasks = async (status?: string) => {
    setLoading(true)
    try {
      const url = status && status !== 'all' 
        ? `/api/task?status=${status}` 
        : '/api/task'
      const res = await Network.request({ url })
      if (res.data?.code === 200) {
        setTasks(res.data.data || [])
      }
    } catch (error) {
      console.error('获取任务失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await Network.request({ url: '/api/task/stats' })
      if (res.data?.code === 200) {
        setStats(res.data.data)
      }
    } catch (error) {
      console.error('获取统计失败:', error)
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    fetchTasks(value)
  }

  const createTask = async () => {
    showModal({
      title: '创建任务',
      editable: true,
      placeholderText: '请输入任务内容',
      success: async (res: any) => {
        if (res.confirm && res.content) {
          try {
            const result = await Network.request({
              url: '/api/task',
              method: 'POST',
              data: {
                title: res.content,
                description: res.content,
                type: 'general'
              }
            })
            if (result.data?.code === 200) {
              showToast({ title: '创建成功', icon: 'success' })
              fetchTasks(activeTab)
              fetchStats()
            }
          } catch (error) {
            showToast({ title: '创建失败', icon: 'none' })
          }
        }
      }
    } as any)
  }

  const cancelTask = async (taskId: string) => {
    try {
      const res = await Network.request({
        url: `/api/task/${taskId}/cancel`,
        method: 'PUT'
      })
      if (res.data?.code === 200) {
        showToast({ title: '已取消', icon: 'success' })
        fetchTasks(activeTab)
      }
    } catch (error) {
      showToast({ title: '操作失败', icon: 'none' })
    }
  }

  const retryTask = async (taskId: string) => {
    try {
      const res = await Network.request({
        url: `/api/task/${taskId}/retry`,
        method: 'PUT'
      })
      if (res.data?.code === 200) {
        showToast({ title: '已重试', icon: 'success' })
        fetchTasks(activeTab)
      }
    } catch (error) {
      showToast({ title: '操作失败', icon: 'none' })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-slate-600"><Clock size={12} color="#fff" className="mr-1" />等待中</Badge>
      case 'in_progress':
        return <Badge variant="secondary" className="bg-indigo-600"><RefreshCw size={12} color="#fff" className="mr-1" />进行中</Badge>
      case 'completed':
        return <Badge variant="secondary" className="bg-emerald-600"><CircleCheck size={12} color="#fff" className="mr-1" />已完成</Badge>
      case 'cancelled':
        return <Badge variant="secondary" className="bg-red-600"><CircleX size={12} color="#fff" className="mr-1" />已取消</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <View className="task-container min-h-screen bg-slate-900 pb-20">
      {/* 顶部统计 */}
      <View className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600">
        <Text className="block text-white text-lg font-semibold mb-4">任务概览</Text>
        <View className="grid grid-cols-4 gap-2">
          <StatCard label="全部" value={stats.total} />
          <StatCard label="等待" value={stats.pending} />
          <StatCard label="进行" value={stats.inProgress} />
          <StatCard label="完成" value={stats.completed} />
        </View>
      </View>

      {/* Tab 切换 */}
      <View className="px-4 py-3">
        <View className="flex bg-slate-800 rounded-xl p-1">
          {['all', 'pending', 'in_progress', 'completed'].map((tab) => (
            <View 
              key={tab}
              className={`flex-1 py-2 text-center rounded-lg ${
                activeTab === tab ? 'bg-indigo-500 text-white' : 'text-slate-400'
              }`}
              onClick={() => handleTabChange(tab)}
            >
              <Text className={`text-sm ${activeTab === tab ? 'text-white' : 'text-slate-400'}`}>
                {tab === 'all' ? '全部' : tab === 'pending' ? '等待' : tab === 'in_progress' ? '进行中' : '已完成'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* 任务列表 */}
      <ScrollView className="px-4" scrollY style={{ height: '60vh' }}>
        {loading ? (
          <View className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </View>
        ) : tasks.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-20">
            <ClipboardList size={48} color="#64748b" className="mb-4" />
            <Text className="text-slate-400 mb-4">暂无任务</Text>
            <Button 
              className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
              onClick={createTask}
            >
              <Plus size={18} color="#fff" className="mr-1" />
              创建任务
            </Button>
          </View>
        ) : (
          <View className="space-y-3">
            {tasks.map((task) => (
              <Card 
                key={task.id}
                className="bg-slate-800 border-slate-700"
              >
                <CardContent className="p-4">
                  <View className="flex items-start justify-between mb-2">
                    <Text className="text-white font-medium flex-1">{task.title}</Text>
                    {getStatusBadge(task.status)}
                  </View>
                  
                  {task.description && (
                    <Text className="text-slate-400 text-sm mb-3">{task.description}</Text>
                  )}

                  {task.status === 'in_progress' && (
                    <View className="mb-3">
                      <View className="flex items-center justify-between mb-1">
                        <Text className="text-slate-400 text-xs">进度</Text>
                        <Text className="text-indigo-400 text-xs">{task.progress}%</Text>
                      </View>
                      <View className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <View 
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                          style={{ width: `${task.progress}%` }}
                        />
                      </View>
                    </View>
                  )}

                  <View className="flex items-center justify-between">
                    <Text className="text-slate-500 text-xs">
                      {new Date(task.created_at).toLocaleString('zh-CN')}
                    </Text>
                    <View className="flex space-x-2">
                      {task.status === 'pending' && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-red-400"
                          onClick={() => cancelTask(task.id)}
                        >
                          取消
                        </Button>
                      )}
                      {task.status === 'cancelled' && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-indigo-400"
                          onClick={() => retryTask(task.id)}
                        >
                          重试
                        </Button>
                      )}
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 浮动创建按钮 */}
      <View 
        className="fixed right-4 bottom-20 w-14 h-14 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg"
        onClick={createTask}
      >
        <Plus size={28} color="#fff" />
      </View>
    </View>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View className="bg-white bg-opacity-10 rounded-xl p-3 text-center">
      <Text className="block text-white text-2xl font-bold">{value}</Text>
      <Text className="block text-white text-white-opacity-70 text-xs">{label}</Text>
    </View>
  )
}
