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
  playlistId: string;
  playlist?: Playlist;
  displayIds: string[];
  displays?: Display[];
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  timezone?: string;
  isActive: boolean;
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
