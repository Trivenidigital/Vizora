import { z } from 'zod';

// Display types
export const DisplayType = z.enum(['digital-signage', 'kiosk', 'tv']);
export type DisplayType = z.infer<typeof DisplayType>;

export const DisplayOrientation = z.enum(['landscape', 'portrait']);
export type DisplayOrientation = z.infer<typeof DisplayOrientation>;

export const DisplayStatusEnum = z.enum(['active', 'inactive', 'disconnected', 'maintenance']);
export type DisplayStatusEnum = z.infer<typeof DisplayStatusEnum>;

export const DisplayResolution = z.enum(['1920x1080', '3840x2160', '1280x720']);
export type DisplayResolution = z.infer<typeof DisplayResolution>;

export const DisplaySchema = z.object({
  _id: z.string(),
  name: z.string().min(1),
  location: z.string().min(1),
  qrCode: z.string(),
  status: DisplayStatusEnum,
  lastConnected: z.string().datetime(),
  type: DisplayType,
  resolution: DisplayResolution,
  orientation: DisplayOrientation,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type DisplayZod = z.infer<typeof DisplaySchema>;

export const DisplayRegistrationSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  type: DisplayType,
  resolution: DisplayResolution,
  orientation: DisplayOrientation,
});

export type DisplayRegistrationZod = z.infer<typeof DisplayRegistrationSchema>;

export const DisplayConfigSchema = z.object({
  resolution: DisplayResolution,
  orientation: DisplayOrientation,
  refreshRate: z.number().min(30).max(120),
  brightness: z.number().min(0).max(100),
});

export type DisplayConfigZod = z.infer<typeof DisplayConfigSchema>;

// Content types
export const ContentTypeEnum = z.enum(['image', 'video', 'html', 'text']);
export type ContentTypeEnum = z.infer<typeof ContentTypeEnum>;

export const ContentStatus = z.enum(['draft', 'published', 'archived']);
export type ContentStatus = z.infer<typeof ContentStatus>;

export const ContentFormat = z.enum(['jpg', 'png', 'mp4', 'webm', 'html']);
export type ContentFormat = z.infer<typeof ContentFormat>;

export const ContentSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  type: ContentTypeEnum,
  url: z.string().url(),
  thumbnail: z.string().url().optional(),
  status: ContentStatus,
  format: ContentFormat,
  metadata: z.object({
    width: z.number().optional(),
    height: z.number().optional(),
    duration: z.number().optional(),
    size: z.number().optional(),
    mimeType: z.string().optional(),
  }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  userId: z.string(),
});

export type ContentZod = z.infer<typeof ContentSchema>;

export const ContentCreateSchema = z.object({
  title: z.string().min(1),
  type: ContentTypeEnum,
  url: z.string().url(),
  thumbnail: z.string().url().optional(),
  format: ContentFormat,
  metadata: z.object({
    width: z.number().optional(),
    height: z.number().optional(),
    duration: z.number().optional(),
    size: z.number().optional(),
    mimeType: z.string().optional(),
  }).optional(),
});

export type ContentCreate = z.infer<typeof ContentCreateSchema>;

export const ContentUpdateSchema = ContentCreateSchema.partial();

export type ContentUpdate = z.infer<typeof ContentUpdateSchema>;

// Schedule types
export const DayOfWeek = z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
export type DayOfWeek = z.infer<typeof DayOfWeek>;

export const RepeatPattern = z.enum(['daily', 'weekly', 'monthly', 'once']);
export type RepeatPattern = z.infer<typeof RepeatPattern>;

export const ScheduleSchema = z.object({
  _id: z.string(),
  name: z.string().min(1),
  contentId: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  daysOfWeek: z.array(DayOfWeek),
  repeat: RepeatPattern,
  priority: z.number().min(1).max(10),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ScheduleZod = z.infer<typeof ScheduleSchema>;

export const ScheduleCreateSchema = z.object({
  name: z.string().min(1),
  contentId: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  daysOfWeek: z.array(DayOfWeek),
  repeat: RepeatPattern,
  priority: z.number().min(1).max(10),
});

export type ScheduleCreate = z.infer<typeof ScheduleCreateSchema>;

export const ScheduleUpdateSchema = ScheduleCreateSchema.partial();

export type ScheduleUpdate = z.infer<typeof ScheduleUpdateSchema>;

export const TimeRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

export type TimeRangeZod = z.infer<typeof TimeRangeSchema>;

// Re-export types from other files
// Using explicit re-exports to avoid conflicts
export * from './schedule';
export * from './content';

// Export from display with renames to avoid conflicts
export type {
  DisplayStatusType,
  DisplayMetadata,
  DisplayRegistration,
  DisplayToken,
  DisplayStatus,
  Display,
  DisplayWithScheduleInfo,
  DisplayContentItem,
  DisplayContent,
  DisplayState
} from './display';

// Other type exports can stay below
// ... existing code ... 