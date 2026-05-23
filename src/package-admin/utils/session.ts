import Taro from '@tarojs/taro'

export const ADMIN_LOGIN_PATH = '/package-admin/pages/login/index'
export const ADMIN_TOKEN_KEY = 'admin_token'
export const ADMIN_INFO_KEY = 'admin_info'

export interface AdminInfo {
  id?: string
  username?: string
  role?: string
  [key: string]: unknown
}

export interface AdminSessionPayload {
  token: string
  admin: AdminInfo
}

export const getAdminToken = () => {
  const token = Taro.getStorageSync(ADMIN_TOKEN_KEY)
  return typeof token === 'string' ? token : ''
}

export const getAdminInfo = () => {
  const adminInfo = Taro.getStorageSync(ADMIN_INFO_KEY)
  return (adminInfo || null) as AdminInfo | null
}

export const hasAdminSession = () => Boolean(getAdminToken())

export const setAdminSession = ({ token, admin }: AdminSessionPayload) => {
  Taro.setStorageSync(ADMIN_TOKEN_KEY, token)
  Taro.setStorageSync(ADMIN_INFO_KEY, admin)
}

export const clearAdminSession = () => {
  Taro.removeStorageSync(ADMIN_TOKEN_KEY)
  Taro.removeStorageSync(ADMIN_INFO_KEY)
}

export const redirectToAdminLogin = (redirect?: string) => {
  const query = redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''
  return Taro.redirectTo({ url: `${ADMIN_LOGIN_PATH}${query}` })
}
