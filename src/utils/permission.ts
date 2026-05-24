import Taro from '@tarojs/taro'
import { Network } from '@/network'

export type PermissionType = 'check_avatars' | 'check_orders' | 'check_skills' | 'check_feature'

export interface PermissionResult {
  allowed: boolean
  limit: number
  current: number
  planName?: string
  reason?: string
}

/**
 * 检查用户是否有某项权益权限
 * @param type 权限类型: check_avatars | check_orders | check_skills | check_feature
 * @param currentCount 当前数量（用于 check_avatars / check_skills）
 * @param feature 功能名称（用于 check_feature，如 batch_publish / analytics / custom_personality）
 */
export async function checkPermission(
  type: PermissionType,
  currentCount?: number,
  feature?: string
): Promise<PermissionResult> {
  try {
    // 获取当前用户ID
    const userInfo = Taro.getStorageSync('userInfo')
    const userId = userInfo?.id || userInfo?.userId || ''
    if (!userId) {
      return { allowed: false, limit: 0, current: 0, reason: '请先登录' }
    }

    const params: Record<string, string> = {
      userId: String(userId),
      type,
    }
    if (currentCount !== undefined) {
      params.currentCount = String(currentCount)
    }
    if (feature) {
      params.feature = feature
    }

    const query = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')

    const res = await Network.request({
      url: `/api/subscription/check?${query}`,
    })


    const data = res.data?.data
    if (res.data?.code === 200 && data) {
      return {
        allowed: data.allowed,
        limit: data.limit,
        current: data.current ?? currentCount ?? 0,
        reason: data.reason,
      }
    }

    return { allowed: false, limit: 0, current: currentCount ?? 0, reason: '权益校验失败' }
  } catch (err) {
    console.error('[Permission] 校验异常:', err)
    return { allowed: false, limit: 0, current: currentCount ?? 0, reason: '网络异常' }
  }
}

/**
 * 检查分身创建权限，未通过时引导升级
 */
export async function checkAvatarPermission(currentCount: number): Promise<boolean> {
  const result = await checkPermission('check_avatars', currentCount)
  if (!result.allowed) {
    Taro.showModal({
      title: '分身数量已达上限',
      content: result.reason || `当前套餐最多支持 ${result.limit} 个分身，升级订阅可创建更多`,
      confirmText: '去升级',
      cancelText: '知道了',
      success: (res) => {
        if (res.confirm) {
          Taro.navigateTo({ url: '/package-avatar/pages/subscription/index' })
        }
      }
    })
    return false
  }
  return true
}

/**
 * 检查接单权限，未通过时引导升级
 */
export async function checkOrderPermission(): Promise<boolean> {
  const result = await checkPermission('check_orders')
  if (!result.allowed) {
    Taro.showModal({
      title: '接单权益未开通',
      content: result.reason || '当前套餐不支持接单，升级专业版即可接单赚钱',
      confirmText: '去升级',
      cancelText: '知道了',
      success: (res) => {
        if (res.confirm) {
          Taro.navigateTo({ url: '/package-avatar/pages/subscription/index' })
        }
      }
    })
    return false
  }
  return true
}

/**
 * 检查技能使用权限，未通过时引导升级
 */
export async function checkSkillPermission(currentCount: number): Promise<boolean> {
  const result = await checkPermission('check_skills', currentCount)
  if (!result.allowed) {
    Taro.showModal({
      title: '今日技能次数已用完',
      content: result.reason || `当前套餐每天最多使用 ${result.limit} 次技能，升级订阅可解锁更多次数`,
      confirmText: '去升级',
      cancelText: '知道了',
      success: (res) => {
        if (res.confirm) {
          Taro.navigateTo({ url: '/package-avatar/pages/subscription/index' })
        }
      }
    })
    return false
  }
  return true
}

/**
 * 检查特定功能权限（如 batch_publish / analytics / custom_personality）
 */
export async function checkFeaturePermission(feature: string, title?: string): Promise<boolean> {
  const result = await checkPermission('check_feature', undefined, feature)
  if (!result.allowed) {
    Taro.showModal({
      title: title || '功能未开通',
      content: result.reason || '当前套餐不支持此功能，升级订阅即可使用',
      confirmText: '去升级',
      cancelText: '知道了',
      success: (res) => {
        if (res.confirm) {
          Taro.navigateTo({ url: '/package-avatar/pages/subscription/index' })
        }
      }
    })
    return false
  }
  return true
}
