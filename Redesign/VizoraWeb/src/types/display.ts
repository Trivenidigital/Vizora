import { z } from 'zod';

// Resolution options
export const RESOLUTION_OPTIONS = [
  { value: '1920x1080', label: '1920x1080 (Full HD)' },
  { value: '3840x2160', label: '3840x2160 (4K)' },
  { value: '2560x1440', label: '2560x1440 (2K)' },
  { value: '1366x768', label: '1366x768 (HD)' }
] as const;

// Playback modes
export const PLAYBACK_MODES = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'manual', label: 'Manual' },
  { value: 'loop', label: 'Loop' }
] as const;

// Display settings schema
export const DisplaySettingsSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
  location: z.object({
    name: z.string().min(1, 'Location name is required'),
    address: z.string().optional(),
    floor: z.string().optional(),
    room: z.string().optional(),
    notes: z.string().optional()
  }),
  resolution: z.enum([RESOLUTION_OPTIONS[number]['value']]),
  playbackMode: z.enum([PLAYBACK_MODES[number]['value']]),
  groupId: z.string().optional(),
  settings: z.object({
    brightness: z.number().min(0).max(100),
    volume: z.number().min(0).max(100),
    autoPlay: z.boolean(),
    contentFit: z.enum(['contain', 'cover', 'fill', 'none']),
    rotation: z.number().min(0).max(270).step(90)
  })
});

export type DisplaySettings = z.infer<typeof DisplaySettingsSchema>;

// Display group schema
export const DisplayGroupSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Group name is required'),
  description: z.string().optional(),
  displayIds: z.array(z.string())
});

export type DisplayGroup = z.infer<typeof DisplayGroupSchema>;

// Display health status
export interface DisplayHealth {
  status: 'healthy' | 'warning' | 'error';
  metrics: {
    cpu: number;
    memory: number;
    storage: number;
    temperature: number;
    uptime: number;
  };
  lastUpdated: string;
  issues: Array<{
    type: 'error' | 'warning';
    message: string;
    timestamp: string;
  }>;
} 