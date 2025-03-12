export interface Device {
  id: string;
  name: string;
  ip: string;
  type: string;
  status: 'online' | 'offline';
  lastSeen: string;
  resolution?: string;
  currentContent?: string;
  groups?: string[];
}
