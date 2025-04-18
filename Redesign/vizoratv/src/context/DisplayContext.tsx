import React, { createContext, useContext, ReactNode, useEffect, useReducer, useMemo, useCallback, useRef, useState } from 'react';
import {
  initializeConnectionManager,
  getConnectionManager,
  // ConnectionManager, // Unused if only using singleton getter
  DeviceManager,
  TokenManager,
  PairingStateManager,
  PairingState,
  PairingEvent,
  PairingManagerState,
  // PairingErrorCode, // Unused
  PairingError,
  RegistrationState,
  ConnectionState,
  ConnectionDiagnostics,
  DiagnosticConnectionState,
  ConnectionConfig,
  // PairingStateManagerOptions // Unused
} from '@vizora/common';
import { logger } from '@/utils/logger'; // Assuming logger is moved to utils

// <<< REMOVE DUMMY EXPORT >>>
// export const testExport = 'This is a test';

// <<< ADD Mapping function >>>
function mapDiagnosticToConnectionState(diagState: DiagnosticConnectionState): ConnectionState {
  switch (diagState) {
    case 'connected': 
      return ConnectionState.CONNECTED;
    case 'connecting': 
      return ConnectionState.CONNECTING;
    case 'disconnected': 
      return ConnectionState.DISCONNECTED;
    case 'fatal': 
      return ConnectionState.ERROR;
    default:
      logger.warn(`[DisplayContext] Unhandled DiagnosticConnectionState: ${diagState}. Falling back to Disconnected.`);
      return ConnectionState.DISCONNECTED;
  }
}

// --- State & Context Definition ---

export interface DisplayContextType extends PairingManagerState {
  connectionState: ConnectionState;
  connectionDiagnostics: ConnectionDiagnostics | null;
  deviceManager: DeviceManager | null; // Can be null initially
  pairingStateManager: PairingStateManager | null; // Can be null initially
  startPairing: () => Promise<void>;
  resetPairing: () => void;
  retryConnection: () => void;
  isInitialized: boolean; // Add flag
  // Add any other actions components might need
}

// <<< DEFINE initialPairingState directly >>>
const initialPairingState: PairingManagerState = {
  deviceId: null,
  socketId: null,
  registrationState: RegistrationState.UNREGISTERED, // Start as unregistered
  pairingState: PairingState.IDLE,
  pairingCode: null,
  pairingCodeExpiry: null,
  pairingUrl: null,
  retryCount: 0,
  throttledUntil: null,
  error: null,
  deviceRegistrationVerified: false,
  qrCodeUrl: null,
  circuitBreakerTripped: false,
  lastError: null,
  lastServerVerification: 0
};

const initialState: PairingManagerState & { connectionState: ConnectionState; connectionDiagnostics: ConnectionDiagnostics | null } = {
  ...initialPairingState,
  connectionState: ConnectionState.DISCONNECTED, 
  connectionDiagnostics: null,
};

// --- Reducer ---
// Manages the combined state updates from managers
type DisplayAction = 
  | { type: 'PAIRING_STATE_UPDATE', payload: PairingManagerState }
  | { type: 'CONNECTION_STATE_UPDATE', payload: { state: ConnectionState; diagnostics: ConnectionDiagnostics | null } }
  // Remove SET_MANAGERS as refs are used
  // | { type: 'SET_MANAGERS', payload: { deviceManager: DeviceManager, pairingStateManager: PairingStateManager } }
  | { type: 'RESET' };

const displayReducer = (state: typeof initialState, action: DisplayAction): typeof initialState => {
  switch (action.type) {
    case 'PAIRING_STATE_UPDATE':
      logger.debug('[DisplayContext] Reducer: PAIRING_STATE_UPDATE'); 
      return { ...state, ...action.payload };
    case 'CONNECTION_STATE_UPDATE':
      logger.debug('[DisplayContext] Reducer: CONNECTION_STATE_UPDATE', { state: action.payload.state });
      return { ...state, connectionState: action.payload.state, connectionDiagnostics: action.payload.diagnostics };
    case 'RESET':
      logger.info('[DisplayContext] Reducer: RESET');
      // <<< RESET to the defined initialPairingState >>>
      return {
        ...initialState, // Base initial state (sets connectionState to disconnected)
        ...initialPairingState, // Overlay default pairing structure
      };
    default:
      return state;
  }
};

// --- Context Setup ---

const DisplayContext = createContext<DisplayContextType | undefined>(undefined);

// --- Provider Component ---

const DisplayProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(displayReducer, initialState);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const deviceManagerRef = useRef<DeviceManager | null>(null);
  const tokenManagerRef = useRef<TokenManager | null>(null);
  const pairingStateManagerRef = useRef<PairingStateManager | null>(null);

  // Initialize Core Managers
  useEffect(() => {
    logger.info('[DisplayContext] Initializing core managers (Connection Singleton, Token, Device)...');
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3003';
    console.log('[DisplayContext] Reading VITE_API_URL:', import.meta.env.VITE_API_URL);
    logger.info(`[DisplayContext] Using API URL: ${apiUrl}`);
    
    const connectionConfig: ConnectionConfig = { baseUrl: apiUrl, debug: import.meta.env.DEV, autoConnect: false };
    const connectionManager = initializeConnectionManager(connectionConfig);
    
    const tokenManager = new TokenManager();
    const deviceManager = new DeviceManager(connectionManager, tokenManager);
    
    tokenManagerRef.current = tokenManager;
    deviceManagerRef.current = deviceManager;

    // <<< CALL initializeListeners on DeviceManager >>>
    deviceManager.initializeListeners();

    logger.info('[DisplayContext] Core managers initialized & listeners attached.');
    
    connectionManager.connect().catch((err: Error) => logger.error('[DisplayContext] Initial connection failed', err));

    const handleConnectionStateChange = (diagnostics: ConnectionDiagnostics) => {
      const mappedState = mapDiagnosticToConnectionState(diagnostics.connectionState);
      console.log('[DisplayContext] handleConnectionStateChange FIRED. Dispatching mapped state:', mappedState);
      logger.debug(`[DisplayContext] handleConnectionStateChange - Diagnostics:`, diagnostics);
      dispatch({ type: 'CONNECTION_STATE_UPDATE', payload: { state: mappedState, diagnostics } }); 
    };
    connectionManager.on('connectionStateChange', handleConnectionStateChange);
    const handleError = (err: Error) => logger.error('[DisplayContext] Connection Error Listener:', err);
    connectionManager.on('error', handleError);

    // <<< SET Initialized state >>>
    setIsInitialized(true);
    logger.info('[DisplayContext] Initialization complete. Provider is ready.');

    return () => {
      logger.info('[DisplayContext] Cleaning up core manager listeners...');
      const currentManager = getConnectionManager();
      currentManager.off('connectionStateChange', handleConnectionStateChange);
      currentManager.off('error', handleError); 
    }
  }, []); 

  // Initialize Pairing State Manager
  useEffect(() => {
    // <<< ADD BACK isInitialized check >>>
    if (!isInitialized) {
        logger.debug('[DisplayContext-PSM] Waiting for core initialization...');
        return; 
    }
    const deviceManager = deviceManagerRef.current;
    const connectionManager = getConnectionManager();
    
    if (!deviceManager) { 
      logger.warn('[DisplayContext-PSM] DeviceManager still not available after initialization.');
      return;
    }
    
    const deviceId = deviceManager.getDeviceInfo()?.deviceId || null; 
    logger.info(`[DisplayContext-PSM] Retrieved deviceId from DeviceManager: ${deviceId}`);

    if (!deviceId) {
       logger.warn('[DisplayContext-PSM] deviceId still null, cannot init PairingStateManager yet.');
       return; 
    }

    if (pairingStateManagerRef.current) {
        logger.debug('[DisplayContext-PSM] PairingStateManager already initialized.');
        return; 
    }

    logger.info(`[DisplayContext-PSM] Initializing PairingStateManager with deviceId: ${deviceId}`);
    const pairingManager = new PairingStateManager(
        deviceId, 
        connectionManager, 
        deviceManager, 
        { debug: import.meta.env.DEV }
    );
    pairingStateManagerRef.current = pairingManager;
    
    // <<< CALL initializeListeners >>>
    pairingManager.initializeListeners(); 
    
    const initialPsmState = pairingManager.getState();
    dispatch({ type: 'PAIRING_STATE_UPDATE', payload: initialPsmState });

    const handlePairingStateChange = (newState: PairingManagerState) => {
        dispatch({ type: 'PAIRING_STATE_UPDATE', payload: newState });
    };
    pairingManager.on(PairingEvent.STATE_CHANGE, handlePairingStateChange);

    pairingManager.on(PairingEvent.PAIRING_CODE_GENERATED, (code: string) => logger.info(`🔑 Pairing Code Received: ${code}`));
    pairingManager.on(PairingEvent.PAIRING_ERROR, (err: PairingError) => logger.error('Pairing Error object:', err)); 

    return () => {
        logger.info('[DisplayContext-PSM] Cleaning up PairingStateManager listener...');
        const currentPairingManager = pairingStateManagerRef.current;
        if (currentPairingManager) {
            // Listeners are removed inside cleanup now
            // currentPairingManager.off(PairingEvent.STATE_CHANGE, handlePairingStateChange);
            // currentPairingManager.off(PairingEvent.PAIRING_CODE_GENERATED);
            // currentPairingManager.off(PairingEvent.PAIRING_ERROR);
            
            // <<< FIX: Call the public cleanup method >>>
            currentPairingManager.cleanup();
        }
        pairingStateManagerRef.current = null; 
    };
  }, [isInitialized, state.deviceId]); 

  // --- Actions ---
  // Actions now need to access managers via refs or singleton getter
  const startPairing = useCallback(async () => {
    const psm = pairingStateManagerRef.current;
    if (!psm) {
        logger.error('[DisplayContext] Action: startPairing called before PairingStateManager initialized!');
        return;
    }
    logger.info('[DisplayContext] Action: startPairing initiated');
    try {
      // Now public, should be fine
      psm.clearError(); 
      await psm.generatePairingCode(); 
      logger.info('[DisplayContext] Pairing code generation initiated successfully');
    } catch (error) {
      logger.error('[DisplayContext] Failed to initiate pairing code generation', error);
    }
  }, []); 

  const resetPairing = useCallback(() => {
     const psm = pairingStateManagerRef.current;
     if (!psm) {
        logger.error('[DisplayContext] Action: resetPairing called before PairingStateManager initialized!');
        return;
    }
    logger.info('[DisplayContext] Action: resetPairing');
    // <<< FIX: Call the public reset method >>>
    psm.reset();
    // Dispatching RESET action in reducer might be redundant now, 
    // if psm.reset() emits the necessary STATE_CHANGE event.
    // Keep it for now for safety, but consider removing if reset() handles state updates.
    dispatch({ type: 'RESET' }); 
  }, []);

  const retryConnection = useCallback(() => {
    // Use Singleton Getter
    const cm = getConnectionManager();
    logger.info('[DisplayContext] Action: retryConnection');
    cm.connect(); 
  }, []);

  // --- Context Value ---
  const contextValue = useMemo(() => {
    return {
        ...state,
        deviceManager: deviceManagerRef.current, 
        pairingStateManager: pairingStateManagerRef.current,
        startPairing,
        resetPairing,
        retryConnection,
        connectionState: state.connectionState, 
        connectionDiagnostics: state.connectionDiagnostics,
        isInitialized, // Expose initialization status
    };
  }, [state, startPairing, resetPairing, retryConnection, isInitialized]); 

  // --- Render ---
  return (
    <DisplayContext.Provider value={contextValue}>
      {isInitialized ? (
        children // Render children only when initialized
      ) : (
        // Render placeholder while initializing
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 md:p-8 bg-gradient-to-br from-zinc-900 via-black to-zinc-900 text-white relative overflow-hidden">
           <p className="text-white">Initializing Context...</p>
        </div>
      )}
    </DisplayContext.Provider>
  );
};

// --- Hook ---

export const useDisplay = (): DisplayContextType => {
  const context = useContext(DisplayContext);
  if (context === undefined) {
    throw new Error('useDisplay must be used within a DisplayProvider');
  }
  return context;
};

// Export provider as default
export default DisplayProvider; 