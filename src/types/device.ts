export interface Device {
  id?: string;
  name?: string;
  ip: string;
  mac?: string;
  type?: string;
  status?: 'online' | 'offline' | 'pending';
  lastSeen?: string;
  location?: string;
}
