export default typeof definePageConfig === 'function'
  ? definePageConfig({
      // 不使用原生导航栏，使用自定义 page-header
      disableScroll: false,
      enableShareAppMessage: true,
      enableShareTimeline: true
    })
  : { disableScroll: false }
