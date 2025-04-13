import React from 'react';
import { 
  CheckBadgeIcon, 
  ServerIcon, 
  QrCodeIcon, 
  ClockIcon,
  ExclamationCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import PropTypes from 'prop-types';

// Improved interface with more specific types
interface DisplayProps {
  display: {
    id: string;
    name: string;
    status: string;
    location: string; // Now we ensure this is always a string
    qrCode?: string;
    lastConnected: string;
  };
  onPushContent: (id: string) => void;
  onUnpair: (id: string) => void;
}

/**
 * Display component for showing a single display/device card
 * Ensures all rendered values are strings to prevent "Objects are not valid as React children" errors
 */
const Display: React.FC<DisplayProps> = ({ display, onPushContent, onUnpair }) => {
  // Helper function to ensure any value is rendered as a string
  const ensureString = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'online':
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'offline':
        return 'bg-gray-100 text-gray-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'reconnecting':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'online':
      case 'active':
        return <CheckBadgeIcon className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <ExclamationCircleIcon className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <ExclamationCircleIcon className="h-4 w-4 text-red-500" />;
      case 'reconnecting':
        return <ArrowPathIcon className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  // Convert all display properties to strings to avoid rendering objects
  const safeDisplay = {
    ...display,
    name: ensureString(display.name),
    status: ensureString(display.status),
    location: ensureString(display.location),
    qrCode: ensureString(display.qrCode),
    lastConnected: ensureString(display.lastConnected)
  };

  const isOffline = safeDisplay.status.toLowerCase() === 'offline';

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex-1">
        <div className="flex items-center">
          <ServerIcon className="h-6 w-6 text-gray-400 mr-3" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">{safeDisplay.name}</h3>
            <div className="mt-1 flex items-center space-x-1">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(safeDisplay.status)}`}
              >
                {safeDisplay.status}
              </span>
              {getStatusIcon(safeDisplay.status)}
            </div>
          </div>
        </div>
        
        <div className="mt-2 flex flex-col text-sm text-gray-500">
          <div className="flex items-center mb-1">
            <QrCodeIcon className="h-4 w-4 mr-1 flex-shrink-0" />
            <span className="truncate">{safeDisplay.location}</span>
          </div>
          <div className="flex items-center">
            <ClockIcon className="h-4 w-4 mr-1 flex-shrink-0" />
            <span className="truncate">Last active: {safeDisplay.lastConnected}</span>
          </div>
        </div>
      </div>
      
      <div className="mt-4 flex space-x-3">
        <button
          onClick={() => onPushContent(display.id)}
          disabled={isOffline}
          className={`flex-1 inline-flex justify-center items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
            isOffline 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
          }`}
        >
          Push Content
        </button>
        <button
          onClick={() => onUnpair(display.id)}
          className="flex-1 inline-flex justify-center items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Unpair
        </button>
      </div>
    </div>
  );
};

// PropTypes for better documentation and runtime checking
Display.propTypes = {
  display: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    location: PropTypes.string.isRequired,
    qrCode: PropTypes.string,
    lastConnected: PropTypes.string.isRequired
  }).isRequired,
  onPushContent: PropTypes.func.isRequired,
  onUnpair: PropTypes.func.isRequired
};

export default Display; 