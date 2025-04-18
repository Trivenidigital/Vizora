import React, { ReactNode } from 'react';
import { DeviceManager, PairingStateManager, PairingManagerState, ConnectionState, ConnectionDiagnostics } from '@vizora/common';
export interface DisplayContextType extends PairingManagerState {
    connectionState: ConnectionState;
    connectionDiagnostics: ConnectionDiagnostics | null;
    deviceManager: DeviceManager | null;
    pairingStateManager: PairingStateManager | null;
    startPairing: () => Promise<void>;
    resetPairing: () => void;
    retryConnection: () => void;
    isInitialized: boolean;
}
declare const DisplayProvider: React.FC<{
    children: ReactNode;
}>;
export declare const useDisplay: () => DisplayContextType;
export default DisplayProvider;
