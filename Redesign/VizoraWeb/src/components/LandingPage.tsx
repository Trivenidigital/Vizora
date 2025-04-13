import React from 'react';
import { Link } from 'react-router-dom';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => (
  <div className="feature-card">
    <div className="feature-icon">{icon}</div>
    <h3 className="feature-title">{title}</h3>
    <p className="feature-description">{description}</p>
  </div>
);

const LandingPage: React.FC = () => {
  return (
    <div className="landing-page">
      <header className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">Welcome to Vizora</h1>
          <h2 className="hero-subtitle">Digital Signage Management Made Simple</h2>
          <p className="hero-description">
            Create, schedule, and manage digital content across all your displays from one central platform.
          </p>
          <div className="hero-actions">
            <Link to="/signup" className="btn btn-primary">
              Get Started
            </Link>
            <Link to="/login" className="btn btn-secondary">
              Log In
            </Link>
          </div>
        </div>
        <div className="hero-image-container">
          <img src="/images/hero-image.png" alt="Vizora Dashboard Preview" className="hero-image" />
        </div>
      </header>

      <section className="features-section">
        <h2 className="section-title">Key Features</h2>
        <div className="features-grid">
          <FeatureCard 
            icon={<span className="material-icon">dashboard</span>}
            title="Centralized Dashboard"
            description="Monitor all your displays, content, and schedules from one intuitive dashboard."
          />
          <FeatureCard 
            icon={<span className="material-icon">schedule</span>}
            title="Smart Scheduling"
            description="Create complex schedules based on time, date, location, and more."
          />
          <FeatureCard 
            icon={<span className="material-icon">content_copy</span>}
            title="Content Management"
            description="Upload, organize, and distribute content to any display with a few clicks."
          />
          <FeatureCard 
            icon={<span className="material-icon">analytics</span>}
            title="Analytics & Reporting"
            description="Gain insights with detailed analytics about display performance and content engagement."
          />
        </div>
      </section>

      <section className="testimonials-section">
        <h2 className="section-title">Trusted by Businesses Worldwide</h2>
        <div className="testimonials-container">
          <div className="testimonial-card">
            <p className="testimonial-text">
              "Vizora has transformed how we manage digital content across our stores. The platform is intuitive and powerful."
            </p>
            <div className="testimonial-author">
              <img src="/images/testimonial-1.jpg" alt="Jane Smith" className="testimonial-avatar" />
              <div className="testimonial-info">
                <h4 className="testimonial-name">Jane Smith</h4>
                <p className="testimonial-role">Marketing Director, Retail Co.</p>
              </div>
            </div>
          </div>
          <div className="testimonial-card">
            <p className="testimonial-text">
              "The scheduling capabilities are exactly what we needed for our global operations. Support team is amazing too!"
            </p>
            <div className="testimonial-author">
              <img src="/images/testimonial-2.jpg" alt="John Davis" className="testimonial-avatar" />
              <div className="testimonial-info">
                <h4 className="testimonial-name">John Davis</h4>
                <p className="testimonial-role">IT Manager, Global Services</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <h2 className="cta-title">Ready to Transform Your Digital Displays?</h2>
        <p className="cta-description">
          Join thousands of businesses that trust Vizora for their digital signage needs.
        </p>
        <Link to="/signup" className="btn btn-primary btn-large">
          Start Your Free Trial
        </Link>
      </section>

      <footer className="landing-footer">
        <div className="footer-logo">
          <img src="/images/logo.svg" alt="Vizora Logo" className="footer-logo-image" />
        </div>
        <div className="footer-links">
          <div className="footer-links-column">
            <h4>Product</h4>
            <ul>
              <li><Link to="/features">Features</Link></li>
              <li><Link to="/pricing">Pricing</Link></li>
              <li><Link to="/case-studies">Case Studies</Link></li>
            </ul>
          </div>
          <div className="footer-links-column">
            <h4>Company</h4>
            <ul>
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/contact">Contact</Link></li>
              <li><Link to="/careers">Careers</Link></li>
            </ul>
          </div>
          <div className="footer-links-column">
            <h4>Resources</h4>
            <ul>
              <li><Link to="/blog">Blog</Link></li>
              <li><Link to="/help">Help Center</Link></li>
              <li><Link to="/api-docs">API Documentation</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-legal">
          <p className="copyright">© {new Date().getFullYear()} Vizora. All rights reserved.</p>
          <div className="legal-links">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage; 