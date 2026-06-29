import { create } from 'zustand'
import { setStorageSync, getStorageSync, removeStorageSync } from '@tarojs/taro'
import { Network } from '@/network'

// 判断是否为 H5 环境
const isH5 = typeof window !== 'undefined' && typeof document !== 'undefined'

interface User {
  id: string
  openid?: string
  nickname: string
  avatar: string
  avatarId?: string
  phone?: string
  bio?: string
  level?: number
  exp?: number
  credits?: number
  created_at?: string
  updated_at?: string
}

interface UserState {
  userInfo: User | null
  token: string
  isLoggedIn: boolean
  avatarId?: string
  isDarkMode: boolean
  setUserInfo: (info: User) => void
  setToken: (token: string) => void
  setLoggedIn: (status: boolean) => void
  setAvatarId: (avatarId: string) => void
  setDarkMode: (isDark: boolean) => void
  toggleDarkMode: () => void
  logout: () => void
  login: (code: string) => Promise<void>
  loadUserFromStorage: () => Promise<void>
}

export const useUserStore = create<UserState>((set, get) => ({
  userInfo: null,
  token: '',
  isLoggedIn: false,
  avatarId: undefined,
  isDarkMode: false, // 默认浅色模式

  setUserInfo: (info) => {
    setStorageSync('userInfo', info)
    set({ userInfo: info, isLoggedIn: true })
  },

  setToken: (token) => {
    setStorageSync('token', token)
    set({ token })
  },

  setLoggedIn: (status) => set({ isLoggedIn: status }),

  setAvatarId: (avatarId) => set({ avatarId }),

  setDarkMode: (isDark) => {
    setStorageSync('isDarkMode', isDark)
    set({ isDarkMode: isDark })
    // 仅在 H5 环境下操作 DOM
    if (isH5 && typeof document !== 'undefined') {
      if (isDark) {
        document.body.classList.add('dark')
      } else {
        document.body.classList.remove('dark')
      }
    }
  },

  toggleDarkMode: () => {
    const current = get().isDarkMode
    const newMode = !current
    get().setDarkMode(newMode)
  },

  logout: () => {
    removeStorageSync('token')
    removeStorageSync('userInfo')
    removeStorageSync('avatar_create_draft_v3')
    removeStorageSync('mind_chat_focus_avatar')
    removeStorageSync('onboarding_new_avatar_id')
    removeStorageSync('isDarkMode')
    removeStorageSync('hasSubscribedFeedback')
    removeStorageSync('dismissed_order_ids')
    set({ userInfo: null, token: '', isLoggedIn: false, avatarId: undefined, isDarkMode: false })
  },

  login: async (code: string) => {
    try {
      const res = await Network.request({
        url: '/api/auth/wechat-login',
        method: 'POST',
        data: { code }
      })
      
      if (res.data?.code === 200) {
        const { user, token } = res.data.data
        get().setToken(token)
        get().setUserInfo(user)
        setStorageSync('userInfo', user)
      } else {
        throw new Error(res.data?.message || '登录失败')
      }
    } catch (error) {
      console.error('登录失败:', error)
      throw error
    }
  },

  loadUserFromStorage: async () => {
    try {
      const token = getStorageSync('token')
      const userInfo = getStorageSync('userInfo')
      const isDarkMode = getStorageSync('isDarkMode')

      if (token && userInfo) {
        set({ token, userInfo, isLoggedIn: true })
      }

      // 加载主题设置
      if (typeof isDarkMode === 'boolean') {
        set({ isDarkMode })
        // 仅在 H5 环境下操作 DOM
        if (isH5 && typeof document !== 'undefined') {
          if (isDarkMode) {
            document.body.classList.add('dark')
          } else {
            document.body.classList.remove('dark')
          }
        }
      }
    } catch (error) {
      console.error('加载用户信息失败:', error)
    }
  }
}))
