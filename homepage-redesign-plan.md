# Vizora Homepage Redesign Plan

## A: Overall Assessment

### What's Working Well (Keep)
- **Dark theme + neon green accent** — Appropriate for a tech/SaaS product. The deep teal-to-navy gradient background (#061A21 → #0A222E) creates depth.
- **Dashboard mockup in hero** — The interactive-looking fleet overview with live device cards, stats, and sidebar is the strongest visual element. It shows the product immediately.
- **Feature showcase alternating layout** — Left text/right mockup, then reversed. Breaks monotony better than a grid.
- **Sticky bottom CTA bar** — Smart UX. Appears after hero scroll, disappears near footer. Good implementation with IntersectionObserver.
- **FAQ accordion** — Clean implementation, appropriate for this content type.
- **Scroll-reveal animations** — The `eh-reveal` system is performant (IntersectionObserver, CSS transitions, not JS-driven animation). Keep the approach, improve the variety.
- **Section ordering is mostly correct** — Hero → Social proof → Features → Trust → Pricing → CTA follows a proven conversion funnel.
- **Animated stat counters** — Good detail with easing function.

### What's NOT Working (Fix or Replace)

1. **CRITICAL: Typography is generic** — Space Grotesk is the #1 most overused "AI-generated website" font. The frontend-design plugin specifically warns against this convergence. It screams "template." JetBrains Mono for metrics is fine, but the primary font needs to change.

2. **CRITICAL: Visual monotony — four consecutive 6-card grids** — Capabilities (6 cards), Solutions (6 cards), Security (6 cards), Testimonials (6 cards). All use identical `eh-card` styling. This is the biggest design problem on the page. After the features section, every section looks the same.

3. **CRITICAL: Social proof is fake-looking** — Text + Lucide icons instead of real logos. "Meridian Health" with a stethoscope icon feels like a template placeholder. This section is supposed to BUILD trust but actively undermines it.

4. **HIGH: Hero headline is generic** — "The modern platform for digital signage" could be any competitor's tagline. No emotional hook, no specific value proposition, no differentiation.

5. **HIGH: Color monotony** — #00E5A0 green is used for EVERYTHING: badges, checkmarks, icons, buttons, borders, glows, trust badges. When everything is accented, nothing stands out.

6. **HIGH: No imagery whatsoever** — Zero photographs, illustrations, or real visual content. The entire page is text, icons, and code mockups. This makes it feel technical and cold rather than inviting.

7. **MEDIUM: Inline style soup** — Nearly every element uses `style={{}}` with hardcoded hex values. This creates maintenance nightmares and inconsistency. Multiple places use slightly different opacity values for the same conceptual element.

8. **MEDIUM: CTA fatigue** — "Start Free Trial" appears 7+ times with identical copy and styling. No variation in messaging or urgency.

9. **MEDIUM: Feature mockups are static** — The fleet status, content library, and schedule previews are static HTML. Adding subtle animation (status changes, content uploading) would make them feel alive.

10. **LOW: Page is too long** — 14 distinct sections. The Capabilities section overlaps heavily with the Features section. Solutions and Security could be tighter.

### Biggest Conversion Killers (Priority Order)
1. **Fake-looking social proof** — If logos look fabricated, visitors distrust everything that follows
2. **Generic headline** — First 5 seconds determine bounce rate. "Modern platform" tells them nothing
3. **Visual fatigue from card grids** — By the 4th grid section, users stop reading
4. **No differentiation from competitors** — Nothing memorable or distinctive about the visual design

### Recommended Section Order (Reordered)
Current: Nav → Hero → Logos → Stats → Features → Capabilities → CTA → Solutions → Security → How It Works → Testimonials → Pricing → FAQ → Final CTA → Footer

**Proposed** (merge capabilities into features, move How It Works earlier):
1. Nav
2. Hero (with embedded social proof stats)
3. Logo bar (tighter, better styling)
4. How It Works (3 steps — immediately shows simplicity after hero)
5. Features showcase (3 alternating panels + integrated capabilities)
6. Mid-page CTA
7. Solutions/Industries (condensed to 4, more visual)
8. Testimonials (reduced to 3 featured, carousel for rest)
9. Security & Trust (condensed, horizontal layout)
10. Pricing
11. FAQ
12. Final CTA
13. Footer

---

## B: Section-by-Section Redesign

### 1. Navigation Bar
**Current state:** Fixed nav with gradient logo, 4 scroll links, Login/Start Free Trial buttons. Hamburger on mobile. Glass-morphism on scroll.

**Problems:**
- Nav links are #8A8278 (very muted) — they look disabled
- The ⌘K command palette trigger is developer-facing, not customer-facing
- Logo is just gradient text "VIZORA" — no icon/mark
- Nav height is tight (h-14 = 56px)

**Proposed changes:**
- **Keep:** Glass-morphism effect on scroll, sticky positioning, mobile hamburger
- **Typography:** Switch to new display font for logo
- **Nav links:** Brighten to #B5AEA6 default, #F0ECE8 on hover (more visible)
- **Remove:** ⌘K command palette on landing page (it's a dashboard feature, confusing for prospects)
- **Add:** Subtle separator dot between nav items for breathing room
- **CTA button:** Add subtle pulse animation on the "Start Free Trial" button after 3 seconds of inactivity (draws eye without being annoying)
- **Height:** Increase to h-16 (64px) for more premium feel
- **Logo:** Add a small geometric icon mark before "VIZORA" text (simple abstracted screen/display icon using CSS)

**Priority:** HIGH
**Frontend-design patterns:** Distinctive typography, intentional spacing, refined minimalism

---

### 2. Hero Section
**Current state:** Badge → H1 → Subtitle → 2 CTAs → Trust line → Dashboard mockup. Grid background with gradient orbs.

**Problems:**
- Headline "The modern platform for digital signage" is forgettable
- Subtitle is functional but doesn't create desire
- Grid background is a cliched AI design pattern
- The entire hero is center-aligned — safe but unremarkable
- Dashboard mockup is well-done but appears below the fold on many screens
- "Watch Demo" links to #how-it-works (not a video) — misleading
- Badge text "Real-time fleet monitoring · Built for scale" is feature-speak, not benefit-speak

**Proposed changes:**
- **Headline rewrite:** "Every screen. Every location. One command center." — Specific, visceral, implies scale and control
- **Subtitle rewrite:** "Deploy digital signage in minutes. Push content to thousands of screens instantly. Know the moment any display goes offline."
- **Badge rewrite:** "Trusted by 2,500+ organizations worldwide" (social proof > feature claim)
- **Background:** Replace grid with organic noise texture + subtle gradient. More atmosphere, less template.
- **Layout:** Left-align the text block on desktop, with the dashboard mockup to the right (more editorial, less SaaS-template). On mobile, stack centered.
- **Dashboard mockup:** Add subtle CSS animations — the green status dots already pulse, but add a periodic "status change" animation where one device briefly shows "Deploying..." then returns to "Online"
- **"Watch Demo" → "See How It Works"** and scroll to the correct section
- **Add:** A subtle floating particle/dot effect in the hero background (very sparse, performant CSS-only using pseudo-elements)

**Priority:** HIGH
**Frontend-design patterns:** Asymmetric layout, atmospheric backgrounds, bold headline typography, motion for delight

---

### 3. Social Proof / Logo Bar
**Current state:** Muted text "Trusted by forward-thinking teams worldwide" + 6 icon/text "logos" at 40% opacity.

**Problems:**
- Icons + text at 40% opacity looks like placeholder content
- These are fictional companies — that's fine, but the presentation shouldn't highlight it
- No visual weight — section feels dismissible

**Proposed changes:**
- **Merge stats INTO the logo bar** — Currently stats are a separate section below. Combine them.
- **Logo treatment:** Replace icon+text with proper styled "logos" using distinctive typography for each name (different font weights, letter-spacing). Each "logo" should look like a designed wordmark, not a label.
- **Remove opacity dimming** — Instead, use a uniform muted color (#5A5248) with subtle hover brightening
- **Stats integration:** Place the 4 stats (50K+ screens, 99.9% uptime, 2,500+ orgs, 45+ countries) in a horizontal strip directly below the logos. Use the animated counter.
- **Layout:** Single horizontal scrolling row on mobile (not wrapping)

**Priority:** HIGH
**Frontend-design patterns:** Typographic variety for logo wordmarks, horizontal rhythm

---

### 4. How It Works (Move UP from position 9 to position 4)
**Current state:** 3 cards in a row with step numbers, icons, and descriptions. Connecting line between them.

**Problems:**
- Currently buried deep in the page (section 9). By the time users reach it, they've already seen 8 sections.
- Cards look like every other card section
- The connecting line is barely visible

**Proposed changes:**
- **Move immediately after logo bar** — Visitors who've seen the hero want to know "how easy is this?" Answer that fast.
- **Visual redesign:** Use a horizontal timeline/pipeline aesthetic instead of cards. Three connected nodes with a visible animated progress line.
- **Add micro-illustrations:** Simple line-art icons that animate in as each step is revealed (upload → schedule → live screen)
- **Tighten copy:** Keep it to one line per step
- **Connecting line:** Make it a gradient line (#00E5A0 → #00B4D8 → #8B5CF6) that animates as you scroll through

**Priority:** MEDIUM
**Frontend-design patterns:** Motion, visual storytelling, timeline composition

---

### 5. Features Showcase (Absorb Capabilities)
**Current state:** Section header → sticky tab bar → 3 alternating feature panels → "More capabilities" header → 6 capability cards.

**Problems:**
- Sticky tab bar is a nice touch but the tabs don't feel interactive enough
- "More capabilities" grid duplicates concepts already covered (Analytics appears in both)
- 6 identical capability cards create visual fatigue
- Feature mockups are well-crafted but static

**Proposed changes:**
- **Keep:** Alternating left/right layout for the 3 main features, sticky tab navigation
- **Absorb capabilities INTO features:** Instead of a separate 6-card grid, integrate the extra capabilities as small inline badges/tags within each feature panel. e.g., "Real-time Control" panel gets "Display Groups" and "Device Preview" as feature tags.
- **Remove:** The "More capabilities" sub-section entirely — reduces page length by ~100px and eliminates one card grid
- **Tab bar enhancement:** Add a small icon to each tab, make the active tab have a subtle background glow
- **Mockup animations:**
  - Fleet Status: Periodically animate a device going from "online" to "offline" and back
  - Content Library: Show a subtle upload progress bar animation
  - Schedule: Have the time blocks subtly shift/pulse
- **Color coding:** Maintain the green/cyan/purple distinction for each feature — this is one of the stronger visual choices on the page

**Priority:** HIGH
**Frontend-design patterns:** Reduce repetition, meaningful animation, visual hierarchy through color

---

### 6. Mid-page CTA Banner
**Current state:** Gradient card with "Ready to see it in action?" + CTA button.

**Problems:**
- Copy is generic
- Visually similar to the final CTA (same gradient, same button)
- Doesn't create urgency

**Proposed changes:**
- **Copy rewrite:** "See the difference in 5 minutes" — Time-specific, implies low commitment
- **Subtext:** "No credit card. No sales call. Just sign up and start managing screens."
- **Visual differentiation:** Add a subtle mockup/screenshot element beside the CTA (small laptop with dashboard) to reinforce the product
- **Background:** Use a slightly different gradient angle/color mix than the final CTA to prevent déjà vu

**Priority:** LOW
**Frontend-design patterns:** Purposeful copy, visual variation

---

### 7. Solutions/Industries (Condensed)
**Current state:** 6 cards in a 3x2 grid. Each has an icon, title, and 1-sentence description.

**Problems:**
- 6 identical cards = visual fatigue (this is the 3rd or 4th card grid the user has seen)
- Text-heavy, no visual differentiation between industries
- No clear hierarchy — all industries appear equally important

**Proposed changes:**
- **Reduce to 4 industries:** Retail, Corporate, Healthcare, Restaurants (highest market demand). Cut Education and Manufacturing — they can be mentioned in a "plus more" line.
- **Visual redesign:** Use larger cards (2x2 grid) with a subtle background color tint per industry, and a small illustration or icon scene (not just a single Lucide icon)
- **Add a visual element:** Each card gets a small "scenario" illustration — e.g., Retail shows a store window with a digital display, Healthcare shows a waiting room
- **"Plus more" footer:** "Also used in Education, Manufacturing, Hospitality, Transportation, and Government" as a simple text line below

**Priority:** MEDIUM
**Frontend-design patterns:** Visual differentiation, illustration, reduced repetition

---

### 8. Security & Trust (Condensed)
**Current state:** 6 security feature cards in 3x2 grid + 5 compliance badges.

**Problems:**
- Another 6-card grid — monotony continues
- Security details are too technical for the average buyer (CSRF, XSS, MIME spoofing)
- Compliance badges are text-only with no visual weight

**Proposed changes:**
- **Merge into a compact 2-column layout:** Left side = 3-4 key security points in a styled list (not cards), Right side = compliance badges with visual shield/badge icons
- **Simplify language:** Replace "CSRF & XSS Protection" with "Full attack prevention" or "Built-in threat protection." Enterprise buyers know what to look for; you don't need to spell out every acronym.
- **Reduce to 4 points:** Dual authentication, Content validation, Role-based access, Audit logging
- **Compliance badges redesign:** Use styled badge components with a shield icon and checkmark. Make them look like actual certification marks, not text labels.
- **Add:** A single line "Questions about security? Contact our security team →" link

**Priority:** MEDIUM
**Frontend-design patterns:** Horizontal layout variation, visual weight on badges, simplified messaging

---

### 9. Testimonials (Refined)
**Current state:** 6 testimonial cards in 3x2 grid. Each has stars, quote, name, role, company.

**Problems:**
- 6 testimonials = wall of text. Users read 1-2, then scroll past.
- No photos/avatars — feels impersonal
- All 5 stars — looks fake (some 4.5 would be more believable but 5 is fine for landing page)
- Cards are identical in size and style

**Proposed changes:**
- **Feature 3 testimonials prominently** (most impactful quotes), with the other 3 available via horizontal scroll or carousel dots
- **Add avatars:** CSS-generated colored circles with initials (like most SaaS sites). Each with a distinct gradient.
- **Visual hierarchy:** Make the first testimonial larger/featured, the other 2 slightly smaller
- **Layout:** 1 large card on the left (featured), 2 stacked cards on the right
- **Add company "logo" text** styled distinctively below each testimonial
- **Keep:** The aggregate 4.9/5 badge — it's well-done

**Priority:** MEDIUM
**Frontend-design patterns:** Visual hierarchy, asymmetric layout, avatar personality

---

### 10. Pricing
**Current state:** 4 tiers in a row (Free, Basic, Pro, Enterprise). Pro highlighted with "Most Popular" badge.

**Problems:**
- On mobile, 4-column grid becomes 2x2 which is cramped
- Price typography doesn't have enough contrast/weight
- Feature lists are plain text — hard to compare tiers at a glance
- "Contact Sales" for Enterprise goes to /register — wrong destination

**Proposed changes:**
- **Layout:** Keep 4-column on desktop. On mobile, switch to a scrollable horizontal carousel (not 2x2 grid)
- **Pro tier emphasis:** Increase the visual distinction — slightly larger card, stronger border glow, more visible "Most Popular" tag
- **Price typography:** Make the dollar amount significantly larger (text-5xl instead of text-3xl) with the per-unit smaller below
- **Feature comparison:** Add subtle divider lines between features for scannability
- **Add toggle:** Monthly / Annual pricing toggle (show "Save 20%" on annual). Even if backend doesn't support it yet, showing it signals maturity.
- **Enterprise CTA:** Change to a mailto: or /contact-sales path instead of /register
- **Add:** "All plans include: SSL, 99.9% SLA, Email support" as a note below the pricing grid

**Priority:** HIGH
**Frontend-design patterns:** Visual hierarchy on featured tier, responsive carousel, clear comparison

---

### 11. FAQ
**Current state:** 6 questions in an accordion with ChevronDown icon.

**Problems:**
- Functional but visually plain
- Some questions overlap ("Can I try before committing?" is answered by the pricing section)
- Accordion max-height is hardcoded to 200px — could clip long answers

**Proposed changes:**
- **Keep:** Accordion pattern, it's the right choice
- **Fix:** Change maxHeight from 200px to a measured height or use grid-template-rows for smooth animation
- **Visual enhancement:** Add a subtle left border accent on the active/open question
- **Reorder questions** by likely conversion impact:
  1. "How long does setup take?" (ease)
  2. "What hardware do I need?" (compatibility)
  3. "How does real-time monitoring work?" (differentiation)
  4. "Is Vizora secure enough for enterprise?" (trust)
  5. "Can I manage screens across timezones?" (capability)
  6. "What does the free trial include?" (conversion — rewrite of current Q6)
- **Add:** "Still have questions? Contact us →" link at the bottom

**Priority:** LOW
**Frontend-design patterns:** Subtle interaction refinement, content strategy

---

### 12. Final CTA
**Current state:** Gradient card with "Ready to modernize your screens?" + 2 buttons + trust line.

**Problems:**
- Almost identical to mid-page CTA in visual treatment
- Copy is decent but could be more compelling
- Sign In button here is odd — it's for existing users, not conversion prospects

**Proposed changes:**
- **Copy rewrite:** "Your screens are waiting" — Short, punchy, action-oriented
- **Subtext:** "Join 2,500+ organizations. Deploy your first screen in under 5 minutes."
- **Remove Sign In button** — This is a conversion section, not a navigation section
- **Add social proof element:** A small row of avatar circles with "+2,500" to visually show community
- **Visual:** Make this the most visually distinctive CTA on the page. Use a stronger gradient, add a subtle grid pattern behind it, or a glowing border animation.

**Priority:** MEDIUM
**Frontend-design patterns:** Strong final conversion push, visual distinction from mid-page CTA

---

### 13. Footer
**Current state:** 4-column grid: Brand, Product links, Company links, Support/compliance badges.

**Problems:**
- "Company" column has Login, Sign Up, Dashboard — these aren't company info
- Compliance badges are duplicated from the security section
- Footer links (Privacy, Terms, Security) are not actual links — just styled spans
- No social media links

**Proposed changes:**
- **Rename columns:** Product | Resources | Legal | Connect
- **Product:** Features, Pricing, Integrations, Changelog
- **Resources:** Documentation, Help Center, API Reference, Status Page
- **Legal:** Privacy Policy, Terms of Service, Security, Cookies
- **Connect:** Twitter/X, LinkedIn, GitHub (if open source components), Contact
- **Make all links actual `<a>` or `<Link>` elements** — not span tags
- **Add:** Newsletter signup with email input (simple inline form)
- **Keep:** Brand section with tagline and gradient logo

**Priority:** LOW
**Frontend-design patterns:** Complete information architecture, functional navigation

---

### 14. Sticky Bottom CTA Bar
**Current state:** Fixed bar at bottom with trust text + "Start Free Trial" button. Shows/hides based on scroll position.

**Problems:** Minor — this is well-implemented.

**Proposed changes:**
- **Add subtle progress indicator** — A thin line at the very top of the bar showing how far down the page the user has scrolled
- **Copy variation:** Instead of always saying "Start Free Trial," show contextual copy based on which section is in view (e.g., near pricing: "Choose Your Plan →")

**Priority:** LOW
**Frontend-design patterns:** Contextual micro-copy, progress indication

---

## C: Content Improvements

### Headline Rewrites
| Current | Proposed | Rationale |
|---------|----------|-----------|
| "The modern platform for digital signage" | "Every screen. Every location. One command center." | Specific, paints a picture, implies scale |
| "Everything you need to run world-class digital signage" | "Complete control over every screen" | Shorter, more direct |
| "Ready to see it in action?" | "See the difference in 5 minutes" | Time-specific, low commitment |
| "Built for every industry" | "Built for your industry" | Personal, inclusive |
| "Enterprise-grade security, built in from day one" | "Security that never sleeps" | More evocative, less jargon |
| "Up and running in 3 steps" | Keep as-is | Clear and effective |
| "Loved by teams everywhere" | "Teams love what Vizora does for them" | More dynamic |
| "Ready to modernize your screens?" | "Your screens are waiting" | Urgency, anthropomorphism |

### Subtext Tightening
- Hero subtitle: Cut from 30 words to 22. Remove "From a single lobby TV to thousands of locations" — the headline already implies scale.
- Feature descriptions: Cut each from ~35 words to ~25 words. Lead with the benefit, not the mechanism.

### CTA Copy Improvements
| Location | Current | Proposed |
|----------|---------|----------|
| Hero primary | "Start Free Trial" | "Start Free — 5 Minutes to Live" |
| Hero secondary | "Watch Demo" | "See How It Works" |
| Mid-page | "Start Free Trial" | "Try It Free" |
| Pricing - Free | "Start Free Trial" | "Start Free" |
| Pricing - Basic | "Get Started" | "Start with Basic" |
| Pricing - Pro | "Get Started" | "Go Pro" |
| Pricing - Enterprise | "Contact Sales" | "Talk to Sales" |
| Final CTA | "Start Free Trial" | "Get Started Free" |
| Sticky bar | "Start Free Trial" | Contextual (see section 14) |

### Sections to Remove/Merge
- **REMOVE:** "More Capabilities" grid — absorb into feature panels
- **MERGE:** Social proof logos + Stats bar → Single "Trusted By" section
- **CONDENSE:** Solutions from 6 → 4 industries
- **CONDENSE:** Security from 6 cards → 4 bullet points + badge strip

---

## D: Performance & Technical

### Animation/Transition Improvements
- **Replace `* { transition }` rule** in globals.css — This applies transitions to EVERY element including layout changes, causing jank. Limit to interactive elements only.
- **Add `will-change: transform` / `will-change: opacity`** to animated elements for GPU compositing hints
- **Use `transform` and `opacity` ONLY** for animations (compositor-only properties, no layout thrashing)
- **Scroll-linked effects:** Use `IntersectionObserver` (already done) but add threshold stages for smoother progressive reveal
- **Feature mockup animations:** Use CSS `@keyframes` only — no JS-driven animation loops

### Image/Asset Optimization
- **Current state:** Zero images. All visual content is JSX + CSS.
- **Recommendation:** Keep the zero-image approach — it's actually great for performance. Instead of adding photos, add SVG illustrations (inline, compressed, minimal).
- **Fonts:** Space Grotesk + JetBrains Mono are already loaded via `next/font/google` (automatic optimization). When switching the display font, continue using `next/font/google` for automatic subsetting and preloading.
- **Icon optimization:** Lucide icons are tree-shaken (importing individual icons). Keep this approach.

### Lazy Loading
- **Current state:** `IntersectionObserver` reveals elements on scroll, but all content is rendered in the initial HTML.
- **Recommendation:** The page is a single component with no dynamic data fetching. Given it's all static content, the current approach is fine. Consider wrapping below-fold sections in `React.lazy()` with Suspense only if bundle size becomes an issue.

### Core Web Vitals Considerations
- **LCP (Largest Contentful Paint):** The hero headline is the LCP element. Ensure the new display font has `display: swap` and is preloaded. Keep the hero content as SSR (currently 'use client' — the initial HTML still contains the text).
- **CLS (Cumulative Layout Shift):** The animated counters start at 0 and animate to final value — this is fine since they're below fold. Ensure no font-swap CLS by setting explicit sizes.
- **INP (Interaction to Next Paint):** Main interactions are scroll-based reveals and FAQ accordion. Both are lightweight. The mobile menu toggle should remain fast.
- **FID (First Input Delay):** The `'use client'` directive means hydration must complete before interactions work. Consider moving the hero content to a server component and only client-wrapping interactive elements.
- **Consider:** Moving the entire page to a Server Component with small interactive islands (FAQ, mobile menu, animated stats, sticky bar) as separate Client Components. This reduces JS bundle and hydration time.

---

## E: Implementation Batches

### Batch 1: Hero + Nav + Social Proof (First Impression)
**Scope:** Sections 1-3 (Navigation, Hero, Logo/Stats bar)
**Agent:** Agent 1 — Global & Hero

**Tasks:**
1. Update global font: Replace Space Grotesk with a distinctive display font (suggestion: Satoshi, General Sans, or Clash Display for headings; keep a clean sans for body). Update layout.tsx and globals.css.
2. Add new CSS utility classes to globals.css for the redesigned components (replace some inline styles with classes)
3. Redesign navigation: Brighter links, remove command palette, increase height, add logo icon mark
4. Redesign hero: New headline/subtitle/CTA copy, asymmetric layout (left text, right mockup on desktop), replace grid background with noise texture gradient, add subtle particle effect
5. Redesign social proof: Merge logo bar + stats into single section, style company names as wordmarks
6. Remove the separate Stats section (section 4 in current code)

**Estimated complexity:** High — touches global styles, layout structure, and the most visible content
**Dependencies:** None — can start immediately

---

### Batch 2: Features + How It Works (Core Value Prop)
**Scope:** Sections 4-6 (How It Works moved up, Features, Mid-page CTA)
**Agent:** Agent 2 — Features & Capabilities

**Tasks:**
1. Move "How It Works" section to directly after social proof (position 4 → position 4 in new order)
2. Redesign as horizontal timeline instead of 3 cards
3. Absorb "More Capabilities" grid into the 3 feature panels as inline feature tags
4. Add subtle CSS animations to feature mockups (fleet status changes, upload progress, schedule pulse)
5. Enhance sticky tab bar with icons and active glow
6. Redesign mid-page CTA with new copy and visual treatment

**Estimated complexity:** Medium — mostly restructuring and animation work
**Dependencies:** Batch 1 (needs new global styles/fonts)

---

### Batch 3: Trust Building (Solutions + Security + Testimonials)
**Scope:** Sections 7-9
**Agent:** Agent 3 — Trust & Social Proof

**Tasks:**
1. Condense Solutions from 6 → 4 industries in a 2x2 grid with visual differentiation per card
2. Add "Plus more" industries line below grid
3. Redesign Security section: 2-column layout (points list + badge strip), simplify technical language
4. Redesign compliance badges as proper visual badge components
5. Redesign Testimonials: 3 featured (asymmetric layout — 1 large + 2 small), add avatar circles
6. Add horizontal scroll/dots for remaining testimonials on mobile

**Estimated complexity:** Medium — mostly layout restructuring
**Dependencies:** Batch 1 (needs new global styles)

---

### Batch 4: Conversion (Pricing + FAQ + Final CTA + Footer)
**Scope:** Sections 10-14
**Agent:** Agent 4 — Conversion

**Tasks:**
1. Redesign pricing: Larger price typography, stronger Pro emphasis, horizontal scroll on mobile, add monthly/annual toggle UI
2. Fix Enterprise CTA (currently links to /register, should have a distinct flow)
3. Add "All plans include" baseline features note
4. Redesign FAQ: Smooth animation fix (replace hardcoded maxHeight), add left border accent on active, reorder questions, add "Contact us" link
5. Redesign Final CTA: New copy, remove Sign In button, add avatar row social proof, distinctive visual treatment
6. Redesign Footer: New column structure, real links, newsletter signup

**Estimated complexity:** Medium
**Dependencies:** Batch 1 (needs new global styles)

---

### Batch 5: Polish & Performance
**Scope:** Cross-cutting concerns
**Agent:** Agent 5 — Polish & Performance

**Tasks:**
1. Remove `* { transition }` blanket rule, apply transitions only to interactive elements
2. Add `will-change` hints to animated elements
3. Review all animations for compositor-only properties (transform/opacity only)
4. Verify scroll reveal thresholds and timing across all sections
5. Mobile responsiveness audit at 375px, 768px, 1024px, 1440px viewports
6. Verify all links/CTAs point to correct destinations
7. Run Lighthouse audit, address any scores below 90
8. Consider Server Component refactor (move static sections out of 'use client', use client islands)
9. Verify dark/light mode behavior (currently landing page forces dark — confirm this is intentional)
10. Cross-browser check (Chrome, Firefox, Safari, Edge)
11. Create `homepage-redesign-results.md` documenting all changes

**Estimated complexity:** High — touches every section
**Dependencies:** Batches 1-4 complete

---

## Appendix: Font Recommendations

Replacing Space Grotesk. Candidates (all available via Google Fonts / next/font/google):

| Font | Style | Use Case |
|------|-------|----------|
| **Sora** | Geometric, techy, modern | Headlines + body — feels premium and distinctive |
| **Outfit** | Clean geometric, wide | Headlines — feels modern without being overused |
| **Plus Jakarta Sans** | Elegant, slightly rounded | Body text — more personality than Inter/Space Grotesk |
| **DM Sans** | Clean, professional | Body text — good readability |
| **Manrope** | Geometric, slightly quirky | Headlines — stands out without being too loud |

**Recommended pairing:** **Sora** for headlines + **DM Sans** for body text. Sora has distinctive character shapes (especially lowercase 'a' and 'g') that will immediately differentiate from the Space Grotesk look while maintaining the techy/modern feel appropriate for a SaaS product. DM Sans for body provides excellent readability with just enough personality.

Keep **JetBrains Mono** for monospace/metrics — it's well-chosen.

---

## Appendix: Color Refinements

Keep the existing palette but add more variation:

| Token | Current | Proposed | Notes |
|-------|---------|----------|-------|
| Primary accent | #00E5A0 | #00E5A0 | Keep — it's the brand |
| Secondary accent | #00B4D8 | #00B4D8 | Keep — good contrast with primary |
| Tertiary accent | #8B5CF6 | #8B5CF6 | Keep — adds warmth |
| **NEW: Warm accent** | — | #F59E0B (amber) | For urgency/attention elements (pricing highlights, "Popular" badges) |
| **NEW: Surface accent** | — | rgba(0,229,160,0.03) | Very subtle green tint for alternating section backgrounds |
| Muted text | #8A8278 | #9A958E | Slightly brighter for better readability |
| Dim text | #5A5248 | #6B655D | Slightly brighter |

The key change: Use **amber/gold** (#F59E0B) for the "Most Popular" pricing badge and any urgency elements, instead of the same green used everywhere else. This creates visual distinction where it matters for conversion.
