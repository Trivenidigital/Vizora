import { Content } from './content';

export interface DisplayStatus {
  deviceId: string;
  status: 'online' | 'offline' | 'maintenance' | 'error';
  online: boolean;
  lastSeen: string;
  currentContent?: {
    id: string;
    name: string;
    type: string;
    startedAt: string;
  };
  diagnostic?: {
    errors?: string[];
    warnings?: string[];
  };
}

export interface DisplayMetrics {
  deviceId: string;
  cpu: {
    usage: number;
    temperature?: number;
  };
  memory: {
    total: number;
    used: number;
    usage: number;
  };
  storage: {
    total: number;
    used: number;
    usage: number;
  };
  network: {
    type: string;
    strength: number;
    speed?: number;
  };
  uptime: number;
  lastUpdated: string;
}

export interface Display {
  id: string;
  name: string;
  description?: string;
  location?: string;
  status: 'online' | 'offline' | 'maintenance';
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
}

export interface ContentSchedule {
  id: string;
  contentId: string;
  displayId: string;
  startTime: string;
  endTime: string;
  timezone: string;
  repeat?: 'daily' | 'weekly' | 'monthly' | 'none';
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  owner: string;
}

export interface ContentPush {
  id: string;
  contentId: string;
  displayId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  owner: string;
}

export interface DisplayContent {
  display: Display;
  content: Content;
  schedule?: ContentSchedule;
  push?: ContentPush;
} 