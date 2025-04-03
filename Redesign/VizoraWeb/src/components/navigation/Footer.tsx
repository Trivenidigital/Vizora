import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-white border-t border-gray-200 relative z-20">
      <div className="mx-auto px-4 py-3 md:flex md:items-center md:justify-between">
        <div className="flex justify-center space-x-6 md:order-2">
          <Link to="/help" className="text-sm text-gray-500 hover:text-gray-700">
            Help
          </Link>
          <Link to="/privacy" className="text-sm text-gray-500 hover:text-gray-700">
            Privacy
          </Link>
          <Link to="/terms" className="text-sm text-gray-500 hover:text-gray-700">
            Terms
          </Link>
        </div>
        <div className="mt-2 md:order-1 md:mt-0">
          <p className="text-center text-sm text-gray-500">
            &copy; {currentYear} Vizora. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 