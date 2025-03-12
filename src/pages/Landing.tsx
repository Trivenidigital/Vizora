import { Link } from 'react-router-dom';
import { Cast } from 'lucide-react';

const Landing = () => {
  return (
    <div className="bg-white min-h-screen">
      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <div className="flex items-center">
            <Cast className="h-8 w-8 text-primary-600" />
            <span className="ml-2 text-2xl font-bold text-primary-600">Vizora</span>
          </div>
          <div className="hidden md:flex items-center space-x-10">
            <Link to="#features" className="text-base font-medium text-secondary-600 hover:text-secondary-900">
              Features
            </Link>
            <Link to="#pricing" className="text-base font-medium text-secondary-600 hover:text-secondary-900">
              Pricing
            </Link>
            <Link to="#about" className="text-base font-medium text-secondary-600 hover:text-secondary-900">
              About
            </Link>
            <Link to="#contact" className="text-base font-medium text-secondary-600 hover:text-secondary-900">
              Contact
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/login" className="text-base font-medium text-secondary-600 hover:text-secondary-900">
              Sign in
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
            >
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900 to-primary-700 opacity-90">
          <img
            src="https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=2850&q=80"
            alt=""
            className="w-full h-full object-cover mix-blend-overlay"
          />
        </div>
        <div className="relative max-w-7xl mx-auto py-24 px-4 sm:py-32 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Transform Your Displays
              <br />
              <span className="text-white opacity-90">With AI-Powered Signage</span>
            </h1>
            <p className="mt-6 max-w-3xl mx-auto text-xl text-white opacity-90">
              Vizora delivers next-generation digital signage with intelligent content management,
              dynamic scheduling, and seamless integration with your existing systems.
            </p>
            <div className="mt-10 flex justify-center space-x-6">
              <Link
                to="/app"
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-primary-700 bg-white hover:bg-gray-50"
              >
                Get started
              </Link>
              <Link
                to="#demo"
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-500 bg-opacity-30 hover:bg-opacity-40"
              >
                Live demo
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Next-Generation Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-secondary-900 sm:text-4xl">
              Next-Generation Digital Signage
            </h2>
            <p className="mt-4 max-w-3xl mx-auto text-xl text-secondary-500">
              Vizora combines cutting-edge AI technology with intuitive design to revolutionize how
              you manage and display content.
            </p>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-base text-primary-600 font-semibold tracking-wide uppercase">Features</h2>
            <p className="mt-2 text-3xl font-extrabold text-secondary-900 sm:text-4xl">
              Everything you need for digital signage
            </p>
            <p className="mt-4 max-w-2xl mx-auto text-xl text-secondary-500">
              Manage your displays, create content, schedule playlists, and analyze performance all in one place.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
              <div className="w-12 h-12 rounded-md bg-primary-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-secondary-900">Smart Display Management</h3>
              <p className="mt-2 text-base text-secondary-500">
                Easily connect, monitor, and control all your displays from a central dashboard.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
              <div className="w-12 h-12 rounded-md bg-primary-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-secondary-900">AI Content Generation</h3>
              <p className="mt-2 text-base text-secondary-500">
                Create professional-looking content in seconds with our AI-powered design tools.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
              <div className="w-12 h-12 rounded-md bg-primary-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-secondary-900">Dynamic Scheduling</h3>
              <p className="mt-2 text-base text-secondary-500">
                Schedule content based on time, location, audience, and other contextual factors.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
              <div className="w-12 h-12 rounded-md bg-primary-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-secondary-900">Advanced Analytics</h3>
              <p className="mt-2 text-base text-secondary-500">
                Gain insights into viewer engagement and optimize your content strategy.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
              <div className="w-12 h-12 rounded-md bg-primary-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-secondary-900">Real-time Updates</h3>
              <p className="mt-2 text-base text-secondary-500">
                Push content updates instantly to any or all of your displays with a single click.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
              <div className="w-12 h-12 rounded-md bg-primary-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-secondary-900">Seamless Integration</h3>
              <p className="mt-2 text-base text-secondary-500">
                Connect with your existing tools and data sources for a unified workflow.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary-700">
        <div className="max-w-2xl mx-auto text-center py-16 px-4 sm:py-20 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            <span className="block">Ready to transform your displays?</span>
            <span className="block">Start your free trial today.</span>
          </h2>
          <p className="mt-4 text-lg leading-6 text-primary-200">
            No credit card required. Start managing your digital signage in minutes.
          </p>
          <Link
            to="/register"
            className="mt-8 w-full inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-primary-600 bg-white hover:bg-primary-50 sm:w-auto"
          >
            Sign up for free
          </Link>
        </div>
      </div>

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
              <Link to="#features" className="text-base text-secondary-500 hover:text-secondary-900">
                Features
              </Link>
            </div>
            <div className="px-5 py-2">
              <Link to="#pricing" className="text-base text-secondary-500 hover:text-secondary-900">
                Pricing
              </Link>
            </div>
            <div className="px-5 py-2">
              <Link to="#about" className="text-base text-secondary-500 hover:text-secondary-900">
                About
              </Link>
            </div>
            <div className="px-5 py-2">
              <Link to="#contact" className="text-base text-secondary-500 hover:text-secondary-900">
                Contact
              </Link>
            </div>
            <div className="px-5 py-2">
              <Link to="#privacy" className="text-base text-secondary-500 hover:text-secondary-900">
                Privacy
              </Link>
            </div>
            <div className="px-5 py-2">
              <Link to="#terms" className="text-base text-secondary-500 hover:text-secondary-900">
                Terms
              </Link>
            </div>
          </nav>
          <p className="mt-8 text-center text-base text-secondary-400">
            &copy; 2023 Vizora, Inc. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
