# Auth Pages Improvement Plan

## Audit Summary

### What EXISTS (Backend)

| Feature | Status | Details |
|---------|--------|---------|
| JWT Authentication | YES | HS256, 7-day expiry, httpOnly cookie `vizora_auth_token` |
| User Registration | YES | Auto-creates org, bcrypt 14 rounds |
| User Login | YES | With account lockout (10 attempts = 15 min lock) |
| Logout | YES | Token revocation via Redis |
| CSRF Protection | YES | Double-submit cookie pattern, constant-time comparison |
| Rate Limiting | YES | 3-tier: 10/s, 100/m, 1000/h (production). Auth-specific: login 5/min, register 3/min |
| Password Hashing | YES | bcrypt with 14 rounds (OWASP 2025 compliant) |
| Account Lockout | YES | Redis counter, 10 attempts, 15 min TTL |
| Secure Error Messages | YES | "Invalid email or password" — doesn't leak which field is wrong |
| Token Refresh | YES | POST /api/v1/auth/refresh |

### What DOES NOT EXIST (Backend)

| Feature | Status | Impact |
|---------|--------|--------|
| Forgot Password Endpoint | MISSING | Users can't self-service password recovery |
| Password Reset Tokens | MISSING | No Prisma model, no token generation/validation |
| Email Service | MISSING | No SMTP, no SendGrid, no nodemailer — zero email capability |
| Email Verification | MISSING | Users are `isActive: true` immediately, no `emailVerified` field |
| OAuth / Social Login | MISSING | Only passport-jwt and passport-local installed |
| Remember Me (explicit) | MISSING | 7-day tokens exist but no UI toggle for extended sessions |

### What EXISTS (Frontend)

| Page | Status | Details |
|------|--------|---------|
| Login (`/login`) | YES | Split layout, email/password, password toggle, error handling, lockout detection, CSRF |
| Registration (`/register`) | YES | Split layout, 6 fields, Zod validation, password checklist, honeypot, trust signals |
| Forgot Password (`/forgot-password`) | NO | Returns 404. Login has stub link pointing to `/login` |
| Reset Password (`/reset-password`) | NO | Returns 404 |
| Auth Layout | PARTIAL | No dedicated `(auth)/layout.tsx` — uses root layout |
| Shared Components | YES | FormField, PasswordInput, PasswordChecklist, ValuePanel, MiniDashboard |

### Current Frontend Gaps

**Login Page:**
- "Forgot password?" link is a stub (points to `/login`)
- No "Remember me" checkbox
- No social login buttons
- Loading state exists but no rate-limit feedback UI
- No explicit lockout timer display

**Registration Page:**
- No Terms of Service / Privacy Policy checkbox
- No email verification step (auto-redirects to dashboard)
- Password checklist shows 4 requirements (8+ chars, uppercase, lowercase, number/special)
- Trust signals exist: "256-bit encrypted", "Free 30-day trial", "5 screens included"

---

## Scope Decision

Given the audit results, here is the scope breakdown:

### IN SCOPE (This Project)

**Frontend Only (No Backend Changes):**
1. Login page UX improvements (forgot password link fix, remember me UI, polish)
2. Registration page UX improvements (ToS, minor polish)
3. Forgot Password page (frontend only — email input + success UI)
4. Reset Password page (frontend only — new password form + token validation UI)
5. Shared auth layout consolidation
6. Consistent design system across all 4 pages

**Backend Required:**
7. Forgot password API endpoint (`POST /api/v1/auth/forgot-password`)
8. Reset password API endpoint (`POST /api/v1/auth/reset-password`)
9. Password reset token model (Prisma migration)
10. Email service integration (nodemailer + SMTP or SendGrid)
11. Password reset email template

### OUT OF SCOPE (Future Work)

- OAuth / Social login (no backend support, significant effort)
- Email verification on registration (separate project)
- 2FA / MFA (separate project)
- Refresh token rotation
- Session management UI ("Sign out all devices")

### Rationale

Social login and email verification are substantial backend features that deserve their own projects. The forgot/reset password flow is the minimum viable improvement — users MUST be able to recover their accounts. Everything else is polish on existing pages.

---

## A: Shared Design System

All four auth pages share the existing split layout pattern established in the current login and registration pages.

### Existing Design Language (Keep & Refine)

- **Layout**: 45/55 split — ValuePanel (left) + Form (right). Hidden on mobile < md breakpoint.
- **Color palette**: Dark theme — background `#061A21`, primary `#00E5A0`, foreground `#F0ECE8`
- **Typography**: Sora (headings, tight tracking), DM Sans (body), JetBrains Mono (code)
- **ValuePanel**: Dark background with animated glowing orbs, grain texture, logo, 3 benefit bullets, variant-specific bottom content (MiniDashboard for register, FleetStats for login)
- **Inputs**: Dark background (`bg-[#0a2a36]`), green focus ring, white text, proper labels
- **Buttons**: Green gradient CTA (`#00E5A0`), glow on hover
- **Links**: Green text links with underline on hover
- **Error states**: Red border on inputs, role="alert" error messages

### Design Refinements

1. **Create a shared `(auth)/layout.tsx`** to extract common auth page structure:
   - Consistent meta viewport, theme color
   - Common wrapper with responsive split layout
   - Shared footer: Terms of Use | Privacy Policy | Help

2. **ValuePanel variants**: Add `forgot-password` and `reset-password` variants:
   - **Forgot Password**: Show a lock/key illustration with reassuring copy ("We'll get you back in")
   - **Reset Password**: Show a shield/checkmark illustration with security-focused copy ("Almost there — set a strong password")

3. **Mobile trust banner**: Already exists on registration — ensure it appears on all auth pages

4. **Consistent page transitions**: Fade-in animation on form load (already exists via `fadeIn` keyframe)

### Aesthetic Direction (frontend-design skill)

**Tone**: Refined dark-tech — the existing "Electric Horizon" design language is strong. We'll deepen it, not reinvent.

**Differentiation**: The atmospheric glowing orbs, grain texture, and MiniDashboard preview are distinctive. Extend this to new pages with contextual illustrations (lock icon for forgot password, shield for reset).

**Typography**: Keep Sora/DM Sans pairing — it's distinctive and well-implemented.

**Motion**: Add subtle entrance animations for form fields (staggered fade-in-up) and success state transitions. Keep animations CSS-only for performance.

**Color accent shifts**: Consider a subtle color temperature shift per page:
- Login: Green accent (trust, "go")
- Register: Green accent (growth, start)
- Forgot Password: Amber/warm accent (caution, but reassuring)
- Reset Password: Green accent (success, completion)

*Note: The amber accent is a suggestion for differentiation. If it feels inconsistent, stick with green throughout.*

---

## B: Login Page Improvements

### Current State
- Split layout with ValuePanel (login variant: fleet stats card)
- Email + password fields with Zod validation
- Password show/hide toggle
- Error handling: invalid credentials, account lockout detection
- Redirect validation (prevents open redirects)
- Stub "Forgot password?" link (goes to `/login` — broken)
- "Don't have an account? Sign up" link

### Changes

#### B1. Fix Forgot Password Link
**Priority: HIGH** — Currently broken (links to `/login`)
- Change href from `/login` to `/forgot-password`
- Keep existing position: right-aligned below password field
- File: `web/src/app/(auth)/login-content.tsx` line ~142

#### B2. Add "Remember Me" Checkbox
- Add between password field and login button
- Label: "Remember me for 30 days"
- Default: unchecked
- Sends `rememberMe: boolean` to login API
- Backend: If true, set cookie maxAge to 30 days instead of 7 days
- Styling: Small checkbox with green checkmark, `text-sm text-gray-400`

#### B3. Improve Lockout Feedback
- Currently: Shows generic error "Account temporarily locked..."
- Improve: Parse lockout state and show:
  - Prominent lockout alert with countdown timer (if API provides remaining time)
  - Disable form fields and submit button during lockout
  - Prominent "Forgot your password?" link in the lockout alert
  - "Try again in X minutes" with live countdown

#### B4. Loading State Polish
- Already exists (spinner on button, fields disabled)
- Add: Subtle pulse animation on the button during loading
- Ensure double-submit prevention is solid

#### B5. Error Message Improvements
- Current errors are functional but could be more helpful
- Invalid credentials: Keep generic "Invalid email or password" (security)
- Add: Attempt counter display ("3 of 10 attempts remaining") — only if backend provides this
- Network error: "Unable to connect. Check your internet connection."

#### B6. Keyboard UX Audit
- Already has: `enterKeyHint`, `autoComplete`, `inputMode`
- Verify: Tab order (email → password → remember me → login)
- Verify: Enter submits from any field
- Verify: Autofocus on email field

### NOT Adding to Login
- Social login buttons — No backend OAuth support
- reCAPTCHA — Existing rate limiting + lockout is sufficient for now
- Magic link login — Out of scope

---

## C: Registration Page Improvements

### Current State
- Split layout with ValuePanel (register variant: MiniDashboard preview)
- 6 fields: first name, last name, org name, work email, password, confirm password
- Honeypot field for bot protection
- Password strength checklist (4 requirements)
- Real-time password match indicator
- Trust signals: "256-bit encrypted", "Free 30-day trial", "5 screens included"
- Zod schema validation
- Detects duplicate email and shows login link

### Changes

#### C1. Add Terms of Service Acceptance
- Add checkbox below confirm password, above "Create Account" button
- Label: "I agree to the [Terms of Service] and [Privacy Policy]"
- Links open in new tab (placeholder URLs for now: `/terms`, `/privacy`)
- Required: Cannot submit without checking
- Validation error: "You must agree to the Terms of Service"

#### C2. Improve Email Validation Feedback
- Currently: Validates format only
- Add: Common typo detection (gmial.com → "Did you mean gmail.com?")
- Show suggestion as a clickable link below the email field
- Library: Simple regex-based detection for top 10 email providers

#### C3. Improve Password Strength UX
- Current checklist: 8+ chars, uppercase, lowercase, number/special — KEEP
- Add: Visual strength bar (weak/medium/strong) above the checklist
  - Weak (red): <2 requirements met
  - Medium (amber): 2-3 requirements met
  - Strong (green): All 4 requirements met
- Add: "Strong password" confirmation message when all requirements met (already exists in PasswordChecklist)

#### C4. Post-Registration UX
- Currently: Shows success message, redirects to `/dashboard` after 800ms
- Keep this behavior (no email verification — out of scope)
- Consider: Slightly longer delay (1.5s) so user reads the success message
- Consider: Welcome animation on the success state

#### C5. Organization Name Tooltip Enhancement
- Currently: Small `?` icon with title tooltip
- Enhance: Make tooltip more prominent — popover on hover/click with:
  - "This creates your workspace"
  - "Team members will join this organization later"
  - "You can change this in Settings"

### NOT Adding to Registration
- Social signup — No backend OAuth support
- Email verification step — Out of scope (separate project)
- Organization selection for existing orgs — Complex, separate feature

---

## D: Forgot Password Page (NEW)

### Route: `/forgot-password`

### Frontend Design

**Layout**: Same split layout as login/register pages.

**ValuePanel variant**: `forgot-password`
- Heading: "Don't worry"
- Subtext: "It happens to the best of us. We'll help you get back into your account."
- Illustration: Stylized lock/key icon using the existing atmospheric gradient style
- Keep the 3 benefit bullets (brand reinforcement)

**Form:**
```
[Vizora Logo]

Reset your password

Enter the email address associated with your account
and we'll send you a link to reset your password.

[Email input field]

[Send Reset Link] (green CTA button)

[Back to Login] (text link)
[Don't have an account? Sign up] (text link)
```

**States:**

1. **Default**: Email input + submit button
2. **Loading**: Button shows spinner, field disabled
3. **Success**: Replace form with:
   ```
   [Check icon / email illustration]

   Check your email

   We've sent a password reset link to j***@example.com
   Check your inbox and spam folder.

   [Didn't receive it? Resend] (disabled with countdown: "Resend in 45s")
   [Back to Login]
   ```
4. **Error states**:
   - Empty email: "Please enter your email address"
   - Invalid format: "Please enter a valid email address"
   - Rate limited: "Too many requests. Please try again in X minutes."
   - Network error: "Unable to connect. Please try again."
   - **Email not found: ALWAYS show success** (security — never reveal if email exists)

**Rate limit**: Show cooldown on resend button (45s → 30s → 15s → Resend)

### Backend: `POST /api/v1/auth/forgot-password`

**Request:**
```json
{ "email": "user@example.com" }
```

**Response (always 200):**
```json
{ "success": true, "message": "If an account exists with this email, a reset link has been sent." }
```

**Logic:**
1. Validate email format
2. Look up user by email
3. If user found:
   a. Generate cryptographically random token (32 bytes, hex)
   b. Hash the token (SHA-256) before storing in database
   c. Store: `{ hashedToken, userId, expiresAt: now + 1 hour, usedAt: null }`
   d. Send email with unhashed token in reset link: `https://vizora.cloud/reset-password?token=xxx`
4. If user NOT found: Do nothing (but still return 200)
5. Rate limit: 3 requests per email per hour (use Redis counter)
6. Always return the same success response

**Prisma model:**
```prisma
model PasswordResetToken {
  id        String   @id @default(uuid())
  token     String   @unique  // SHA-256 hash of the actual token
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  @@index([token])
  @@index([userId])
}
```

**User model update:**
```prisma
model User {
  // ... existing fields
  passwordResetTokens PasswordResetToken[]
}
```

### Email Service Setup

**Package**: `nodemailer` (lightweight, no vendor lock-in)

**Module**: `middleware/src/modules/mail/`
- `mail.module.ts` — NestJS module
- `mail.service.ts` — Send email via SMTP
- `templates/` — HTML email templates

**Environment variables:**
```
SMTP_HOST=smtp.sendgrid.net   # or any SMTP provider
SMTP_PORT=587
SMTP_USER=apikey              # SendGrid uses "apikey" as username
SMTP_PASSWORD=SG.xxxxx        # SendGrid API key or SMTP password
EMAIL_FROM=noreply@vizora.cloud
```

**Password Reset Email Template:**
```
From: Vizora <noreply@vizora.cloud>
Subject: Reset your Vizora password

[Vizora Logo]

Hi [firstName],

You requested a password reset for your Vizora account.

[Reset Password Button → https://vizora.cloud/reset-password?token=xxx]

This link expires in 1 hour.

If you didn't request this, you can safely ignore this email.
Your password won't be changed.

— The Vizora Team
```

---

## E: Reset Password Page (NEW)

### Route: `/reset-password?token=xxx`

### Frontend Design

**Layout**: Same split layout.

**ValuePanel variant**: `reset-password`
- Heading: "Almost there"
- Subtext: "Choose a strong, unique password to keep your account secure."
- Illustration: Shield/checkmark icon in atmospheric gradient style

**Token Validation (on page load):**
1. Extract `token` from URL query params
2. Call `GET /api/v1/auth/validate-reset-token?token=xxx`
3. If valid: Show password form
4. If invalid/expired: Show error state

**Form (valid token):**
```
[Vizora Logo]

Create new password

Choose a strong password for your Vizora account.

[New Password] (with show/hide toggle)
[Password strength checklist — same as registration]
[Confirm New Password] (with match indicator)

[Reset Password] (green CTA button)

[Back to Login] (text link)
```

**States:**

1. **Loading**: Token validation in progress — show spinner
2. **Valid token**: Show password form
3. **Invalid/expired token**:
   ```
   [Warning icon]

   This reset link has expired or is invalid

   Reset links are valid for 1 hour and can only be used once.

   [Request a New Reset Link] (→ /forgot-password)
   [Back to Login]
   ```
4. **Success**:
   ```
   [Checkmark icon]

   Password reset successful!

   Your password has been updated. You can now log in
   with your new password.

   Redirecting to login in 5s...

   [Log In Now] (→ /login)
   ```
5. **Error states**:
   - Passwords don't match: Inline validation (real-time)
   - Password requirements not met: Checklist shows unmet items
   - Token expired during submission: "This link has expired. Please request a new one."
   - Network error: "Unable to connect. Please try again."

### Backend: `GET /api/v1/auth/validate-reset-token`

**Query**: `?token=xxx`

**Response (valid):**
```json
{ "success": true, "data": { "valid": true, "email": "j***@example.com" } }
```

**Response (invalid):**
```json
{ "success": false, "message": "Invalid or expired reset token" }
```

**Logic:**
1. Hash the incoming token (SHA-256)
2. Look up by hashed token
3. Check: exists, not expired, not used
4. Return masked email for user confirmation

### Backend: `POST /api/v1/auth/reset-password`

**Request:**
```json
{
  "token": "xxx",
  "newPassword": "NewStr0ngP@ss!"
}
```

**Response:**
```json
{ "success": true, "message": "Password has been reset successfully" }
```

**Logic:**
1. Hash the incoming token (SHA-256)
2. Look up by hashed token
3. Validate: exists, not expired, not used
4. Validate new password (8+ chars, uppercase, number — same as registration)
5. Hash new password with bcrypt (14 rounds)
6. Update user's `passwordHash`
7. Mark token as used (`usedAt = now`)
8. Invalidate all existing sessions for this user (clear Redis tokens)
9. Clear login attempt counter for this user
10. Return success

---

## F: Security Checklist

All items from the user's requirements, with current status:

```
[x] CSRF tokens on all forms — Double-submit cookie pattern, constant-time comparison
[x] Rate limiting on login — 5 attempts/min (throttler) + 10 attempts/15min lockout (Redis)
[x] Rate limiting on registration — 3 per minute
[ ] Rate limiting on forgot password — NEEDS: 3 per hour per email (new endpoint)
[ ] Password reset tokens: cryptographically random, time-limited, single-use — NEEDS: New system
[x] Password hashing: bcrypt with cost factor 14 (OWASP 2025 compliant)
[x] No password in URL parameters — Token only, password in POST body
[x] Secure cookies: HttpOnly, Secure (prod), SameSite strict (prod) / lax (dev)
[x] Don't reveal if email exists on forgot password — WILL IMPLEMENT: Always return 200
[x] Don't reveal which field is wrong on login — "Invalid email or password"
[x] Account lockout after N failed attempts — 10 attempts, 15 min
[x] Brute force protection — Rate limiting + lockout combined
[x] Input sanitization — Global SanitizeInterceptor
[x] XSS prevention — Helmet headers + sanitization
[ ] reCAPTCHA on registration — DEFERRED: Honeypot exists, rate limiting active
```

### Additional Security for New Endpoints

1. **Forgot password rate limit**: Redis counter `password_reset:{email}` with 1-hour TTL, max 3
2. **Token storage**: Store only SHA-256 hash in database (never plaintext)
3. **Token entropy**: 32 bytes (256 bits) of `crypto.randomBytes`
4. **Token single-use**: Mark `usedAt` on consumption, reject if already used
5. **Session invalidation**: On password reset, revoke all existing JWT tokens via Redis
6. **Timing attack prevention**: Use constant-time comparison for token validation

---

## G: Implementation Plan (Phase 2 Agent Assignments)

### Agent 1: Shared Auth Layout + Design Polish
**Scope:**
- Create `web/src/app/(auth)/layout.tsx` for shared auth page structure
- Add ValuePanel variants for `forgot-password` and `reset-password`
- Add subtle entrance animations (staggered fade-in for form fields)
- Ensure mobile trust banner on all pages
- Add footer links (Terms, Privacy) on all auth pages
- Use frontend-design skill for all visual decisions

**Dependencies:** None — starts first

### Agent 2: Login Page Improvements
**Scope:**
- Fix forgot password link (`/login` → `/forgot-password`)
- Add "Remember me" checkbox with styling
- Improve lockout feedback (prominent alert, forgot password link in lockout)
- Polish error messages and loading states
- Keyboard UX audit

**Dependencies:** Agent 1 (shared layout)

### Agent 3: Registration Page Improvements
**Scope:**
- Add Terms of Service checkbox
- Add email typo detection
- Add password strength bar
- Polish success state timing
- Enhance organization tooltip

**Dependencies:** Agent 1 (shared layout)

### Agent 4: Forgot Password + Reset Password (Full Stack)
**Scope:**
- **Backend:**
  - Create `PasswordResetToken` Prisma model + migration
  - Add `passwordResetTokens` relation to User model
  - Create mail module (`nodemailer` + SMTP)
  - Build `POST /api/v1/auth/forgot-password` endpoint
  - Build `GET /api/v1/auth/validate-reset-token` endpoint
  - Build `POST /api/v1/auth/reset-password` endpoint
  - Password reset email template (branded HTML)
  - Rate limiting on forgot password (3/hour/email)
  - Token hashing (SHA-256), single-use, 1-hour expiry
  - Session invalidation on password reset
- **Frontend:**
  - Build `/forgot-password` page with all states
  - Build `/reset-password` page with all states
  - Token validation on page load
  - Success state with auto-redirect
  - All error states

**Dependencies:** Agent 1 (shared layout)

### Agent 5: Security Hardening + Testing
**Scope:**
- Verify all security checklist items
- Add rate limiting to new forgot password endpoint
- Test all error states across all 4 pages
- Test lockout behavior end-to-end
- Test forgot → reset → login full flow
- Mobile responsiveness check (375px, 768px)
- Write/update tests for all changed components

**Dependencies:** Agents 1-4 complete

### Execution Order
```
Agent 1 (layout)        ████████░░░░░░░░░░░░░░░░░░░░
Agent 2 (login)         ░░░░░░░░████████░░░░░░░░░░░░
Agent 3 (registration)  ░░░░░░░░████████░░░░░░░░░░░░  (parallel with 2)
Agent 4 (forgot/reset)  ░░░░░░░░████████████████░░░░  (longest — full stack)
Agent 5 (security/test) ░░░░░░░░░░░░░░░░░░░░████████
```

---

## H: Files To Be Created / Modified

### New Files
```
web/src/app/(auth)/layout.tsx                          # Shared auth layout
web/src/app/(auth)/forgot-password/page.tsx             # Forgot password page
web/src/app/(auth)/forgot-password-content.tsx          # Forgot password client component
web/src/app/(auth)/reset-password/page.tsx              # Reset password page
web/src/app/(auth)/reset-password-content.tsx           # Reset password client component
web/src/components/auth/ValuePanel.tsx                  # Update with new variants
middleware/src/modules/mail/mail.module.ts              # Email service module
middleware/src/modules/mail/mail.service.ts             # Email sending service
middleware/src/modules/mail/templates/                  # Email templates directory
middleware/src/modules/auth/dto/forgot-password.dto.ts  # Forgot password DTO
middleware/src/modules/auth/dto/reset-password.dto.ts   # Reset password DTO
packages/database/prisma/migrations/xxx_add_password_reset_tokens/  # Prisma migration
```

### Modified Files
```
web/src/app/(auth)/login-content.tsx                   # Fix forgot password link, add remember me
web/src/app/(auth)/register-content.tsx                # Add ToS checkbox, email typo detection
web/src/components/auth/ValuePanel.tsx                 # Add forgot-password/reset-password variants
web/src/lib/api.ts                                     # Add forgotPassword(), resetPassword(), validateResetToken()
web/src/lib/validation.ts                              # Add forgot password & reset password schemas
packages/database/prisma/schema.prisma                 # Add PasswordResetToken model
middleware/src/modules/auth/auth.controller.ts          # Add forgot/reset password endpoints
middleware/src/modules/auth/auth.service.ts             # Add forgot/reset password logic
middleware/src/modules/auth/auth.module.ts              # Import mail module
middleware/src/app/app.module.ts                        # Register mail module
middleware/package.json                                 # Add nodemailer dependency
```

### Test Files (New/Modified)
```
web/src/app/(auth)/__tests__/forgot-password.test.tsx   # Forgot password page tests
web/src/app/(auth)/__tests__/reset-password.test.tsx    # Reset password page tests
web/src/app/(auth)/__tests__/login-page.test.tsx        # Update for new features
web/src/app/(auth)/__tests__/register-page.test.tsx     # Update for ToS checkbox
middleware/test/auth-forgot-password.e2e-spec.ts        # E2E: forgot password flow
middleware/test/auth-reset-password.e2e-spec.ts         # E2E: reset password flow
```

---

## I: Environment Variables Needed

### New (Required for Forgot/Reset Password)
```env
SMTP_HOST=smtp.sendgrid.net       # SMTP server host
SMTP_PORT=587                      # SMTP port (587 for TLS)
SMTP_USER=apikey                   # SMTP username
SMTP_PASSWORD=SG.xxxxx            # SMTP password / API key
EMAIL_FROM=noreply@vizora.cloud    # Sender email address
FRONTEND_URL=https://vizora.cloud  # For building reset links in emails
```

### Decision Needed
- **Email provider**: SendGrid (recommended — generous free tier, reliable), Mailgun, AWS SES, or self-hosted SMTP?
- The plan assumes SendGrid but the implementation uses standard SMTP (nodemailer), so any provider works.

---

## J: What We're NOT Changing

To keep scope controlled:

1. **No OAuth/Social Login** — No backend support exists. Requires passport strategies, Prisma schema changes, UI for account linking. Separate project.
2. **No Email Verification on Registration** — Requires `emailVerified` field, verification token flow, conditional login blocking. Separate project.
3. **No 2FA/MFA** — Requires TOTP setup, QR code generation, backup codes. Separate project.
4. **No Magic Link Login** — Alternative auth method. Separate project.
5. **No Account Deletion** — Settings feature, not auth page. Separate project.
6. **No Password History** — Preventing reuse of old passwords. Nice-to-have, not MVP.
7. **No reCAPTCHA** — Honeypot + rate limiting + lockout is sufficient for now.

---

## Summary

This plan focuses on **two primary deliverables**:

1. **Polish existing auth pages** (Login + Registration) with missing UX features
2. **Build the forgot/reset password flow** end-to-end (frontend + backend + email)

The forgot/reset password flow is the critical missing piece — it's a core security feature that every production app needs. The login/registration improvements are quality-of-life enhancements that make the first-touch experience feel complete and professional.

**Estimated scope**: ~40 files touched (new + modified + tests), 1 new Prisma model, 1 new NestJS module, 2 new pages, 3 new API endpoints.
