import type { UserConfigExport } from "@tarojs/cli"

export default {
  defineConstants: {
    PROJECT_DOMAIN: JSON.stringify('https://mrlweb.51webjs.com'), // 直连服务器
  },
  mini: {
    debugReact: true,
  },
  h5: {}
} satisfies UserConfigExport<'vite'>
