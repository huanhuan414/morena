import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useLoad, navigateBack, showToast, chooseImage, getLocation } from '@tarojs/taro'
import { useState } from 'react'
import * as Network from '@/network'
import { ChevronLeft, Camera, MapPin, Sparkles } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import './index.css'

// 性格选项
const PERSONALITY_OPTIONS = [
  { key: 'friendly', label: '友善', icon: '😊', desc: '亲切友好，容易相处' },
  { key: 'professional', label: '专业', icon: '💼', desc: '严谨专业，高效可靠' },
  { key: 'creative', label: '创意', icon: '🎨', desc: '富有创意，思维活跃' },
  { key: 'humorous', label: '幽默', icon: '😄', desc: '风趣幽默，轻松愉快' },
  { key: 'gentle', label: '温柔', icon: '🌸', desc: '温和体贴，善解人意' },
  { key: 'outgoing', label: '外向', icon: '☀️', desc: '活泼开朗，善于交际' }
]

// 技能选项
const SKILL_OPTIONS = [
  { key: 'chat', label: '陪聊', icon: '💬' },
  { key: 'advice', label: '建议', icon: '💡' },
  { key: 'writing', label: '写作', icon: '✍️' },
  { key: 'translation', label: '翻译', icon: '🌐' },
  { key: 'coding', label: '编程', icon: '💻' },
  { key: 'analysis', label: '分析', icon: '📊' }
]

export default function AvatarCreatePage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [personality, setPersonality] = useState('friendly')
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['chat'])
  const [location, setLocation] = useState<{latitude: number; longitude: number; address: string} | null>(null)
  const [loading, setLoading] = useState(false)

  useLoad(() => {
    // 尝试获取位置信息
    getLocation({
      type: 'gcj02',
      success: (res) => {
        setLocation({
          latitude: res.latitude,
          longitude: res.longitude,
          address: ''
        })
      },
      fail: () => {
        console.log('获取位置失败')
      }
    })
  })

  // 选择头像
  const handleChooseAvatar = async () => {
    try {
      const res = await chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })

      if (res.tempFilePaths && res.tempFilePaths.length > 0) {
        const filePath = res.tempFilePaths[0]
        
        // 上传图片到服务器
        showToast({ title: '上传中...', icon: 'loading' })
        
        const uploadRes = await Network.uploadFile({
          url: '/api/upload/general-image',
          filePath: filePath,
          name: 'image'
        })

        const data = JSON.parse(uploadRes.data)
        if (data.code === 200 && data.data?.url) {
          setAvatarUrl(data.data.url)
          showToast({ title: '上传成功', icon: 'success' })
        } else {
          throw new Error(data.message || '上传失败')
        }
      }
    } catch (error: any) {
      console.error('上传头像失败:', error)
      showToast({ title: error.message || '上传失败', icon: 'none' })
    }
  }

  // 切换技能选择
  const toggleSkill = (skillKey: string) => {
    setSelectedSkills(prev => {
      if (prev.includes(skillKey)) {
        return prev.filter(k => k !== skillKey)
      }
      return [...prev, skillKey]
    })
  }

  // 创建分身
  const handleCreate = async () => {
    if (!name.trim()) {
      showToast({ title: '请输入分身名称', icon: 'none' })
      return
    }

    if (!avatarUrl) {
      showToast({ title: '请上传分身头像', icon: 'none' })
      return
    }

    setLoading(true)
    
    try {
      const res = await Network.request({
        url: '/api/avatar',
        method: 'POST',
        data: {
          name: name.trim(),
          description: description.trim(),
          avatar_url: avatarUrl,
          personality: personality,
          skills: selectedSkills,
          latitude: location?.latitude,
          longitude: location?.longitude,
          location_text: location?.address
        }
      })

      if (res.data?.code === 200) {
        showToast({ title: '创建成功', icon: 'success' })
        setTimeout(() => {
          navigateBack()
        }, 1500)
      } else {
        throw new Error(res.data?.message || '创建失败')
      }
    } catch (error: any) {
      console.error('创建分身失败:', error)
      showToast({ title: error.message || '创建失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="avatar-create-page">
      {/* 导航栏 */}
      <View className="nav-bar">
        <View className="nav-back" onClick={() => navigateBack()}>
          <ChevronLeft size={24} color="#1f2937" />
        </View>
        <Text className="nav-title">创建分身</Text>
        <View className="nav-placeholder" />
      </View>

      <ScrollView className="create-content" scrollY>
        {/* 头像上传 */}
        <View className="section">
          <Text className="section-title">分身头像</Text>
          <View className="avatar-upload" onClick={handleChooseAvatar}>
            {avatarUrl ? (
              <Image className="avatar-preview" src={avatarUrl} mode="aspectFill" />
            ) : (
              <View className="avatar-placeholder">
                <Camera size={32} color="#9ca3af" />
                <Text className="placeholder-text">点击上传</Text>
              </View>
            )}
          </View>
        </View>

        {/* 基本信息 */}
        <View className="section">
          <Text className="section-title">基本信息</Text>
          <View className="form-item">
            <Text className="form-label">分身名称</Text>
            <Input
              className="form-input"
              placeholder="给你的分身起个名字"
              value={name}
              onInput={(e) => setName(e.detail.value)}
              maxlength={20}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">分身介绍</Text>
            <Input
              className="form-input"
              placeholder="介绍一下你的分身"
              value={description}
              onInput={(e) => setDescription(e.detail.value)}
              maxlength={100}
            />
          </View>
        </View>

        {/* 性格选择 */}
        <View className="section">
          <Text className="section-title">性格特点</Text>
          <View className="personality-list">
            {PERSONALITY_OPTIONS.map(item => (
              <View
                key={item.key}
                className={`personality-item ${personality === item.key ? 'active' : ''}`}
                onClick={() => setPersonality(item.key)}
              >
                <Text className="personality-icon">{item.icon}</Text>
                <Text className="personality-label">{item.label}</Text>
                <Text className="personality-desc">{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 技能选择 */}
        <View className="section">
          <Text className="section-title">技能标签</Text>
          <View className="skills-list">
            {SKILL_OPTIONS.map(item => (
              <View
                key={item.key}
                className={`skill-tag ${selectedSkills.includes(item.key) ? 'active' : ''}`}
                onClick={() => toggleSkill(item.key)}
              >
                <Text className="skill-icon">{item.icon}</Text>
                <Text className="skill-label">{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 位置信息 */}
        {location && (
          <View className="section">
            <Text className="section-title">位置信息</Text>
            <View className="location-item">
              <MapPin size={16} color="#6b7280" />
              <Text className="location-text">
                {location.address || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
              </Text>
            </View>
          </View>
        )}

        {/* 底部按钮 */}
        <View className="bottom-actions">
          <Button 
            className="create-btn"
            onClick={handleCreate}
            disabled={loading || !name.trim() || !avatarUrl}
          >
            <Sparkles size={18} color="#fff" />
            <Text className="btn-text">{loading ? '创建中...' : '创建分身'}</Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  )
}
