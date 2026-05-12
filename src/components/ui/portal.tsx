import * as React from "react"

const Portal = ({ children }: { children: React.ReactNode }) => {
  // 小程序端和 H5 端统一使用 Fragment 渲染
  // 不使用 RootPortal（小程序兼容性不可靠）
  // 不使用 createPortal（避免 require("react-dom") 在小程序中出错）
  return <>{children}</>
}

export { Portal }
