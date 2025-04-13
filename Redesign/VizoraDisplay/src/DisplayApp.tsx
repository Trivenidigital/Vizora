import React, { useEffect, useState } from 'react';
import { DisplayStatus } from '@vizora/common/types';
import { VizoraSocketClient } from '@vizora/common/sockets';
import { DisplayService } from './services/displayService';
import { ContentService } from './services/contentService';
import { ScheduleService } from './services/scheduleService';
import { DeviceAuthService } from './services/deviceAuthService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingScreen } from './components/LoadingScreen';
import { ErrorScreen } from './components/ErrorScreen';
import { ContentPlayer } from './components/ContentPlayer';
import { RegistrationScreen } from './components/RegistrationScreen';

// TODO: Phase 4 - Implement more sophisticated error handling and recovery strategies:
// 1. Add automatic reconnection with exponential backoff
// 2. Implement crash analytics and remote logging
// 3. Develop fallback content for disconnected states
// 4. Add self-healing mechanisms for common failure scenarios

interface DisplayMetadata {
  name: string;
  location: string;
  resolution: {
    width: number;
    height: number;
  };
  model: string;
  os: string;
}

export const DisplayApp: React.FC = () => {
  const [status, setStatus] = useState<DisplayStatus | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsRegistration, setNeedsRegistration] = useState(false);

  const socket = new VizoraSocketClient();
  const deviceAuthService = new DeviceAuthService(socket);
  const displayService = new DisplayService(socket);
  const contentService = new ContentService();
  const scheduleService = new ScheduleService(contentService);

  const getDisplayMetadata = (): DisplayMetadata => ({
    name: 'Vizora Display',
    location: 'Default Location',
    resolution: {
      width: window.screen.width,
      height: window.screen.height,
    },
    model: 'Web Browser',
    os: navigator.platform,
  });

  const initializeDisplay = async () => {
    try {
      // Check for existing token
      const token = deviceAuthService.getToken();
      const displayId = deviceAuthService.getDisplayId();
      const metadata = getDisplayMetadata();

      if (token && displayId) {
        // Validate existing token
        const isValid = await deviceAuthService.validateToken();
        if (isValid) {
          setIsAuthenticated(true);
          const displayStatus = await displayService.registerDisplay(displayId);
          setStatus(displayStatus);
          await scheduleService.initialize(displayId);
          return;
        }
      }

      // Need registration
      setNeedsRegistration(true);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to initialize display'));
      setIsLoading(false);
    }
  };

  const handleRegistration = async (pairingCode: string) => {
    try {
      setIsLoading(true);
      const metadata = getDisplayMetadata();
      await deviceAuthService.registerWithPairingCode(pairingCode, metadata);
      
      const displayId = deviceAuthService.getDisplayId();
      if (!displayId) {
        throw new Error('Registration failed: No display ID received');
      }

      setIsAuthenticated(true);
      setNeedsRegistration(false);
      const displayStatus = await displayService.registerDisplay(displayId);
      setStatus(displayStatus);
      await scheduleService.initialize(displayId);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Registration failed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initializeDisplay();

    return () => {
      socket.disconnect();
      scheduleService.cleanup();
    };
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <ErrorScreen error={error} onRetry={() => window.location.reload()} />;
  }

  if (needsRegistration) {
    return <RegistrationScreen onRegister={handleRegistration} />;
  }

  if (!isAuthenticated) {
    return <ErrorScreen error={new Error('Device not authenticated')} onRetry={() => window.location.reload()} />;
  }

  return (
    <ErrorBoundary>
      <ContentPlayer
        scheduleService={scheduleService}
        contentService={contentService}
        displayStatus={status}
      />
    </ErrorBoundary>
  );
}; 