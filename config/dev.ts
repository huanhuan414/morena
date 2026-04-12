import type { UserConfigExport } from "@tarojs/cli"

export default {
  defineConstants: {
    PROJECT_DOMAIN: JSON.stringify(''), // 开发模式下使用空字符串，让 Coze 网关处理 /api 路由
  },
  mini: {
    debugReact: true,
  },
  h5: {}
} satisfies UserConfigExport<'vite'>
