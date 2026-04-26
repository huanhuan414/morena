export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '分身设置' })
  : { navigationBarTitleText: '分身设置' }
