import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockUpdateBrandConfig = jest.fn();
let currentBrandConfig: any;
let currentOrganizationId: string | null;
const mockBrandConfig = {
  id: 'org-1',
  name: 'Vizora Test',
  logo: 'https://example.com/logo.png',
  logoAlt: 'Test Logo',
  primaryColor: '#0284c7',
  secondaryColor: '#38bdf8',
  accentColor: '#00E5A0',
  fontFamily: 'sans',
  showPoweredBy: true,
  customDomain: '',
  customCSS: '',
};

jest.mock('@/components/providers/CustomizationProvider', () => ({
  useCustomization: () => ({
    brandConfig: currentBrandConfig,
    updateBrandConfig: mockUpdateBrandConfig,
    organizationId: currentOrganizationId,
  }),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    uploadBrandingLogo: jest.fn(),
  },
}));

jest.mock('@/components/ui/Card', () => {
  // Build Card with attached subcomponents in one place — the previous
  // version declared `Card:` twice (once standalone, once via spread),
  // which tsc flagged as TS2783 "specified more than once".
  const Card: any = ({ children, className }: any) => (
    <div data-testid="card" className={className}>{children}</div>
  );
  Card.Header = ({ children }: any) => <div data-testid="card-header">{children}</div>;
  Card.Body = ({ children, className }: any) => (
    <div data-testid="card-body" className={className}>{children}</div>
  );
  return { Card };
});

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/Button', () => {
  return function MockButton({ children, onClick, variant, disabled }: any) {
    return <button data-testid={`btn-${variant}`} onClick={onClick} disabled={disabled}>{children}</button>;
  };
});

import CustomizationPage from '../page';

describe('CustomizationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentBrandConfig = mockBrandConfig;
    currentOrganizationId = 'org-1';
    mockUpdateBrandConfig.mockResolvedValue(mockBrandConfig);
  });

  it('renders without crashing', () => {
    render(<CustomizationPage />);
    expect(screen.getByText('Brand Customization')).toBeInTheDocument();
  });

  it('renders page heading and description', () => {
    render(<CustomizationPage />);
    expect(screen.getByText('Brand Customization')).toBeInTheDocument();
    expect(screen.getByText(/Customize your white-label branding/)).toBeInTheDocument();
  });

  it('renders Brand Information section', () => {
    render(<CustomizationPage />);
    expect(screen.getByText('Brand Information')).toBeInTheDocument();
    // "Brand Name" appears as both a form label and preview label
    expect(screen.getAllByText('Brand Name').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Brand Colors section', () => {
    render(<CustomizationPage />);
    expect(screen.getByText('Brand Colors')).toBeInTheDocument();
    expect(screen.getByText('Primary Color')).toBeInTheDocument();
    expect(screen.getByText('Secondary Color')).toBeInTheDocument();
    expect(screen.getByText('Accent Color')).toBeInTheDocument();
  });

  it('renders Display Settings section', () => {
    render(<CustomizationPage />);
    expect(screen.getByText('Display Settings')).toBeInTheDocument();
    // "Font Family" appears both as a label and in preview, use getAllByText
    expect(screen.getAllByText('Font Family').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Custom Domain section', () => {
    render(<CustomizationPage />);
    expect(screen.getByText('Custom Domain')).toBeInTheDocument();
  });

  it('renders Custom CSS section', () => {
    render(<CustomizationPage />);
    expect(screen.getByText('Custom CSS')).toBeInTheDocument();
  });

  it('populates form fields with brand config data', () => {
    render(<CustomizationPage />);
    const nameInput = screen.getByPlaceholderText('Your Brand Name') as HTMLInputElement;
    expect(nameInput.value).toBe('Vizora Test');
  });

  it('renders Save and Reset buttons', () => {
    render(<CustomizationPage />);
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
    expect(screen.getByText('Reset')).toBeInTheDocument();
  });

  it('calls updateBrandConfig on save', async () => {
    render(<CustomizationPage />);
    fireEvent.click(screen.getByText('Save Changes'));
    await waitFor(() => {
      expect(mockUpdateBrandConfig).toHaveBeenCalledWith(mockBrandConfig);
    });
  });

  it('shows success message after save', async () => {
    render(<CustomizationPage />);
    fireEvent.click(screen.getByText('Save Changes'));
    await waitFor(() => {
      expect(screen.getByText(/Brand configuration saved successfully/)).toBeInTheDocument();
    });
  });

  it('shows an error instead of success when save fails', async () => {
    mockUpdateBrandConfig.mockRejectedValueOnce(new Error('Branding API failed'));

    render(<CustomizationPage />);
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(screen.getByText('Branding API failed')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Brand configuration saved successfully/)).not.toBeInTheDocument();
  });

  it('disables saving while organization branding context is unavailable', () => {
    currentOrganizationId = null;

    render(<CustomizationPage />);

    expect(screen.getByText('Save Changes')).toBeDisabled();
  });

  it('syncs form fields when async branding loads before the user edits', () => {
    const { rerender } = render(<CustomizationPage />);

    currentBrandConfig = {
      ...mockBrandConfig,
      name: 'Loaded Brand',
      primaryColor: '#111111',
    };
    rerender(<CustomizationPage />);

    const nameInput = screen.getByPlaceholderText('Your Brand Name') as HTMLInputElement;
    expect(nameInput.value).toBe('Loaded Brand');
  });

  it('does not overwrite local edits when provider branding refreshes', () => {
    const { rerender } = render(<CustomizationPage />);
    const nameInput = screen.getByPlaceholderText('Your Brand Name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Unsaved Local Brand' } });

    currentBrandConfig = {
      ...mockBrandConfig,
      name: 'Loaded Brand',
    };
    rerender(<CustomizationPage />);

    expect((screen.getByPlaceholderText('Your Brand Name') as HTMLInputElement).value).toBe(
      'Unsaved Local Brand',
    );
  });

  it('renders preview section with logo', () => {
    render(<CustomizationPage />);
    expect(screen.getByText('Preview')).toBeInTheDocument();
    const logoImg = screen.getByAltText('Test Logo') as HTMLImageElement;
    expect(logoImg.src).toBe('https://example.com/logo.png');
  });

  it('renders Powered by Vizora checkbox', () => {
    render(<CustomizationPage />);
    const checkbox = screen.getByLabelText(/Powered by Vizora/) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('renders font family selector with options', () => {
    render(<CustomizationPage />);
    const selects = screen.getAllByRole('combobox');
    const fontSelect = selects.find(
      (el) => (el as HTMLSelectElement).value === 'sans',
    ) as HTMLSelectElement;
    expect(fontSelect).toBeDefined();
  });

  it('renders logo upload section', () => {
    render(<CustomizationPage />);
    expect(screen.getByText('Upload Logo')).toBeInTheDocument();
    expect(screen.getByText(/PNG, JPEG, or WebP/)).toBeInTheDocument();
  });
});
