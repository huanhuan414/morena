export default defineAppConfig({
  pages: [
    // 主包：TabBar页面 + 核心页面
    'pages/social/index',
    'pages/mind-chat/index',
    'pages/profile/index',
    'pages/login/index',
    'pages/webview/index',
    'pages/publish-redirect/index',
  ],
  subPackages: [
    // 分包1：分身相关
    {
      root: 'avatar',
      pages: [
        'avatar-create/index',
        'avatar-manage/index',
        'avatar-settings/index',
        'avatar-friends/index',
        'avatar-account-add/index',
        'avatar-account-config/index',
      ],
    },
    {
      root: 'pages/avatar',
      pages: [
        'avatar-profile/index',
        'avatar-recommend/index',
        'avatar-order-completed/index',
      ],
    },
    // 分包2：订单相关
    {
      root: 'order',
      pages: [
        'order-list/index',
        'order-create/index',
        'order-detail/index',
        'order-processing/index',
        'order-acceptance/index',
        'avatar-orders/index',
        'order-matching/index',
        'order-content-creation/index',
        'order-feedback/index',
        'pending-order/index',
      ],
    },
    // 分包3：个人中心子页面
    {
      root: 'pages/profile-sub',
      pages: [
        'about/index',
        'help/index',
        'notifications',
        'settings',
        'followers',
      ],
    },
    {
      root: 'pages/settings-root',
      pages: [
        'settings/index',
        'security/index',
      ],
    },
    {
      root: 'pages/earning',
      pages: [
        'earning-center/index',
        'referral-center/index',
        'order-stats/index',
      ],
    },
    // 分包4：其他功能页面
    {
      root: 'pages/feature',
      pages: [
        'skills-square/index',
        'palm-reading/index',
        'task/index',
        'voice-call/index',
        'subscription/index',
        'skill-create/index',
        'skill-training/index',
        'friendship-management/index',
        'generated-content/index',
      ],
    },
    // 分包5：管理后台
    {
      root: 'pages/admin',
      pages: [
        'login/index',
        'dashboard/index',
        'users/index',
        'avatars/index',
        'orders/index',
        'finance/index',
        'content/index',
        'referral/index',
        'settings/index',
        'skills/index',
      ],
    },
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '',
    navigationBarTextStyle: 'black',
    navigationStyle: 'custom',
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#8b5cf6',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/social/index',
        text: '广场',
        iconPath: './assets/tabbar/sparkles.png',
        selectedIconPath: './assets/tabbar/sparkles-active.png',
      },
      {
        pagePath: 'pages/mind-chat/index',
        text: '分身进化',
        iconPath: './assets/tabbar/message-circle.png',
        selectedIconPath: './assets/tabbar/message-circle-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: './assets/tabbar/user.png',
        selectedIconPath: './assets/tabbar/user-active.png',
      },
    ],
  },
  permission: {
    'scope.userLocation': {
      desc: '你的位置信息将用于更好的体验',
    },
  },
  lazyCodeLoading: 'requiredComponents',
})
