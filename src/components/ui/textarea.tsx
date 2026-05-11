import * as React from "react"
import { Textarea as TaroTextarea } from "@tarojs/components"
import { cn } from "@/lib/utils"
import type { CSSProperties } from 'react'

interface CustomTextareaProps {
  className?: string
  style?: CSSProperties
  value?: string
  onChange?: (value: string) => void
  onInput?: (e: any) => void
  placeholder?: string
  autoHeight?: boolean
  disabled?: boolean
  maxlength?: number
}

const Textarea = React.forwardRef<any, CustomTextareaProps>(
  ({ className, style, autoHeight, onChange, onInput, ...props }, ref) => {
    const handleInput = (e: any) => {
      if (onInput) {
        onInput(e)
      }
      if (onChange) {
        onChange(e.detail?.value || '')
      }
    }

    return (
      <TaroTextarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        style={style}
        ref={ref}
        autoHeight={autoHeight || false}
        onInput={handleInput}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
