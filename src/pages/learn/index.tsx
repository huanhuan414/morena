import { View, Text, ScrollView } from '@tarojs/components'
import { useLoad, useDidShow, redirectTo, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { GraduationCap, BookOpen, Award, Trophy, Star, Target, Clock, Flame, ChevronRight, Lock } from 'lucide-react-taro'
import './index.css'

interface Course {
  id: string
  title: string
  desc: string
  category: string
  duration: number
  progress: number
  lessons: number
  completed_lessons: number
  level: 'beginner' | 'intermediate' | 'advanced'
  locked: boolean
}

interface Achievement {
  id: string
  name: string
  desc: string
  icon: string
  unlocked: boolean
  unlocked_at?: string
}

export default function LearnPage() {
  const { isLoggedIn } = useUserStore()
  const [activeTab, setActiveTab] = useState<'courses' | 'paths' | 'achievements'>('courses')
  const [courses, setCourses] = useState<Course[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [stats, setStats] = useState({
    total_hours: 0,
    courses_completed: 0,
    skills_learned: 0,
    streak_days: 0,
    total_xp: 0
  })

  useLoad(() => {
    if (!isLoggedIn) {
      redirectTo({ url: '/pages/home/index' })
    }
  })

  useDidShow(() => {
    if (isLoggedIn) {
      fetchCourses()
      fetchAchievements()
      fetchStats()
    }
  })

  const fetchCourses = async () => {
    try {
      const res = await Network.request({ url: '/api/learn/courses' })
      if (res.data?.code === 200) {
        setCourses(res.data.data || [])
      }
    } catch (error) {
      // 模拟数据
      setCourses([
        { id: '1', title: 'AI对话基础', desc: '学习如何与AI高效沟通', category: '基础', duration: 30, progress: 75, lessons: 8, completed_lessons: 6, level: 'beginner', locked: false },
        { id: '2', title: '提示词工程', desc: '掌握提示词编写技巧', category: '进阶', duration: 45, progress: 30, lessons: 12, completed_lessons: 4, level: 'intermediate', locked: false },
        { id: '3', title: 'AI分身定制', desc: '打造专属AI助手', category: '核心', duration: 60, progress: 0, lessons: 10, completed_lessons: 0, level: 'intermediate', locked: false },
        { id: '4', title: '自动化工作流', desc: '构建AI自动化流程', category: '高级', duration: 90, progress: 0, lessons: 15, completed_lessons: 0, level: 'advanced', locked: true }
      ])
    }
  }

  const fetchAchievements = async () => {
    try {
      const res = await Network.request({ url: '/api/learn/achievements' })
      if (res.data?.code === 200) {
        setAchievements(res.data.data || [])
      }
    } catch (error) {
      // 模拟数据
      setAchievements([
        { id: '1', name: '初学者', desc: '完成第一门课程', icon: 'star', unlocked: true, unlocked_at: '2024-01-15' },
        { id: '2', name: '探索者', desc: '学习时长超过10小时', icon: 'trophy', unlocked: true, unlocked_at: '2024-01-20' },
        { id: '3', name: '专注达人', desc: '连续学习7天', icon: 'flame', unlocked: false },
        { id: '4', name: '知识大师', desc: '解锁所有技能', icon: 'award', unlocked: false }
      ])
    }
  }

  const fetchStats = async () => {
    try {
      const res = await Network.request({ url: '/api/user/learning-stats' })
      if (res.data?.code === 200) {
        setStats(res.data.data)
      }
    } catch (error) {
      setStats({
        total_hours: 12.5,
        courses_completed: 3,
        skills_learned: 8,
        streak_days: 5,
        total_xp: 1250
      })
    }
  }

  const learningPaths = [
    { id: 'basics', title: 'AI基础入门', courses: 4, duration: '2小时', progress: 60, level: 'beginner' },
    { id: 'advanced', title: 'AI进阶应用', courses: 6, duration: '4小时', progress: 20, level: 'intermediate' },
    { id: 'expert', title: 'AI专家认证', courses: 8, duration: '8小时', progress: 0, level: 'advanced' }
  ]

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return '#00ff88'
      case 'intermediate': return '#00f5ff'
      case 'advanced': return '#bf00ff'
      default: return '#fff'
    }
  }

  const getLevelText = (level: string) => {
    switch (level) {
      case 'beginner': return '入门'
      case 'intermediate': return '进阶'
      case 'advanced': return '高级'
      default: return level
    }
  }

  const startCourse = (courseId: string) => {
    const course = courses.find(c => c.id === courseId)
    if (course?.locked) {
      showToast({ title: '请先完成前置课程', icon: 'none' })
      return
    }
    showToast({ title: '即将开始学习', icon: 'success' })
  }

  const renderCourses = () => (
    <View className="courses-section">
      <View className="section-header">
        <Text className="section-title">推荐课程</Text>
        <Text className="section-more">查看全部</Text>
      </View>

      <View className="courses-list">
        {courses.map(course => (
          <View 
            key={course.id}
            className={`course-card ${course.locked ? 'locked' : ''}`}
            onClick={() => !course.locked && startCourse(course.id)}
          >
            <View className="course-header">
              <View className="course-category">
                <Text className="category-text">{course.category}</Text>
              </View>
              <View 
                className="course-level"
                style={{ background: `${getLevelColor(course.level)}20` }}
              >
                <Text className="level-text" style={{ color: getLevelColor(course.level) }}>
                  {getLevelText(course.level)}
                </Text>
              </View>
            </View>

            <Text className="course-title">{course.title}</Text>
            <Text className="course-desc">{course.desc}</Text>

            <View className="course-progress">
              <View className="progress-bar-bg">
                <View 
                  className="progress-bar-fill"
                  style={{ width: `${course.progress}%` }}
                />
              </View>
              <Text className="progress-text">{course.progress}%</Text>
            </View>

            <View className="course-meta">
              <View className="meta-item">
                <BookOpen size={14} color="rgba(255,255,255,0.4)" />
                <Text className="meta-text">{course.completed_lessons}/{course.lessons}课时</Text>
              </View>
              <View className="meta-item">
                <Clock size={14} color="rgba(255,255,255,0.4)" />
                <Text className="meta-text">{course.duration}分钟</Text>
              </View>
            </View>

            {course.locked && (
              <View className="locked-overlay">
                <Lock size={24} color="rgba(255,255,255,0.4)" />
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  )

  const renderPaths = () => (
    <View className="paths-section">
      <View className="section-header">
        <Text className="section-title">学习路径</Text>
      </View>

      <View className="paths-list">
        {learningPaths.map((path, idx) => (
          <View key={path.id} className="path-card">
            <View className="path-number">
              <Text className="number-text">{idx + 1}</Text>
            </View>
            <View className="path-content">
              <View className="path-header">
                <Text className="path-title">{path.title}</Text>
                <Badge 
                  className="path-level"
                  style={{ 
                    background: `${getLevelColor(path.level)}20`,
                    color: getLevelColor(path.level)
                  }}
                >
                  {getLevelText(path.level)}
                </Badge>
              </View>
              <View className="path-meta">
                <Text className="path-courses">{path.courses}门课程</Text>
                <Text className="path-dot">·</Text>
                <Text className="path-duration">{path.duration}</Text>
              </View>
              <View className="path-progress">
                <View className="progress-bar-bg">
                  <View 
                    className="progress-bar-fill"
                    style={{ width: `${path.progress}%` }}
                  />
                </View>
                <Text className="progress-text">{path.progress}%</Text>
              </View>
            </View>
            <ChevronRight size={20} color="rgba(255,255,255,0.2)" />
          </View>
        ))}
      </View>
    </View>
  )

  const renderAchievements = () => (
    <View className="achievements-section">
      <View className="section-header">
        <Text className="section-title">成就徽章</Text>
        <Text className="achievement-count">{achievements.filter(a => a.unlocked).length}/{achievements.length}</Text>
      </View>

      <View className="achievements-grid">
        {achievements.map(achievement => (
          <View 
            key={achievement.id}
            className={`achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}`}
          >
            <View className="achievement-icon">
              {achievement.icon === 'star' && <Star size={28} color={achievement.unlocked ? '#ffaa00' : 'rgba(255,255,255,0.2)'} />}
              {achievement.icon === 'trophy' && <Trophy size={28} color={achievement.unlocked ? '#00f5ff' : 'rgba(255,255,255,0.2)'} />}
              {achievement.icon === 'flame' && <Flame size={28} color={achievement.unlocked ? '#ff6b6b' : 'rgba(255,255,255,0.2)'} />}
              {achievement.icon === 'award' && <Award size={28} color={achievement.unlocked ? '#bf00ff' : 'rgba(255,255,255,0.2)'} />}
            </View>
            <Text className="achievement-name">{achievement.name}</Text>
            <Text className="achievement-desc">{achievement.desc}</Text>
            {achievement.unlocked && achievement.unlocked_at && (
              <Text className="achievement-date">{achievement.unlocked_at}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  )

  if (!isLoggedIn) return null

  return (
    <View className="learn-page">
      {/* 顶部统计 */}
      <View className="stats-section">
        <View className="stats-bg" />
        <View className="stats-content">
          <View className="stats-header">
            <GraduationCap size={24} color="#00f5ff" />
            <Text className="stats-title">学习中心</Text>
          </View>
          
          <View className="stats-grid">
            <View className="stat-item main-stat">
              <Text className="stat-value">{stats.total_hours}</Text>
              <Text className="stat-label">学习小时</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-item">
              <Text className="stat-value">{stats.courses_completed}</Text>
              <Text className="stat-label">完成课程</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-item">
              <Text className="stat-value">{stats.streak_days}</Text>
              <Text className="stat-label">连续天数</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-item">
              <Text className="stat-value">{stats.total_xp}</Text>
              <Text className="stat-label">经验值</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Tab切换 */}
      <View className="tabs-section">
        <View 
          className={`tab-item ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          <BookOpen size={18} color={activeTab === 'courses' ? '#00f5ff' : 'rgba(255,255,255,0.4)'} />
          <Text className="tab-text">课程</Text>
        </View>
        <View 
          className={`tab-item ${activeTab === 'paths' ? 'active' : ''}`}
          onClick={() => setActiveTab('paths')}
        >
          <Target size={18} color={activeTab === 'paths' ? '#00f5ff' : 'rgba(255,255,255,0.4)'} />
          <Text className="tab-text">路径</Text>
        </View>
        <View 
          className={`tab-item ${activeTab === 'achievements' ? 'active' : ''}`}
          onClick={() => setActiveTab('achievements')}
        >
          <Award size={18} color={activeTab === 'achievements' ? '#00f5ff' : 'rgba(255,255,255,0.4)'} />
          <Text className="tab-text">成就</Text>
        </View>
      </View>

      {/* 内容区域 */}
      <ScrollView className="content-scroll" scrollY>
        {activeTab === 'courses' && renderCourses()}
        {activeTab === 'paths' && renderPaths()}
        {activeTab === 'achievements' && renderAchievements()}
        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
