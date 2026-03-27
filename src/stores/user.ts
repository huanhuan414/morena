import { create } from 'zustand'
import { setStorageSync, getStorageSync, removeStorageSync } from '@tarojs/taro'
import { Network } from '@/network'

interface User {
  id: string
  openid?: string
  nickname: string
  avatar: string
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
  setUserInfo: (info: User) => void
  setToken: (token: string) => void
  setLoggedIn: (status: boolean) => void
  logout: () => void
  login: (code: string) => Promise<void>
  loadUserFromStorage: () => Promise<void>
}

export const useUserStore = create<UserState>((set, get) => ({
  userInfo: null,
  token: '',
  isLoggedIn: false,

  setUserInfo: (info) => set({ userInfo: info, isLoggedIn: true }),

  setToken: (token) => {
    setStorageSync('token', token)
    set({ token })
  },

  setLoggedIn: (status) => set({ isLoggedIn: status }),

  logout: () => {
    removeStorageSync('token')
    removeStorageSync('userInfo')
    set({ userInfo: null, token: '', isLoggedIn: false })
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
      
      if (token && userInfo) {
        set({ token, userInfo, isLoggedIn: true })
      }
    } catch (error) {
      console.error('加载用户信息失败:', error)
    }
  }
}))
