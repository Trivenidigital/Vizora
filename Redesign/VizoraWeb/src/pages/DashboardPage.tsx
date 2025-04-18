import React from 'react';

export const DashboardPage: React.FC = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p>Welcome to VizoraWeb!</p>
      {/* Placeholder for Stat Cards, Charts, AI Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <div className="bg-card p-4 rounded-lg shadow">Stat Card 1</div>
        <div className="bg-card p-4 rounded-lg shadow">Stat Card 2</div>
        <div className="bg-card p-4 rounded-lg shadow">Stat Card 3</div>
        <div className="bg-card p-4 rounded-lg shadow col-span-1 md:col-span-2 lg:col-span-3">Chart Placeholder</div>
        <div className="bg-card p-4 rounded-lg shadow col-span-1 md:col-span-2 lg:col-span-3">AI Insight Placeholder</div>
      </div>
    </div>
  );
}; 