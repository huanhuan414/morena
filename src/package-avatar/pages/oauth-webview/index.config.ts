export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '抖音授权' })
  : { navigationBarTitleText: '抖音授权' }
