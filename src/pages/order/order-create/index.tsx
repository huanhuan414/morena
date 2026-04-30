import { View, Text, Input, Textarea, ScrollView } from '@tarojs/components'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import './index.css'

const PLATFORMS = [
  { id: 'wechat', name: '微信', icon: '💬' },
  { id: 'douyin', name: '抖音', icon: '🎵' },
  { id: 'xiaohongshu', name: '小红书', icon: '📕' },
  { id: 'weibo', name: '微博', icon: '🌐' },
  { id: 'zhihu', name: '知乎', icon: '💭' }
]

const BUDGET_OPTIONS = [50, 100, 200, 500, 1000]

export default function OrderCreate() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState('')
  const [budget, setBudget] = useState<number | ''>('')
  const [customBudget, setCustomBudget] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('请输入任务标题')
      return
    }
    if (!selectedPlatform) {
      setError('请选择发布平台')
      return
    }
    const finalBudget = budget || (customBudget ? parseInt(customBudget) : 0)
    if (finalBudget <= 0) {
      setError('请选择或输入预算')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await Network.request({
        url: '/api/order/create',
        method: 'POST',
        data: {
          title: title.trim(),
          description: description.trim(),
          platform: selectedPlatform,
          budget: finalBudget
        }
      })
      console.log('创建订单结果:', res.data)
      if (res.data?.code === 200) {
        Taro.showToast({ title: '创建成功', icon: 'success' })
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        setError(res.data?.message || '创建失败')
      }
    } catch (err: any) {
      console.error('创建订单失败:', err)
      setError(err.message || '网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-20">
      <ScrollView>
        <View className="p-4">
          {/* 任务标题 */}
          <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="block text-sm font-medium text-gray-700 mb-2">任务标题 *</Text>
            <View className="bg-gray-50 rounded-lg px-3 py-2">
              <Input
                className="w-full text-base"
                placeholder="例如：帮我写一篇关于AI的种草文案"
                value={title}
                onInput={(e) => setTitle(e.detail.value)}
                maxlength={100}
              />
            </View>
          </View>

          {/* 任务描述 */}
          <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="block text-sm font-medium text-gray-700 mb-2">详细描述</Text>
            <View className="bg-gray-50 rounded-lg px-3 py-2">
              <Textarea
                style={{ width: '100%', minHeight: '100px', backgroundColor: 'transparent' }}
                className="text-base"
                placeholder="详细描述你的任务需求，帮助分身更好地理解..."
                value={description}
                onInput={(e) => setDescription(e.detail.value)}
                maxlength={500}
              />
            </View>
          </View>

          {/* 发布平台 */}
          <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="block text-sm font-medium text-gray-700 mb-3">发布平台 *</Text>
            <View className="flex flex-wrap gap-2">
              {PLATFORMS.map(platform => (
                <View
                  key={platform.id}
                  className={`px-4 py-2 rounded-full border-2 ${
                    selectedPlatform === platform.id
                      ? 'border-primary bg-primary/10'
                      : 'border-gray-200'
                  }`}
                  onClick={() => setSelectedPlatform(platform.id)}
                >
                  <Text className="block text-sm">
                    {platform.icon} {platform.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* 预算 */}
          <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="block text-sm font-medium text-gray-700 mb-3">预算金额 *</Text>
            <View className="flex flex-wrap gap-2 mb-3">
              {BUDGET_OPTIONS.map(amount => (
                <View
                  key={amount}
                  className={`px-4 py-2 rounded-lg border-2 ${
                    budget === amount
                      ? 'border-primary bg-primary/10'
                      : 'border-gray-200'
                  }`}
                  onClick={() => {
                    setBudget(amount)
                    setCustomBudget('')
                  }}
                >
                  <Text className="block text-sm text-gray-700">¥{amount}</Text>
                </View>
              ))}
            </View>
            <View className="flex items-center gap-2">
              <Text className="block text-sm text-gray-500">自定义金额:</Text>
              <View className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                <Input
                  className="w-full text-base"
                  type="number"
                  placeholder="输入金额"
                  value={customBudget}
                  onInput={(e) => {
                    setCustomBudget(e.detail.value)
                    setBudget('')
                  }}
                />
              </View>
              <Text className="block text-sm text-gray-500">元</Text>
            </View>
          </View>

          {/* 错误提示 */}
          {error && (
            <View className="bg-red-50 rounded-lg p-3 mb-4">
              <Text className="block text-sm text-red-600">{error}</Text>
            </View>
          )}

          {/* 提交按钮 */}
          <View
            className={`py-3 rounded-full text-center ${
              loading ? 'bg-gray-300' : 'bg-primary'
            }`}
            onClick={loading ? undefined : handleSubmit}
          >
            <Text className="block text-white font-medium">
              {loading ? '提交中...' : '立即创建订单'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
