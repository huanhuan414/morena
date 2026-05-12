export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '推广管理' })
  : { navigationBarTitleText: '推广管理' }
