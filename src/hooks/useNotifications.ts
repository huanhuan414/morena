import { useState, useEffect, useCallback, useRef } from 'react'
import { Network } from '@/network'

export interface Notification {
  id: string
  type: string
  title: string
  content: string
  isRead: boolean
  createdAt: string
  metadata?: Record<string, any>
}

interface UseNotificationsOptions {
  pollInterval?: number // 轮询间隔，默认 10 秒
  onNewNotification?: (notification: Notification) => void // 新通知回调
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { pollInterval = 10000, onNewNotification } = options
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null)
  const lastFetchTime = useRef<number>(0)

  const normalizeNotification = useCallback((n: any): Notification => {
    const isRead = Boolean(n?.isRead ?? n?.is_read)
    const createdAt = n?.createdAt || n?.created_at || ''
    let metadata = n?.metadata
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata) } catch { metadata = {} }
    }
    return {
      id: n?.id,
      type: n?.type,
      title: n?.title,
      content: n?.content,
      isRead,
      createdAt,
      metadata: metadata || {}
    }
  }, [])

  // 获取通知列表
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await Network.request({
        url: '/api/notifications'
      })
      console.log('[useNotifications] 获取通知:', res.data)
      
      if (res.data?.code === 200 && res.data?.data) {
        const list = (res.data.data.list || res.data.data || []).map(normalizeNotification)
        setNotifications(list)
        setUnreadCount(res.data.data.total || list.filter((n: any) => !n.isRead).length)
        lastFetchTime.current = Date.now()
      }
    } catch (err) {
      console.error('[useNotifications] 获取通知失败:', err)
    }
  }, [normalizeNotification])

  // 获取未读数量
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await Network.request({
        url: '/api/notifications/unread-count'
      })
      console.log('[useNotifications] 未读数量:', res.data)
      
      if (res.data?.code === 200) {
        const count = res.data.data?.count || 0
        setUnreadCount(count)
        
        // 如果有新的未读通知且距离上次获取超过 5 秒，弹窗显示
        if (count > 0 && Date.now() - lastFetchTime.current > 5000) {
          // 获取最新的一条未读通知
          const notifRes = await Network.request({
            url: '/api/notifications'
          })
          if (notifRes.data?.data?.list?.length > 0) {
            const unreadNotifications = notifRes.data.data.list
              .map(normalizeNotification)
              .filter((n: any) => !n.isRead)
            if (unreadNotifications.length > 0) {
              const latest = unreadNotifications[0]
              setCurrentNotification(latest)
              setShowModal(true)
              onNewNotification?.(latest)
            }
          }
        }
      }
    } catch (err) {
      console.error('[useNotifications] 获取未读数量失败:', err)
    }
  }, [onNewNotification, normalizeNotification])

  // 标记单条为已读
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await Network.request({
        url: `/api/notifications/${notificationId}/read`,
        method: 'PUT'
      })
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, isRead: true } : n
      ))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('[useNotifications] 标记已读失败:', err)
    }
  }, [])

  // 标记全部已读
  const markAllAsRead = useCallback(async () => {
    try {
      await Network.request({
        url: '/api/notifications/read-all',
        method: 'PUT'
      })
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('[useNotifications] 标记全部已读失败:', err)
    }
  }, [])

  // 关闭弹窗
  const closeModal = useCallback(() => {
    if (currentNotification && !currentNotification.isRead) {
      markAsRead(currentNotification.id)
    }
    setShowModal(false)
    setCurrentNotification(null)
  }, [currentNotification, markAsRead])

  // 初始加载和轮询
  useEffect(() => {
    // 延迟首次加载，避免与页面初始化并发
    const timer = setTimeout(() => {
      fetchNotifications()
    }, 3000)
    
    const interval = setInterval(() => {
      fetchUnreadCount()
    }, pollInterval)
    
    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [fetchNotifications, fetchUnreadCount, pollInterval])

  return {
    notifications,
    unreadCount,
    showModal,
    currentNotification,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    closeModal
  }
}
