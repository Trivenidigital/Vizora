// Export all custom hooks for easy importing

// Core hooks
export { useAuth } from './useAuth';
export { useSocket } from './useSocket';
export { useToast } from './useToast';
export { useTheme } from './useTheme';
export { useDebounce } from './useDebounce';

// Analytics and data hooks
export { useAnalyticsData } from './useAnalyticsData';
export { useChartData } from './useChartData';

// Real-time and state management hooks (Phase 8 - Socket.io integration)
export { useRealtimeEvents } from './useRealtimeEvents';
export type {
  DeviceStatusUpdate,
  PlaylistUpdate,
  HealthAlert,
  ScheduleExecution,
  UseRealtimeEventsOptions,
} from './useRealtimeEvents';

export { useOptimisticState } from './useOptimisticState';
export type { OptimisticUpdate, UseOptimisticStateOptions } from './useOptimisticState';

export { useErrorRecovery } from './useErrorRecovery';
export type {
  ErrorSeverity,
  RetryConfig,
  CircuitBreakerConfig,
  ErrorInfo,
  UseErrorRecoveryOptions,
} from './useErrorRecovery';
