export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/chat/index',
    'pages/task/index',
    'pages/social/index',
    'pages/profile/index'
  ],
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#0f172a',
    navigationBarTitleText: '莫瑞娜',
    navigationBarTextStyle: 'white',
    backgroundColor: '#0f172a'
  },
  tabBar: {
    color: '#64748b',
    selectedColor: '#818cf8',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: './assets/tabbar/house.png',
        selectedIconPath: './assets/tabbar/house-active.png'
      },
      {
        pagePath: 'pages/chat/index',
        text: '对话',
        iconPath: './assets/tabbar/message-circle.png',
        selectedIconPath: './assets/tabbar/message-circle-active.png'
      },
      {
        pagePath: 'pages/task/index',
        text: '任务',
        iconPath: './assets/tabbar/clipboard-list.png',
        selectedIconPath: './assets/tabbar/clipboard-list-active.png'
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
