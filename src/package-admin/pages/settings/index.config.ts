export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '系统设置' })
  : { navigationBarTitleText: '系统设置' }
