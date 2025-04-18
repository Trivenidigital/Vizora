import { jsx as _jsx } from "react/jsx-runtime";
export const Button = (props) => {
    // Placeholder for shadcn Button component
    // Destructure and ignore variant/size for now
    const { variant, size, ...rest } = props;
    return _jsx("button", { ...rest });
};
export default Button;
