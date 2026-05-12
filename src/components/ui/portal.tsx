import * as React from "react"
import { isH5 } from "@/lib/platform"

const Portal = ({ children }: { children: React.ReactNode }) => {
  if (isH5()) {
    if (typeof document === "undefined") return <>{children}</>
    // H5 端使用 React.createPortal
    try {
      const { createPortal } = require("react-dom")
      return createPortal(children, document.body)
    } catch {
      return <>{children}</>
    }
  }
  // 小程序端不使用 RootPortal（兼容性不可靠），直接渲染
  return <>{children}</>
}

export { Portal }
