import { Content, ContentWithSchedule } from './content';
import { ScheduleEntry } from './schedule';

export type DisplayStatusType = 'online' | 'offline' | 'warning' | 'maintenance' | 'error' | 'pending';

export interface DisplayMetadata {
  id: string;
  name: string;
  location?: string;
  resolution?: {
    width: number;
    height: number;
  };
  model?: string;
  os?: string;
  status: DisplayStatusType;
}

export interface DisplayRegistration {
  pairingCode: string;
  metadata: DisplayMetadata;
}

export interface DisplayToken {
  token: string;
  expiresAt: Date | string;
  displayId: string;
}

export interface DisplayStatus {
  displayId: string;
  status: DisplayStatusType;
  lastSeen: Date | string;
  errors?: string[];
  contentStatus?: {
    currentContentId?: string;
    nextContentId?: string;
    isPlaying: boolean;
    lastSync: Date | string;
  };
}

export interface ScheduledContent {
  startTime: Date | string;
  endTime: Date | string;
  contentId: string;
  priority: number;
  content: Content;
}

export interface Display {
  id: string;
  name: string;
  deviceId: string;
  location: string;
  status: DisplayStatusType;
  lastPing?: string;
  ipAddress?: string;
  model?: string;
  scheduledContent?: ScheduleEntry[];
  contentIds?: string[];
  _id?: string; // MongoDB ID for backward compatibility
}

export interface DisplayWithScheduleInfo extends Display {
  activeSchedule?: ScheduleEntry;
  nextScheduledContent?: {
    title: string;
    startTime: string;
  } | null;
}

export interface DisplayContentItem extends Omit<ContentWithSchedule, 'type'> {
  id: string;
  contentId: string;
  title: string;
  url: string;
  type: string;
  duration: number;
  displaySettings: {
    autoplay: boolean;
    loop: boolean;
    mute: boolean;
    fit: string;
  };
}

export interface DisplayContent {
  success: boolean;
  displayId: string;
  timestamp: string;
  count: number;
  content: DisplayContentItem[];
}

export interface DisplayState {
  id: string;
  deviceId: string;
  currentContent: ContentWithSchedule | null;
  nextContent: ContentWithSchedule | null;
  queue: ContentWithSchedule[];
  connected: boolean;
  online: boolean;
  lastUpdated: string;
  error?: string;
  usingPolling?: boolean;
} 