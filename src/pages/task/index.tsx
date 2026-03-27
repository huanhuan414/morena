import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro, { switchTab } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { 
  Plus, Zap, Clock, Check, CircleAlert, 
  Play, Pause, Trash2, ChevronRight, 
  Loader, Brain, Sparkles, Target,
  Calendar, FileText
} from 'lucide-react-taro'
import './index.css'

interface Task {
  id: string
  title: string
  description?: string
  task_type: string
  priority: string
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  result?: any
  logs?: any[]
  created_at: string
  started_at?: string
  completed_at?: string
  avatars?: {
    name: string
    avatar_url: string
  }
}

interface Avatar {
  id: string
  name: string
  avatar_url: string
  personality: string
}

interface TaskStats {
  total: number
  pending: number
  executing: number
  completed: number
  failed: number
  cancelled: number
  byType: Record<string, number>
}

export default function TaskPage() {
  const { isLoggedIn } = useUserStore()
  const [tasks, setTasks] = useState<Task[]>([])
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'executing' | 'completed'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  
  // 创建任务表单
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    task_type: 'general',
    priority: 'normal',
    avatar_id: ''
  })
  const [creating, setCreating] = useState(false)
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) {
      switchTab({ url: '/pages/home/index' })
      return
    }
    loadData()
  }, [isLoggedIn])

  const loadData = async () => {
    setLoading(true)
    try {
      // 并行加载任务列表、分身列表和统计数据
      const [tasksRes, avatarsRes, statsRes] = await Promise.all([
        Network.request({ url: '/api/task' }),
        Network.request({ url: '/api/avatar' }),
        Network.request({ url: '/api/task/stats' })
      ])

      if (tasksRes.data?.code === 200) {
        setTasks(tasksRes.data.data || [])
      }
      
      if (avatarsRes.data?.code === 200) {
        const avatarList = avatarsRes.data.data || []
        setAvatars(avatarList)
        if (avatarList.length > 0) {
          setNewTask(prev => ({ ...prev, avatar_id: avatarList[0].id }))
        }
      }
      
      if (statsRes.data?.code === 200) {
        setStats(statsRes.data.data)
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTasks = tasks.filter(task => {
    if (activeTab === 'all') return true
    if (activeTab === 'pending') return task.status === 'pending'
    if (activeTab === 'executing') return task.status === 'executing'
    if (activeTab === 'completed') return task.status === 'completed' || task.status === 'failed'
    return true
  })

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      Taro.showToast({ title: '请输入任务标题', icon: 'none' })
      return
    }
    if (!newTask.avatar_id) {
      Taro.showToast({ title: '请选择执行分身', icon: 'none' })
      return
    }

    setCreating(true)
    try {
      const res = await Network.request({
        url: '/api/task',
        method: 'POST',
        data: newTask
      })

      if (res.data?.code === 200) {
        Taro.showToast({ title: '创建成功', icon: 'success' })
        setShowCreate(false)
        setNewTask({
          title: '',
          description: '',
          task_type: 'general',
          priority: 'normal',
          avatar_id: avatars[0]?.id || ''
        })
        loadData()
      }
    } catch (error) {
      console.error('创建任务失败:', error)
      Taro.showToast({ title: '创建失败', icon: 'none' })
    } finally {
      setCreating(false)
    }
  }

  const handleExecuteTask = async (taskId: string) => {
    setExecuting(true)
    try {
      const res = await Network.request({
        url: `/api/task/${taskId}/execute`,
        method: 'POST'
      })

      if (res.data?.code === 200) {
        Taro.showToast({ title: '任务执行完成', icon: 'success' })
        loadData()
        if (selectedTask?.id === taskId) {
          const detailRes = await Network.request({ url: `/api/task/${taskId}` })
          if (detailRes.data?.code === 200) {
            setSelectedTask(detailRes.data.data)
          }
        }
      }
    } catch (error) {
      console.error('执行任务失败:', error)
      Taro.showToast({ title: '执行失败', icon: 'none' })
    } finally {
      setExecuting(false)
    }
  }

  const handleCancelTask = async (taskId: string) => {
    try {
      const res = await Network.request({
        url: `/api/task/${taskId}/cancel`,
        method: 'POST'
      })

      if (res.data?.code === 200) {
        Taro.showToast({ title: '已取消', icon: 'success' })
        loadData()
      }
    } catch (error) {
      console.error('取消任务失败:', error)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await Network.request({
        url: `/api/task/${taskId}`,
        method: 'DELETE'
      })

      if (res.data?.code === 200) {
        Taro.showToast({ title: '已删除', icon: 'success' })
        setShowDetail(false)
        setSelectedTask(null)
        loadData()
      }
    } catch (error) {
      console.error('删除任务失败:', error)
    }
  }

  const openTaskDetail = async (task: Task) => {
    setSelectedTask(task)
    setShowDetail(true)
    
    // 获取最新详情
    try {
      const res = await Network.request({ url: `/api/task/${task.id}` })
      if (res.data?.code === 200) {
        setSelectedTask(res.data.data)
      }
    } catch (error) {
      console.error('获取任务详情失败:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={16} color="#ffaa00" />
      case 'executing': return <Loader size={16} color="#00f5ff" />
      case 'completed': return <Check size={16} color="#00ff88" />
      case 'failed': return <CircleAlert size={16} color="#ff4444" />
      case 'cancelled': return <Pause size={16} color="#888" />
      default: return <Clock size={16} color="#888" />
    }
  }

  const getStatusText = (status: string) => {
    const map = {
      pending: '待执行',
      executing: '执行中',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消'
    }
    return map[status] || status
  }

  const getTypeIcon = (type: string) => {
    const icons = {
      writing: <FileText size={16} color="#00f5ff" />,
      analysis: <Brain size={16} color="#bf00ff" />,
      research: <Target size={16} color="#00ff88" />,
      general: <Sparkles size={16} color="#ffaa00" />
    }
    return icons[type] || icons.general
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: '#888',
      normal: '#00f5ff',
      high: '#ffaa00',
      urgent: '#ff4444'
    }
    return colors[priority] || colors.normal
  }

  if (!isLoggedIn) return null

  return (
    <View className="task-page">
      {/* 头部统计 */}
      <View className="stats-header">
        <View className="stats-card">
          <Text className="stats-number">{stats?.total || 0}</Text>
          <Text className="stats-label">全部任务</Text>
        </View>
        <View className="stats-divider" />
        <View className="stats-card">
          <Text className="stats-number executing">{stats?.executing || 0}</Text>
          <Text className="stats-label">执行中</Text>
        </View>
        <View className="stats-divider" />
        <View className="stats-card">
          <Text className="stats-number completed">{stats?.completed || 0}</Text>
          <Text className="stats-label">已完成</Text>
        </View>
      </View>

      {/* 标签筛选 */}
      <View className="tabs-container">
        {[
          { id: 'all', name: '全部' },
          { id: 'pending', name: '待执行' },
          { id: 'executing', name: '执行中' },
          { id: 'completed', name: '已完成' }
        ].map(tab => (
          <View
            key={tab.id}
            className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            <Text className="tab-text">{tab.name}</Text>
          </View>
        ))}
      </View>

      {/* 任务列表 */}
      <ScrollView className="task-list" scrollY>
        {loading ? (
          <View className="loading-state">
            <Loader size={32} color="#00f5ff" className="loading-spinner" />
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : filteredTasks.length === 0 ? (
          <View className="empty-state">
            <Zap size={48} color="rgba(255,255,255,0.2)" />
            <Text className="empty-text">暂无任务</Text>
            <Text className="empty-hint">点击右下角按钮创建新任务</Text>
          </View>
        ) : (
          filteredTasks.map(task => (
            <View 
              key={task.id} 
              className="task-card"
              onClick={() => openTaskDetail(task)}
            >
              <View className="task-header">
                <View className="task-type-icon">
                  {getTypeIcon(task.task_type)}
                </View>
                <View className="task-info">
                  <Text className="task-title">{task.title}</Text>
                  <View className="task-meta">
                    <View className="meta-item">
                      {getStatusIcon(task.status)}
                      <Text className="meta-text">{getStatusText(task.status)}</Text>
                    </View>
                    <View className="meta-item">
                      <Text className="priority-dot" style={{ background: getPriorityColor(task.priority) }} />
                      <Text className="meta-text">{task.priority === 'urgent' ? '紧急' : task.priority === 'high' ? '高优' : '普通'}</Text>
                    </View>
                  </View>
                </View>
                <ChevronRight size={20} color="rgba(255,255,255,0.3)" />
              </View>
              
              {task.status === 'executing' && (
                <View className="progress-bar">
                  <View className="progress-fill" style={{ width: `${task.progress}%` }} />
                  <Text className="progress-text">{task.progress}%</Text>
                </View>
              )}
              
              {task.avatars && (
                <View className="task-avatar">
                  <Text className="avatar-label">执行分身:</Text>
                  <Text className="avatar-name">{task.avatars.name}</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* 创建任务按钮 */}
      <View className="create-fab" onClick={() => setShowCreate(true)}>
        <Plus size={28} color="#fff" />
      </View>

      {/* 创建任务弹窗 */}
      {showCreate && (
        <View className="modal-overlay" onClick={() => setShowCreate(false)}>
          <View className="modal-content create-modal" onClick={e => e.stopPropagation()}>
            <View className="modal-header">
              <Text className="modal-title">创建新任务</Text>
            </View>
            
            <ScrollView className="modal-body" scrollY>
              <View className="form-section">
                <Text className="form-label">任务标题</Text>
                <View className="input-wrap">
                  <Input
                    className="form-input"
                    placeholder="输入任务标题..."
                    value={newTask.title}
                    onInput={e => setNewTask({ ...newTask, title: e.detail.value })}
                  />
                </View>
              </View>

              <View className="form-section">
                <Text className="form-label">任务描述</Text>
                <View className="textarea-wrap">
                  <Textarea
                    className="form-textarea"
                    placeholder="详细描述任务内容..."
                    value={newTask.description}
                    onInput={e => setNewTask({ ...newTask, description: e.detail.value })}
                    maxlength={500}
                  />
                </View>
              </View>

              <View className="form-section">
                <Text className="form-label">任务类型</Text>
                <View className="type-options">
                  {[
                    { id: 'general', name: '通用', icon: Sparkles },
                    { id: 'writing', name: '写作', icon: FileText },
                    { id: 'analysis', name: '分析', icon: Brain },
                    { id: 'research', name: '研究', icon: Target }
                  ].map(type => {
                    const Icon = type.icon
                    return (
                      <View
                        key={type.id}
                        className={`type-option ${newTask.task_type === type.id ? 'selected' : ''}`}
                        onClick={() => setNewTask({ ...newTask, task_type: type.id })}
                      >
                        <Icon size={20} color={newTask.task_type === type.id ? '#00f5ff' : 'rgba(255,255,255,0.5)'} />
                        <Text className="type-text">{type.name}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>

              <View className="form-section">
                <Text className="form-label">优先级</Text>
                <View className="priority-options">
                  {[
                    { id: 'low', name: '低' },
                    { id: 'normal', name: '普通' },
                    { id: 'high', name: '高' },
                    { id: 'urgent', name: '紧急' }
                  ].map(p => (
                    <View
                      key={p.id}
                      className={`priority-option ${newTask.priority === p.id ? 'selected' : ''}`}
                      onClick={() => setNewTask({ ...newTask, priority: p.id })}
                    >
                      <Text className="priority-text">{p.name}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className="form-section">
                <Text className="form-label">执行分身</Text>
                <View className="avatar-options">
                  {avatars.map(avatar => (
                    <View
                      key={avatar.id}
                      className={`avatar-option ${newTask.avatar_id === avatar.id ? 'selected' : ''}`}
                      onClick={() => setNewTask({ ...newTask, avatar_id: avatar.id })}
                    >
                      <Text className="avatar-option-name">{avatar.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View className="modal-actions">
              <Button className="cancel-btn" onClick={() => setShowCreate(false)}>
                <Text className="cancel-btn-text">取消</Text>
              </Button>
              <Button className="submit-btn" onClick={handleCreateTask} disabled={creating}>
                {creating ? (
                  <Loader size={18} color="#0a0a0f" />
                ) : (
                  <Text className="submit-btn-text">创建任务</Text>
                )}
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 任务详情弹窗 */}
      {showDetail && selectedTask && (
        <View className="modal-overlay" onClick={() => setShowDetail(false)}>
          <View className="modal-content detail-modal" onClick={e => e.stopPropagation()}>
            <View className="modal-header">
              <View className="detail-header-info">
                <View className="detail-type-icon">
                  {getTypeIcon(selectedTask.task_type)}
                </View>
                <View className="detail-header-text">
                  <Text className="modal-title">{selectedTask.title}</Text>
                  <View className="detail-status">
                    {getStatusIcon(selectedTask.status)}
                    <Text className="detail-status-text">{getStatusText(selectedTask.status)}</Text>
                  </View>
                </View>
              </View>
            </View>

            <ScrollView className="modal-body" scrollY>
              {selectedTask.description && (
                <View className="detail-section">
                  <Text className="detail-label">任务描述</Text>
                  <Text className="detail-desc">{selectedTask.description}</Text>
                </View>
              )}

              {selectedTask.status === 'executing' && (
                <View className="detail-section">
                  <Text className="detail-label">执行进度</Text>
                  <View className="detail-progress">
                    <View className="progress-bar large">
                      <View className="progress-fill" style={{ width: `${selectedTask.progress}%` }} />
                    </View>
                    <Text className="progress-percent">{selectedTask.progress}%</Text>
                  </View>
                </View>
              )}

              {selectedTask.result && (
                <View className="detail-section">
                  <Text className="detail-label">执行结果</Text>
                  <View className="result-box">
                    <Text className="result-summary">{selectedTask.result.summary}</Text>
                    {selectedTask.result.steps?.map((step, idx) => (
                      <View key={idx} className="result-step">
                        <View className="step-header">
                          <Check size={14} color="#00ff88" />
                          <Text className="step-name">{step.step}</Text>
                        </View>
                        <Text className="step-output">{step.output}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {selectedTask.logs && selectedTask.logs.length > 0 && (
                <View className="detail-section">
                  <Text className="detail-label">执行日志</Text>
                  <View className="logs-box">
                    {selectedTask.logs.map((log, idx) => (
                      <View key={idx} className="log-item">
                        <Text className="log-time">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </Text>
                        <Text className="log-message">{log.message}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View className="detail-meta">
                <View className="meta-row">
                  <Calendar size={16} color="rgba(255,255,255,0.5)" />
                  <Text className="meta-text">
                    创建于 {new Date(selectedTask.created_at).toLocaleString()}
                  </Text>
                </View>
                {selectedTask.avatars && (
                  <View className="meta-row">
                    <Text className="meta-label">执行分身:</Text>
                    <Text className="meta-value">{selectedTask.avatars.name}</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View className="modal-actions">
              {selectedTask.status === 'pending' && (
                <Button 
                  className="execute-btn" 
                  onClick={() => handleExecuteTask(selectedTask.id)}
                  disabled={executing}
                >
                  {executing ? (
                    <Loader size={18} color="#0a0a0f" />
                  ) : (
                    <>
                      <Play size={18} color="#0a0a0f" />
                      <Text className="execute-btn-text">执行任务</Text>
                    </>
                  )}
                </Button>
              )}
              {selectedTask.status === 'executing' && (
                <Button 
                  className="cancel-task-btn" 
                  onClick={() => handleCancelTask(selectedTask.id)}
                >
                  <Pause size={18} color="#fff" />
                  <Text className="cancel-task-btn-text">取消任务</Text>
                </Button>
              )}
              <Button 
                className="delete-btn" 
                onClick={() => {
                  Taro.showModal({
                    title: '确认删除',
                    content: '确定要删除这个任务吗？',
                    success: (res) => {
                      if (res.confirm) {
                        handleDeleteTask(selectedTask.id)
                      }
                    }
                  })
                }}
              >
                <Trash2 size={18} color="#ff4444" />
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
