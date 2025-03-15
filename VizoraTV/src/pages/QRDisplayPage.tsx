import React from 'react';
import { QRDisplay } from '../components/QRDisplay';

export const QRDisplayPage: React.FC = () => {
  // For testing purposes, we'll use static values
  const testPairingCode = '123456';
  const testDisplayId = 'display-123';

  return (
    <QRDisplay
      pairingCode={testPairingCode}
      displayId={testDisplayId}
    />
  );
}; 