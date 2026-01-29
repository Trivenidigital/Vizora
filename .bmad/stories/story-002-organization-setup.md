# Story 002: Organization Setup

**ID:** STORY-002  
**Module:** Organizations  
**Priority:** P0 - Critical  
**Status:** Development Complete - Awaiting Test  
**Created:** 2026-01-28  
**Updated:** 2026-01-28

---

## User Story

**As a** new user  
**I want to** create and configure my organization  
**So that** I can manage my digital signage infrastructure

---

## Acceptance Criteria

### AC-001: Organization Creation
**Given** I am registering a new account  
**When** I provide organization name during signup  
**Then** an organization should be created and associated with my account

**Validation Rules:**
- Organization name required (min 2 characters)
- Organization name must be unique
- User becomes admin of their organization

### AC-002: Organization Context
**Given** I am logged in  
**When** I access any feature  
**Then** all data should be scoped to my organization only

**Multi-Tenancy Requirements:**
- Data isolation between organizations
- No cross-organization data access
- Organization ID in all queries

### AC-003: Organization Settings
**Given** I am an organization admin  
**When** I navigate to settings  
**Then** I should be able to update:
- Organization name
- Contact information
- Time zone
- Default settings

---

## Implementation Details

**Backend Files:**
- `middleware/src/modules/organizations/organizations.controller.ts`
- `middleware/src/modules/organizations/organizations.service.ts`
- `middleware/src/modules/organizations/entities/organization.entity.ts`

**Database Tables:**
- `organizations` (id, name, created_at, updated_at)
- `users.organization_id` (foreign key)

**Middleware:**
- Organization context middleware
- Multi-tenant query scoping

---

## Test Cases

See: `.bmad/testing/test-cases/story-002-tests.md`

**Total Test Cases:** 8  
**Passed:** 0  
**Failed:** 0  
**Blocked:** 0

---

## Dependencies

- User authentication (Story-001)
- Database migrations
- JWT token includes organization ID

---

## Bugs Found

None yet - testing pending

---

**Status:** ⏳ READY FOR TEST
