import React from 'react';

interface DisplayProps {
  display: {
    id: string;
    name: string;
    status: 'active' | 'offline';
    location: string;
    qrCode: string;
    lastConnected: string;
  };
  onPushContent: (displayId: string) => void;
  onUnpair: (displayId: string) => void;
}

const Display: React.FC<DisplayProps> = ({ display, onPushContent, onUnpair }) => {
  const isActive = display.status === 'active';
  
  return (
    <div className="border-b border-gray-200 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${isActive ? 'text-green-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{display.name}</h3>
            <p className="text-sm text-gray-500">Location: {display.location}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
            {isActive ? 'active' : 'offline'}
          </span>
          
          <button
            onClick={() => onPushContent(display.id)}
            className={`inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white ${isActive ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
            disabled={!isActive}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
            </svg>
            Push Content
          </button>
          
          <button
            onClick={() => onUnpair(display.id)}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Unpair
          </button>
        </div>
      </div>
      
      <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">QR Code:</span> {display.qrCode}
        </div>
        <div>
          <span className="text-gray-500">Last connected:</span> {display.lastConnected}
        </div>
      </div>
    </div>
  );
};

export default Display; 