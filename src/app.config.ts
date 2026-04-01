export default defineAppConfig({
  pages: [
    'pages/social/index',
    'pages/login/index',
    'pages/avatar-create/index',
    'pages/avatar-manage/index',
    'pages/avatar-settings/index',
    'pages/mind-chat/index',
    'pages/profile/index',
    'pages/profile/settings',
    'pages/profile/notifications',
    'pages/profile/security',
    'pages/profile/help',
    'pages/profile/about',
    'pages/task/index',
    'pages/order-create/index',
    'pages/order-list/index',
    'pages/order-detail/index',
    'pages/earning-center/index',
    'pages/referral-center/index'
  ],
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#0a0a0f',
    navigationBarTitleText: '莫瑞娜',
    navigationBarTextStyle: 'white',
    backgroundColor: '#0a0a0f',
    navigationStyle: 'custom'
  },
  tabBar: {
    color: '#64748b',
    selectedColor: '#00f5ff',
    backgroundColor: 'rgba(10, 10, 15, 0.95)',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/social/index',
        text: '广场',
        iconPath: './assets/tabbar/users.png',
        selectedIconPath: './assets/tabbar/users-active.png'
      },
      {
        pagePath: 'pages/mind-chat/index',
        text: '心智对话',
        iconPath: './assets/tabbar/message-circle.png',
        selectedIconPath: './assets/tabbar/message-circle-active.png'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: './assets/tabbar/user.png',
        selectedIconPath: './assets/tabbar/user-active.png'
      }
    ]
  },
  permission: {
    'scope.userLocation': {
      desc: '你的位置信息将用于小程序位置接口的效果展示'
    }
  }
})
