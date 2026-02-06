# Wave 8: Admin System - Comprehensive Implementation Plan

## Overview
Vizora Admin System for platform super-admins to manage the entire SaaS platform. This is separate from organization admins - these are Vizora platform operators.

**Branch:** `feat/wave-8-admin`
**Estimated Total Effort:** ~40-50 hours
**Estimated Tests:** ~200 new tests

---

## Schema Changes

### User Model Update
```prisma
model User {
  // ... existing fields
  isSuperAdmin   Boolean  @default(false)  // Vizora platform admin
}
```

### New Models

```prisma
// ============================================================================
// PLAN MANAGEMENT
// ============================================================================

model Plan {
  id                     String   @id @default(cuid())
  slug                   String   @unique  // 'free', 'basic', 'pro', 'enterprise'
  name                   String
  description            String?

  // Quotas
  screenQuota            Int      // -1 for unlimited
  storageQuotaMb         Int      @default(5000)  // Storage limit in MB
  apiRateLimit           Int      @default(1000)  // Requests per hour

  // Pricing (cents/paise, -1 for custom)
  priceUsdMonthly        Int
  priceUsdYearly         Int
  priceInrMonthly        Int
  priceInrYearly         Int

  // Payment provider IDs
  stripePriceIdMonthly   String?
  stripePriceIdYearly    String?
  razorpayPlanIdMonthly  String?
  razorpayPlanIdYearly   String?

  // Features (JSON array of feature flags)
  features               String[]  // ['analytics', 'api_access', 'priority_support']
  featureFlags           Json?     @db.JsonB  // Detailed feature config

  // Display
  isActive               Boolean   @default(true)
  isPublic               Boolean   @default(true)  // Show on pricing page
  sortOrder              Int       @default(0)
  highlightText          String?   // "Most Popular", "Best Value"

  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt

  promotions             PlanPromotion[]

  @@index([isActive, isPublic])
  @@map("plans")
}

// ============================================================================
// PROMOTIONS & DISCOUNTS
// ============================================================================

model Promotion {
  id                   String    @id @default(cuid())
  code                 String    @unique  // 'LAUNCH50', 'DIWALI2026'
  name                 String
  description          String?

  // Discount configuration
  discountType         String    // 'percentage' | 'fixed_amount' | 'free_months'
  discountValue        Int       // 50 for 50%, or cents/paise, or months
  currency             String?   // null for percentage, 'usd'/'inr' for fixed

  // Limits
  maxRedemptions       Int?      // null for unlimited
  maxPerCustomer       Int       @default(1)
  currentRedemptions   Int       @default(0)
  minPurchaseAmount    Int?      // Minimum cart value

  // Validity
  startsAt             DateTime
  expiresAt            DateTime?
  isActive             Boolean   @default(true)

  // Tracking
  createdBy            String?   // Admin user ID
  metadata             Json?     @db.JsonB  // Campaign tracking, UTM, etc.

  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  applicablePlans      PlanPromotion[]
  redemptions          PromotionRedemption[]

  @@index([code])
  @@index([isActive, startsAt, expiresAt])
  @@map("promotions")
}

model PlanPromotion {
  id           String    @id @default(cuid())
  planId       String
  plan         Plan      @relation(fields: [planId], references: [id], onDelete: Cascade)
  promotionId  String
  promotion    Promotion @relation(fields: [promotionId], references: [id], onDelete: Cascade)

  @@unique([planId, promotionId])
  @@map("plan_promotions")
}

model PromotionRedemption {
  id             String       @id @default(cuid())
  promotionId    String
  promotion      Promotion    @relation(fields: [promotionId], references: [id], onDelete: Cascade)
  organizationId String
  discountApplied Int         // Actual discount in cents/paise
  redeemedAt     DateTime     @default(now())

  @@index([promotionId])
  @@index([organizationId])
  @@map("promotion_redemptions")
}

// ============================================================================
// SYSTEM CONFIGURATION
// ============================================================================

model SystemConfig {
  id          String   @id @default(cuid())
  key         String   @unique
  value       Json     @db.JsonB
  dataType    String   @default("string")  // string, number, boolean, json
  category    String   @default("general") // general, security, limits, features
  description String?
  isSecret    Boolean  @default(false)  // Hide value in UI
  updatedAt   DateTime @updatedAt
  updatedBy   String?  // Admin user ID

  @@index([category])
  @@map("system_configs")
}

// ============================================================================
// ADMIN AUDIT LOG
// ============================================================================

model AdminAuditLog {
  id             String   @id @default(cuid())
  adminUserId    String
  action         String   // 'plan.create', 'org.suspend', 'user.impersonate'
  targetType     String?  // 'organization', 'user', 'plan', 'promotion'
  targetId       String?
  details        Json?    @db.JsonB  // Action-specific details
  ipAddress      String?
  userAgent      String?
  createdAt      DateTime @default(now())

  @@index([adminUserId])
  @@index([action])
  @@index([targetType, targetId])
  @@index([createdAt])
  @@map("admin_audit_logs")
}

// ============================================================================
// SYSTEM ANNOUNCEMENTS
// ============================================================================

model SystemAnnouncement {
  id          String    @id @default(cuid())
  title       String
  message     String
  type        String    @default("info")  // info, warning, critical, maintenance
  targetAudience String @default("all")   // all, admins, specific_plans
  targetPlans String[]  // If targetAudience is specific_plans
  startsAt    DateTime
  expiresAt   DateTime?
  isActive    Boolean   @default(true)
  isDismissible Boolean @default(true)
  linkUrl     String?
  linkText    String?
  createdBy   String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([isActive, startsAt, expiresAt])
  @@map("system_announcements")
}

// ============================================================================
// IP BLOCKLIST
// ============================================================================

model IpBlocklist {
  id          String   @id @default(cuid())
  ipAddress   String   // Can be single IP or CIDR range
  reason      String?
  blockedBy   String?  // Admin user ID
  expiresAt   DateTime?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  @@unique([ipAddress])
  @@index([isActive])
  @@map("ip_blocklist")
}
```

---

## Module Structure

```
middleware/src/modules/admin/
├── admin.module.ts
├── admin.controller.ts              # Main admin endpoints
│
├── guards/
│   └── super-admin.guard.ts         # isSuperAdmin check
│
├── services/
│   ├── plans.service.ts             # Plan CRUD
│   ├── promotions.service.ts        # Promotion CRUD + validation
│   ├── system-config.service.ts     # Config management
│   ├── organizations-admin.service.ts # Org management
│   ├── users-admin.service.ts       # User management
│   ├── platform-stats.service.ts    # Analytics & metrics
│   ├── platform-health.service.ts   # System health checks
│   ├── billing-admin.service.ts     # Billing operations
│   ├── security-admin.service.ts    # Security tools
│   ├── announcements.service.ts     # System announcements
│   └── admin-audit.service.ts       # Audit logging
│
├── dto/
│   ├── plans/
│   │   ├── create-plan.dto.ts
│   │   └── update-plan.dto.ts
│   ├── promotions/
│   │   ├── create-promotion.dto.ts
│   │   ├── update-promotion.dto.ts
│   │   └── validate-promotion.dto.ts
│   ├── organizations/
│   │   ├── update-org-admin.dto.ts
│   │   └── org-filters.dto.ts
│   ├── users/
│   │   └── update-user-admin.dto.ts
│   ├── config/
│   │   └── update-config.dto.ts
│   ├── announcements/
│   │   └── create-announcement.dto.ts
│   └── security/
│       └── block-ip.dto.ts
│
└── tests/
    ├── plans.service.spec.ts
    ├── promotions.service.spec.ts
    ├── organizations-admin.service.spec.ts
    ├── users-admin.service.spec.ts
    ├── platform-stats.service.spec.ts
    ├── platform-health.service.spec.ts
    ├── billing-admin.service.spec.ts
    ├── security-admin.service.spec.ts
    ├── announcements.service.spec.ts
    ├── admin.controller.spec.ts
    └── super-admin.guard.spec.ts
```

---

## API Endpoints

### Plans Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/plans` | List all plans (including inactive) |
| GET | `/admin/plans/:id` | Get plan details |
| POST | `/admin/plans` | Create new plan |
| PUT | `/admin/plans/:id` | Update plan |
| DELETE | `/admin/plans/:id` | Soft-delete plan |
| POST | `/admin/plans/:id/duplicate` | Clone a plan |
| PUT | `/admin/plans/reorder` | Update sort order |

### Promotions Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/promotions` | List all promotions |
| GET | `/admin/promotions/:id` | Get promotion details with stats |
| POST | `/admin/promotions` | Create promotion |
| PUT | `/admin/promotions/:id` | Update promotion |
| DELETE | `/admin/promotions/:id` | Delete promotion |
| POST | `/admin/promotions/validate` | Validate code for checkout |
| POST | `/admin/promotions/bulk-generate` | Generate multiple codes |
| GET | `/admin/promotions/:id/redemptions` | View redemption history |

### Organization Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/organizations` | List/search all organizations |
| GET | `/admin/organizations/:id` | Full org details |
| PUT | `/admin/organizations/:id` | Update org (plan, status, quotas) |
| POST | `/admin/organizations/:id/extend-trial` | Add trial days |
| POST | `/admin/organizations/:id/suspend` | Suspend organization |
| POST | `/admin/organizations/:id/unsuspend` | Reactivate organization |
| DELETE | `/admin/organizations/:id` | Delete org (GDPR) |
| POST | `/admin/organizations/:id/impersonate` | Get impersonation token |
| GET | `/admin/organizations/:id/audit-log` | Org activity log |
| POST | `/admin/organizations/:id/notes` | Add internal note |

### User Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/users` | List/search all users |
| GET | `/admin/users/:id` | User details |
| PUT | `/admin/users/:id` | Update user |
| POST | `/admin/users/:id/reset-password` | Force password reset |
| POST | `/admin/users/:id/disable` | Disable user account |
| POST | `/admin/users/:id/enable` | Enable user account |
| POST | `/admin/users/:id/grant-super-admin` | Grant super admin |
| POST | `/admin/users/:id/revoke-super-admin` | Revoke super admin |
| POST | `/admin/users/:id/impersonate` | Get impersonation token |
| GET | `/admin/users/:id/sessions` | View active sessions |
| DELETE | `/admin/users/:id/sessions` | Force logout all sessions |

### Platform Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/health` | Overall system health |
| GET | `/admin/health/services` | Individual service status |
| GET | `/admin/health/database` | DB stats (connections, query times) |
| GET | `/admin/health/redis` | Redis stats (memory, hit rate) |
| GET | `/admin/health/storage` | MinIO/S3 stats |
| GET | `/admin/health/websocket` | WebSocket connection stats |
| GET | `/admin/health/queues` | Background job queue status |
| GET | `/admin/health/errors` | Recent error rates by endpoint |
| GET | `/admin/health/uptime` | Uptime history |

### Platform Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/stats/overview` | Dashboard summary |
| GET | `/admin/stats/revenue` | MRR, ARR, trends |
| GET | `/admin/stats/signups` | Registration trends |
| GET | `/admin/stats/churn` | Cancellation metrics |
| GET | `/admin/stats/usage` | Platform usage metrics |
| GET | `/admin/stats/geographic` | Users/revenue by region |
| GET | `/admin/stats/plans` | Breakdown by plan tier |
| GET | `/admin/stats/features` | Feature adoption rates |
| GET | `/admin/stats/api-usage` | API call metrics |

### Billing Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/billing/transactions` | All transactions |
| GET | `/admin/billing/failed-payments` | Failed payment list |
| POST | `/admin/billing/retry-payment/:id` | Retry failed payment |
| POST | `/admin/billing/refund/:id` | Issue refund |
| GET | `/admin/billing/revenue-report` | Revenue breakdown |
| POST | `/admin/billing/manual-invoice` | Create manual invoice |
| GET | `/admin/billing/subscription/:orgId` | Org billing details |

### System Configuration
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/config` | Get all configs |
| GET | `/admin/config/:key` | Get specific config |
| PUT | `/admin/config/:key` | Update config value |
| DELETE | `/admin/config/:key` | Delete config |
| POST | `/admin/config/bulk` | Bulk update configs |
| GET | `/admin/config/categories` | Get configs by category |

### Security
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/security/audit-log` | Admin action log |
| GET | `/admin/security/failed-logins` | Failed login attempts |
| GET | `/admin/security/ip-blocklist` | Blocked IPs |
| POST | `/admin/security/ip-blocklist` | Block IP |
| DELETE | `/admin/security/ip-blocklist/:id` | Unblock IP |
| GET | `/admin/security/api-keys` | All API keys across platform |
| POST | `/admin/security/api-keys/:id/revoke` | Revoke API key |
| GET | `/admin/security/sessions` | Active sessions platform-wide |

### Announcements
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/announcements` | List announcements |
| POST | `/admin/announcements` | Create announcement |
| PUT | `/admin/announcements/:id` | Update announcement |
| DELETE | `/admin/announcements/:id` | Delete announcement |
| POST | `/admin/announcements/:id/publish` | Activate announcement |

### Support Tools
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/support/lookup` | Quick lookup by email/org/device |
| POST | `/admin/support/send-test-push/:deviceId` | Push test content |
| POST | `/admin/support/clear-cache/:orgId` | Clear org cache |
| GET | `/admin/support/debug-report/:orgId` | Generate debug report |
| GET | `/admin/support/device-diagnostics/:id` | Device health check |

---

## Frontend Structure

```
web/src/app/admin/
├── layout.tsx                    # Admin layout with sidebar
├── page.tsx                      # Dashboard overview
│
├── plans/
│   ├── page.tsx                  # Plans list
│   ├── new/page.tsx              # Create plan
│   └── [id]/page.tsx             # Edit plan
│
├── promotions/
│   ├── page.tsx                  # Promotions list
│   ├── new/page.tsx              # Create promotion
│   └── [id]/page.tsx             # Edit promotion
│
├── organizations/
│   ├── page.tsx                  # Org list with filters
│   └── [id]/page.tsx             # Org details
│
├── users/
│   ├── page.tsx                  # User list
│   └── [id]/page.tsx             # User details
│
├── health/
│   └── page.tsx                  # System health dashboard
│
├── analytics/
│   ├── page.tsx                  # Analytics overview
│   ├── revenue/page.tsx          # Revenue details
│   └── usage/page.tsx            # Usage details
│
├── billing/
│   ├── page.tsx                  # Billing operations
│   └── transactions/page.tsx     # Transaction list
│
├── config/
│   └── page.tsx                  # System configuration
│
├── security/
│   ├── page.tsx                  # Security overview
│   ├── audit-log/page.tsx        # Admin audit log
│   └── ip-blocklist/page.tsx     # IP management
│
├── announcements/
│   ├── page.tsx                  # Announcements list
│   └── new/page.tsx              # Create announcement
│
├── support/
│   └── page.tsx                  # Support tools
│
└── components/
    ├── AdminSidebar.tsx
    ├── AdminHeader.tsx
    ├── StatCard.tsx
    ├── DataTable.tsx
    ├── PlanForm.tsx
    ├── PromotionForm.tsx
    ├── OrgDetailsCard.tsx
    ├── UserDetailsCard.tsx
    ├── HealthStatusCard.tsx
    ├── RevenueChart.tsx
    ├── UsageChart.tsx
    ├── ConfigEditor.tsx
    ├── AuditLogTable.tsx
    ├── AnnouncementForm.tsx
    └── QuickLookup.tsx
```

---

## Implementation Phases

### Phase 1: Foundation (P0) - ~12 hours
**Must have for operations**

- [ ] Schema migration (all new models)
- [ ] SuperAdminGuard
- [ ] AdminAuditService (log all admin actions)
- [ ] PlansService (CRUD)
- [ ] Update BillingService to read from Plan table
- [ ] Seed migration (PLAN_TIERS → Plan table)
- [ ] Admin layout + dashboard page
- [ ] Plans management UI
- [ ] Basic org list/view

### Phase 2: Core Operations (P1) - ~12 hours
**Important for day-to-day**

- [ ] PromotionsService (CRUD + validation)
- [ ] OrganizationsAdminService (suspend, extend trial, impersonate)
- [ ] UsersAdminService (disable, reset password, impersonate)
- [ ] SystemConfigService
- [ ] Promotions UI with date pickers
- [ ] Org management UI (actions, notes)
- [ ] User management UI
- [ ] Config editor UI

### Phase 3: Health & Analytics (P1) - ~10 hours
**Visibility into platform**

- [ ] PlatformHealthService (service checks, DB/Redis/MinIO stats)
- [ ] PlatformStatsService (business metrics)
- [ ] Health dashboard UI
- [ ] Analytics charts (revenue, signups, usage)
- [ ] Real-time stats websocket

### Phase 4: Billing & Security (P1) - ~8 hours
**Financial operations & protection**

- [ ] BillingAdminService (refunds, failed payments)
- [ ] SecurityAdminService (IP blocklist, audit log)
- [ ] Billing operations UI
- [ ] Security dashboard UI
- [ ] Audit log viewer

### Phase 5: Communications & Support (P2) - ~6 hours
**User communication & debugging**

- [ ] AnnouncementsService
- [ ] Support tools (lookup, test push, debug report)
- [ ] Announcements UI
- [ ] Support tools UI

---

## Task Checklist

### Schema & Migration
- [ ] Add isSuperAdmin to User model
- [ ] Create Plan model
- [ ] Create Promotion model
- [ ] Create PlanPromotion model
- [ ] Create PromotionRedemption model
- [ ] Create SystemConfig model
- [ ] Create AdminAuditLog model
- [ ] Create SystemAnnouncement model
- [ ] Create IpBlocklist model
- [ ] Create seed script for initial data
- [ ] Run migration

### Backend Services (~15 services)
- [ ] SuperAdminGuard
- [ ] AdminAuditService
- [ ] PlansService
- [ ] PromotionsService
- [ ] SystemConfigService
- [ ] OrganizationsAdminService
- [ ] UsersAdminService
- [ ] PlatformStatsService
- [ ] PlatformHealthService
- [ ] BillingAdminService
- [ ] SecurityAdminService
- [ ] AnnouncementsService
- [ ] SupportToolsService
- [ ] AdminController (main)
- [ ] Update BillingService (use Plan table)

### Frontend Pages (~15 pages)
- [ ] Admin layout + sidebar
- [ ] Dashboard overview
- [ ] Plans list + form
- [ ] Promotions list + form
- [ ] Organizations list + details
- [ ] Users list + details
- [ ] Health dashboard
- [ ] Analytics pages (revenue, usage)
- [ ] Billing operations
- [ ] Config editor
- [ ] Security dashboard
- [ ] Audit log viewer
- [ ] IP blocklist manager
- [ ] Announcements manager
- [ ] Support tools

### Tests (~200 total)
- [ ] PlansService tests (~15)
- [ ] PromotionsService tests (~20)
- [ ] OrganizationsAdminService tests (~20)
- [ ] UsersAdminService tests (~15)
- [ ] PlatformStatsService tests (~15)
- [ ] PlatformHealthService tests (~15)
- [ ] BillingAdminService tests (~15)
- [ ] SecurityAdminService tests (~15)
- [ ] AnnouncementsService tests (~10)
- [ ] AdminController tests (~25)
- [ ] SuperAdminGuard tests (~10)
- [ ] Frontend component tests (~25)

---

## Environment Variables (New)

```env
# Admin
SUPER_ADMIN_EMAILS=admin@vizora.com,ops@vizora.com  # Auto-grant on registration

# Health checks
HEALTH_CHECK_TIMEOUT_MS=5000
```

---

## Seed Data

### Default System Configs
```typescript
const defaultConfigs = [
  { key: 'maintenance_mode', value: false, category: 'general' },
  { key: 'new_registrations_enabled', value: true, category: 'general' },
  { key: 'default_trial_days', value: 14, category: 'billing' },
  { key: 'max_file_size_mb', value: 500, category: 'limits' },
  { key: 'api_rate_limit_default', value: 1000, category: 'limits' },
  { key: 'require_email_verification', value: true, category: 'security' },
  { key: 'password_min_length', value: 8, category: 'security' },
  { key: 'session_timeout_hours', value: 168, category: 'security' },
];
```

### Migrate PLAN_TIERS to Plan table
```typescript
// Seed script will convert existing PLAN_TIERS constant to Plan records
```

---

## Notes

- All admin actions logged to AdminAuditLog
- Impersonation creates special JWT with `impersonatedBy` claim
- Health checks use Promise.race with timeout
- Stats are cached in Redis (1-5 min TTL depending on metric)
- Announcements checked on dashboard load (cached client-side)
- IP blocklist checked in global middleware
