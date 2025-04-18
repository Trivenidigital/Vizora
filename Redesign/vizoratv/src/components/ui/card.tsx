import React from 'react';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => {
  // Placeholder for shadcn Card component
  return <div ref={ref} {...props} />;
});
Card.displayName = 'Card';

export default Card;
