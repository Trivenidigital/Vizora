// Type definitions for Vizora

export type DisplayOrientation = 'landscape' | 'portrait' | 'landscape_flipped' | 'portrait_flipped';

export interface Display {
  id: string;
  nickname: string;
  deviceId: string;
  location?: string;
  status: 'online' | 'offline';
  lastSeen?: Date | string;
  currentPlaylistId?: string;
  orientation?: DisplayOrientation;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Content {
  id: string;
  title: string;
  type: 'image' | 'video' | 'pdf' | 'url';
  url?: string;
  thumbnailUrl?: string;
  status: 'ready' | 'processing' | 'error';
  duration?: number;
  metadata?: Record<string, any>;
  folderId?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PlaylistItem {
  id: string;
  contentId: string;
  content?: Content;
  duration?: number;
  order: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  items: PlaylistItem[];
  totalDuration?: number;
  totalSize?: number;
  itemCount?: number;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Schedule {
  id: string;
  name: string;
  description?: string;
  playlistId: string;
  playlist?: Playlist;
  displayId?: string;
  displayIds: string[];
  displayGroupId?: string;
  displays?: Display[];
  startTime: string;
  endTime: string;
  startDate?: string;
  endDate?: string;
  daysOfWeek: number[];
  timezone?: string;
  isActive: boolean;
  priority?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DisplayGroup {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  displays?: Array<{
    id: string;
    displayId: string;
    display?: Display;
  }>;
  _count?: {
    displays: number;
  };
}

export interface ContentFolder {
  id: string;
  name: string;
  parentId: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  children?: ContentFolder[];
  contentCount?: number;
}

export interface AppNotification {
  id: string;
  type: 'device_offline' | 'device_online' | 'content_expired' | 'system';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  read: boolean;
  dismissedAt: string | null;
  metadata?: Record<string, unknown>;
  organizationId: string;
  userId?: string;
  createdAt: string;
}

export interface ScreenshotResponse {
  url: string;
  capturedAt: string;
  width?: number;
  height?: number;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyResponse {
  key: string; // Plain key, only shown once
  apiKey: ApiKey;
}

// Billing types
export interface SubscriptionStatus {
  subscriptionTier: string;
  subscriptionStatus: string;
  screenQuota: number;
  screensUsed: number;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  paymentProvider: string | null;
}

export interface Plan {
  id: string;
  name: string;
  screenQuota: number;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  isCurrent: boolean;
}

export interface QuotaUsage {
  screenQuota: number;
  screensUsed: number;
  remaining: number;
  percentUsed: number;
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  createdAt: string;
  pdfUrl: string | null;
}

export interface CheckoutResponse {
  url: string;
  sessionId: string;
}

export interface BillingPortalResponse {
  url: string;
}

// Admin types
export interface AdminPlan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  screenQuota: number;
  storageQuotaMb: number;
  apiRateLimit: number;
  priceUsdMonthly: number;
  priceUsdYearly: number;
  priceInrMonthly: number;
  priceInrYearly: number;
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
  razorpayPlanIdMonthly: string | null;
  razorpayPlanIdYearly: string | null;
  features: string[];
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  highlightText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Promotion {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: 'percentage' | 'fixed_amount' | 'free_months';
  discountValue: number;
  currency: string | null;
  maxRedemptions: number | null;
  maxPerCustomer: number;
  currentRedemptions: number;
  minPurchaseAmount: number | null;
  startsAt: string;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  screenQuota: number;
  country: string | null;
  createdAt: string;
  _count: { users: number; displays: number };
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  organization: { id: string; name: string };
}

export interface PlatformStats {
  totalOrganizations: number;
  totalUsers: number;
  totalScreens: number;
  onlineScreens: number;
  mrr: number;
  arr: number;
}

export interface SystemConfig {
  id: string;
  key: string;
  value: any;
  dataType: string;
  category: string;
  description: string | null;
  isSecret: boolean;
}

export interface AdminAuditLog {
  id: string;
  adminUserId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: any;
  ipAddress: string | null;
  createdAt: string;
}

export interface SystemAnnouncement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical' | 'maintenance';
  isActive: boolean;
  startsAt: string;
  expiresAt: string | null;
}

export interface IpBlocklistEntry {
  id: string;
  ipAddress: string;
  reason: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

// Analytics types
export interface AnalyticsSummary {
  totalDevices: number;
  onlineDevices: number;
  totalContent: number;
  totalPlaylists: number;
  totalImpressions: number;
  avgUptimePercent: number;
}

export interface DeviceMetric {
  date: string;
  onlineCount: number;
  offlineCount: number;
  avgUptime: number;
}

export interface ContentPerformance {
  contentId: string;
  name: string;
  type: string;
  impressions: number;
  avgDuration: number;
}

export interface UsageTrend {
  date: string;
  impressions: number;
  activeDevices: number;
  contentUploads: number;
}

export interface DeviceDistribution {
  status: string;
  count: number;
  percentage: number;
}

export interface BandwidthUsage {
  date: string;
  bytesTransferred: number;
  requestCount: number;
}

export interface PlaylistPerformance {
  playlistId: string;
  name: string;
  impressions: number;
  deviceCount: number;
}

export interface AnalyticsExport {
  data: Record<string, unknown>;
  exportedAt: string;
  format: string;
}

// Team / User types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  userId: string | null;
  user?: { id: string; firstName: string; lastName: string; email: string } | null;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

// Template Library types
export interface TemplateCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  templateCount: number;
}

export interface TemplateSearchResult {
  data: TemplateSummary[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface TemplateSummary {
  id: string;
  name: string;
  description: string | null;
  category: string;
  thumbnail: string | null;
  orientation: string;
  difficulty: string;
  tags: string[];
  isFeatured: boolean;
  useCount?: number;
  previewImageUrl?: string | null;
  templateOrientation?: string | null;
  libraryTags?: string[];
}

export interface TemplateDetail extends TemplateSummary {
  templateHtml: string;
  customCss: string | null;
  variables: Record<string, unknown>[];
  previewUrl: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AIGenerateResponse {
  available: boolean;
  message?: string;
  template?: TemplateSummary;
}

// Widget types
export interface WidgetType {
  type: string;
  name: string;
  description: string;
  configSchema: Record<string, unknown>;
}

export interface Widget {
  id: string;
  name: string;
  widgetType: string;
  widgetConfig: Record<string, unknown>;
  description: string | null;
  lastRefreshedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Layout types
export interface LayoutPreset {
  type: string;
  name: string;
  description: string;
  zones: LayoutZone[];
}

export interface LayoutZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface Layout {
  id: string;
  name: string;
  layoutType: string;
  description: string | null;
  zones: LayoutZone[];
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedLayout extends Layout {
  resolvedZones: Array<LayoutZone & {
    content?: Content;
    playlist?: Playlist;
  }>;
}

// QR Overlay
export interface QrOverlayConfig {
  enabled: boolean;
  url: string;
  position?: string;
  size?: number;
  opacity?: number;
  margin?: number;
  backgroundColor?: string;
  label?: string;
}

// Platform Health
export interface PlatformHealth {
  status: string;
  services: Record<string, { status: string; latency?: number }>;
  uptime: number;
  timestamp: string;
}
