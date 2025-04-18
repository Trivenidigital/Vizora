import { Schedule, ScheduleInfo, ScheduleEntry } from './schedule';

export interface ContentItem {
  id: string;
  name?: string;
  title?: string;
  type: ContentType;
  url: string;
  duration: number; // in seconds
  metadata?: ContentMetadata;
  createdAt: Date | string;
  updatedAt?: Date | string;
  _id?: string; // MongoDB ID for backward compatibility
}

export type ContentType = 'image' | 'video' | 'webpage' | 'text' | 'html' | 'stream' | 'widget';

export interface ContentMetadata {
  width?: number;
  height?: number;
  format?: string;
  size?: number;
  checksum?: string;
  dimensions?: {
    width: number;
    height: number;
  };
  duration?: number;
  thumbnailUrl?: string;
  tags?: string[];
  folder?: string;
}

export interface ContentSchedule {
  id: string;
  name: string;
  displayId: string;
  items: Array<ScheduleEntry>;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export interface ContentPlaybackStatus {
  contentId: string;
  displayId: string;
  status: 'playing' | 'paused' | 'completed' | 'error';
  currentTime: number;
  errors?: string[];
  lastUpdated: Date | string;
}

export interface Content {
  id: string;
  title: string;
  type: ContentType;
  url: string;
  duration?: number; // in seconds
  settings?: ContentDisplaySettings;
  metadata?: ContentMetadata;
  tags?: string[];
  folder?: string;
  userId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ContentWithSchedule extends Content {
  scheduled?: boolean;
  scheduledInfo?: ScheduleInfo;
}

export interface ContentDisplaySettings {
  autoplay?: boolean;
  loop?: boolean;
  mute?: boolean;
  fit?: 'contain' | 'cover' | 'fill' | 'none';
  position?: string;
  sound?: { enabled?: boolean };
}

export interface ContentPushOptions {
  contentId: string;
  displayId: string;
  schedulePayload?: {
    startTime?: string;
    endTime?: string;
    repeat?: string;
    priority?: number;
  };
}

export interface ContentAssignment {
  contentId: string;
  displayId: string;
  schedule?: Schedule;
  added: string;
}

export interface FolderContent {
  id: string;
  name: string;
  parentId?: string;
  type: 'folder';
  children?: (FolderContent | Content)[];
  createdAt: string;
  updatedAt?: string;
}

export interface ContentTree {
  folders: FolderContent[];
  rootContent: Content[];
} 