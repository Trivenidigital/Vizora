import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import AnalyticsPage from '../../src/pages/analytics/AnalyticsPage';
import * as analyticsService from '../../src/services/analyticsService';
import toast from 'react-hot-toast';

// Mock services
vi.mock('../../src/services/analyticsService');
vi.mock('react-hot-toast');

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

describe('Analytics Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (analyticsService.getAnalytics as any).mockResolvedValue(mockAnalytics);
  });

  it('loads and displays analytics dashboard', async () => {
    render(<AnalyticsPage />);

    // Wait for analytics to load
    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument(); // Total content
      expect(screen.getByText('25')).toBeInTheDocument(); // Total displays
      expect(screen.getByText('15000')).toBeInTheDocument(); // Total views
    });

    // Verify key metrics are shown
    expect(screen.getByText('120')).toBeInTheDocument(); // Active content
    expect(screen.getByText('20')).toBeInTheDocument(); // Active displays
    expect(screen.getByText('5000')).toBeInTheDocument(); // Unique viewers
  });

  it('allows filtering analytics by date range', async () => {
    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('15000')).toBeInTheDocument();
    });

    // Select date range
    const dateRangeSelect = screen.getByLabelText(/date range/i);
    fireEvent.change(dateRangeSelect, { target: { value: 'last30days' } });

    await waitFor(() => {
      expect(analyticsService.getAnalytics).toHaveBeenCalledWith('last30days');
    });
  });

  it('displays content type distribution', async () => {
    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('80')).toBeInTheDocument(); // Image count
      expect(screen.getByText('40')).toBeInTheDocument(); // Video count
      expect(screen.getByText('20')).toBeInTheDocument(); // Webpage count
      expect(screen.getByText('10')).toBeInTheDocument(); // Custom count
    });
  });

  it('displays display status distribution', async () => {
    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('18')).toBeInTheDocument(); // Online displays
      expect(screen.getByText('2')).toBeInTheDocument(); // Offline displays
      expect(screen.getByText('5')).toBeInTheDocument(); // Maintenance displays
    });
  });

  it('displays peak viewing times', async () => {
    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('09:00')).toBeInTheDocument();
      expect(screen.getByText('12:00')).toBeInTheDocument();
      expect(screen.getByText('17:00')).toBeInTheDocument();
      expect(screen.getByText('800')).toBeInTheDocument();
      expect(screen.getByText('1200')).toBeInTheDocument();
      expect(screen.getByText('900')).toBeInTheDocument();
    });
  });

  it('displays performance metrics', async () => {
    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('2.5')).toBeInTheDocument(); // Average load time
      expect(screen.getByText('0.5')).toBeInTheDocument(); // Error rate
      expect(screen.getByText('99.9')).toBeInTheDocument(); // Uptime
      expect(screen.getByText('1500')).toBeInTheDocument(); // Current bandwidth
      expect(screen.getByText('2000')).toBeInTheDocument(); // Bandwidth limit
    });
  });

  it('allows exporting analytics data', async () => {
    const mockExportData = 'csv,data,here';
    (analyticsService.exportAnalytics as any).mockResolvedValue(mockExportData);
    
    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('15000')).toBeInTheDocument();
    });

    // Click export button
    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(analyticsService.exportAnalytics).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Analytics exported successfully');
    });
  });

  it('handles errors gracefully', async () => {
    const error = new Error('API Error');
    (analyticsService.getAnalytics as any).mockRejectedValue(error);
    
    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load analytics');
    });
  });
}); 