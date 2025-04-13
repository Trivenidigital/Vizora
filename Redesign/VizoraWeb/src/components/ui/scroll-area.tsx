import * as React from "react"

// Simple classname utility function
function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  viewportClassName?: string;
}

const ScrollArea = React.forwardRef<
  HTMLDivElement,
  ScrollAreaProps
>(({ className, viewportClassName, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <div className={cn("h-full w-full overflow-auto", viewportClassName)}>
        {children}
      </div>
      <div className="absolute bottom-2 right-2 left-2 h-[1px] opacity-0"></div>
    </div>
  )
})
ScrollArea.displayName = "ScrollArea"

export { ScrollArea } 