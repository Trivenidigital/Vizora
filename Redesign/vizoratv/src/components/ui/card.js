import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
export const Card = React.forwardRef((props, ref) => {
    // Placeholder for shadcn Card component
    return _jsx("div", { ref: ref, ...props });
});
Card.displayName = 'Card';
export default Card;
