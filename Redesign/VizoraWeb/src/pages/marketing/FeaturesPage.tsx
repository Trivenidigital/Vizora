import { FC } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  CloudArrowUpIcon,
  LockClosedIcon,
  ServerIcon,
  DeviceTabletIcon,
  ChartBarIcon,
  PuzzlePieceIcon,
  GlobeAltIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';
import { Logo } from '../../components/ui/Logo';

const primaryFeatures = [
  {
    name: 'Cloud-based Management',
    description: 'Manage all your digital displays from anywhere with our secure cloud platform. Control content, schedules, and monitor performance remotely.',
    icon: CloudArrowUpIcon,
  },
  {
    name: 'Enterprise Security',
    description: 'Keep your content and data secure with bank-level encryption, role-based access controls, and comprehensive audit logs.',
    icon: LockClosedIcon,
  },
  {
    name: 'Reliable Infrastructure',
    description: 'Our infrastructure is built for reliability with 99.9% uptime, automatic failover, and multiple redundancies.',
    icon: ServerIcon,
  },
];

const secondaryFeatures = [
  {
    name: 'Multi-Display Control',
    description: 'Manage content across an unlimited number of displays with intuitive grouping and tagging capabilities.',
    icon: DeviceTabletIcon,
  },
  {
    name: 'Detailed Analytics',
    description: 'Track engagement, view durations, and user interactions to optimize your content strategy.',
    icon: ChartBarIcon,
  },
  {
    name: 'Integration Ecosystem',
    description: 'Connect with your existing systems through our powerful API and pre-built integrations with popular platforms.',
    icon: PuzzlePieceIcon,
  },
  {
    name: 'Global Deployment',
    description: 'Deploy your content globally with our CDN-backed distribution network for fast loading times anywhere.',
    icon: GlobeAltIcon,
  },
  {
    name: 'Smart Scheduling',
    description: 'Schedule content based on time, date, location, or trigger events for targeted messaging.',
    icon: BellAlertIcon,
  },
];

export const FeaturesPage: FC = () => {
  return (
    <div className="bg-neutral-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Logo className="h-8" />
            <div className="flex items-center space-x-4">
              <Link to="/features" className="text-primary-600 hover:text-primary-800 px-3 py-2 text-sm font-medium">
                Features
              </Link>
              <Link to="/pricing" className="text-neutral-600 hover:text-neutral-900 px-3 py-2 text-sm font-medium">
                Pricing
              </Link>
              <Link to="/contact" className="text-neutral-600 hover:text-neutral-900 px-3 py-2 text-sm font-medium">
                Contact
              </Link>
              <Link to="/login" className="text-primary-700 hover:text-primary-800 px-3 py-2 text-sm font-medium">
                Log in
              </Link>
              <Link
                to="/register"
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow transition-all"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600/10 to-accent-500/5 z-0" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 tracking-tight">
              Powerful Features for Digital Signage
            </h1>
            <p className="mt-6 text-xl text-neutral-600 max-w-3xl mx-auto">
              Vizora provides everything you need to create, manage, and optimize your digital display network, from a single screen to thousands.
            </p>
          </div>
        </div>
      </div>

      {/* Primary features */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {primaryFeatures.map((feature, index) => (
              <motion.div
                key={feature.name}
                className="relative bg-white p-8 rounded-2xl shadow-lg border border-neutral-100 overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary-100 rounded-bl-3xl -mr-12 -mt-12" />
                
                <div className="h-12 w-12 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center mb-6 relative">
                  <feature.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">{feature.name}</h3>
                <p className="text-neutral-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Platform showcase */}
      <div className="py-16 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="md:w-1/2">
              <h2 className="text-3xl font-bold text-neutral-900 mb-6">
                Intuitive Dashboard for Complete Control
              </h2>
              <p className="text-lg text-neutral-600 mb-8">
                Our modern dashboard provides a comprehensive overview of your entire display network. Monitor status, update content, and analyze performance from a single interface.
              </p>
              <ul className="space-y-4">
                {[
                  'Real-time display status monitoring',
                  'Drag-and-drop content management',
                  'Advanced scheduling capabilities',
                  'User permission management',
                  'Automated content distribution',
                ].map((item, i) => (
                  <li key={i} className="flex items-start">
                    <svg className="h-5 w-5 text-primary-600 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-neutral-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:w-1/2 mt-8 md:mt-0">
              <div className="relative bg-white p-3 rounded-2xl shadow-lg border border-neutral-200">
                <img
                  src="/assets/dashboard-screenshot.png"
                  alt="Vizora Dashboard"
                  className="rounded-lg w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary features */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-neutral-900">
              Everything You Need for Digital Signage
            </h2>
            <p className="mt-4 text-lg text-neutral-600 max-w-3xl mx-auto">
              Our platform is packed with features to help you create engaging experiences, manage content efficiently, and optimize your messaging.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
            {secondaryFeatures.map((feature, index) => (
              <motion.div
                key={feature.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + index * 0.1 }}
              >
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0 h-10 w-10 rounded-md bg-primary-100 text-primary-600 flex items-center justify-center">
                    <feature.icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="ml-4 text-lg font-medium text-neutral-900">{feature.name}</h3>
                </div>
                <div className="ml-14">
                  <p className="text-neutral-600">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Testimonial */}
      <div className="bg-primary-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative p-8 bg-white rounded-2xl shadow-xl max-w-3xl mx-auto">
            <svg className="absolute h-16 w-16 text-primary-100 -top-8 -left-8" fill="currentColor" viewBox="0 0 32 32" aria-hidden="true">
              <path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" />
            </svg>
            <div className="relative">
              <p className="text-lg text-neutral-600 italic mb-4">
                "Vizora has transformed how we manage our digital displays across all our retail locations. The platform is intuitive, powerful, and has helped us increase engagement with our customers through timely, targeted content."
              </p>
              <div className="flex items-center">
                <div className="h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center">
                  <span className="text-neutral-500 font-medium">JD</span>
                </div>
                <div className="ml-4">
                  <h4 className="text-base font-medium text-neutral-900">Jane Doe</h4>
                  <p className="text-sm text-neutral-500">Digital Marketing Director, Major Retail Chain</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-neutral-900 mb-4">
            Ready to see Vizora in action?
          </h2>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto mb-8">
            Start your 14-day free trial today and experience the power of our digital signage platform.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/register"
              className="btn-primary px-6 py-3 text-base font-medium"
            >
              Start Free Trial
            </Link>
            <Link
              to="/contact"
              className="btn-outline px-6 py-3 text-base font-medium"
            >
              Request Demo
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-neutral-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
            <div className="col-span-2">
              <Logo variant="white" className="h-8 mb-4" />
              <p className="text-neutral-400 max-w-xs">
                Vizora helps businesses manage and optimize their digital displays to create engaging experiences.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-4">Product</h3>
              <ul className="space-y-3">
                <li><Link to="/features" className="text-neutral-400 hover:text-white">Features</Link></li>
                <li><Link to="/pricing" className="text-neutral-400 hover:text-white">Pricing</Link></li>
                <li><Link to="/integrations" className="text-neutral-400 hover:text-white">Integrations</Link></li>
                <li><Link to="/changelog" className="text-neutral-400 hover:text-white">Changelog</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-4">Resources</h3>
              <ul className="space-y-3">
                <li><Link to="/blog" className="text-neutral-400 hover:text-white">Blog</Link></li>
                <li><Link to="/docs" className="text-neutral-400 hover:text-white">Documentation</Link></li>
                <li><Link to="/community" className="text-neutral-400 hover:text-white">Community</Link></li>
                <li><Link to="/support" className="text-neutral-400 hover:text-white">Support</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-4">Company</h3>
              <ul className="space-y-3">
                <li><Link to="/about" className="text-neutral-400 hover:text-white">About</Link></li>
                <li><Link to="/contact" className="text-neutral-400 hover:text-white">Contact</Link></li>
                <li><Link to="/careers" className="text-neutral-400 hover:text-white">Careers</Link></li>
                <li><Link to="/legal" className="text-neutral-400 hover:text-white">Legal</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-neutral-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-neutral-500 text-sm">
              &copy; {new Date().getFullYear()} Vizora. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-neutral-400 hover:text-white">
                <span className="sr-only">Twitter</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="#" className="text-neutral-400 hover:text-white">
                <span className="sr-only">LinkedIn</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 11-.003-3.096 1.548 1.548 0 01.003 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="text-neutral-400 hover:text-white">
                <span className="sr-only">GitHub</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}; 