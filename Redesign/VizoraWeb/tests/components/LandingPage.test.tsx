import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import LandingPage from '../../src/components/LandingPage';
import { renderWithRouter } from '../utils/test-utils';

describe('LandingPage Component', () => {
  it('renders hero section with title and CTA buttons', () => {
    renderWithRouter(<LandingPage />);
    
    expect(screen.getByText('Welcome to Vizora')).toBeInTheDocument();
    expect(screen.getByText('Digital Signage Management Made Simple')).toBeInTheDocument();
    
    const startButton = screen.getByRole('link', { name: /get started/i });
    expect(startButton).toBeInTheDocument();
    expect(startButton).toHaveAttribute('href', '/signup');
    
    const loginButton = screen.getByRole('link', { name: /log in/i });
    expect(loginButton).toBeInTheDocument();
    expect(loginButton).toHaveAttribute('href', '/login');
  });
  
  it('renders features section with feature cards', () => {
    renderWithRouter(<LandingPage />);
    
    expect(screen.getByText('Key Features')).toBeInTheDocument();
    expect(screen.getByText('Centralized Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Smart Scheduling')).toBeInTheDocument();
    expect(screen.getByText('Content Management')).toBeInTheDocument();
    expect(screen.getByText('Analytics & Reporting')).toBeInTheDocument();
  });
  
  it('renders testimonials section', () => {
    renderWithRouter(<LandingPage />);
    
    expect(screen.getByText('Trusted by Businesses Worldwide')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('John Davis')).toBeInTheDocument();
  });
  
  it('renders call-to-action section', () => {
    renderWithRouter(<LandingPage />);
    
    expect(screen.getByText('Ready to Transform Your Digital Displays?')).toBeInTheDocument();
    
    const ctaButton = screen.getByRole('link', { name: /start your free trial/i });
    expect(ctaButton).toBeInTheDocument();
    expect(ctaButton).toHaveAttribute('href', '/signup');
  });
  
  it('renders footer with navigation links', () => {
    renderWithRouter(<LandingPage />);
    
    // Check for footer sections
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
    
    // Check for legal section
    expect(screen.getByText(/all rights reserved/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /terms of service/i })).toBeInTheDocument();
  });
}); 