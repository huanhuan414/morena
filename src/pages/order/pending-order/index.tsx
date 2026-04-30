import { useLoad, useRouter, navigateBack, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import * as Network from '@/network'
import {
  ArrowLeft, Check, X, Clock, FileText, Award,
  Sparkles, Link2
} from 'lucide-react-taro'

// 平台名称映射
const PLATFORM_NAMES: Record<string, string> = {
  wechat_mp: '微信公众号',
  wechat_moments: '微信朋友圈',
  wechat_video: '微信视频号',
  xiaohongshu: '小红书',
  douyin: '抖音',
  weibo: '微博',
  bilibili: 'B站',
  kuaishou: '快手'
}

export default function PendingOrderPage() {
  const router = useRouter()
  const requestId = router.params.requestId

  const [request, setRequest] = useState<any>(null)
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useLoad(() => {
    if (requestId) {
      fetchRequestData()
    } else {
      showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => navigateBack(), 1500)
    }
  })

  const fetchRequestData = async () => {
    setLoading(true)
    try {
      console.log('[PendingOrder] 正在获取派单请求数据...', { requestId })

      // 获取待确认的派单请求
      const res = await Network.request({
        url: '/api/order-dispatch/pending-requests'
      })

      console.log('[PendingOrder] 响应数据:', res.data)

      if (res.data?.code === 200) {
        const pendingRequests = res.data.data || []
        const foundRequest = pendingRequests.find((r: any) => r.id === requestId)

        if (foundRequest) {
          setRequest(foundRequest)
          setOrder(foundRequest.orders)
          console.log('[PendingOrder] 找到派单请求:', JSON.stringify(foundRequest, null, 2))
        } else {
          console.error('[PendingOrder] 未找到对应的派单请求')
          showToast({ title: '订单不存在或已处理', icon: 'none' })
          setTimeout(() => navigateBack(), 1500)
        }
      } else {
        console.error('[PendingOrder] 获取数据失败:', res.data)
        showToast({ title: '获取数据失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[PendingOrder] 获取数据失败:', error)
      showToast({ title: '获取数据失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!requestId || !request?.avatars?.id || submitting) return

    setSubmitting(true)
    try {
      console.log('[PendingOrder] 确认订单请求:', requestId)

      const res = await Network.request({
        url: `/api/order-dispatch/request/${requestId}/confirm`,
        method: 'PUT',
        data: { avatarId: request.avatars.id }
      })

      console.log('[PendingOrder] 确认响应:', res.data)

      if (res.data?.code === 200) {
        showToast({ title: '已确认接单', icon: 'success' })
        setTimeout(() => {
          navigateBack()
        }, 1500)
      } else {
        showToast({ title: res.data?.msg || '确认失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[PendingOrder] 确认失败:', error)
      showToast({ title: '确认失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!requestId || !request?.avatars?.id || submitting) return

    setSubmitting(true)
    try {
      console.log('[PendingOrder] 拒绝订单请求:', requestId)

      const res = await Network.request({
        url: `/api/order-dispatch/request/${requestId}/reject`,
        method: 'PUT',
        data: { avatarId: request.avatars.id }
      })

      console.log('[PendingOrder] 拒绝响应:', res.data)

      if (res.data?.code === 200) {
        showToast({ title: '已拒绝', icon: 'none' })
        setTimeout(() => {
          navigateBack()
        }, 1500)
      } else {
        showToast({ title: res.data?.msg || '操作失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[PendingOrder] 拒绝失败:', error)
      showToast({ title: '操作失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const getPlatformNames = (platforms: string[]) => {
    if (!platforms || platforms.length === 0) return '不限平台'
    return platforms.map(p => PLATFORM_NAMES[p] || p).join('、')
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '不限'
    return new Date(dateStr).toLocaleDateString('zh-CN')
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Text className="text-gray-500">加载中...</Text>
      </View>
    )
  }

  if (!request || !order) {
    return (
      <View className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Text className="text-gray-500">订单不存在</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <View className="bg-white sticky top-0 z-50 px-4 py-3 flex items-center border-b border-gray-100">
        <View onClick={() => navigateBack()} className="p-2 -ml-2">
          <ArrowLeft size={24} color="#333333" />
        </View>
        <Text className="text-lg font-semibold text-gray-900 flex-1 text-center pr-10">订单详情</Text>
      </View>

      <ScrollView scrollY className="flex-1 px-4 py-4" style={{ height: 'calc(100vh - 140px)' }}>
        {/* 订单状态卡片 */}
        <View className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-5 mb-4">
          <View className="flex items-center mb-3">
            <Sparkles size={24} color="#ffffff" />
            <Text className="text-white text-lg font-semibold ml-2">新订单分配</Text>
          </View>
          <Text className="text-white text-opacity-90 text-sm">请确认是否接受此订单</Text>
        </View>

        {/* 订单信息 */}
        <View className="bg-white rounded-2xl p-5 mb-4">
          <Text className="text-xl font-bold text-gray-900 mb-4">{order.title}</Text>

          {/* 价格 */}
          <View className="flex items-center mb-4">
            <Text className="text-3xl font-bold text-purple-600">¥{order.budget}</Text>
            <Text className="text-gray-500 text-sm ml-2">订单预算</Text>
          </View>

          <View className="border-t border-gray-100 pt-4">
            {/* 平台 */}
            <View className="flex items-center mb-3">
              <Link2 size={18} color="#666666" />
              <Text className="text-gray-600 ml-2">发布平台：{getPlatformNames(order.platforms)}</Text>
            </View>

            {/* 截止日期 */}
            <View className="flex items-center mb-3">
              <Clock size={18} color="#666666" />
              <Text className="text-gray-600 ml-2">截止日期：{formatDate(order.deadline)}</Text>
            </View>

            {/* 订单类型 */}
            <View className="flex items-center mb-3">
              <FileText size={18} color="#666666" />
              <Text className="text-gray-600 ml-2">订单类型：{order.content_type || '内容创作'}</Text>
            </View>
          </View>
        </View>

        {/* 需求描述 */}
        <View className="bg-white rounded-2xl p-5 mb-4">
          <Text className="text-lg font-semibold text-gray-900 mb-3">需求描述</Text>
          <Text className="text-gray-600 leading-relaxed whitespace-pre-wrap">
            {order.description || '暂无详细描述'}
          </Text>
        </View>

        {/* 分身信息 */}
        {request.avatars && (
          <View className="bg-white rounded-2xl p-5 mb-4">
            <Text className="text-lg font-semibold text-gray-900 mb-3">推荐分身</Text>
            <View className="flex items-center">
              <Image
                src={request.avatars.avatar_url || '/assets/default-avatar.png'}
                className="w-14 h-14 rounded-full bg-gray-100"
                mode="aspectFill"
              />
              <View className="ml-3 flex-1">
                <Text className="text-gray-900 font-medium">{request.avatars.name}</Text>
                <View className="flex items-center mt-1">
                  <Award size={14} color="#7B3FE4" />
                  <Text className="text-purple-600 text-sm ml-1">Lv.{request.avatars.level || 1}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 匹配说明 */}
        <View className="bg-indigo-50 rounded-2xl p-5 mb-4">
          <Text className="text-lg font-semibold text-indigo-900 mb-2">为什么推荐这个分身？</Text>
          <Text className="text-indigo-700 text-sm leading-relaxed">
            {request.match_reason || '该分身与您的订单需求高度匹配，建议接受。'}
          </Text>
        </View>

        <View className="h-24" />
      </ScrollView>

      {/* 底部操作栏 */}
      <View className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 flex flex-row gap-3">
        <View className="flex-1">
          <View
            onClick={handleReject}
            className="bg-gray-100 rounded-xl py-4 flex items-center justify-center"
          >
            <X size={20} color="#666666" />
            <Text className="text-gray-600 font-medium ml-2">拒绝</Text>
          </View>
        </View>
        <View className="flex-1">
          <View
            onClick={handleConfirm}
            className="bg-purple-600 rounded-xl py-4 flex items-center justify-center"
          >
            <Check size={20} color="#ffffff" />
            <Text className="text-white font-medium ml-2">确认接单</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
