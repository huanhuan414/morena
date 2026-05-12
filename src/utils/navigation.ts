import Taro from '@tarojs/taro'

export async function safeNavigateBack(fallbackUrl: string) {
  const pages = Taro.getCurrentPages()
  if (pages.length > 1) {
    await Taro.navigateBack()
    return
  }
  await Taro.redirectTo({ url: fallbackUrl })
}
