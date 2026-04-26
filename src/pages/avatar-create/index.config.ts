export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '创建分身' })
  : { navigationBarTitleText: '创建分身' }
