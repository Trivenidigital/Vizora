import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LandingPage from '../../src/components/LandingPage';

describe('LandingPage', () => {
  const renderWithRouter = (component: React.ReactNode) => {
    return render(
      <BrowserRouter>
        {component}
      </BrowserRouter>
    );
  };

  it('renders the landing page with all sections', () => {
    renderWithRouter(<LandingPage />);
    
    // Check header
    expect(screen.getByText('Vizora')).toBeInTheDocument();
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('Sign Up')).toBeInTheDocument();

    // Check main content
    expect(screen.getByText('Smart Digital Signage for Modern Businesses')).toBeInTheDocument();
    expect(screen.getByText('Get Started')).toBeInTheDocument();
    expect(screen.getByText('Learn More')).toBeInTheDocument();

    // Check features section
    expect(screen.getByText('Why Choose Vizora?')).toBeInTheDocument();
    expect(screen.getByText('Easy to Use')).toBeInTheDocument();
    expect(screen.getByText('Fully Customizable')).toBeInTheDocument();
    expect(screen.getByText('Real-time Updates')).toBeInTheDocument();

    // Check footer
    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
  });

  it('renders all navigation links correctly', () => {
    renderWithRouter(<LandingPage />);
    
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(8); // Login, Sign Up, Get Started, Learn More, and footer links

    // Check if login and signup links are present
    expect(screen.getByText('Login')).toHaveAttribute('href', '/login');
    expect(screen.getByText('Sign Up')).toHaveAttribute('href', '/signup');
  });

  it('renders the platform preview image', () => {
    renderWithRouter(<LandingPage />);
    
    const previewImage = screen.getByAltText('Vizora Platform Preview');
    expect(previewImage).toBeInTheDocument();
    expect(previewImage).toHaveAttribute('src', 'https://via.placeholder.com/600x400?text=Vizora+Dashboard');
  });

  it('renders social media links in footer', () => {
    renderWithRouter(<LandingPage />);
    
    const socialLinks = screen.getAllByRole('link', { name: /Facebook|Twitter|LinkedIn/i });
    expect(socialLinks).toHaveLength(3);
  });
}); 