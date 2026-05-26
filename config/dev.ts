import type { UserConfigExport } from "@tarojs/cli"
import dotenv from "dotenv"
import path from "node:path"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

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
