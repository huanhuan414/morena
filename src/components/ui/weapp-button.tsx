import * as React from "react"
import { Button as TaroButton } from "@tarojs/components"

import { cn } from "@/lib/utils"

export interface WeappButtonProps
  extends React.ComponentPropsWithoutRef<typeof TaroButton> {
  className?: string
}

const WeappButton = React.forwardRef<React.ElementRef<typeof TaroButton>, WeappButtonProps>(
  ({ className, disabled, onClick, children, ...props }, ref) => {
    return (
      <TaroButton
        ref={ref}
        className={cn(className)}
        disabled={disabled}
        onClick={disabled ? undefined : onClick}
        {...props}
      >
        {children}
      </TaroButton>
    )
  }
)
WeappButton.displayName = "WeappButton"

export { WeappButton }
