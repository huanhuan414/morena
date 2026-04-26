export default defineAppConfig({
  pages: [
    // 核心Tab页面
    'pages/social/index',
    'pages/avatar-profile/index',
    'pages/avatar-create/index',
    'pages/mind-chat/index',
    'pages/profile/index',
    // 登录
    'pages/login/index',
    // 个人中心子页面
    'pages/settings/index',
    'pages/profile/help/index',
    'pages/profile/about/index',
    'pages/security/index',
    // 分身相关页面
    'pages/avatar-manage/index',
    // 订单相关页面
    'pages/order-list/index',
    // 技能相关页面
    'pages/skills-square/index',
    // 收益和订阅
    'pages/earning-center/index',
    'pages/subscription/index'
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
  }
})
