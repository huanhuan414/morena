import { View, Text, ScrollView } from '@tarojs/components'
import { navigateBack } from '@tarojs/taro'
import { useState } from 'react'
import { ChevronDown, ChevronUp, CircleQuestionMark, MessageCircle, Zap, Shield, Gift } from 'lucide-react-taro'
import './help.css'

export default function HelpPage() {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

  const faqCategories = [
    {
      name: 'AI分身',
      icon: Zap,
      color: '#00f5ff',
      items: [
        { question: '什么是AI分身？', answer: 'AI分身是你的智能助手，可以根据你的性格和习惯学习，帮你完成各种任务，如发帖、交友、学习等。' },
        { question: '如何创建AI分身？', answer: '点击「我的分身」→「创建分身」，填写基本信息并上传照片，AI会自动分析并生成独特的分身形象。' },
        { question: '分身托管是什么？', answer: '开启托管后，分身会自动帮你完成设置的任务，如自动发帖、评论、交友等，让你更高效地管理社交生活。' },
        { question: '分身如何升级？', answer: '通过日常对话、完成任务可以获得经验值，积累足够经验后分身会升级，解锁更多能力。' }
      ]
    },
    {
      name: '心智对话',
      icon: MessageCircle,
      color: '#bf00ff',
      items: [
        { question: '心智对话是什么？', answer: '心智对话是你与AI分身的专属交流空间，分身会记住你们的对话，越聊越懂你。' },
        { question: '分身能记住多少对话？', answer: '分身会保存最近的对话历史，并通过学习你的表达习惯来更好地理解你。' },
        { question: '如何开启新对话？', answer: '点击右上角的历史按钮，可以查看过往对话或开始新对话。' }
      ]
    },
    {
      name: '账户安全',
      icon: Shield,
      color: '#00ff88',
      items: [
        { question: '如何保护我的隐私？', answer: '我们采用端到端加密，你的对话内容只有你能看到。建议定期修改密码并绑定手机号。' },
        { question: '忘记密码怎么办？', answer: '如果绑定了手机号，可以通过短信验证重置密码。' },
        { question: '如何注销账户？', answer: '请联系客服处理账户注销请求，注销后数据将无法恢复。' }
      ]
    },
    {
      name: '会员特权',
      icon: Gift,
      color: '#ffaa00',
      items: [
        { question: '会员有什么特权？', answer: '会员可以创建更多分身、使用高级AI功能、优先体验新功能等。' },
        { question: '如何开通会员？', answer: '在个人中心点击会员入口，选择适合的套餐即可开通。' }
      ]
    }
  ]

  const toggleItem = (index: number) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  let globalIndex = 0

  return (
    <View className="help-page">
      {/* 顶部导航 */}
      <View className="help-header">
        <View className="header-back" onClick={() => navigateBack()}>
          <Text className="back-text">← 返回</Text>
        </View>
        <Text className="header-title">帮助中心</Text>
        <View className="header-placeholder" />
      </View>

      <ScrollView className="help-scroll" scrollY>
        {/* 搜索提示 */}
        <View className="search-tip">
          <CircleQuestionMark size={32} color="#00f5ff" />
          <Text className="tip-text">常见问题解答</Text>
        </View>

        {/* FAQ分类 */}
        {faqCategories.map((category, catIdx) => {
          const CategoryIcon = category.icon
          return (
            <View key={catIdx} className="faq-category">
              <View className="category-header">
                <View className="category-icon" style={{ background: `${category.color}20` }}>
                  <CategoryIcon size={20} color={category.color} />
                </View>
                <Text className="category-name">{category.name}</Text>
              </View>
              
              {category.items.map((item, itemIdx) => {
                const currentIndex = globalIndex++
                const isExpanded = expandedItems.has(currentIndex)
                
                return (
                  <View 
                    key={itemIdx}
                    className={`faq-item ${isExpanded ? 'expanded' : ''}`}
                  >
                    <View 
                      className="faq-question"
                      onClick={() => toggleItem(currentIndex)}
                    >
                      <Text className="question-text">{item.question}</Text>
                      {isExpanded ? (
                        <ChevronUp size={20} color="rgba(255,255,255,0.4)" />
                      ) : (
                        <ChevronDown size={20} color="rgba(255,255,255,0.4)" />
                      )}
                    </View>
                    {isExpanded && (
                      <View className="faq-answer">
                        <Text className="answer-text">{item.answer}</Text>
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          )
        })}

        {/* 联系客服 */}
        <View className="contact-section">
          <Text className="section-title">没有找到答案？</Text>
          <View className="contact-card">
            <Text className="contact-text">联系客服：support@morina.ai</Text>
            <Text className="contact-time">工作时间：9:00-18:00</Text>
          </View>
        </View>

        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
