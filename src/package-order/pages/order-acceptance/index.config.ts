export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '接单' })
  : { navigationBarTitleText: '接单' }
