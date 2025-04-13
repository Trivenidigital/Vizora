import React from 'react';
import { useConnectionState } from '@vizora/common';

const ConnectionBadge: React.FC = () => {
  const { isConnected, isReconnecting } = useConnectionState();

  let statusText = 'Disconnected';
  let statusColor = 'red';
  let statusIcon = '❌';

  if (isConnected) {
    statusText = 'Online';
    statusColor = 'green';
    statusIcon = '✔️';
  } else if (isReconnecting) {
    statusText = 'Reconnecting...';
    statusColor = 'yellow';
    statusIcon = '⚠️';
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', color: statusColor }}>
      <span style={{ marginRight: '5px' }}>{statusIcon}</span>
      <span>{statusText}</span>
    </div>
  );
};

export default ConnectionBadge; 