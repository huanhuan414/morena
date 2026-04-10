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
  const systemInfo = Taro.getSystemInfoSync()
  const screenWidth = systemInfo.screenWidth || 375
  const statusBarHeight = systemInfo.statusBarHeight || 44

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
  const systemInfo = Taro.getSystemInfoSync()
  return systemInfo.statusBarHeight || 44
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
