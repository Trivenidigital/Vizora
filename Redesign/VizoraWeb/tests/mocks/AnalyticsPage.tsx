import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

// Mock analytics data
const mockAnalytics = {
  contentStats: {
    totalContent: 150,
    activeContent: 120,
    byType: {
      image: 80,
      video: 40,
      webpage: 20,
      custom: 10,
    },
    byStatus: {
      published: 100,
      draft: 30,
      archived: 20,
    },
  },
  displayStats: {
    totalDisplays: 25,
    activeDisplays: 20,
    byStatus: {
      online: 18,
      offline: 2,
      maintenance: 5,
    },
    byLocation: {
      'Main Lobby': 5,
      'Conference Rooms': 10,
      'Cafeteria': 3,
      'Other': 7,
    },
  },
  engagementStats: {
    totalViews: 15000,
    uniqueViewers: 5000,
    averageViewDuration: 120,
    peakViewingTimes: [
      { time: '09:00', count: 800 },
      { time: '12:00', count: 1200 },
      { time: '17:00', count: 900 },
    ],
  },
  performanceStats: {
    averageLoadTime: 2.5,
    errorRate: 0.5,
    uptime: 99.9,
    bandwidthUsage: {
      current: 1500,
      limit: 2000,
      unit: 'MB/s',
    },
  },
};

const AnalyticsPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('last7days');

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      // Simulate API call
      setTimeout(() => {
        setAnalytics(mockAnalytics);
        setLoading(false);
      }, 300);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Failed to load analytics');
      setLoading(false);
    }
  };

  const handleDateRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDateRange(e.target.value);
  };

  const handleExportClick = async () => {
    try {
      // Simulate export API call
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('Analytics exported successfully');
    } catch (error) {
      console.error('Error exporting analytics:', error);
      toast.error('Failed to export analytics');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!analytics) {
    return <div>No analytics data available.</div>;
  }

  return (
    <div className="analytics-page">
      <h1>Analytics Dashboard</h1>
      
      <div className="analytics-filters">
        <div className="filter-group">
          <label htmlFor="dateRange">Date Range:</label>
          <select 
            id="dateRange" 
            value={dateRange} 
            onChange={handleDateRangeChange}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7days">Last 7 Days</option>
            <option value="last30days">Last 30 Days</option>
            <option value="thisMonth">This Month</option>
            <option value="lastMonth">Last Month</option>
          </select>
        </div>
        
        <button onClick={handleExportClick}>Export Data</button>
      </div>
      
      <div className="analytics-grid">
        {/* Content Stats Card */}
        <div className="analytics-card">
          <h2>Content</h2>
          <div className="stat-row">
            <div className="stat-item">
              <p className="stat-label">Total Content</p>
              <p className="stat-value">{analytics.contentStats.totalContent}</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Active Content</p>
              <p className="stat-value">{analytics.contentStats.activeContent}</p>
            </div>
          </div>
          
          <h3>Content by Type</h3>
          <div className="stat-row">
            <div className="stat-item">
              <p className="stat-label">Image</p>
              <p className="stat-value">{analytics.contentStats.byType.image}</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Video</p>
              <p className="stat-value">{analytics.contentStats.byType.video}</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Webpage</p>
              <p className="stat-value">{analytics.contentStats.byType.webpage}</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Custom</p>
              <p className="stat-value">{analytics.contentStats.byType.custom}</p>
            </div>
          </div>
          
          <h3>Content by Status</h3>
          <div className="stat-row">
            <div className="stat-item">
              <p className="stat-label">Published</p>
              <p className="stat-value">{analytics.contentStats.byStatus.published}</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Draft</p>
              <p className="stat-value">{analytics.contentStats.byStatus.draft}</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Archived</p>
              <p className="stat-value">{analytics.contentStats.byStatus.archived}</p>
            </div>
          </div>
        </div>
        
        {/* Display Stats Card */}
        <div className="analytics-card">
          <h2>Displays</h2>
          <div className="stat-row">
            <div className="stat-item">
              <p className="stat-label">Total Displays</p>
              <p className="stat-value">{analytics.displayStats.totalDisplays}</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Active Displays</p>
              <p className="stat-value">{analytics.displayStats.activeDisplays}</p>
            </div>
          </div>
          
          <h3>Displays by Status</h3>
          <div className="stat-row">
            <div className="stat-item">
              <p className="stat-label">Online</p>
              <p className="stat-value">{analytics.displayStats.byStatus.online}</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Offline</p>
              <p className="stat-value">{analytics.displayStats.byStatus.offline}</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Maintenance</p>
              <p className="stat-value">{analytics.displayStats.byStatus.maintenance}</p>
            </div>
          </div>
          
          <h3>Displays by Location</h3>
          <div className="location-list">
            {Object.entries(analytics.displayStats.byLocation).map(([location, count]) => (
              <div key={location} className="location-item">
                <p className="location-name">{location}</p>
                <p className="location-count">{count as number}</p>
              </div>
            ))}
          </div>
        </div>
        
        {/* Engagement Stats Card */}
        <div className="analytics-card">
          <h2>Engagement</h2>
          <div className="stat-row">
            <div className="stat-item">
              <p className="stat-label">Total Views</p>
              <p className="stat-value">{analytics.engagementStats.totalViews}</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Unique Viewers</p>
              <p className="stat-value">{analytics.engagementStats.uniqueViewers}</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Avg. View Duration</p>
              <p className="stat-value">{analytics.engagementStats.averageViewDuration}s</p>
            </div>
          </div>
          
          <h3>Peak Viewing Times</h3>
          <div className="peak-times">
            {analytics.engagementStats.peakViewingTimes.map((peak: { time: string, count: number }) => (
              <div key={peak.time} className="peak-time-item">
                <p className="peak-time">{peak.time}</p>
                <p className="peak-count">{peak.count}</p>
              </div>
            ))}
          </div>
        </div>
        
        {/* Performance Stats Card */}
        <div className="analytics-card">
          <h2>Performance</h2>
          <div className="stat-row">
            <div className="stat-item">
              <p className="stat-label">Avg. Load Time</p>
              <p className="stat-value">{analytics.performanceStats.averageLoadTime}s</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Error Rate</p>
              <p className="stat-value">{analytics.performanceStats.errorRate}%</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Uptime</p>
              <p className="stat-value">{analytics.performanceStats.uptime}%</p>
            </div>
          </div>
          
          <h3>Bandwidth Usage</h3>
          <div className="bandwidth-usage">
            <p>Current: {analytics.performanceStats.bandwidthUsage.current} {analytics.performanceStats.bandwidthUsage.unit}</p>
            <p>Limit: {analytics.performanceStats.bandwidthUsage.limit} {analytics.performanceStats.bandwidthUsage.unit}</p>
            <div className="usage-bar">
              <div 
                className="usage-fill" 
                style={{ width: `${(analytics.performanceStats.bandwidthUsage.current / analytics.performanceStats.bandwidthUsage.limit) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage; 