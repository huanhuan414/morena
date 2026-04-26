export default defineAppConfig({
  pages: [
    'pages/social/index',
    'pages/skill-training/index',
    'pages/avatar-profile/index',
    'pages/login/index',
    'pages/avatar-create/index',
    'pages/avatar-manage/index',
    'pages/avatar-settings/index',
    'pages/avatar-account-config/index',
    'pages/avatar-account-add/index',
    'pages/avatar-friends/index',
    'pages/avatar-orders/index',
    'pages/avatar-order-completed/index',
    'pages/voice-call/index',
    'pages/mind-chat/index',
    'pages/publish-redirect/index',
    'pages/profile/index',
    'pages/profile/settings',
    'pages/profile/notifications',
    'pages/profile/security',
    'pages/profile/help',
    'pages/profile/about',
    'pages/profile/followers',
    'pages/subscription/index',
    'pages/task/index',
    'pages/order-create/index',
    'pages/order-list/index',
    'pages/order-detail/index',
    'pages/order-acceptance/index',
    'pages/order-stats/index',
    'pages/order-matching/index',
    'pages/pending-order/index',
    'pages/order-content-creation/index',
    'pages/order-publish-feedback/index',
    'pages/order-processing/index',
    'pages/order-feedback/index',
    'pages/generated-content/index',
    'pages/earning-center/index',
    'pages/referral-center/index',
    'pages/skills-square/index',
    'pages/skill-create/index',
    'pages/avatar-recommend/index',
    'pages/webview/index',
    'pages/admin/login/index',
    'pages/admin/dashboard/index',
    'pages/admin/users/index',
    'pages/admin/users/detail',
    'pages/admin/avatars/index',
    'pages/admin/skills/index',
    'pages/admin/orders/index',
    'pages/admin/content/index',
    'pages/admin/finance/index',
    'pages/admin/referral/index',
    'pages/admin/settings/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: '莫瑞娜',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f8fafc',
    navigationStyle: 'custom'
  },
  tabBar: {
    color: '#64748b',
    selectedColor: '#7B3FE4',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
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
