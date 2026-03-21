import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockGetFeatureFlags = jest.fn();
const mockUpdateFeatureFlags = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getFeatureFlags: (...args: any[]) => mockGetFeatureFlags(...args),
    updateFeatureFlags: (...args: any[]) => mockUpdateFeatureFlags(...args),
  },
}));

const mockUseAuth = jest.fn();
jest.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    ToastContainer: () => null,
  }),
}));

import FeatureFlagsPage from '../page';

const defaultFlags = {
  weatherWidget: true,
  rssWidget: true,
  clockWidget: true,
  fleetControl: true,
  contentModeration: true,
  customBranding: true,
  advancedAnalytics: true,
  emergencyOverride: true,
};

describe('FeatureFlagsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { role: 'admin' } });
    mockGetFeatureFlags.mockResolvedValue(defaultFlags);
  });

  it('should render feature flag toggles', async () => {
    render(<FeatureFlagsPage />);

    await waitFor(() => {
      expect(screen.getByText('Weather Widget')).toBeInTheDocument();
    });

    expect(screen.getByText('RSS/News Widget')).toBeInTheDocument();
    expect(screen.getByText('Fleet Control')).toBeInTheDocument();
    expect(screen.getByText('Emergency Override')).toBeInTheDocument();
    expect(screen.getByText('Advanced Analytics')).toBeInTheDocument();
  });

  it('should load flags on mount', async () => {
    render(<FeatureFlagsPage />);

    await waitFor(() => {
      expect(mockGetFeatureFlags).toHaveBeenCalled();
    });
  });

  it('should show admin warning for non-admin users', async () => {
    mockUseAuth.mockReturnValue({ user: { role: 'viewer' } });
    render(<FeatureFlagsPage />);

    await waitFor(() => {
      expect(screen.getByText(/only administrators/i)).toBeInTheDocument();
    });
  });

  it('should toggle a feature flag when clicked', async () => {
    render(<FeatureFlagsPage />);

    await waitFor(() => {
      expect(screen.getByText('Weather Widget')).toBeInTheDocument();
    });

    // Find the weather widget toggle (first switch)
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBe(8);

    // All should be checked initially
    expect(switches[0]).toHaveAttribute('aria-checked', 'true');

    // Click to toggle off
    fireEvent.click(switches[0]);

    // Should now show as unchecked
    expect(switches[0]).toHaveAttribute('aria-checked', 'false');
  });

  it('should enable save button after toggling', async () => {
    render(<FeatureFlagsPage />);

    await waitFor(() => {
      expect(screen.getByText('Weather Widget')).toBeInTheDocument();
    });

    // Save button should be disabled initially
    const saveBtn = screen.getByText('Save Changes');
    expect(saveBtn).toBeDisabled();

    // Toggle a flag
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);

    // Save button should be enabled now
    expect(saveBtn).not.toBeDisabled();
  });

  it('should call updateFeatureFlags on save', async () => {
    mockUpdateFeatureFlags.mockResolvedValue({ ...defaultFlags, weatherWidget: false });
    render(<FeatureFlagsPage />);

    await waitFor(() => {
      expect(screen.getByText('Weather Widget')).toBeInTheDocument();
    });

    // Toggle weather widget off
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);

    // Click save
    const saveBtn = screen.getByText('Save Changes');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateFeatureFlags).toHaveBeenCalledWith(
        expect.objectContaining({ weatherWidget: false }),
      );
    });
  });

  it('should disable toggles for non-admin users', async () => {
    mockUseAuth.mockReturnValue({ user: { role: 'viewer' } });
    render(<FeatureFlagsPage />);

    await waitFor(() => {
      expect(screen.getByText('Weather Widget')).toBeInTheDocument();
    });

    const switches = screen.getAllByRole('switch');
    switches.forEach(s => expect(s).toBeDisabled());
  });

  it('should show discard changes button when dirty', async () => {
    render(<FeatureFlagsPage />);

    await waitFor(() => {
      expect(screen.getByText('Weather Widget')).toBeInTheDocument();
    });

    // No discard button initially
    expect(screen.queryByText('Discard Changes')).not.toBeInTheDocument();

    // Toggle to make dirty
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);

    expect(screen.getByText('Discard Changes')).toBeInTheDocument();
  });
});
