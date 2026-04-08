export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '分身账号配置' })
  : { navigationBarTitleText: '分身账号配置' }
