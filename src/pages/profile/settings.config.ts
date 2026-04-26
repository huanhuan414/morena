export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '设置' })
  : { navigationBarTitleText: '设置' }
