import React, { useEffect, useState } from 'react';
import { DisplayStatus } from '@vizora/common/types';
import { VizoraSocketClient, TokenManager, DeviceManager, DeviceInfo } from '@vizora/common';
import { getConnectionManager } from '@vizora/common';
import { DisplayService } from './services/displayService';
import { ContentService } from './services/contentService';
import { ScheduleService } from './services/scheduleService';
import { DeviceAuthService } from './services/deviceAuthService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingScreen } from './components/LoadingScreen';
// import { ErrorScreen } from './components/ErrorScreen'; // <<< Commented out
import ContentPlayer from './components/ContentPlayer';
import { RegistrationScreen } from './components/RegistrationScreen';
import { SocketDebug } from './components/dev';

// TODO: Phase 4 - Implement more sophisticated error handling and recovery strategies:
// 1. Add automatic reconnection with exponential backoff
// 2. Implement crash analytics and remote logging
// 3. Develop fallback content for disconnected states
// 4. Add self-healing mechanisms for common failure scenarios

export const DisplayApp: React.FC = () => {
  const [status, setStatus] = useState<DisplayStatus | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsRegistration, setNeedsRegistration] = useState(false);

  const socket = new VizoraSocketClient();
  const tokenManager = new TokenManager({ storageKey: 'display_token' });
  const connectionManager = getConnectionManager();
  if (!connectionManager) {
    console.error("ConnectionManager not initialized!");
    return <LoadingScreen message="Initializing Connection..." />;
  }
  const deviceManager = new DeviceManager(connectionManager, tokenManager);
  const deviceAuthService = new DeviceAuthService(socket, deviceManager, tokenManager);
  const displayService = new DisplayService(socket);
  const contentService = new ContentService();
  const scheduleService = new ScheduleService(contentService);

  const getDisplayMetadata = (): Partial<DeviceInfo> => {
    return {
       name: 'Vizora Display', 
       location: 'Default Location',
       resolution: `${window.screen.width}x${window.screen.height}`, 
       model: 'Web Browser',
       os: navigator.platform,
       deviceType: 'display',
       userAgent: navigator.userAgent,
       platform: navigator.platform
    };
  };

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
      const deviceInfoPayload = getDisplayMetadata();
      await deviceAuthService.registerWithPairingCode(pairingCode, deviceInfoPayload);
      
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

  const handleContentComplete = () => {
    console.log('Content playback completed/ended.');
    scheduleService.advanceToNextContent();
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
    return <div>Error: {error.message}</div>;
  }

  if (needsRegistration) {
    return <RegistrationScreen onRegister={handleRegistration} />;
  }

  if (!isAuthenticated) {
    return <div>Error: Device not authenticated</div>;
  }

  return (
    <ErrorBoundary>
      <ContentPlayer
        scheduleService={scheduleService}
        contentService={contentService}
        displayStatus={status}
        contentItem={scheduleService.getCurrentContent()}
        onComplete={handleContentComplete}
      />
    </ErrorBoundary>
  );
}; 