import { FC, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckIcon } from '@heroicons/react/24/outline';
import { Logo } from '../../components/ui/Logo';

interface PricingTier {
  name: string;
  id: string;
  price: {
    monthly: number;
    annually: number;
  };
  description: string;
  features: string[];
  cta: string;
  popular?: boolean;
}

const tiers: PricingTier[] = [
  {
    name: 'Starter',
    id: 'tier-starter',
    price: {
      monthly: 49,
      annually: 39,
    },
    description: 'Perfect for small businesses starting with digital signage.',
    features: [
      'Up to 10 displays',
      'Cloud-based content management',
      'Basic scheduling',
      'Email support',
      'Standard content templates',
      '720p resolution support',
      'Daily content updates',
      '5GB storage',
    ],
    cta: 'Start with Starter',
  },
  {
    name: 'Professional',
    id: 'tier-professional',
    price: {
      monthly: 99,
      annually: 79,
    },
    description: 'For growing businesses with multiple locations.',
    features: [
      'Up to 50 displays',
      'Advanced scheduling options',
      'Display grouping and tagging',
      'Email and chat support',
      'Advanced content templates',
      '1080p resolution support',
      'Hourly content updates',
      '25GB storage',
      'Basic analytics',
      'User roles and permissions',
    ],
    cta: 'Choose Professional',
    popular: true,
  },
  {
    name: 'Enterprise',
    id: 'tier-enterprise',
    price: {
      monthly: 249,
      annually: 199,
    },
    description: 'For large organizations with complex needs.',
    features: [
      'Unlimited displays',
      'Custom scheduling solutions',
      'Advanced display organization',
      'Priority phone, email, and chat support',
      'Custom content templates',
      '4K resolution support',
      'Real-time content updates',
      '100GB storage',
      'Advanced analytics and reporting',
      'Custom user roles and permissions',
      'API access',
      'Dedicated account manager',
    ],
    cta: 'Contact Sales',
  },
];

const faqs = [
  {
    question: 'How does billing work?',
    answer: 'We offer both monthly and annual billing options. Annual plans come with a 20% discount. You can upgrade or downgrade your plan at any time, and the difference will be prorated.',
  },
  {
    question: 'What happens when I reach my display limit?',
    answer: 'If you need more displays than your current plan allows, you can upgrade to a higher tier plan at any time. Your account will be immediately updated with the new limits.',
  },
  {
    question: 'Can I try Vizora before purchasing?',
    answer: 'Yes, we offer a 14-day free trial that includes all features from our Professional plan. No credit card is required to start your trial.',
  },
  {
    question: 'Do you offer custom enterprise solutions?',
    answer: 'Absolutely. Our Enterprise tier can be customized to meet your specific needs. Contact our sales team to discuss your requirements and get a custom quote.',
  },
  {
    question: 'What kind of support do you provide?',
    answer: 'All plans include email support. The Professional plan adds chat support, while Enterprise customers get priority phone, email, and chat support, as well as a dedicated account manager.',
  },
  {
    question: 'Can I cancel my subscription?',
    answer: "Yes, you can cancel your subscription at any time. If you cancel, you'll continue to have access until the end of your current billing period.",
  },
];

export const PricingPage: FC = () => {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="bg-neutral-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Logo className="h-8" />
            <div className="flex items-center space-x-4">
              <Link to="/features" className="text-neutral-600 hover:text-neutral-900 px-3 py-2 text-sm font-medium">
                Features
              </Link>
              <Link to="/pricing" className="text-primary-600 hover:text-primary-800 px-3 py-2 text-sm font-medium">
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
      <div className="pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 tracking-tight">
              Simple, Transparent Pricing
            </h1>
            <p className="mt-6 text-xl text-neutral-600 max-w-3xl mx-auto">
              Choose the perfect plan for your business, with no hidden fees or surprises.
            </p>
          </div>

          {/* Pricing toggle */}
          <div className="mt-12 flex justify-center">
            <div className="relative bg-neutral-100 p-1 rounded-lg inline-flex">
              <button
                type="button"
                className={`${
                  !annual ? 'bg-white shadow-sm' : 'bg-transparent'
                } relative py-2 px-6 text-sm font-medium rounded-md focus:outline-none transition-all duration-200`}
                onClick={() => setAnnual(false)}
              >
                Monthly billing
              </button>
              <button
                type="button"
                className={`${
                  annual ? 'bg-white shadow-sm' : 'bg-transparent'
                } relative py-2 px-6 text-sm font-medium rounded-md focus:outline-none transition-all duration-200`}
                onClick={() => setAnnual(true)}
              >
                Annual billing
                <span className="absolute -top-2 -right-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-accent-500 text-white">
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing tiers */}
      <div className="pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {tiers.map((tier, index) => (
              <motion.div
                key={tier.id}
                className={`relative bg-white rounded-2xl shadow-lg overflow-hidden border ${
                  tier.popular ? 'border-primary-300' : 'border-neutral-200'
                }`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                {tier.popular && (
                  <div className="absolute top-0 right-0 left-0 bg-primary-600 py-1.5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white">Most popular</p>
                  </div>
                )}
                <div className={`p-8 ${tier.popular ? 'pt-12' : 'pt-8'}`}>
                  <h2 className="text-xl font-semibold text-neutral-900">{tier.name}</h2>
                  <p className="mt-2 text-sm text-neutral-500">{tier.description}</p>
                  
                  <div className="mt-6">
                    <div className="flex items-baseline">
                      <span className="text-neutral-900 text-4xl font-bold">
                        ${annual ? tier.price.annually : tier.price.monthly}
                      </span>
                      <span className="text-neutral-500 ml-2 text-sm">/month</span>
                    </div>
                    {annual && (
                      <p className="text-sm text-neutral-500 mt-1">
                        Billed annually (${tier.price.annually * 12}/year)
                      </p>
                    )}
                  </div>
                  
                  <div className="mt-8">
                    <Link
                      to={tier.name === 'Enterprise' ? '/contact' : '/register'}
                      className={`block w-full py-3 px-4 rounded-lg font-medium text-center ${
                        tier.popular
                          ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm'
                          : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-900'
                      } transition-all duration-200`}
                    >
                      {tier.cta}
                    </Link>
                  </div>
                  
                  <div className="mt-8">
                    <h3 className="text-sm font-semibold text-neutral-900 tracking-wide uppercase">
                      What's included
                    </h3>
                    <ul className="mt-4 space-y-3">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start">
                          <CheckIcon className="flex-shrink-0 h-5 w-5 text-primary-500 mt-0.5" />
                          <span className="ml-3 text-neutral-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-neutral-500">
              All plans include a 14-day free trial. No credit card required.
            </p>
          </div>
        </div>
      </div>

      {/* Enterprise plan */}
      <div className="bg-primary-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="flex flex-col lg:flex-row">
              <div className="flex-1 p-8 lg:p-12">
                <h2 className="text-2xl font-bold text-neutral-900">Need a custom solution?</h2>
                <p className="mt-4 text-lg text-neutral-600">
                  Our Enterprise plan can be tailored to your organization's specific requirements. Get in touch with our sales team for a personalized quote.
                </p>
                <ul className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  {[
                    'Custom SLAs',
                    'Dedicated infrastructure',
                    'White-label options',
                    'On-premises deployment',
                    'Custom integrations',
                    'Advanced security features',
                    'Premium support',
                    'Custom training',
                  ].map((feature) => (
                    <li key={feature} className="flex items-start">
                      <CheckIcon className="flex-shrink-0 h-5 w-5 text-primary-500 mt-0.5" />
                      <span className="ml-3 text-neutral-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex-shrink-0 p-8 lg:p-12 bg-gradient-to-br from-primary-600 to-primary-700 text-white lg:flex lg:flex-col lg:justify-center">
                <div className="text-center lg:text-left">
                  <h3 className="text-xl font-semibold mb-4">Contact our Enterprise team</h3>
                  <p className="mb-6">
                    Talk to our sales team to get a custom quote for your organization.
                  </p>
                  <Link
                    to="/contact"
                    className="inline-block bg-white text-primary-600 hover:bg-neutral-100 rounded-lg px-6 py-3 text-base font-medium transition-all duration-200"
                  >
                    Contact Sales
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FAQs */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-neutral-900">Frequently asked questions</h2>
            <p className="mt-4 text-lg text-neutral-600 max-w-3xl mx-auto">
              Can't find the answer you're looking for? Contact our{' '}
              <Link to="/support" className="text-primary-600 hover:text-primary-800">
                customer support
              </Link>{' '}
              team.
            </p>
          </div>

          <div className="max-w-3xl mx-auto divide-y divide-neutral-200">
            {faqs.map((faq, index) => (
              <motion.div
                key={faq.question}
                className="py-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + index * 0.05 }}
              >
                <h3 className="text-lg font-medium text-neutral-900">{faq.question}</h3>
                <p className="mt-3 text-neutral-600">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-neutral-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-neutral-900 mb-4">
            Ready to transform your digital displays?
          </h2>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto mb-8">
            Start your 14-day free trial today and see how Vizora can help you manage your digital signage network more effectively.
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
              Contact Sales
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