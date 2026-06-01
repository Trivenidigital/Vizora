import type { Prisma } from '@vizora/database';

const TAG_SELECT = {
  id: true,
  name: true,
  color: true,
  organizationId: true,
  createdAt: true,
} satisfies Prisma.TagSelect;

const DISPLAY_TAG_SELECT = {
  id: true,
  displayId: true,
  tagId: true,
  createdAt: true,
  tag: {
    select: TAG_SELECT,
  },
} satisfies Prisma.DisplayTagSelect;

const DISPLAY_GROUP_SELECT = {
  id: true,
  name: true,
  description: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DisplayGroupSelect;

const DISPLAY_GROUP_MEMBER_SELECT = {
  id: true,
  displayId: true,
  displayGroupId: true,
  createdAt: true,
  displayGroup: {
    select: DISPLAY_GROUP_SELECT,
  },
} satisfies Prisma.DisplayGroupMemberSelect;

const PLAYLIST_SUMMARY_SELECT = {
  id: true,
  name: true,
  description: true,
  loop: true,
  isDefault: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PlaylistSelect;

const ACTIVE_SCHEDULE_SELECT = {
  id: true,
  name: true,
  description: true,
  startDate: true,
  endDate: true,
  startTime: true,
  endTime: true,
  daysOfWeek: true,
  priority: true,
  isActive: true,
  organizationId: true,
  playlistId: true,
  displayId: true,
  displayGroupId: true,
  createdAt: true,
  updatedAt: true,
  playlist: {
    select: PLAYLIST_SUMMARY_SELECT,
  },
} satisfies Prisma.ScheduleSelect;

export const DISPLAY_EMBEDDED_SELECT = {
  id: true,
  organizationId: true,
  deviceIdentifier: true,
  nickname: true,
  description: true,
  location: true,
  status: true,
  orientation: true,
  resolution: true,
  timezone: true,
  lastHeartbeat: true,
  isDisabled: true,
  currentPlaylistId: true,
  createdAt: true,
  updatedAt: true,
  pairedAt: true,
  unpairedAt: true,
} satisfies Prisma.DisplaySelect;

export const DISPLAY_LIST_SELECT = {
  ...DISPLAY_EMBEDDED_SELECT,
  tags: {
    select: DISPLAY_TAG_SELECT,
  },
} satisfies Prisma.DisplaySelect;

export const DISPLAY_DETAIL_SELECT = {
  ...DISPLAY_LIST_SELECT,
  metadata: true,
  lastScreenshot: true,
  lastScreenshotAt: true,
  groups: {
    select: DISPLAY_GROUP_MEMBER_SELECT,
  },
  schedules: {
    where: { isActive: true },
    select: ACTIVE_SCHEDULE_SELECT,
  },
} satisfies Prisma.DisplaySelect;

export const DISPLAY_GROUP_MEMBER_WITH_DISPLAY_SELECT = {
  id: true,
  displayId: true,
  displayGroupId: true,
  createdAt: true,
  display: {
    select: DISPLAY_EMBEDDED_SELECT,
  },
} satisfies Prisma.DisplayGroupMemberSelect;
