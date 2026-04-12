import type { UserConfigExport } from "@tarojs/cli"

export default {
  defineConstants: {
    PROJECT_DOMAIN: JSON.stringify(''), // 开发模式下使用空字符串，让 H5 使用 Vite 代理
  },
  mini: {
    debugReact: true,
  },
  h5: {}
} satisfies UserConfigExport<'vite'>
