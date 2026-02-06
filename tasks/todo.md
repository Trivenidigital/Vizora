# Wave 7.5: Admin System Implementation Plan

## Overview
Add a Vizora Admin System for platform administrators to manage plans, promotions, and system-wide configurations. This is separate from organization admins - these are Vizora platform super-admins.

## Why This Matters
- Plans are currently hardcoded in `billing/constants/plans.ts` - any price/feature change requires code deployment
- No way to run time-limited promotions or discount codes
- No central system configuration management
- Need separation between org admins and platform super-admins

---

## Phase 1: Schema Changes

### New Models

```prisma
// Super admin flag on User (simpler than separate table)
model User {
  // ... existing fields
  isSuperAdmin   Boolean  @default(false)  // Vizora platform admin
}

// Dynamic plan tiers (replaces hardcoded PLAN_TIERS)
model Plan {
  id                String   @id @default(cuid())
  slug              String   @unique  // 'free', 'basic', 'pro', 'enterprise'
  name              String
  description       String?
  screenQuota       Int      // -1 for unlimited
  priceUsdMonthly   Int      // cents (0 for free, -1 for custom)
  priceUsdYearly    Int
  priceInrMonthly   Int      // paise
  priceInrYearly    Int
  stripePriceIdMonthly   String?
  stripePriceIdYearly    String?
  razorpayPlanId         String?
  features          String[]
  isActive          Boolean  @default(true)
  sortOrder         Int      @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  promotions        PlanPromotion[]

  @@index([isActive])
  @@map("plans")
}

// Promotions / discount codes
model Promotion {
  id                String    @id @default(cuid())
  code              String    @unique  // e.g., 'LAUNCH50', 'DIWALI2026'
  name              String
  description       String?
  discountType      String    // 'percentage' | 'fixed_amount'
  discountValue     Int       // percentage (50 = 50%) or cents/paise
  currency          String?   // null for percentage, 'usd'/'inr' for fixed
  maxRedemptions    Int?      // null for unlimited
  currentRedemptions Int      @default(0)
  startsAt          DateTime
  expiresAt         DateTime?
  isActive          Boolean   @default(true)
  applicablePlans   PlanPromotion[]
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([code])
  @@index([isActive, startsAt, expiresAt])
  @@map("promotions")
}

// Join table for plan-specific promotions
model PlanPromotion {
  id           String    @id @default(cuid())
  planId       String
  plan         Plan      @relation(fields: [planId], references: [id], onDelete: Cascade)
  promotionId  String
  promotion    Promotion @relation(fields: [promotionId], references: [id], onDelete: Cascade)

  @@unique([planId, promotionId])
  @@map("plan_promotions")
}

// System-wide configuration (key-value store)
model SystemConfig {
  id          String   @id @default(cuid())
  key         String   @unique
  value       Json     @db.JsonB
  description String?
  updatedAt   DateTime @updatedAt
  updatedBy   String?  // User ID who last updated

  @@map("system_configs")
}
```

---

## Phase 2: Backend - Admin Module

### File Structure
```
middleware/src/modules/admin/
├── admin.module.ts
├── admin.controller.ts        # Super-admin only endpoints
├── plans.service.ts           # Plan CRUD
├── promotions.service.ts      # Promotion CRUD
├── system-config.service.ts   # Config management
├── guards/
│   └── super-admin.guard.ts   # isSuperAdmin check
├── dto/
│   ├── create-plan.dto.ts
│   ├── update-plan.dto.ts
│   ├── create-promotion.dto.ts
│   ├── update-promotion.dto.ts
│   └── update-config.dto.ts
└── tests/
    ├── plans.service.spec.ts
    ├── promotions.service.spec.ts
    └── admin.controller.spec.ts
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/plans` | List all plans |
| POST | `/admin/plans` | Create new plan |
| PUT | `/admin/plans/:id` | Update plan |
| DELETE | `/admin/plans/:id` | Soft-delete plan |
| GET | `/admin/promotions` | List promotions |
| POST | `/admin/promotions` | Create promotion |
| PUT | `/admin/promotions/:id` | Update promotion |
| DELETE | `/admin/promotions/:id` | Delete promotion |
| POST | `/admin/promotions/:id/validate` | Validate promo code |
| GET | `/admin/config` | Get all configs |
| PUT | `/admin/config/:key` | Update config value |
| GET | `/admin/stats` | Platform-wide stats |

### Update Billing Service
- Modify `getPlans()` to read from Plan table instead of constants
- Add `applyPromotion()` method for checkout
- Keep constants as fallback/seed data

---

## Phase 3: Frontend - Admin Dashboard

### New Pages
```
web/src/app/admin/
├── layout.tsx                 # Admin layout with sidebar
├── page.tsx                   # Admin dashboard overview
├── plans/
│   ├── page.tsx              # Plan management table
│   └── [id]/page.tsx         # Edit plan form
├── promotions/
│   ├── page.tsx              # Promotions list
│   └── [id]/page.tsx         # Edit promotion
├── config/
│   └── page.tsx              # System configuration
└── components/
    ├── AdminSidebar.tsx
    ├── PlanForm.tsx
    ├── PromotionForm.tsx
    └── ConfigEditor.tsx
```

### Features
- Plan CRUD with price inputs (USD/INR)
- Stripe/Razorpay price ID configuration
- Promotion creation with date pickers
- Real-time promo code validation
- System config key-value editor
- Platform stats dashboard

---

## Phase 4: Integration

### Seed Data
- Migrate existing PLAN_TIERS to Plan table
- Create initial SystemConfig entries

### Update Checkout Flow
- Accept promo code on checkout
- Apply discount to price
- Track redemptions

### Guard Updates
- SuperAdminGuard for /admin/* routes
- Keep existing RolesGuard for org-level

---

## Tasks Checklist

### Schema & Migration
- [ ] Add isSuperAdmin to User model
- [ ] Create Plan model
- [ ] Create Promotion model
- [ ] Create PlanPromotion model
- [ ] Create SystemConfig model
- [ ] Create seed script for initial plans

### Backend
- [ ] Create AdminModule
- [ ] Create SuperAdminGuard
- [ ] Create PlansService with CRUD
- [ ] Create PromotionsService with validation
- [ ] Create SystemConfigService
- [ ] Create AdminController
- [ ] Update BillingService to use Plan table
- [ ] Add promo code support to checkout
- [ ] Write tests (~40 new tests)

### Frontend
- [ ] Create admin layout with guard
- [ ] Create plans management page
- [ ] Create plan edit form
- [ ] Create promotions management page
- [ ] Create promotion form with date picker
- [ ] Create system config page
- [ ] Create admin dashboard with stats
- [ ] Add promo code input to checkout
- [ ] Write tests (~25 new tests)

### Documentation
- [ ] Update MEMORY.md
- [ ] Update Pending-Future-Upgrades.html

---

## Estimated Effort
- Schema + Migration: 1 hour
- Backend (AdminModule + services): 4 hours
- Frontend (admin pages): 4 hours
- Integration + testing: 2 hours
- **Total: ~11 hours**

## New Tests Target
- Backend: ~40 tests
- Frontend: ~25 tests
- **Total: ~65 new tests**

---

## Notes
- Super-admin is flagged on User, not a separate model (simpler)
- Plans stored in DB but constants kept as fallback/seed
- Promotions can be plan-specific or apply to all plans
- SystemConfig is a flexible key-value store for future needs
