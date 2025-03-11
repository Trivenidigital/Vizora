import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Cast, 
  Menu, 
  X, 
  ArrowRight, 
  Zap, 
  Clock, 
  BarChart3, 
  Cloud, 
  Layers, 
  Shield 
} from 'lucide-react';
import { useState } from 'react';

const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const features = [
    {
      name: 'AI-Powered Content Creation',
      description: 'Generate professional content automatically with our advanced AI algorithms tailored to your brand.',
      icon: Zap,
    },
    {
      name: 'Smart Scheduling',
      description: 'Dynamic content scheduling that adapts to audience patterns and business hours automatically.',
      icon: Clock,
    },
    {
      name: 'Advanced Analytics',
      description: 'Comprehensive insights into viewer engagement and content performance with actionable recommendations.',
      icon: BarChart3,
    },
    {
      name: 'Cloud Integration',
      description: 'Seamlessly connect with your existing cloud storage, social media, and business applications.',
      icon: Cloud,
    },
    {
      name: 'Multi-Display Management',
      description: 'Manage thousands of displays from a single dashboard with group controls and status monitoring.',
      icon: Layers,
    },
    {
      name: 'Enterprise Security',
      description: 'Bank-level encryption and access controls to keep your content and displays secure.',
      icon: Shield,
    },
  ];

  return (
    <div className="bg-white">
      {/* Header */}
      <header className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center py-6 md:justify-start md:space-x-10">
            <div className="flex justify-start lg:w-0 lg:flex-1">
              <Link to="/" className="flex items-center">
                <Cast className="h-8 w-8 text-primary-600" />
                <span className="ml-2 text-xl font-bold text-primary-600">Vizora</span>
              </Link>
            </div>
            <div className="-mr-2 -my-2 md:hidden">
              <button
                type="button"
                className="bg-white rounded-md p-2 inline-flex items-center justify-center text-secondary-400 hover:text-secondary-500 hover:bg-secondary-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
                onClick={() => setMobileMenuOpen(true)}
              >
                <span className="sr-only">Open menu</span>
                <Menu className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <nav className="hidden md:flex space-x-10">
              <Link to="/features" className="text-base font-medium text-secondary-500 hover:text-secondary-900">
                Features
              </Link>
              <Link to="/pricing" className="text-base font-medium text-secondary-500 hover:text-secondary-900">
                Pricing
              </Link>
              <Link to="/about" className="text-base font-medium text-secondary-500 hover:text-secondary-900">
                About
              </Link>
              <Link to="/contact" className="text-base font-medium text-secondary-500 hover:text-secondary-900">
                Contact
              </Link>
            </nav>
            <div className="hidden md:flex items-center justify-end md:flex-1 lg:w-0">
              <Link to="/login" className="whitespace-nowrap text-base font-medium text-secondary-500 hover:text-secondary-900">
                Sign in
              </Link>
              <Link
                to="/register"
                className="ml-8 whitespace-nowrap inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary-600 hover:bg-primary-700"
              >
                Sign up
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`${mobileMenuOpen ? 'fixed inset-0 z-40 overflow-y-auto' : 'hidden'} md:hidden`}>
          <div className="fixed inset-0 bg-black bg-opacity-25" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 right-0 max-w-xs w-full bg-white shadow-xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Cast className="h-8 w-8 text-primary-600" />
                <span className="ml-2 text-xl font-bold text-primary-600">Vizora</span>
              </div>
              <button
                type="button"
                className="text-secondary-400 hover:text-secondary-500"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="sr-only">Close menu</span>
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-6 flex flex-col space-y-4">
              <Link to="/features" className="text-base font-medium text-secondary-500 hover:text-secondary-900">
                Features
              </Link>
              <Link to="/pricing" className="text-base font-medium text-secondary-500 hover:text-secondary-900">
                Pricing
              </Link>
              <Link to="/about" className="text-base font-medium text-secondary-500 hover:text-secondary-900">
                About
              </Link>
              <Link to="/contact" className="text-base font-medium text-secondary-500 hover:text-secondary-900">
                Contact
              </Link>
            </div>
            <div className="mt-auto pt-6 flex flex-col space-y-4">
              <Link to="/login" className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-primary-600 bg-white hover:bg-secondary-50 border-primary-600">
                Sign in
              </Link>
              <Link to="/register" className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary-600 hover:bg-primary-700">
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero section */}
      <main>
        <div className="relative">
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gray-100" />
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div className="relative shadow-xl sm:rounded-2xl sm:overflow-hidden">
              <div className="absolute inset-0">
                <img
                  className="h-full w-full object-cover"
                  src="https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2074&q=80"
                  alt="Digital signage in modern office"
                />
                <div className="absolute inset-0 bg-primary-700 mix-blend-multiply" />
              </div>
              <div className="relative px-4 py-16 sm:px-6 sm:py-24 lg:py-32 lg:px-8">
                <motion.h1 
                  className="text-center text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <span className="block text-white">Transform Your Displays</span>
                  <span className="block text-primary-200">With AI-Powered Signage</span>
                </motion.h1>
                <motion.p 
                  className="mt-6 max-w-lg mx-auto text-center text-xl text-white sm:max-w-3xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  Vizora delivers next-generation digital signage with intelligent content management, 
                  dynamic scheduling, and seamless integration with your existing systems.
                </motion.p>
                <div className="mt-10 max-w-sm mx-auto sm:max-w-none sm:flex sm:justify-center">
                  <div className="space-y-4 sm:space-y-0 sm:mx-auto sm:inline-grid sm:grid-cols-2 sm:gap-5">
                    <Link
                      to="/register"
                      className="flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-500 hover:bg-primary-600 sm:px-8"
                    >
                      Get started
                    </Link>
                    <Link
                      to="/demo"
                      className="flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-primary-700 bg-white hover:bg-primary-50 sm:px-8"
                    >
                      Live demo
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features section */}
        <div className="py-16 bg-white overflow-hidden lg:py-24">
          <div className="relative max-w-xl mx-auto px-4 sm:px-6 lg:px-8 lg:max-w-7xl">
            <div className="relative">
              <h2 className="text-center text-3xl leading-8 font-extrabold tracking-tight text-secondary-900 sm:text-4xl">
                Next-Generation Digital Signage
              </h2>
              <p className="mt-4 max-w-3xl mx-auto text-center text-xl text-secondary-500">
                Vizora combines cutting-edge AI technology with intuitive design to revolutionize how you manage and display content.
              </p>
            </div>

            <div className="relative mt-12 lg:mt-24 lg:grid lg:grid-cols-2 lg:gap-8 lg:items-center">
              <div className="relative">
                <h3 className="text-2xl font-extrabold text-secondary-900 tracking-tight sm:text-3xl">
                  AI-Powered Content Management
                </h3>
                <p className="mt-3 text-lg text-secondary-500">
                  Our intelligent system learns your brand voice and automatically generates and optimizes content for your displays.
                </p>

                <dl className="mt-10 space-y-10">
                  <div className="relative">
                    <dt>
                      <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary-500 text-white">
                        <Zap className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <p className="ml-16 text-lg leading-6 font-medium text-secondary-900">Automated Content Creation</p>
                    </dt>
                    <dd className="mt-2 ml-16 text-base text-secondary-500">
                      Generate professional content with a single click, from social media posts to promotional displays.
                    </dd>
                  </div>

                  <div className="relative">
                    <dt>
                      <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary-500 text-white">
                        <Layers className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <p className="ml-16 text-lg leading-6 font-medium text-secondary-900">Smart Templates</p>
                    </dt>
                    <dd className="mt-2 ml-16 text-base text-secondary-500">
                      Access hundreds of AI-optimized templates that adapt to your brand guidelines automatically.
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-10 -mx-4 relative lg:mt-0" aria-hidden="true">
                <img
                  className="relative mx-auto rounded-lg shadow-lg"
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2070&q=80"
                  alt="AI content management dashboard"
                />
              </div>
            </div>

            <div className="relative mt-12 sm:mt-16 lg:mt-24">
              <div className="lg:grid lg:grid-flow-row-dense lg:grid-cols-2 lg:gap-8 lg:items-center">
                <div className="lg:col-start-2">
                  <h3 className="text-2xl font-extrabold text-secondary-900 tracking-tight sm:text-3xl">
                    Intelligent Display Management
                  </h3>
                  <p className="mt-3 text-lg text-secondary-500">
                    Monitor and control all your displays from anywhere with real-time analytics and remote management.
                  </p>

                  <dl className="mt-10 space-y-10">
                    <div className="relative">
                      <dt>
                        <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary-500 text-white">
                          <BarChart3 className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <p className="ml-16 text-lg leading-6 font-medium text-secondary-900">Real-time Analytics</p>
                      </dt>
                      <dd className="mt-2 ml-16 text-base text-secondary-500">
                        Track viewer engagement and content performance with detailed analytics and AI-powered insights.
                      </dd>
                    </div>

                    <div className="relative">
                      <dt>
                        <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary-500 text-white">
                          <Clock className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <p className="ml-16 text-lg leading-6 font-medium text-secondary-900">Dynamic Scheduling</p>
                      </dt>
                      <dd className="mt-2 ml-16 text-base text-secondary-500">
                        Set up intelligent content rotation that adapts to time, audience, and business conditions.
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-10 -mx-4 relative lg:mt-0 lg:col-start-1">
                  <img
                    className="relative mx-auto rounded-lg shadow-lg"
                    src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2070&q=80"
                    alt="Display management interface"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature grid */}
        <div className="bg-gray-50 py-12 sm:py-16 lg:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-base font-semibold text-primary-600 tracking-wide uppercase">Comprehensive Platform</h2>
              <p className="mt-2 text-3xl font-extrabold text-secondary-900 sm:text-4xl lg:text-5xl">
                Everything you need for digital signage
              </p>
              <p className="mt-4 max-w-2xl text-xl text-secondary-500 lg:mx-auto">
                Vizora provides a complete solution for managing your digital displays with powerful features designed for businesses of all sizes.
              </p>
            </div>

            <div className="mt-12">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {features.map((feature) => (
                  <div key={feature.name} className="pt-6">
                    <div className="flow-root bg-white rounded-lg px-6 pb-8 h-full">
                      <div className="-mt-6">
                        <div>
                          <span className="inline-flex items-center justify-center p-3 bg-primary-500 rounded-md shadow-lg">
                            <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                          </span>
                        </div>
                        <h3 className="mt-8 text-lg font-medium text-secondary-900 tracking-tight">{feature.name}</h3>
                        <p className="mt-5 text-base text-secondary-500">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CTA section */}
        <div className="bg-primary-700">
          <div className="max-w-2xl mx-auto text-center py-16 px-4 sm:py-20 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
              <span className="block">Ready to transform your displays?</span>
              <span className="block">Start your free trial today.</span>
            </h2>
            <p className="mt-4 text-lg leading-6 text-primary-200">
              Experience the power of AI-driven digital signage with a 14-day free trial. No credit card required.
            </p>
            <Link
              to="/register"
              className="mt-8 w-full inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-primary-600 bg-white hover:bg-primary-50 sm:w-auto"
            >
              Sign up for free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white">
        <div className="max-w-7xl mx-auto py-12 px-4 overflow-hidden sm:px-6 lg:px-8">
          <div className="flex justify-center">
            <div className="flex items-center">
              <Cast className="h-8 w-8 text-primary-600" />
              <span className="ml-2 text-xl font-bold text-primary-600">Vizora</span>
            </div>
          </div>
          <nav className="mt-8 flex flex-wrap justify-center" aria-label="Footer">
            <div className="px-5 py-2">
              <Link to="/about" className="text-base text-secondary-500 hover:text-secondary-900">
                About
              </Link>
            </div>
            <div className="px-5 py-2">
              <Link to="/features" className="text-base text-secondary-500 hover:text-secondary-900">
                Features
              </Link>
            </div>
            <div className="px-5 py-2">
              <Link to="/pricing" className="text-base text-secondary-500 hover:text-secondary-900">
                Pricing
              </Link>
            </div>
            <div className="px-5 py-2">
              <Link to="/blog" className="text-base text-secondary-500 hover:text-secondary-900">
                Blog
              </Link>
            </div>
            <div className="px-5 py-2">
              <Link to="/contact" className="text-base text-secondary-500 hover:text-secondary-900">
                Contact
              </Link>
            </div>
          </nav>
          <p className="mt-8 text-center text-base text-secondary-400">
            &copy; {new Date().getFullYear()} Vizora, Inc. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
