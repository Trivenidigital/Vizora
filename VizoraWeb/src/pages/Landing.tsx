import React from 'react';
import { Link } from 'react-router-dom';
import { Monitor, Globe, Zap, Shield, Clock, BarChart2, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Landing: React.FC = () => {
  const { isLoggedIn } = useAuth();

  // Features section content
  const features = [
    {
      name: 'Easy Display Management',
      description: 'Connect and manage all your screens from a single dashboard. Our platform supports various display types and locations.',
      icon: Monitor,
    },
    {
      name: 'Global Accessibility',
      description: 'Control your displays from anywhere in the world. Our cloud-based system ensures you stay connected.',
      icon: Globe,
    },
    {
      name: 'Instant Updates',
      description: 'Push content updates instantly to any or all of your displays with just a few clicks.',
      icon: Zap,
    },
    {
      name: 'Robust Security',
      description: 'Enterprise-grade security ensures your content and connections are always protected.',
      icon: Shield,
    },
    {
      name: 'Smart Scheduling',
      description: 'Schedule content to display at specific times, ensuring the right message reaches the right audience.',
      icon: Clock,
    },
    {
      name: 'Detailed Analytics',
      description: 'Track performance with comprehensive analytics, including view counts, engagement metrics, and more.',
      icon: BarChart2,
    },
  ];

  // Testimonials
  const testimonials = [
    {
      content: 'Vizora has transformed how we manage our digital displays. The interface is intuitive and the scheduling capabilities are exactly what we needed.',
      author: 'Sarah Johnson',
      role: 'Marketing Director, TechCorp',
    },
    {
      content: 'The ability to update content across multiple locations instantly has saved us countless hours. The analytics tools have helped us optimize our messaging strategy.',
      author: 'Michael Chen',
      role: 'Operations Manager, Retail Chain',
    },
  ];

  return (
    <div className="bg-white overflow-hidden">
      {/* Hero section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="py-4 flex justify-between items-center">
            <div className="flex items-center">
              <img
                className="h-8 w-auto"
                src="/logo.svg"
                alt="Vizora"
                onError={(e) => {
                  e.currentTarget.src = 'https://placehold.co/40x40?text=V';
                }}
              />
              <span className="ml-2 text-xl font-bold">Vizora</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/login" className="text-sm font-medium hover:text-primary-100">
                Log in
              </Link>
              <Link
                to="/register"
                className="text-sm font-medium bg-white text-primary-600 px-4 py-2 rounded-md hover:bg-primary-50"
              >
                Sign up
              </Link>
            </div>
          </header>
        </div>
        <div className="max-w-7xl mx-auto py-16 px-4 sm:py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold sm:text-5xl md:text-6xl">
              <span className="block">Digital Signage</span>
              <span className="block">Made Simple</span>
            </h1>
            <p className="mt-6 max-w-lg mx-auto text-xl text-primary-100 sm:max-w-3xl">
              Manage all your digital displays from a single platform. Easily update content, schedule campaigns, and track performance.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              {isLoggedIn ? (
                <Link 
                  to="/dashboard" 
                  className="inline-flex justify-center items-center py-3 px-5 font-medium text-center text-white rounded-lg bg-primary-600 hover:bg-primary-700 focus:ring-4 focus:ring-primary-300"
                >
                  Go to Dashboard
                  <ChevronRight className="ml-2 -mr-1 w-5 h-5" />
                </Link>
              ) : (
                <>
                  <Link 
                    to="/register" 
                    className="inline-flex justify-center items-center py-3 px-5 font-medium text-center text-white rounded-lg bg-primary-600 hover:bg-primary-700 focus:ring-4 focus:ring-primary-300"
                  >
                    Get Started
                    <ChevronRight className="ml-2 -mr-1 w-5 h-5" />
                  </Link>
                  <Link 
                    to="/login" 
                    className="inline-flex justify-center items-center py-3 px-5 font-medium text-center text-gray-900 rounded-lg border border-gray-300 hover:bg-gray-100 focus:ring-4 focus:ring-gray-100"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features section */}
      <div id="features" className="py-16 bg-gray-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-base font-semibold text-primary-600 tracking-wide uppercase">Features</h2>
            <p className="mt-2 text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Everything you need to manage your displays
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 mx-auto">
              Our platform provides comprehensive tools for digital signage management.
            </p>
          </div>

          <div className="mt-16">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.name} className="pt-6">
                  <div className="flow-root bg-white rounded-lg px-6 pb-8 shadow-sm hover:shadow-md transition-shadow">
                    <div className="-mt-6">
                      <div>
                        <span className="inline-flex items-center justify-center p-3 bg-primary-500 rounded-md shadow-lg">
                          <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                        </span>
                      </div>
                      <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">{feature.name}</h3>
                      <p className="mt-5 text-base text-gray-500">{feature.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Testimonial section */}
      <div className="py-16 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-base font-semibold text-primary-600 tracking-wide uppercase">Testimonials</h2>
            <p className="mt-2 text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Trusted by businesses worldwide
            </p>
          </div>
          <div className="mt-16 grid gap-8 lg:grid-cols-2">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-gray-50 rounded-lg shadow-sm p-8">
                <p className="text-lg text-gray-600 italic">"{testimonial.content}"</p>
                <div className="mt-6">
                  <p className="text-base font-medium text-gray-900">{testimonial.author}</p>
                  <p className="text-sm text-gray-500">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA section */}
      <div className="py-8 px-4 mx-auto max-w-screen-xl sm:py-16 lg:px-6">
        <div className="mx-auto max-w-screen-sm text-center">
          <h2 className="mb-4 text-4xl tracking-tight font-extrabold leading-tight text-gray-900">Get Started with Vizora Today</h2>
          <p className="mb-6 font-light text-gray-500 md:text-lg">
            Join thousands of businesses managing their digital displays with ease.
          </p>
          {isLoggedIn ? (
            <Link to="/dashboard" className="text-white bg-primary-700 hover:bg-primary-800 focus:ring-4 focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2">
              Go to Dashboard
            </Link>
          ) : (
            <Link to="/register" className="text-white bg-primary-700 hover:bg-primary-800 focus:ring-4 focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2">
              Sign Up Now
            </Link>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8">
          <div className="xl:grid xl:grid-cols-3 xl:gap-8">
            <div className="space-y-8 xl:col-span-1">
              <div className="flex items-center">
                <img
                  className="h-10 w-auto"
                  src="/logo.svg"
                  alt="Vizora"
                  onError={(e) => {
                    e.currentTarget.src = 'https://placehold.co/50x50?text=V';
                  }}
                />
                <span className="ml-3 text-2xl font-bold text-white">Vizora</span>
              </div>
              <p className="text-gray-300 text-base">
                Making digital signage management simple and effective for businesses of all sizes.
              </p>
              <div className="flex space-x-6">
                {/* Social media links can go here */}
              </div>
            </div>
            <div className="mt-12 grid grid-cols-2 gap-8 xl:mt-0 xl:col-span-2">
              <div className="md:grid md:grid-cols-2 md:gap-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 tracking-wider uppercase">Solutions</h3>
                  <ul className="mt-4 space-y-4">
                    <li>
                      <a href="#" className="text-base text-gray-400 hover:text-white">
                        Retail Signage
                      </a>
                    </li>
                    <li>
                      <a href="#" className="text-base text-gray-400 hover:text-white">
                        Corporate Displays
                      </a>
                    </li>
                    <li>
                      <a href="#" className="text-base text-gray-400 hover:text-white">
                        Menu Boards
                      </a>
                    </li>
                    <li>
                      <a href="#" className="text-base text-gray-400 hover:text-white">
                        Wayfinding
                      </a>
                    </li>
                  </ul>
                </div>
                <div className="mt-12 md:mt-0">
                  <h3 className="text-sm font-semibold text-gray-300 tracking-wider uppercase">Support</h3>
                  <ul className="mt-4 space-y-4">
                    <li>
                      <a href="#" className="text-base text-gray-400 hover:text-white">
                        Documentation
                      </a>
                    </li>
                    <li>
                      <a href="#" className="text-base text-gray-400 hover:text-white">
                        API Reference
                      </a>
                    </li>
                    <li>
                      <a href="#" className="text-base text-gray-400 hover:text-white">
                        Guides
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="md:grid md:grid-cols-2 md:gap-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 tracking-wider uppercase">Company</h3>
                  <ul className="mt-4 space-y-4">
                    <li>
                      <a href="#" className="text-base text-gray-400 hover:text-white">
                        About
                      </a>
                    </li>
                    <li>
                      <a href="#" className="text-base text-gray-400 hover:text-white">
                        Blog
                      </a>
                    </li>
                    <li>
                      <a href="#" className="text-base text-gray-400 hover:text-white">
                        Careers
                      </a>
                    </li>
                    <li>
                      <a href="#" className="text-base text-gray-400 hover:text-white">
                        Contact
                      </a>
                    </li>
                  </ul>
                </div>
                <div className="mt-12 md:mt-0">
                  <h3 className="text-sm font-semibold text-gray-300 tracking-wider uppercase">Legal</h3>
                  <ul className="mt-4 space-y-4">
                    <li>
                      <a href="#" className="text-base text-gray-400 hover:text-white">
                        Privacy
                      </a>
                    </li>
                    <li>
                      <a href="#" className="text-base text-gray-400 hover:text-white">
                        Terms
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-12 border-t border-gray-700 pt-8">
            <p className="text-base text-gray-400 xl:text-center">
              &copy; 2023 Vizora, Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
