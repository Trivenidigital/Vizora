import React from 'react';
import { Logo } from '@/components/shared/Logo';
import { Github, Twitter, Linkedin } from 'lucide-react'; // Example social icons

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 bg-slate-900 text-slate-400">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Branding */}
          <div className="md:col-span-1">
            <Logo className="h-8 w-auto mb-3 text-white" />
            <p className="text-sm">AI-Powered Digital Signage Platform</p>
          </div>

          {/* Links - Example Columns */}
          <div>
            <h4 className="font-semibold text-slate-200 mb-3">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white">Features</a></li>
              <li><a href="#" className="hover:text-white">Pricing</a></li>
              <li><a href="#" className="hover:text-white">Integrations</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-200 mb-3">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white">About Us</a></li>
              <li><a href="#" className="hover:text-white">Careers</a></li>
              <li><a href="#" className="hover:text-white">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-200 mb-3">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white">Documentation</a></li>
              <li><a href="#" className="hover:text-white">Blog</a></li>
              <li><a href="#" className="hover:text-white">Support</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */} 
        <div className="border-t border-slate-700 pt-6 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm mb-4 md:mb-0">&copy; {currentYear} Vizora. All rights reserved.</p>
          <div className="flex space-x-4">
            <a href="#" className="hover:text-white" aria-label="Twitter"><Twitter size={18} /></a>
            <a href="#" className="hover:text-white" aria-label="GitHub"><Github size={18} /></a>
            <a href="#" className="hover:text-white" aria-label="LinkedIn"><Linkedin size={18} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}; 