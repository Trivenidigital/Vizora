import { jsx as _jsx } from "react/jsx-runtime";
export const Alert = ({ variant = 'default', className = '', children, ...props }) => {
    // Basic styling
    const baseStyle = 'relative w-full rounded-lg border p-4 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg+div]:translate-y-[-3px] [&:has(svg)]:pl-11';
    const variantStyles = {
        default: 'bg-background text-foreground border-border', // Adapt these variables if needed
        destructive: 'border-red-700/50 text-red-200 dark:border-red-700 [&>svg]:text-red-300 bg-red-900', // Style from PairingScreen
    };
    return (_jsx("div", { role: "alert", className: `${baseStyle} ${variantStyles[variant]} ${className}`, ...props, children: children }));
};
export const AlertTitle = ({ className = '', children, ...props }) => (_jsx("h5", { className: `mb-1 font-medium leading-none tracking-tight ${className}`, ...props, children: children }));
export const AlertDescription = ({ className = '', children, ...props }) => (_jsx("div", { className: `text-sm [&_p]:leading-relaxed ${className}`, ...props, children: children }));
