import React from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { Outlet } from 'react-router-dom';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900">
      <Sidebar />
      <div className="flex flex-col flex-grow ml-64"> {/* Offset by sidebar width */}
        <Navbar />
        <main className="flex-grow p-6 mt-16"> {/* Offset by navbar height */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}; 