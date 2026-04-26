export default defineAppConfig({
  pages: [
    // 核心Tab页面
    'pages/social/index',
    'pages/avatar-profile/index',
    'pages/mind-chat/index',
    'pages/profile/index',
    // 登录
    'pages/login/index',
    // 个人中心子页面
    'pages/settings/index',
    'pages/profile/help/index',
    'pages/profile/about/index',
    'pages/security/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'AI Avatar',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#3b82f6',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/social/index',
        text: '社交',
        iconPath: './assets/tabbar/users.png',
        selectedIconPath: './assets/tabbar/users-active.png'
      },
      {
        pagePath: 'pages/avatar-profile/index',
        text: '分身',
        iconPath: './assets/tabbar/sparkles.png',
        selectedIconPath: './assets/tabbar/sparkles-active.png'
      },
      {
        pagePath: 'pages/mind-chat/index',
        text: '谈心',
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
  }
})
