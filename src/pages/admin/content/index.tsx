import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Check, X, Trash2, MessageSquare } from 'lucide-react-taro'
import AdminLayout from '@/components/admin/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as Network from '@/network'
import './index.css'

interface Post {
  id: string
  user_id: string
  nickname: string
  avatar: string
  content: string
  images: string[]
  status: 'pending' | 'approved' | 'rejected'
  like_count: number
  comment_count: number
  created_at: string
}

export default function ContentManagement() {
  const [posts, setPosts] = useState<Post[]>([])
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    fetchPosts()
  }, [statusFilter])

  const fetchPosts = async () => {
    try {
      let url = '/api/admin/posts'
      const params: string[] = []
      if (statusFilter !== 'all') {
        params.push(`status=${statusFilter}`)
      }
      if (searchQuery) {
        params.push(`search=${encodeURIComponent(searchQuery)}`)
      }
      if (params.length > 0) {
        url += '?' + params.join('&')
      }

      const res = await Network.request({ url })
      if (res.data.code === 200) {
        setPosts(res.data.data.list)
        setTotal(res.data.data.total)
      }
    } catch (err) {
      console.error('获取帖子列表失败:', err)
    }
  }

  const handleReview = async (postId: string, status: 'approved' | 'rejected') => {
    try {
      const res = await Network.request({
        url: `/api/admin/posts/${postId}/review`,
        method: 'PUT',
        data: { status }
      })
      if (res.data.code === 200) {
        Taro.showToast({ 
          title: status === 'approved' ? '已通过' : '已驳回', 
          icon: 'success' 
        })
        fetchPosts()
      }
    } catch (err) {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  const handleDelete = (postId: string) => {
    Taro.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除该帖子吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await Network.request({
              url: `/api/admin/posts/${postId}`,
              method: 'DELETE'
            })
            if (result.data.code === 200) {
              Taro.showToast({ title: '删除成功', icon: 'success' })
              fetchPosts()
            }
          } catch (err) {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已驳回'
    }
    return map[status] || status
  }

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: '#f59e0b',
      approved: '#10b981',
      rejected: '#ef4444'
    }
    return map[status] || '#999'
  }

  return (
    <AdminLayout title="内容管理">
      <View className="content-page">
        {/* 顶部筛选栏 */}
        <View className="content-header">
          <View className="filter-tabs">
            {[
              { key: 'all', label: '全部' },
              { key: 'pending', label: '待审核' },
              { key: 'approved', label: '已通过' },
              { key: 'rejected', label: '已驳回' }
            ].map(item => (
              <View
                key={item.key}
                className={`filter-tab ${statusFilter === item.key ? 'active' : ''}`}
                onClick={() => setStatusFilter(item.key)}
              >
                <Text className="filter-text">{item.label}</Text>
              </View>
            ))}
          </View>
          
          <View className="search-box">
            <Input
              className="search-input"
              placeholder="搜索帖子内容..."
              value={searchQuery}
              onInput={(e: any) => setSearchQuery(e.detail?.value || '')}
            />
            <Button className="search-btn" onClick={fetchPosts}>
              <Text className="search-text">搜索</Text>
            </Button>
          </View>
        </View>

        <Text className="total-info">共 {total} 条帖子</Text>

        {/* 帖子列表 */}
        <View className="posts-list">
          {posts.map(post => (
            <View key={post.id} className="post-card">
              <View className="post-header">
                <View className="author-info">
                  <View className="author-avatar">
                    {post.avatar ? (
                      <Image className="avatar-img" src={post.avatar} mode="aspectFill" />
                    ) : (
                      <Text className="avatar-text">{post.nickname?.[0] || '?'}</Text>
                    )}
                  </View>
                  <View className="author-meta">
                    <Text className="author-name">{post.nickname}</Text>
                    <Text className="post-time">{post.created_at}</Text>
                  </View>
                </View>
                <View 
                  className="post-status" 
                  style={{ backgroundColor: getStatusColor(post.status) + '20' }}
                >
                  <Text style={{ color: getStatusColor(post.status) }}>
                    {getStatusText(post.status)}
                  </Text>
                </View>
              </View>
              
              <View 
                className="post-content" 
                onClick={() => {
                  setSelectedPost(post)
                  setShowDetail(true)
                }}
              >
                <Text className="content-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                  {post.content}
                </Text>
                
                {post.images && post.images.length > 0 && (
                  <View className="post-images">
                    {post.images.slice(0, 3).map((img, idx) => (
                      <Image key={idx} className="post-image" src={img} mode="aspectFill" />
                    ))}
                    {post.images.length > 3 && (
                      <View className="more-images">
                        <Text className="more-text">+{post.images.length - 3}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
              
              <View className="post-stats">
                <View className="stat-item">
                  <Text>👍 {post.like_count}</Text>
                </View>
                <View className="stat-item">
                  <MessageSquare size={14} color="#6b7280" />
                  <Text>{post.comment_count}</Text>
                </View>
              </View>
              
              <View className="post-actions">
                {post.status === 'pending' && (
                  <>
                    <Button 
                      className="action-btn approve"
                      onClick={() => handleReview(post.id, 'approved')}
                    >
                      <Check size={14} color="#10b981" />
                      <Text>通过</Text>
                    </Button>
                    <Button 
                      className="action-btn reject"
                      onClick={() => handleReview(post.id, 'rejected')}
                    >
                      <X size={14} color="#ef4444" />
                      <Text>驳回</Text>
                    </Button>
                  </>
                )}
                <Button 
                  className="action-btn delete"
                  onClick={() => handleDelete(post.id)}
                >
                  <Trash2 size={14} color="#ef4444" />
                  <Text>删除</Text>
                </Button>
              </View>
            </View>
          ))}
        </View>

        {/* 详情弹窗 */}
        {showDetail && selectedPost && (
          <View className="modal-overlay" onClick={() => setShowDetail(false)}>
            <View className="modal-content post-detail" onClick={(e) => e.stopPropagation()}>
              <View className="detail-header">
                <View className="author-info">
                  <View className="author-avatar">
                    {selectedPost.avatar ? (
                      <Image className="avatar-img" src={selectedPost.avatar} mode="aspectFill" />
                    ) : (
                      <Text className="avatar-text">{selectedPost.nickname?.[0] || '?'}</Text>
                    )}
                  </View>
                  <View className="author-meta">
                    <Text className="author-name">{selectedPost.nickname}</Text>
                    <Text className="post-time">{selectedPost.created_at}</Text>
                  </View>
                </View>
                <View className="close-btn" onClick={() => setShowDetail(false)}>
                  <Text>✕</Text>
                </View>
              </View>
              
              <Text className="detail-content">{selectedPost.content}</Text>
              
              {selectedPost.images && selectedPost.images.length > 0 && (
                <ScrollView className="detail-images" scrollX>
                  {selectedPost.images.map((img, idx) => (
                    <Image key={idx} className="detail-image" src={img} mode="aspectFill" />
                  ))}
                </ScrollView>
              )}
              
              <View className="detail-stats">
                <Text>👍 {selectedPost.like_count} 赞</Text>
                <Text>💬 {selectedPost.comment_count} 评论</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </AdminLayout>
  )
}
