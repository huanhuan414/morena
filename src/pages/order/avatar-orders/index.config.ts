export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '分身商单' })
  : { navigationBarTitleText: '分身商单' }
