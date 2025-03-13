export interface Device {
  ip: string;
  port: number;
  type: string;
  name: string;
  manufacturer?: string;
  model?: string;
  lastSeen: string;
}
