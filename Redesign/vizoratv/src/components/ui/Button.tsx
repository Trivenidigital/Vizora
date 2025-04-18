import React from 'react';

// Extend button props to accept optional variant and size for type checking
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: string; 
  size?: string;
}

export const Button = (props: ButtonProps) => {
  // Placeholder for shadcn Button component
  // Destructure and ignore variant/size for now
  const { variant, size, ...rest } = props;
  return <button {...rest} />;
};

export default Button;