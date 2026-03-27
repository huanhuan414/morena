export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/login/index',
    'pages/avatar-create/index',
    'pages/chat/index',
    'pages/learn/index',
    'pages/social/index',
    'pages/profile/index'
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
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: './assets/tabbar/sparkles.png',
        selectedIconPath: './assets/tabbar/sparkles-active.png'
      },
      {
        pagePath: 'pages/chat/index',
        text: '对话',
        iconPath: './assets/tabbar/message-circle.png',
        selectedIconPath: './assets/tabbar/message-circle-active.png'
      },
      {
        pagePath: 'pages/learn/index',
        text: '学习',
        iconPath: './assets/tabbar/graduation-cap.png',
        selectedIconPath: './assets/tabbar/graduation-cap-active.png'
      },
      {
        pagePath: 'pages/social/index',
        text: '广场',
        iconPath: './assets/tabbar/users.png',
        selectedIconPath: './assets/tabbar/users-active.png'
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
