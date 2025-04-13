export interface Content {
  id: string;
  type: string;
  url: string;
  duration: number;
  title?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  settings?: {
    fit?: 'contain' | 'cover' | 'fill';
    position?: string;
    loop?: boolean;
    sound?: {
      enabled?: boolean;
      volume?: number;
    };
    autoplay?: boolean;
  };
}

export interface ScheduleItem {
  id: string;
  contentId: string;
  startTime: string;
  endTime: string;
  priority: number;
}

export interface Schedule {
  id: string;
  items: ScheduleItem[];
}

export interface DisplayStatus {
  id: string;
  status: 'online' | 'offline' | 'error';
  lastSeen: string;
  error?: string;
}

export interface DisplaySettings {
  id: string;
  name: string;
  brightness: number;
  volume: number;
  autoPlay: boolean;
  offlineMode: boolean;
  retryInterval: number;
  maxRetries: number;
  transitionEffect?: 'none' | 'fade' | 'crossfade';
  transitionDuration?: number;
}

export interface PlaybackOptions {
  autoAdvance?: boolean;
  loop?: boolean;
  shuffle?: boolean;
  transition?: {
    effect: 'none' | 'fade' | 'crossfade';
    duration: number;
  };
}

export interface CacheOptions {
  enabled: boolean;
  maxSize?: number;
  maxAge?: number;
  autoCleanup?: boolean;
} 