import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronDown, ChevronUp, ChevronRight, CircleQuestionMark, BookOpen, Video, MessageCircle } from 'lucide-react-taro'

interface HelpItem {
  id: string
  category: string
  question: string
  answer: string
}

const HELP_ITEMS: HelpItem[] = [
  {
    id: '1',
    category: 'create',
    question: '如何创建AI分身？',
    answer: '1. 点击底部"分身"Tab\n2. 点击"创建分身"按钮\n3. 填写分身名称、描述\n4. 设置性格特点和技能\n5. 上传头像\n6. 点击"创建完成"'
  },
  {
    id: '2',
    category: 'create',
    question: '分身性格怎么设置？',
    answer: '在创建或编辑分身时，可以设置：\n• 性格标签：活泼、稳重、幽默、专业等\n• 说话风格：正式、随意、亲切等\n• 知识领域：选择擅长的技能\n• 回复偏好：简短、详细、有趣等'
  },
  {
    id: '3',
    category: 'hosting',
    question: '什么是分身托管？',
    answer: '分身托管是指让你的AI分身24小时在线，自动为其他用户提供服务。你可以：\n• 设置服务价格\n• 选择服务时间\n• 查看服务统计\n• 获得托管收益'
  },
  {
    id: '4',
    category: 'hosting',
    question: '如何开启托管赚钱？',
    answer: '1. 进入分身详情页\n2. 点击"托管设置"\n3. 开启"自动托管"开关\n4. 设置服务价格\n5. 确认托管时间\n6. 点击"开启托管"\n\n收益将自动计入你的账户'
  },
  {
    id: '5',
    category: 'order',
    question: '如何发布技能订单？',
    answer: '1. 点击底部"我的"→"发布订单"\n2. 选择订单类型\n3. 填写订单详情\n4. 设置价格和截止时间\n5. 选择执行的分身\n6. 确认发布\n\n分身将自动帮你完成订单'
  },
  {
    id: '6',
    category: 'order',
    question: '订单完成后怎么收钱？',
    answer: '订单完成后：\n1. 买家确认收货\n2. 系统自动结算\n3. 收益进入"我的钱包"\n4. 可申请提现到微信/支付宝\n\n提现一般1-3个工作日到账'
  },
  {
    id: '7',
    category: 'earn',
    question: '怎么邀请好友赚钱？',
    answer: '1. 进入"我的"→"推广中心"\n2. 复制你的专属邀请码\n3. 分享给好友\n4. 好友注册并完成首单\n5. 你获得佣金奖励\n\n佣金比例：好友消费的10%'
  },
  {
    id: '8',
    category: 'earn',
    question: '有哪些赚钱方式？',
    answer: '平台提供多种赚钱方式：\n• 分身托管：24小时自动服务赚钱\n• 发布订单：出售技能服务\n• 邀请好友：推广佣金10%\n• 任务奖励：完成新手任务\n• 活动奖励：参与平台活动'
  }
]

const CATEGORIES = [
  { key: 'all', label: '全部', icon: CircleQuestionMark },
  { key: 'create', label: '创建分身', icon: BookOpen },
  { key: 'hosting', label: '托管赚钱', icon: Video },
  { key: 'order', label: '发布订单', icon: MessageCircle },
  { key: 'earn', label: '赚钱攻略', icon: MessageCircle }
]

export default function HelpCenter() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filteredItems = activeCategory === 'all'
    ? HELP_ITEMS
    : HELP_ITEMS.filter(item => item.category === activeCategory)

  return (
    <View className="flex flex-col min-h-screen bg-gray-50">
      {/* 顶部标题 */}
      <View className="bg-gradient-to-r from-indigo-500 to-purple-500 px-5 pt-8 pb-6">
        <Text className="block text-2xl font-bold text-white mb-1">新手指南</Text>
        <Text className="block text-sm text-white opacity-80">快速了解如何创建分身、托管赚钱</Text>
      </View>

      {/* 快速入口 */}
      <View className="flex flex-row gap-2 px-4 py-4 overflow-x-auto bg-white">
        {CATEGORIES.map(cat => (
          <View
            key={cat.key}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-full flex-shrink-0 ${
              activeCategory === cat.key
                ? 'bg-blue-50 border border-blue-200'
                : 'bg-gray-50 border border-transparent'
            }`}
            onClick={() => setActiveCategory(cat.key)}
          >
            <cat.icon
              size={22}
              color={activeCategory === cat.key ? '#3b82f6' : '#6b7280'}
            />
            <Text
              className={`block text-xs whitespace-nowrap ${
                activeCategory === cat.key
                  ? 'text-blue-500 font-medium'
                  : 'text-gray-500'
              }`}
            >
              {cat.label}
            </Text>
          </View>
        ))}
      </View>

      {/* 视频教程入口 */}
      <View className="px-4 pb-3">
        <View
          className="flex flex-row items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-100"
          onClick={() => Taro.showToast({ title: '视频教程开发中', icon: 'none' })}
        >
          <View className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <Video size={24} color="#ef4444" />
          </View>
          <View className="flex-1">
            <Text className="block text-base font-semibold text-gray-800">视频教程</Text>
            <Text className="block text-sm text-gray-500 mt-1">3分钟学会所有功能</Text>
          </View>
          <ChevronRight size={18} color="#9ca3af" />
        </View>
      </View>

      {/* FAQ列表 */}
      <ScrollView className="flex-1 px-4 pb-6" scrollY>
        <Text className="block text-base font-semibold text-gray-800 mb-3 mt-1">常见问题</Text>
        {filteredItems.map(item => (
          <View key={item.id} className="mb-2 bg-white rounded-xl overflow-hidden shadow-sm">
            <View
              className="flex flex-row items-center justify-between px-4 py-3"
              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
            >
              <Text className={`block text-base flex-1 pr-3 ${expandedId === item.id ? 'text-blue-500 font-medium' : 'text-gray-800'}`}>
                {item.question}
              </Text>
              {expandedId === item.id ? (
                <ChevronUp size={18} color="#6b7280" className="flex-shrink-0" />
              ) : (
                <ChevronDown size={18} color="#6b7280" className="flex-shrink-0" />
              )}
            </View>
            {expandedId === item.id && (
              <View className="px-4 pb-4 border-t border-gray-100">
                <Text className="block text-sm text-gray-600 leading-relaxed mt-3 whitespace-pre-wrap">
                  {item.answer}
                </Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* 客服入口 */}
      <View className="px-4 py-5 bg-white border-t border-gray-100">
        <View className="flex flex-row items-center justify-center gap-2" onClick={() => Taro.showToast({ title: '客服功能开发中', icon: 'none' })}>
          <Text className="block text-sm text-gray-500">还有其他问题？</Text>
          <View className="flex flex-row items-center gap-1">
            <MessageCircle size={16} color="#3b82f6" />
            <Text className="block text-sm text-blue-500 font-medium">联系客服</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
