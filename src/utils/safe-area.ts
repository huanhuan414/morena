/**
 * 小程序胶囊按钮适配工具
 *
 * 用于计算小程序右上角胶囊按钮占用的空间，确保页面右上角元素不被遮挡
 */

import Taro from '@tarojs/taro'

interface CapsuleButtonInfo {
  width: number          // 胶囊按钮占用的宽度（单位：px）
  height: number         // 胶囊按钮的高度（单位：px）
  rightMargin: number    // 胶囊按钮右侧距离屏幕右边的距离（单位：px）
  leftMargin: number     // 胶囊按钮左侧距离屏幕左边的距离（单位：px）
}

interface SafeArea {
  statusBarHeight: number      // 状态栏高度（单位：px）
  capsuleButtonInfo: CapsuleButtonInfo | null  // 胶囊按钮信息
  safeWidth: number            // 左侧可用宽度（单位：px）
  safeWidthRpx: number         // 左侧可用宽度（单位：rpx）
  placeholderWidth: number     // 右侧占位宽度（单位：px）
  placeholderWidthRpx: number  // 右侧占位宽度（单位：rpx）
}

/**
 * 获取安全区域信息
 *
 * @returns {SafeArea} 安全区域信息
 */
export function getSafeArea(): SafeArea {
  let statusBarHeight = 44
  let screenWidth = 375

  try {
    // 使用新的 API 替代 getSystemInfoSync
    if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
      // 小程序环境：使用 wx.getWindowInfo() 和 wx.getDeviceInfo()
      const windowInfo = Taro.getWindowInfo?.() as any
      const deviceInfo = Taro.getDeviceInfo?.() as any

      if (windowInfo) {
        statusBarHeight = windowInfo.statusBarHeight || 44
        screenWidth = windowInfo.screenWidth || 375
      }

      if (deviceInfo) {
        screenWidth = deviceInfo.screenWidth || screenWidth
      }
    } else {
      // 其他环境：使用 Taro.getSystemInfoSync() 作为降级方案
      const systemInfo = Taro.getSystemInfoSync()
      statusBarHeight = systemInfo.statusBarHeight || 44
      screenWidth = systemInfo.screenWidth || 375
    }
  } catch (error) {
    // 出错时使用默认值
    console.error('[SafeArea] 获取系统信息失败，使用默认值:', error)
    statusBarHeight = 44
    screenWidth = 375
  }

  let capsuleButtonInfo: CapsuleButtonInfo | null = null
  let safeWidth = screenWidth
  let placeholderWidth = 120 // 默认 120rpx 约等于 60px

  // 仅在小程序环境中计算胶囊按钮信息
  if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
    try {
      const menuButton = Taro.getMenuButtonBoundingClientRect()

      if (menuButton && menuButton.width > 0) {
        const rightMargin = screenWidth - menuButton.right
        const leftMargin = menuButton.left

        capsuleButtonInfo = {
          width: menuButton.width,
          height: menuButton.height,
          rightMargin,
          leftMargin
        }

        // 左侧可用宽度 = 胶囊按钮左侧距离
        safeWidth = leftMargin

        // 右侧占位宽度 = 屏幕宽度 - 胶囊按钮左侧距离 + 额外间距
        // 加上 20px 额外间距，确保按钮不会贴近胶囊
        placeholderWidth = screenWidth - leftMargin + 20

        console.log('[SafeArea] 胶囊按钮信息:', {
          capsuleWidth: menuButton.width,
          capsuleHeight: menuButton.height,
          leftMargin,
          rightMargin,
          safeWidth,
          placeholderWidth
        })
      }
    } catch (error) {
      console.error('[SafeArea] 获取胶囊按钮信息失败:', error)
    }
  }

  // 将 px 转换为 rpx（小程序中 1px = 2rpx）
  const placeholderWidthRpx = Math.ceil(placeholderWidth * 2)
  const safeWidthRpx = Math.ceil(safeWidth * 2)

  return {
    statusBarHeight,
    capsuleButtonInfo,
    safeWidth,
    safeWidthRpx,
    placeholderWidth,
    placeholderWidthRpx
  }
}

/**
 * 获取状态栏高度
 *
 * @returns {number} 状态栏高度（单位：px）
 */
export function getStatusBarHeight(): number {
  let statusBarHeight = 44

  try {
    // 统一使用 getSystemInfoSync，兼容性最好
    const systemInfo = Taro.getSystemInfoSync()
    statusBarHeight = systemInfo.statusBarHeight || 44
  } catch (error) {
    console.error('[SafeArea] 获取状态栏高度失败，使用默认值:', error)
    statusBarHeight = 44
  }

  console.log('[SafeArea] statusBarHeight:', statusBarHeight)
  return statusBarHeight
}

/**
 * 获取胶囊按钮占位宽度（单位：rpx）
 *
 * @returns {number} 占位宽度（单位：rpx）
 */
export function getCapsulePlaceholderWidth(): number {
  const safeArea = getSafeArea()
  return safeArea.placeholderWidthRpx
}
