export interface ContentItem {
  id: string;
  name: string;
  type: 'image' | 'video' | 'webpage' | 'text';
  url: string;
  duration: number; // in seconds
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
    size?: number;
    checksum?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentSchedule {
  id: string;
  name: string;
  displayId: string;
  items: Array<{
    contentId: string;
    startTime: Date;
    endTime: Date;
    priority: number;
  }>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentPlaybackStatus {
  contentId: string;
  displayId: string;
  status: 'playing' | 'paused' | 'completed' | 'error';
  currentTime: number;
  errors?: string[];
  lastUpdated: Date;
}

/**
 * Display content item 
 * Used for delivering content to displays
 */
export interface DisplayContent {
  id: string;
  contentType: 'image' | 'video' | 'webpage' | 'text';
  url: string;
  duration: number;
  title?: string;
  description?: string;
  displaySettings?: {
    autoplay?: boolean;
    loop?: boolean;
    mute?: boolean;
    fit?: 'contain' | 'cover' | 'fill';
  };
}

/**
 * Content update event payload
 * Sent when content is updated for a display
 */
export interface ContentUpdateEvent {
  displayId: string;
  updateType: 'schedule' | 'direct' | 'emergency';
  timestamp: string;
} 