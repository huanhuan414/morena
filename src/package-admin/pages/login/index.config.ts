export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '管理员登录' })
  : { navigationBarTitleText: '管理员登录' }
