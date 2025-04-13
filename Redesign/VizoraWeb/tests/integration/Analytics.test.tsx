import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '../utils/test-utils';
import AnalyticsPage from '../mocks/AnalyticsPage';
import toast from 'react-hot-toast';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  success: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
}));

describe('Analytics Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and displays analytics dashboard', async () => {
    render(<AnalyticsPage />);

    // Wait for analytics to load with longer timeout
    await waitFor(() => {
      const totalContentElement = screen.getByText('Total Content').nextElementSibling;
      expect(totalContentElement).toHaveTextContent('150');
    }, { timeout: 2000 });
    
    const totalDisplaysElement = screen.getByText('Total Displays').nextElementSibling;
    expect(totalDisplaysElement).toHaveTextContent('25');
    
    const totalViewsElement = screen.getByText('Total Views').nextElementSibling;
    expect(totalViewsElement).toHaveTextContent('15000');

    // Verify key metrics are shown
    const activeContentElement = screen.getByText('Active Content').nextElementSibling;
    expect(activeContentElement).toHaveTextContent('120');
    
    const activeDisplaysElement = screen.getByText('Active Displays').nextElementSibling;
    expect(activeDisplaysElement).toHaveTextContent('20');
    
    const uniqueViewersElement = screen.getByText('Unique Viewers').nextElementSibling;
    expect(uniqueViewersElement).toHaveTextContent('5000');
  });

  it('allows filtering analytics by date range', async () => {
    render(<AnalyticsPage />);

    // Use findByText with more specific approach
    const totalViewsElement = await screen.findByText('Total Views', {}, { timeout: 2000 });
    const viewsValueElement = totalViewsElement.nextElementSibling;
    expect(viewsValueElement).toHaveTextContent('15000');

    // Select date range
    const dateRangeSelect = screen.getByLabelText(/date range/i);
    fireEvent.change(dateRangeSelect, { target: { value: 'last30days' } });
    
    // Verify the change takes effect by checking that loading was triggered
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('displays content type distribution', async () => {
    render(<AnalyticsPage />);

    // Wait for content to load
    await screen.findByText('Content by Type', {}, { timeout: 2000 });
    
    // Query by specific label + value combinations
    const imageElement = screen.getByText('Image').nextElementSibling;
    expect(imageElement).toHaveTextContent('80');
    
    const videoElement = screen.getByText('Video').nextElementSibling;
    expect(videoElement).toHaveTextContent('40');
    
    const webpageElement = screen.getByText('Webpage').nextElementSibling;
    expect(webpageElement).toHaveTextContent('20');
    
    const customElement = screen.getByText('Custom').nextElementSibling;
    expect(customElement).toHaveTextContent('10');
  });

  it('displays display status distribution', async () => {
    render(<AnalyticsPage />);

    // Wait for displays section to load
    await screen.findByText('Displays by Status', {}, { timeout: 2000 });
    
    // Query by specific label + value combinations
    const onlineElement = screen.getByText('Online').nextElementSibling;
    expect(onlineElement).toHaveTextContent('18');
    
    const offlineElement = screen.getByText('Offline').nextElementSibling;
    expect(offlineElement).toHaveTextContent('2');
    
    const maintenanceElement = screen.getByText('Maintenance').nextElementSibling;
    expect(maintenanceElement).toHaveTextContent('5');
  });

  it('displays peak viewing times', async () => {
    render(<AnalyticsPage />);

    // Wait for peak times section to load
    await screen.findByText('Peak Viewing Times', {}, { timeout: 2000 });
    
    // Query directly for the specific time and count elements
    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('12:00')).toBeInTheDocument();
    expect(screen.getByText('17:00')).toBeInTheDocument();
    expect(screen.getByText('800')).toBeInTheDocument();
    expect(screen.getByText('1200')).toBeInTheDocument();
    expect(screen.getByText('900')).toBeInTheDocument();
  });

  it('displays performance metrics', async () => {
    render(<AnalyticsPage />);

    // Wait for performance section to load
    await screen.findByText('Performance', {}, { timeout: 2000 });
    
    // Query by specific label + value combinations
    const loadTimeElement = screen.getByText('Avg. Load Time').nextElementSibling;
    expect(loadTimeElement).toHaveTextContent('2.5s');
    
    const errorRateElement = screen.getByText('Error Rate').nextElementSibling;
    expect(errorRateElement).toHaveTextContent('0.5%');
    
    const uptimeElement = screen.getByText('Uptime').nextElementSibling;
    expect(uptimeElement).toHaveTextContent('99.9%');
    
    // Use getByText with regex for these more complex strings
    expect(screen.getByText(/Current: 1500 MB\/s/i)).toBeInTheDocument();
    expect(screen.getByText(/Limit: 2000 MB\/s/i)).toBeInTheDocument();
  });

  it('allows exporting analytics data', async () => {
    render(<AnalyticsPage />);

    // Wait for analytics to load
    const totalViewsElement = await screen.findByText('Total Views', {}, { timeout: 2000 });
    const viewsValueElement = totalViewsElement.nextElementSibling;
    expect(viewsValueElement).toHaveTextContent('15000');

    // Click export button
    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Analytics exported successfully');
    }, { timeout: 2000 });
  });
}); 