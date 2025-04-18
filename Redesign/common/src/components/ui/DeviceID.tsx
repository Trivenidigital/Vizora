import React from 'react';
import { cn } from '../../lib/utils'; // Use relative path

interface DeviceIDProps {
  deviceId: string | null | undefined;
  className?: string;
}

export const DeviceID: React.FC<DeviceIDProps> = ({ deviceId, className }) => {
  if (!deviceId) {
    return null; // Don't render if no device ID
  }

  return (
    <div className={cn("text-xs text-muted-foreground font-mono truncate max-w-[80vw]", className)}>
      Device ID: {deviceId}
    </div>
  );
};

export default DeviceID; 