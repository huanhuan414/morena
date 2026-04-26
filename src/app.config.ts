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
    'pages/profile/notifications',
    'pages/security/index',
    // 订阅
    'pages/subscription/index',
    // 分身相关
    'pages/avatar-manage/index',
    'pages/avatar-friends/index',
    'pages/avatar-create/index',
    'pages/avatar-settings/index',
    // 技能
    'pages/skills-square/index',
    'pages/skill-create/index',
    'pages/skill-training/index',
    // 推广收益
    'pages/referral-center/index',
    'pages/earning-center/index',
    // 订单
    'pages/order-list/index',
    'pages/avatar-orders/index'
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
