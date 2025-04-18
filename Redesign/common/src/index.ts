// Types
export type { DisplayMetadata, DisplayRegistration, DisplayToken, DisplayStatus, ScheduledContent } from './types/display';
export type { ContentPlaybackStatus, ContentWithSchedule } from './types/content';
export type { 
  Schedule, 
  RepeatMode, 
  TimeRange, 
  ScheduleEntry, 
  ScheduleInfo, 
  ScheduleValidationResult,
  DaysOfWeek,
  MonthlyRepeatOptions,
  ScheduleRepeatMetadata
} from './types/schedule';

// Sockets
export * from './sockets/client';

// Utils
export * from './utils/scheduler';
export * from './utils/index';
export * from './utils/jwt';
export * from './utils/socketUtils';  // Export getSocketId from socketUtils
export * from './utils/offlineQueue';

// AI Tools
export * from './aiTools/index';
export { aiTools } from './aiTools/index';

// Connection management factory
export { 
  getConnectionManager as getConnectionManager_Factory,
  createConnectionManager,
  resetConnectionManager,
  setConnectionManager
} from './services/ConnectionManagerFactory';

// <<< ADD EXPORTS for new ConnectionManager singleton functions >>>
export { 
  initializeConnectionManager, 
  getConnectionManager
} from './services/ConnectionManager';

// Connection health monitoring
export {
  ConnectionHealthMonitor,
  getConnectionHealthMonitor,
  type ConnectionHealthMetrics,
  type ConnectionHealthConfig
} from './services/ConnectionHealthMonitor';

// Connection diagnostics
export {
  ConnectionDiagnosticEventType,
  connectionDiagnostics$,
  connectionDiagnosticsHistory$,
  emitDiagnosticEvent,
  clearDiagnosticHistory
} from './devtools/ConnectionStateObservable';

// Connection diagnostics hooks
export {
  useConnectionDiagnostics,
  useConnectionDiagnosticsHistory
} from './hooks/useConnectionDiagnostics';

// Diagnostics dump utilities
export {
  dumpConnectionState,
  captureConnectionDiagnostics,
  copyDiagnosticsToClipboard,
  initializeDiagnosticDump,
  type ConnectionDumpData
} from './devtools/DiagnosticsDump';

// Development tools and components
export { ConnectionDebugger } from './devtools/ConnectionDebugger';
export { ConnectionDebugOverlay } from './components/ConnectionDebugOverlay';

// Get the current socket ID - standalone helper function
import { ConnectionManager } from './services/ConnectionManager';
// Use the factory import instead of the hook
import { getConnectionManager } from './services/ConnectionManagerFactory';

// Standalone helper to get socket ID
export function getSocketId(): string | undefined {
  const connectionManager = getConnectionManager();
  return connectionManager?.getSocketId() || undefined;
}

// Schedule utilities
export {
  isScheduleActive,
  isDailyScheduleActive,
  isWeeklyScheduleActive,
  isMonthlyScheduleActive,
  getActiveSchedules,
  getHighestPrioritySchedule,
  getNextSchedule,
  processScheduledContent,
  formatTimeRange,
  parseTimeRange,
  doSchedulesOverlap,
  formatScheduleTime,
  validateSchedule,
  cleanupSchedules,
  findOverlappingSchedules
} from './utils/scheduleUtils';

// Schedule export utilities
export {
  validateSchedules,
  exportSchedules,
  filterSchedulesByArchiveStatus
} from './utils/scheduleExport';

// Auth
export * from './auth/device';

// Export types (General)
export * from './types';

// Hooks - use the factory implementation now 
export { 
  useConnectionStatus, 
  // <<< REMOVE ConnectionState export from here >>>
  // ConnectionState 
} from './hooks/useConnectionStatus';

// <<< ADD EXPORT for the new hook >>>
export { 
  useConnectionState, 
  useConnectionStatusDebug 
} from './hooks/useConnectionState';

// Explicitly export ConnectionManager values (Class, Enum)
export { 
  ConnectionManager, 
  // <<< ENSURE ConnectionState is exported here (and only here) >>>
  ConnectionState // Remove alias if not needed: as ConnectionManagerState 
} from './services/ConnectionManager';

// Export ConnectionManager types/interfaces
export type { 
  ConnectionConfig, 
  ConnectionDiagnostics, 
  DiagnosticConnectionState,
  TransportType,
  SocketAdapterType,
  ConnectionStateChangeListener,
  LogEntry,             
  ConnectionHistoryEntry 
} from './services/ConnectionManager';

// Export other services
export * from './services/TokenManager';
// Add the default export for the singleton instance
export { default as tokenManager } from './services/TokenManager';
export * from './services/DeviceManager';
export { LocalStorageStateService } from './services/LocalStorageStateService';
export { ErrorReportingService } from './services/ErrorReportingService';
export { 
  PairingStateManager, 
  PairingState, 
  RegistrationState, 
  PairingEvent, 
  PairingErrorCode 
} from './services/PairingStateManager';
// Also export relevant types from PairingStateManager
export type {
  PairingError,
  PairingManagerState,
  PairingStateManagerOptions
} from './services/PairingStateManager';

// Content Service exports
export {
  uploadContentFile,
  uploadMultipleFiles,
  contentService
} from './services/contentService';

// Remove the old wildcard exports that are now handled explicitly above
// export * from './services/DeviceManager';
// export * from './services/TokenManager';