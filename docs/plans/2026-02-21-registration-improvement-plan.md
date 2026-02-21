# Registration Page Improvement Plan

## Current State Audit

### What exists today
A single centered card (`max-w-md`) on a flat background with:
- "Create Account" heading with `eh-gradient` text
- First Name + Last Name (side-by-side grid)
- Organization Name
- Email
- Password (with static text requirements below)
- Confirm Password
- "Create Account" green button
- "Already have an account? Login" link
- Dark theme matching the Electric Horizon design system

### Issues identified

| Category | Issue | Severity |
|----------|-------|----------|
| Layout | Single-column centered card wastes 70% of viewport on desktop | High |
| Trust | Zero social proof, zero value reinforcement at point of signup | High |
| Form UX | No real-time validation — errors only appear on submit | Medium |
| Form UX | Password requirements shown as static text, not interactive checklist | Medium |
| Form UX | No show/hide password toggle | Medium |
| Form UX | No password match indicator while typing confirm password | Medium |
| Form UX | Button has no disabled state when form is incomplete | Low |
| Conversion | No "free trial" or "no credit card" messaging | High |
| Conversion | No benefits/features reinforcement during signup | High |
| Visual | Flat background with no texture or depth — doesn't match the premium landing page | Medium |
| Visual | Form card looks generic, lacks the Electric Horizon atmosphere | Medium |
| Mobile | Current layout works on mobile but wastes all the vertical space above the fold | Low |
| Login parity | Login page is the same centered-card style — should match improved register | Medium |

---

## A: Layout & Visual Improvements

### Split Layout Design

**Desktop (1024px+):** 50/50 horizontal split
- **Left side — Value Proposition Panel**: Full-height dark panel with atmospheric background (grain texture, gradient orbs like the landing page hero). Contains headline, benefits, social proof, and a miniature dashboard preview.
- **Right side — Registration Form**: Clean, focused form on a slightly lighter surface. Card-style container with generous padding.

**Tablet (768px-1023px):** 40/60 split (narrower value side, wider form)

**Mobile (<768px):** Stacked vertically — condensed value banner (headline + 2-3 bullet points) above the form card. The full value panel is not needed on mobile; a compact version reinforces trust without blocking the form.

### Visual treatment

**Value panel (left side):**
- Background: Deep teal `#061A21` with `eh-grain` texture overlay
- Ambient glow: Two radial gradient orbs (neon green + cyan) with `eh-glow-breathe` animation, matching the landing page hero
- Content hierarchy:
  1. Vizora logo (small, top-left)
  2. Headline: "Every screen, managed." (Sora font, `eh-heading` class)
  3. Subtext: "Join 2,500+ organizations running their displays on Vizora."
  4. Three benefit items with custom icons (not emoji):
     - "Live in 5 minutes" — quick setup
     - "AI-powered scheduling" — smart automation
     - "99.9% uptime" — reliability
  5. Mini dashboard mockup (CSS-only, matching the landing page hero's style — simplified fleet overview card showing 3 devices with status dots)
  6. Bottom: "Free for 30 days. No credit card required." in muted text

**Form panel (right side):**
- Background: `var(--surface)` with subtle border-left matching the border color
- Form card: No extra card-within-card nesting — the panel itself IS the card
- Generous vertical padding (py-12 px-10 on desktop)
- Heading: "Create your account" (Sora font, not gradient — clean black/white text)

---

## B: Form UX Improvements

### Field improvements

**Labels:** Keep top-positioned labels (not floating). They are more accessible and match the existing pattern. Style with `var(--foreground-secondary)`, 13px, 600 weight.

**Real-time validation:** Add `onBlur` validation per field. When a field loses focus:
- Valid: Subtle green checkmark icon appears at the right edge of the input
- Invalid: Red border + inline error message below the field (same as current, but triggered on blur not just on submit)
- While typing after a blur error: Clear the error as soon as input becomes valid

**Email field:** Validate format on blur. Show green checkmark for valid format.

**Organization Name:** Add a small info tooltip (?) icon next to the label: "This creates your workspace. Your team members will join this organization." Keep it required.

**Do NOT add an Industry dropdown** — that's onboarding friction. Keep the form minimal.

### Password UX

**Interactive requirements checklist** replacing the static text:
```
Password strength:
  ✓ 8+ characters          (green when met, muted when not)
  ✓ Uppercase letter        (green when met, muted when not)
  ✓ Lowercase letter        (green when met, muted when not)
  ✓ Number or special char  (green when met, muted when not)
```

- Show checklist below the password field, always visible while password field is focused or has content
- Items start as muted text with empty circle icon
- When requirement is met: text turns green, icon becomes filled checkmark, subtle scale transition
- When all 4 are met: optional subtle "Strong password" label in green

**Show/hide password toggle:** Eye icon button inside the password input (right-aligned). Toggles between `type="password"` and `type="text"`. Also add to confirm password field.

**Confirm password match indicator:** While typing in confirm password:
- If matches password: Green checkmark + "Passwords match" in green
- If doesn't match (and has 3+ characters): Red X + "Passwords don't match" in red
- If empty or <3 chars: No indicator

### Button & Actions

**Submit button:**
- Use the `eh-btn-neon` class for the neon glow effect on hover (matches landing page CTA)
- **Disabled state:** `opacity-50 cursor-not-allowed` when any required field is empty. NOT when validation fails — only when fields are literally empty, so the user can still attempt submission to see validation errors.
- **Loading state:** Replace text with spinner + "Creating your account..." (already partially exists)
- Height: `py-3` (taller than current `py-2`) for a more premium feel

**"Already have an account?" link:** Move below the form with more visual separation. Use a subtle horizontal divider above it.

### Error handling

**Field-level errors:** Appear on blur and on submit. Red border + red text below field. Clear when user fixes the input.

**General errors (server-side):** Appear at the top of the form in a styled alert box (current red banner is fine, but add an icon and more specific messaging):
- "An account with this email already exists. [Log in instead](/login)"
- "Registration is temporarily unavailable. Please try again."
- Network errors: "Unable to connect. Check your internet connection."

---

## C: Social Login / OAuth

**Finding: No OAuth support exists on the backend.** The middleware auth module only supports email/password.

**Decision:** Do NOT add social login buttons. Adding non-functional buttons damages trust. Instead:
- Leave space in the layout for future OAuth buttons (above the form with an "or" divider)
- This can be added later when Google/Microsoft OAuth is implemented on the backend
- Note this as a future enhancement in the codebase

---

## D: Trust & Conversion Elements

All placed on the **value proposition panel** (left side), not cluttering the form:

1. **Headline social proof:** "Join 2,500+ organizations worldwide" (matches landing page stats)
2. **Three benefit bullets** with icons:
   - Clock icon: "Live screens in under 5 minutes"
   - Sparkle/AI icon: "AI-powered content & scheduling"
   - Shield icon: "99.9% uptime, enterprise security"
3. **Free trial callout:** "Free for 30 days. No credit card required." — placed prominently near the bottom of the value panel
4. **Mini dashboard preview:** CSS-rendered mini dashboard showing the fleet overview (3 device cards with status dots), giving a taste of what they'll see after signup. This matches the hero mockup style from the landing page.

**On the form side (subtle):**
- Below the submit button: Small lock icon + "256-bit encrypted. Your data is secure."
- Below that: "Free 30-day trial. 5 screens included."

---

## E: Post-Registration Flow

**Current flow:** Register → immediate redirect to `/dashboard` (no email verification, no onboarding wizard).

**Proposed improvement (form side only — no backend changes):**
1. On successful registration: Brief success state on the button (green checkmark + "Account created!") for ~1 second
2. Then redirect to `/dashboard` as current

**Future enhancement (not in this scope):** Onboarding wizard after first login (select industry, number of screens, primary use case). This requires backend work and is deferred.

---

## F: Mobile Experience

**Layout adaptation:**
- **<768px:** Stack vertically. Compact value banner at top (logo + headline + 1-line subtext + "Free 30-day trial" badge). Form below, full-width with comfortable padding.
- **768px-1023px:** 40/60 split. Value panel narrows, form widens. Dashboard preview hides. Benefits stay.
- **1024px+:** Full 50/50 split with dashboard preview.

**Form on mobile:**
- Name fields: Stack vertically (not side-by-side) on screens < 480px
- All inputs: `min-height: 48px` for touch targets (Apple HIG recommendation)
- Proper `inputMode` attributes: `email` for email field
- `autoComplete` attributes: `given-name`, `family-name`, `organization`, `email`, `new-password`
- Form submits on Enter key from last field

**Keyboard experience:**
- Tab order: First Name → Last Name → Organization → Email → Password → Confirm Password → Submit
- `enterKeyHint="next"` on all fields except last, `enterKeyHint="done"` on Confirm Password

---

## G: Login Page Consistency

**The login page should get the same split-layout treatment** for visual consistency:

**Left side (value panel):** Same atmospheric background, but with login-specific messaging:
- Headline: "Welcome back."
- Subtext: "Your screens are waiting."
- Same mini dashboard preview (or a different angle — show a "last session" preview card)
- Same trust signals at bottom

**Right side (form):**
- "Log in to Vizora" heading (clean, not gradient)
- Email + Password fields with same styling
- Show/hide password toggle
- "Forgot password?" link below password field (even if not implemented yet — can link to a "coming soon" or email support)
- Submit button with same `eh-btn-neon` style
- "Don't have an account? Sign up" link below divider

---

## H: Technical Improvements

### Already in place (no changes needed):
- **CSRF protection:** Exists — API client sends `X-CSRF-Token` header
- **Password hashing:** bcryptjs with 14 rounds (exceeds OWASP 2025 recommendation)
- **Rate limiting:** Login is rate-limited (5 attempts/minute in production). Registration is behind global rate limiter.
- **Account lockout:** 10 failed login attempts → 15 minutes lockout

### Improvements to implement:
- **HTML5 form attributes:** Add `autoComplete` attributes to all fields (`given-name`, `family-name`, `organization`, `email`, `new-password`)
- **`noValidate`:** Already present on the form — good, we handle validation ourselves
- **`inputMode="email"`:** Add to email field for mobile keyboard optimization
- **Honeypot field:** Add a hidden field as basic bot protection (no reCAPTCHA needed for now — registration is already rate-limited and creates an organization with trial, so bots have limited incentive)

### Not changing:
- **reCAPTCHA:** Not adding. Current rate limiting + account lockout is sufficient. reCAPTCHA adds friction and privacy concerns. Can be added later if bot registrations become a problem.
- **Email verification:** Out of scope (requires backend email service). Noted as future enhancement.

---

## Implementation Summary

### Files to create:
| File | Purpose |
|------|---------|
| `web/src/components/auth/ValuePanel.tsx` | Left-side value proposition panel (shared between login + register) |
| `web/src/components/auth/PasswordChecklist.tsx` | Interactive password requirements checklist |
| `web/src/components/auth/PasswordInput.tsx` | Password field with show/hide toggle |
| `web/src/components/auth/FormField.tsx` | Reusable form field with blur validation + checkmark |
| `web/src/components/auth/MiniDashboard.tsx` | CSS-only mini dashboard preview for value panel |

### Files to modify:
| File | Changes |
|------|---------|
| `web/src/app/(auth)/register-content.tsx` | Complete rewrite: split layout, new form UX, real-time validation |
| `web/src/app/(auth)/login-content.tsx` | Same split layout treatment, show/hide password, consistent styling |
| `web/src/app/(auth)/__tests__/register-page.test.tsx` | Update tests for new component structure |
| `web/src/app/(auth)/__tests__/login-page.test.tsx` | Update tests for new component structure (if exists) |

### No files deleted. No backend changes.
