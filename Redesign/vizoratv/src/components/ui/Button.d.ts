import React from 'react';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: string;
    size?: string;
}
export declare const Button: (props: ButtonProps) => import("react/jsx-runtime").JSX.Element;
export default Button;
