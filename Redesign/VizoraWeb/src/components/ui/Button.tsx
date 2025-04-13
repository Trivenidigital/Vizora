import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
// Remove the Slot import and replace with our own implementation
// import { Slot } from '@radix-ui/react-slot';

// Simple classname utility function
function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

// Create a simple Slot implementation
const Slot = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => {
    // A simple implementation that passes props to the first child
    const child = React.Children.only(children) as React.ReactElement;
    return React.cloneElement(child, { ...props, ref });
  }
);
Slot.displayName = 'Slot';

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer transition duration-150 ease-in-out",
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 text-white shadow hover:bg-blue-700 rounded-md",
        primary:
          "bg-violet-600 text-white shadow hover:bg-violet-700 rounded-xl font-semibold",
        destructive:
          "bg-red-500 text-white shadow-sm hover:bg-red-600 rounded-md",
        danger: 
          "bg-red-600 text-white shadow-sm hover:bg-red-700 rounded-xl font-semibold",
        outline:
          "border border-gray-300 bg-transparent shadow-sm hover:bg-gray-100 hover:text-gray-900 rounded-md",
        secondary:
          "bg-gray-100 text-gray-900 shadow-sm hover:bg-gray-200 rounded-md",
        ghost:
          "hover:bg-gray-100 hover:text-gray-900",
        link:
          "text-blue-600 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isLoading || disabled}
        {...props}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants }; 