export interface DisplayConfig {
  id: string;
  displayName: string;
  resolution: string;
  orientation: 'landscape' | 'portrait';
  refreshRate: number;
  brightness: number;
  volume: number;
  autostart: boolean;
  logLevel: 'info' | 'warn' | 'error' | 'debug';
  cacheLimit: number; // in MB
  offlineMode: 'disabled' | 'basic' | 'advanced';
} 