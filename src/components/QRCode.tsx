import React from 'react';

interface QRCodeProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  bgColor?: string;
  fgColor?: string;
}

/**
 * A simple QR Code placeholder component
 */
export const QRCode: React.FC<QRCodeProps> = ({ 
  value,
  size = 128,
  level = 'L',
  bgColor = '#FFFFFF',
  fgColor = '#000000'
}) => {
  return (
    <div 
      style={{ 
        width: size, 
        height: size, 
        backgroundColor: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        borderRadius: '8px',
        boxSizing: 'border-box',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
      }}
    >
      <svg width={size - 40} height={size - 40} viewBox="0 0 100 100">
        {/* Simple QR code representation */}
        <rect x="0" y="0" width="100" height="100" fill={bgColor} />
        
        {/* Border pattern */}
        <rect x="0" y="0" width="30" height="30" fill={fgColor} />
        <rect x="10" y="10" width="10" height="10" fill={bgColor} />
        
        <rect x="70" y="0" width="30" height="30" fill={fgColor} />
        <rect x="80" y="10" width="10" height="10" fill={bgColor} />
        
        <rect x="0" y="70" width="30" height="30" fill={fgColor} />
        <rect x="10" y="80" width="10" height="10" fill={bgColor} />
        
        {/* Data pattern (simplified) */}
        <rect x="40" y="10" width="20" height="10" fill={fgColor} />
        <rect x="10" y="40" width="10" height="20" fill={fgColor} />
        <rect x="30" y="40" width="40" height="20" fill={fgColor} />
        <rect x="80" y="40" width="10" height="20" fill={fgColor} />
        <rect x="40" y="70" width="20" height="10" fill={fgColor} />
        <rect x="70" y="70" width="10" height="10" fill={fgColor} />
      </svg>
    </div>
  );
}; 