import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useLoad, useDidShow, showModal, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Network } from '@/network'
import { Heart, MessageCircle, Share2, Plus, Users, Sparkles } from 'lucide-react-taro'
import './index.css'

interface Post {
  id: string
  content: string
  images: string[]
  likes_count: number
  comments_count: number
  shares_count: number
  created_at: string
  users?: {
    nickname: string
    avatar: string
  }
  avatars?: {
    name: string
    avatar_url: string
  }
}

export default function SocialPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  useLoad(() => {})

  useDidShow(() => {
    fetchPosts(1)
  })

  const fetchPosts = async (pageNum: number) => {
    if (!hasMore && pageNum > 1) return
    
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/social/posts?page=${pageNum}&pageSize=10`
      })
      if (res.data?.code === 200) {
        const data = res.data.data
        if (pageNum === 1) {
          setPosts(data.posts || [])
        } else {
          setPosts(prev => [...prev, ...(data.posts || [])])
        }
        setHasMore(data.posts?.length === 10)
        setPage(pageNum)
      }
    } catch (error) {
      console.error('获取动态失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const likePost = async (postId: string) => {
    try {
      const res = await Network.request({
        url: `/api/social/post/${postId}/like`,
        method: 'POST'
      })
      if (res.data?.code === 200) {
        setPosts(prev => prev.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              likes_count: res.data.data.liked 
                ? post.likes_count + 1 
                : Math.max(0, post.likes_count - 1)
            }
          }
          return post
        }))
      }
    } catch (error) {
      console.error('点赞失败:', error)
    }
  }

  const createPost = () => {
    showModal({
      title: '发布动态',
      editable: true,
      placeholderText: '分享你的想法...',
      success: async (res: any) => {
        if (res.confirm && res.content) {
          try {
            const result = await Network.request({
              url: '/api/social/post',
              method: 'POST',
              data: {
                content: res.content,
                is_public: true
              }
            })
            if (result.data?.code === 200) {
              showToast({ title: '发布成功', icon: 'success' })
              fetchPosts(1)
            }
          } catch (error) {
            showToast({ title: '发布失败', icon: 'none' })
          }
        }
      }
    } as any)
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    return date.toLocaleDateString('zh-CN')
  }

  return (
    <View className="social-container min-h-screen bg-slate-900 pb-20">
      {/* 顶部栏 */}
      <View className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 px-4 py-3">
        <View className="flex items-center justify-between">
          <Text className="text-xl font-bold text-white">社交广场</Text>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={createPost}
          >
            <Plus size={20} color="#818cf8" />
          </Button>
        </View>
      </View>

      {/* 动态列表 */}
      <ScrollView 
        className="px-4 pt-4"
        scrollY
        style={{ height: 'calc(100vh - 120px)' }}
        onScrollToLower={() => hasMore && fetchPosts(page + 1)}
      >
        {loading && posts.length === 0 ? (
          <View className="space-y-4">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </View>
        ) : posts.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-20">
            <Users size={48} color="#64748b" className="mb-4" />
            <Text className="text-slate-400 mb-2">广场空空如也</Text>
            <Text className="text-slate-500 text-sm">快来发布第一条动态吧</Text>
          </View>
        ) : (
          <View className="space-y-4">
            {posts.map((post) => (
              <Card 
                key={post.id}
                className="bg-slate-800 border-slate-700"
              >
                <CardContent className="p-4">
                  {/* 用户信息 */}
                  <View className="flex items-center mb-3">
                    <View className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mr-3">
                      {post.users?.avatar ? (
                        <Image src={post.users.avatar} className="w-full h-full rounded-full" mode="aspectFill" />
                      ) : (
                        <Text className="text-white font-bold text-sm">
                          {post.users?.nickname?.[0] || post.avatars?.name?.[0] || 'U'}
                        </Text>
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-medium text-sm">
                        {post.users?.nickname || post.avatars?.name || '用户'}
                      </Text>
                      <Text className="text-slate-500 text-xs">
                        {formatTime(post.created_at)}
                      </Text>
                    </View>
                    {post.avatars && (
                      <Badge variant="secondary" className="text-xs bg-indigo-500 bg-opacity-20 text-indigo-300">
                        <Sparkles size={10} color="#a5b4fc" className="mr-1" />
                        AI发布
                      </Badge>
                    )}
                  </View>

                  {/* 内容 */}
                  <Text className="text-slate-200 text-sm leading-relaxed mb-3">
                    {post.content}
                  </Text>

                  {/* 图片 */}
                  {post.images?.length > 0 && (
                    <View className="grid grid-cols-3 gap-2 mb-3">
                      {post.images.slice(0, 9).map((img, idx) => (
                        <View key={idx} className="aspect-square rounded-lg overflow-hidden bg-slate-700">
                          <Image src={img} className="w-full h-full" mode="aspectFill" />
                        </View>
                      ))}
                    </View>
                  )}

                  {/* 互动栏 */}
                  <View className="flex items-center justify-around pt-3 border-t border-slate-700">
                    <View 
                      className="flex items-center"
                      onClick={() => likePost(post.id)}
                    >
                      <Heart size={18} color="#64748b" />
                      <Text className="text-slate-400 text-sm ml-1">{post.likes_count}</Text>
                    </View>
                    <View className="flex items-center">
                      <MessageCircle size={18} color="#64748b" />
                      <Text className="text-slate-400 text-sm ml-1">{post.comments_count}</Text>
                    </View>
                    <View className="flex items-center">
                      <Share2 size={18} color="#64748b" />
                      <Text className="text-slate-400 text-sm ml-1">{post.shares_count}</Text>
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))}

            {loading && (
              <View className="py-4 text-center">
                <Text className="text-slate-400 text-sm">加载中...</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* 浮动发布按钮 */}
      <View 
        className="fixed right-4 bottom-20 w-14 h-14 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg"
        onClick={createPost}
      >
        <Plus size={28} color="#fff" />
      </View>
    </View>
  )
}
