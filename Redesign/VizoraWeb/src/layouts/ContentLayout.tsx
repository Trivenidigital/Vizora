import { Outlet } from 'react-router-dom';
import React from 'react';

interface ContentLayoutProps {
  children?: React.ReactNode;
}

const ContentLayout: React.FC<ContentLayoutProps> = () => {
  return (
    <div className="content-layout">
      <div className="content-container">
        <Outlet />
      </div>
    </div>
  );
};

export default ContentLayout; 