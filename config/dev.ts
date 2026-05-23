import type { UserConfigExport } from "@tarojs/cli"

const projectDomain = process.env.PROJECT_DOMAIN?.trim() ?? ''

export default {
  defineConstants: {
    PROJECT_DOMAIN: JSON.stringify(projectDomain),
  },
  mini: {
    debugReact: true,
  },
  h5: {}
} satisfies UserConfigExport<'vite'>
