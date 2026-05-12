export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '发布反馈' })
  : { navigationBarTitleText: '发布反馈' }
