import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QRDisplay } from '../QRDisplay';

describe('QRDisplay', () => {
  const mockPairingCode = '123456';
  const mockDisplayId = 'display-123';

  beforeEach(() => {
    // Mock window.location
    delete window.location;
    window.location = {
      ...window.location,
      origin: 'http://localhost:3000',
    };
  });

  it('renders QR code with correct pairing URL', () => {
    render(<QRDisplay pairingCode={mockPairingCode} displayId={mockDisplayId} />);
    
    // Check if the QR code is rendered
    const qrCode = screen.getByRole('img', { hidden: true });
    expect(qrCode).toBeInTheDocument();
    expect(qrCode).toHaveAttribute('data-value', `http://localhost:3000/pair?code=${mockPairingCode}&displayId=${mockDisplayId}`);
  });

  it('displays pairing code and display ID', () => {
    render(<QRDisplay pairingCode={mockPairingCode} displayId={mockDisplayId} />);
    
    expect(screen.getByText(`Display ID: ${mockDisplayId}`)).toBeInTheDocument();
    expect(screen.getByText(`Pairing Code: ${mockPairingCode}`)).toBeInTheDocument();
  });

  it('renders with correct title and instructions', () => {
    render(<QRDisplay pairingCode={mockPairingCode} displayId={mockDisplayId} />);
    
    expect(screen.getByText('VizoraTV Display')).toBeInTheDocument();
    expect(screen.getByText('Scan this QR code to pair your display')).toBeInTheDocument();
  });
}); 