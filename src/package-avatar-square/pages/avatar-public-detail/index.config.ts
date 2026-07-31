export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationStyle: 'custom',
      backgroundColor: '#f6f7ff',
    })
  : {
      navigationStyle: 'custom',
      backgroundColor: '#f6f7ff',
    }