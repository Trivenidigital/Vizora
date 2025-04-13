import { FC, ReactNode } from 'react';
import { Navigation } from '../Navigation';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      <Navigation />
      <div className="md:ml-64 transition-all duration-300">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-x-hidden">
          <div className="w-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}; 