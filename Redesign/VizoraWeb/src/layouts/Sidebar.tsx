import React from 'react';

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 h-screen bg-card text-card-foreground p-4 border-r border-border fixed top-0 left-0">
      <h2 className="text-lg font-semibold mb-4">VizoraWeb</h2>
      {/* Placeholder for navigation items */}
      <nav>
        <ul>
          <li className="mb-2">
            <a href="#" className="text-muted-foreground hover:text-foreground">Dashboard</a>
          </li>
          <li className="mb-2">
            <a href="#" className="text-muted-foreground hover:text-foreground">Devices</a>
          </li>
          <li className="mb-2">
            <a href="#" className="text-muted-foreground hover:text-foreground">Content</a>
          </li>
          <li className="mb-2">
            <a href="#" className="text-muted-foreground hover:text-foreground">Schedules</a>
          </li>
          {/* Add more links later */}
        </ul>
      </nav>
    </aside>
  );
}; 