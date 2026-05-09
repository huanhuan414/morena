export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '生成内容' })
  : { navigationBarTitleText: '生成内容' }
