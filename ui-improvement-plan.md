# Vizora Dashboard UI/UX Improvement Plan

## Executive Summary

The Vizora dashboard has a solid functional foundation but suffers from visual congestion, inconsistent design patterns, and underutilization of its own design system. The "Electric Horizon" theme has good bones (deep teal + neon green + warm cream) but execution is inconsistent - hardcoded colors everywhere, cramped layouts, and generic patterns that don't leverage the brand's identity.

This plan applies the **frontend-design plugin's principles** to elevate the dashboard from functional to distinctive, while preserving all existing functionality and the brand identity.

---

## A: Design System Gaps

### A1. Typography — Space Grotesk Problem
**Current**: Uses `Space_Grotesk` as the primary font + `JetBrains_Mono` for code.
**Issue**: The frontend-design plugin explicitly warns: *"NEVER converge on common choices (Space Grotesk, for example)"*. Space Grotesk is one of the most overused fonts in AI-generated UIs. It makes the dashboard look generic.
**Fix**: Replace with a distinctive, characterful font pairing:
- **Display/Headings**: `Plus Jakarta Sans` or `Outfit` — geometric but warmer than Space Grotesk, better personality
- **Body**: `DM Sans` — clean, highly legible, pairs beautifully with geometric display fonts
- **Mono**: Keep `JetBrains Mono` — it's excellent for code/data
- **Priority**: HIGH | **Complexity**: SMALL (font swap in layout.tsx + tailwind config)

### A2. Color Token Usage — Hardcoded Hex Epidemic
**Current**: CSS variables exist (`var(--foreground)`, `var(--surface)`, etc.) but pages constantly bypass them with raw hex values:
- `#00E5A0` appears 100+ times across components instead of using a token
- `bg-green-50`, `text-purple-600`, `bg-red-50` — raw Tailwind colors that break in dark mode
- Action buttons use 6+ different color families with no semantic meaning
**Fix**:
- Add CSS custom properties for ALL semantic colors: `var(--primary)`, `var(--success)`, `var(--warning)`, `var(--error)`, `var(--info)`
- These already exist in globals.css but are NOT used by most components
- Create Tailwind utilities that map to CSS vars so devs write `bg-primary` instead of `bg-[#00E5A0]`
- Replace ALL hardcoded hex and raw Tailwind color classes with semantic tokens
- **Priority**: HIGH | **Complexity**: MEDIUM (systematic find-and-replace across all pages)

### A3. Spacing Inconsistency
**Current**: Token spacing scale exists (xs=4px through 5xl=80px) but components use arbitrary Tailwind spacing:
- Page headers: sometimes `space-y-6`, sometimes `space-y-4`
- Card padding: varies between `p-4`, `p-6`, `p-8` with no pattern
- Form fields: `space-y-3`, `space-y-4`, or `space-y-6` depending on the page
- Button padding: `px-3 py-1.5`, `px-4 py-2`, `px-6 py-3` — all on the same page
**Fix**: Establish spacing conventions:
- Page-level sections: `gap-8` (32px)
- Card internal padding: `p-6` (24px) standard, `p-4` (16px) compact
- Form fields: `space-y-5` (20px) standard
- Button sizes: sm=`px-3 py-1.5`, md=`px-4 py-2`, lg=`px-5 py-2.5`
- **Priority**: HIGH | **Complexity**: MEDIUM

### A4. Motion & Micro-interactions — Massively Underutilized
**Current**: `framer-motion@11` is installed but barely used. The dashboard feels static despite having:
- Custom keyframe animations in globals.css (eh-reveal, eh-float, neon-pulse) that are rarely applied
- No page transition animations
- No staggered list/grid reveals
- No skeleton loading states (just a spinner)
**Fix**:
- Add staggered fade-in reveals for card grids and table rows on page load
- Add skeleton loading screens for each page type (card grid skeleton, table skeleton)
- Add subtle hover micro-interactions beyond just color changes
- Use framer-motion `AnimatePresence` for modals and page transitions
- **Priority**: MEDIUM | **Complexity**: MEDIUM

### A5. Component Pattern Inconsistencies
**Current**: The `/components/ui/` folder has well-built components (Card, Badge, DataTable, Button, Tabs) but many pages DON'T use them:
- Devices page builds its own table instead of using `DataTable`
- Content page builds its own card grid instead of using `Card`
- Many pages create inline badge styles instead of using `Badge`
- `Button` component exists with proper variants but pages hardcode button styles
**Fix**: Adopt the component library consistently across all pages
- **Priority**: HIGH | **Complexity**: LARGE (requires refactoring every page)

---

## B: Global Fixes

### B1. Sidebar — Too Narrow & Cramped
**Current**: `w-48` (192px) with `p-2 space-y-0.5` — items are visually squeezed
- Navigation items have only `px-3 py-2` padding
- Active state uses `border-l-2` which is too thin to be noticed
- No visual grouping of related items (Content/Templates/Widgets/Layouts should be grouped)
- Sidebar footer with version info wastes space
**Fix**:
- Widen to `w-56` (224px) for breathing room
- Increase nav item padding to `px-4 py-2.5`
- Group navigation into sections with subtle dividers: "Overview", "Content" (Content, Templates, Widgets, Layouts), "Distribution" (Playlists, Schedules, Devices), "Insights" (Analytics), "Settings"
- Replace thin border-l-2 active indicator with a bolder visual treatment (full background fill with accent color at 10% opacity + left bar at 3px)
- Remove version info footer or collapse it into a hover state
- **Priority**: HIGH | **Complexity**: SMALL

### B2. Page Headers — Inconsistent & Space-Wasting
**Current**: Every page has a `text-3xl font-bold` title + subtitle + action button, but:
- Title and CTA button are on the same line, causing wrapping on smaller screens
- Subtitle text provides little value ("Manage your paired display devices")
- Search filter is a separate section below, wasting vertical space
**Fix**:
- Combine page title + search + primary action into one compact header bar
- Remove generic subtitles (they state the obvious)
- Move item counts into a Badge next to the title
- Keep the primary CTA button but reduce its visual weight when not needed
- **Priority**: HIGH | **Complexity**: SMALL

### B3. Table Design — Functional But Flat
**Current**: Tables use the standard pattern (thead/tbody, row hover, action buttons as text links) but lack polish:
- No sticky headers (scroll loses context)
- Action buttons are small text links that are hard to hit
- Checkbox column takes too much space
- No row focus/selected state
- Pagination controls are overly complex
**Fix**:
- Add `sticky top-0` to thead with background blur
- Convert text action links to `IconButton` components (from ui/)
- Use `DataTable` component consistently (it already has pagination built in)
- Simplify pagination: "Showing 1-10 of 50" + prev/next buttons (remove page number buttons)
- Add subtle row alternating backgrounds for readability
- **Priority**: MEDIUM | **Complexity**: MEDIUM

### B4. Dark Mode Breakage
**Current**: Many components use raw Tailwind colors that don't adapt:
- `bg-green-50`, `bg-purple-50`, `bg-red-50`, `bg-orange-50` — all white-ish in dark mode
- `text-green-600`, `text-purple-600` — too dark in dark mode
- Quick Actions on dashboard use `from-purple-50 to-purple-100` — invisible in dark mode
- Status badges use `bg-green-100 text-green-800` — wrong contrast in dark mode
**Fix**: Replace ALL raw Tailwind color classes with dark-mode-aware patterns:
- Use CSS variables: `var(--success)`, `var(--error)`, etc. (already defined in globals.css)
- Or use explicit dark: variants: `bg-green-50 dark:bg-green-900/20`
- The Badge component already handles this correctly — use it everywhere
- **Priority**: HIGH | **Complexity**: MEDIUM

### B5. Loading States — Spinner-Only Is Lazy
**Current**: Every page shows a single centered `LoadingSpinner` component while data loads. This causes:
- Content layout shift when data arrives (spinner is small, content is large)
- No sense of what's coming (user sees a spinner and nothing else)
- Jarring transition from empty to full
**Fix**: Create skeleton loading screens:
- `TableSkeleton` — animated placeholder rows matching table column layout
- `CardGridSkeleton` — animated placeholder cards matching grid layout
- `StatsGridSkeleton` — animated placeholder stat cards
- Use CSS `animate-pulse` on `bg-[var(--surface-hover)]` rectangles
- **Priority**: MEDIUM | **Complexity**: SMALL

### B6. Empty States — Inconsistent & Bland
**Current**: `EmptyState` component exists but:
- Uses a generic icon + text pattern for every page
- Gradient background variant is visually heavy
- Some pages don't use EmptyState at all (inline "No results" text)
**Fix**:
- Create page-specific empty state illustrations (or at minimum, contextual icons)
- Tone down the gradient background — use subtle surface with a dashed border instead
- Ensure ALL pages use the EmptyState component consistently
- **Priority**: LOW | **Complexity**: SMALL

---

## C: Page-by-Page Improvements

### C1. Overview/Dashboard (`/dashboard`)
**Current Problems**:
- Stats grid cards are generic (big number + label + sublabel) — no visual distinctiveness
- "System Status" card uses a gradient that's disconnected from the other 3 cards
- Quick Actions buttons use page-specific colors (purple, orange, green) that don't work in dark mode
- Recent Activity list is a flat, unengaging list
- Storage Usage bar is tiny and hard to read
- Getting Started guide (when no devices) is an enormous gradient block

**Proposed Changes**:
- **Stats cards**: Add subtle gradient borders on hover, use consistent surface style, add trend sparklines (tiny inline charts using recharts)
- **System Status card**: Convert from gradient to surface card matching the other 3, use a green status dot instead of gradient for "Healthy"
- **Quick Actions**: Use consistent `var(--surface)` background with `var(--primary)` icon color for all 4 buttons. Remove page-specific color coding — the icon provides enough differentiation
- **Recent Activity**: Add content type indicators (colored left border per type), improve time formatting (relative: "2 min ago")
- **Storage Usage**: Make the progress bar taller (h-2 to h-3), add color change at thresholds (green < 50%, yellow < 80%, red > 80%)
- **Getting Started**: Reduce to a compact horizontal stepper with checkmarks, not a full-page gradient block
- **Priority**: HIGH | **Complexity**: MEDIUM

### C2. Devices (`/dashboard/devices`)
**Current Problems**:
- Header area has title + real-time badge + description + CTA — 4 elements competing for attention
- Device Groups filter is a collapsible section that's easy to miss
- Table has 7 columns — too many for comfortable reading, especially "Device ID" which is developer-facing
- Action buttons (Preview, Edit, Pair, Delete) are text links that look like navigation, not actions
- Bulk action bar appears above the table and pushes content down
- Pagination is overly complex (page numbers + per-page selector + showing X-Y of Z)

**Proposed Changes**:
- **Header**: Combine title + badge inline, move search into the header bar, keep CTA
- **Device Groups**: Move to a horizontal filter chip row (like Content's type filters) instead of hidden collapsible
- **Table**: Remove "Device ID" column (show on hover/detail). Consolidate to 5 columns: Checkbox, Device (name + location combined), Status, Playlist, Actions
- **Actions**: Replace text links with IconButton components (icon-only, tooltip on hover)
- **Bulk actions**: Move to a sticky bottom bar that slides up when items are selected
- **Pagination**: Simplify to "Showing 1-10 of 50 | Prev | Next" — remove individual page buttons
- **Priority**: HIGH | **Complexity**: MEDIUM

### C3. Templates (`/dashboard/templates`)
**Current Problems**:
- Featured carousel scrollbar is barely visible
- Active filter pills have low contrast (#00E5A0/10 on light backgrounds)
- Category sidebar overlaps with main content on medium screens
- Card hover inconsistency (carousel cards vs grid cards use different effects)
- Templates showing "Bad Request" error displays as raw text

**Proposed Changes**:
- **Carousel**: Replace thin scrollbar with arrow navigation buttons + fade edges (gradient overlay on left/right edges to indicate scroll)
- **Filter pills**: Increase opacity to `/20` and add border: `border border-[var(--primary)]/30`
- **Category sidebar**: Convert to horizontal scrollable chip row on screens < lg, sidebar on lg+
- **Card hovers**: Unify to consistent hover effect: `translateY(-2px)` + shadow increase
- **Error state**: Create proper error card component with retry button and friendly messaging
- **Priority**: MEDIUM | **Complexity**: SMALL

### C4. Widgets (`/dashboard/widgets`)
**Current Problems**:
- Widget gallery cards use emoji placeholders (clipboard emoji) instead of proper icons
- Create wizard modal step indicator is just text ("Step 1 of 3")
- Config fields are dynamically rendered with inconsistent spacing
- Widget preview doesn't match the final widget styling
- No widget search/filter

**Proposed Changes**:
- **Gallery cards**: Replace emoji with proper `Icon` components matching widget type
- **Step indicator**: Add `Stepper` component (already exists in ui/) to show wizard progress visually
- **Config fields**: Standardize field spacing with a form layout component
- **Widget preview**: Style preview to match actual widget rendering more closely
- **Search**: Add SearchFilter at top for users with many widgets
- **Priority**: MEDIUM | **Complexity**: SMALL

### C5. Layouts (`/dashboard/layouts`)
**Current Problems**:
- Layout preset grid uses 5 columns on xl — too many, cards are tiny
- Preview grids are only h-24 (96px) — too small to read zone labels
- "Use Preset" appears redundantly (on card and in modal)
- Zone colors are hardcoded and don't relate to any semantic meaning

**Proposed Changes**:
- **Preset grid**: Reduce to max 4 columns, increase card size
- **Preview size**: Increase to h-36 (144px) minimum, make zone labels readable
- **De-duplicate**: Remove redundant "Use Preset" button — make the whole card clickable
- **Zone colors**: Use primary palette variants (primary/100, primary/200, etc.) instead of random colors
- **Priority**: LOW | **Complexity**: SMALL

### C6. Playlists (`/dashboard/playlists`)
**Current Problems**:
- Playlist cards are HIGH density: title + description + 4 metric pills + active badge + device badge + content preview list + 5 action buttons = way too much
- 5 action buttons per card (Preview, Edit, Publish, Duplicate, Delete) create visual noise
- Thumbnail grid (2x2) loads slowly and shifts layout
- Drag-and-drop builder has no visual drop indicators

**Proposed Changes**:
- **Card simplification**: Remove inline content preview. Show only: thumbnail/icon, title, item count badge, active status badge. Move actions to a kebab (three-dot) menu
- **Action consolidation**: Show 2 primary actions (Edit, Preview) + kebab menu for rest
- **Thumbnail**: Use a single representative image or gradient placeholder instead of 2x2 grid
- **Builder modal**: Add dashed-border drop zones with "Drop here" text, highlight active drop target
- **Priority**: HIGH | **Complexity**: MEDIUM

### C7. Schedules (`/dashboard/schedules`)
**Current Problems**:
- Modal form has 9+ fields in a single scrollable area — overwhelming
- Day selector and device/group checkboxes are cramped
- Calendar view is functional but visually plain
- "Next occurrences" preview uses random purple background that doesn't match theme
- Conflict warnings are easy to miss (small yellow text)

**Proposed Changes**:
- **Modal form**: Split into 2 steps — Step 1: When (time, days, timezone), Step 2: What & Where (playlist, devices)
- **Day selector**: Use pill-style buttons with clear active/inactive states
- **Calendar**: Add color-coded schedule blocks, improve today indicator
- **Next occurrences**: Use `var(--info)` background instead of purple
- **Conflict warnings**: Use a proper warning banner with `var(--warning)` color and an alert icon
- **Priority**: MEDIUM | **Complexity**: MEDIUM

### C8. Analytics (`/dashboard/analytics`)
**Current Problems**:
- KPI cards all look identical — no visual hierarchy indicating which metrics matter most
- Chart loading causes layout shift (spinner to chart)
- Export CSV button is visually buried
- Charts use default Recharts styling that may not match Electric Horizon theme

**Proposed Changes**:
- **KPI cards**: Add subtle left-border color coding matching the metric type (devices=primary, content=info, storage=warning, uptime=success)
- **Chart loading**: Use chart-shaped skeletons instead of spinners
- **Export button**: Style as a secondary button with download icon, place prominently in header
- **Chart colors**: Ensure all charts use the Electric Horizon palette (primary green, info cyan, warning amber, etc.)
- **Priority**: LOW | **Complexity**: SMALL

### C9. Settings (`/dashboard/settings`)
**Current Problems**:
- Long vertical scroll with 7 sections — no way to jump to a section
- Account Actions (change password, export data, delete account) are all styled as navigation links but behave as modals/actions
- Timezone dropdown has 400+ options with no search
- Color preview grid is cramped

**Proposed Changes**:
- **Navigation**: Add a sticky sidebar or tab navigation for settings sections
- **Account Actions**: Style destructive actions (delete account) with clear visual warning (red border, danger icon)
- **Timezone**: Replace `<select>` with a searchable combobox
- **Color preview**: Increase swatch size, add labels
- **Priority**: LOW | **Complexity**: SMALL

---

## D: Content Page Deep Dive

The Content page is the most problematic page in the dashboard. Here's a detailed breakdown:

### D1. Current Layout (Top to Bottom)
1. **Folder sidebar** (w-64, left panel) — always visible, takes 256px
2. **Page header** — "Content Library" h2 + item count + realtime status + view toggle + upload button
3. **Search filter** — full-width input + result count
4. **Tag filter** — collapsible card with tags
5. **Type filter tabs** — All/Image/Video/PDF/URL + counts + advanced toggle + clear all
6. **Advanced filters** (expandable) — Status dropdown + Date range dropdown
7. **Active filter indicators** — colored pills showing active filters
8. **Folder breadcrumb** — navigation path
9. **Bulk action toolbar** (conditional) — selection count + move/delete buttons
10. **Content grid/list** — actual content

**That's 9-10 UI sections before the user even sees their content!** This is the core problem.

### D2. Specific Issues
- **Vertical congestion**: The filter stack takes ~300-400px of vertical space before content appears
- **Folder sidebar + page padding**: Content area is already narrowed by 256px sidebar + 24px padding on each side
- **Duplicate filtering paradigms**: Tags, Type tabs, Advanced filters, and Search all do filtering but are visually disconnected
- **Type filter counts** recalculate on the unfiltered set, which is confusing when other filters are active
- **View toggle** (grid/list) is in the header — far from the content it controls
- **Upload button** styling (`bg-[#00E5A0] text-[#061A21]` with `text-white` Icon) has a color conflict
- **Card grid** action buttons (Push, Playlist, Edit, Delete) take up too much card space with a 2x2 button grid
- **List view** action buttons are tiny icon links that are hard to click
- **Status badges** on cards use hardcoded light-mode colors (`bg-green-100`, `bg-yellow-100`, `bg-red-100`)

### D3. Proposed New Layout

```
+---Folder Sidebar (w-56)---+---Main Content Area-------------------------------------------+
|                            |                                                               |
| [folder tree]              | Content Library [42]         [search input] [upload btn]      |
|                            |                                                               |
|                            | All | Images (12) | Videos (8) | PDFs (5) | URLs (17)         |
|                            | Home > Marketing > Summer Campaign                            |
|                            |                                                               |
|                            | [content grid / list with cards]                              |
|                            |                                                               |
|                            | [...more content...]                                          |
|                            |                                                               |
+----------------------------+---------------------------------------------------------------+
```

**Key structural changes**:
1. **Merge header + search + CTA into one compact bar**: Title + badge count on left, search in center, upload button on right — all on one line
2. **Flatten type filters into a tab bar**: Directly below the header, no card wrapper, no advanced toggle
3. **Remove the tag filter section entirely from the main flow**: Move to a slide-out filter panel (drawer from right) that includes tags, status, date range, and any other advanced filters. Trigger via a "Filter" icon button in the header bar
4. **Remove active filter indicators as a separate section**: Show as dismissible chips inline within the tab bar area
5. **Keep folder breadcrumb** but make it more compact (smaller text, integrated with folder sidebar context)
6. **Move bulk actions to a sticky bottom bar**: When items are selected, a bar slides up from the bottom with selection count and actions — doesn't push content down

**Result**: Content appears after just ~120px of header/tabs (down from ~350-400px)

### D4. Card Improvements (Grid View)
- **Reduce action buttons**: Show only "Preview" on hover overlay. Move Edit, Push, Playlist, Delete to a kebab (three-dot) context menu
- **Status badge**: Move from card image overlay to a small dot indicator on the card
- **Checkbox**: Show only on hover (like Google Photos)
- **Card size**: Increase thumbnail area (h-48 to h-52), reduce info padding
- **Hover state**: Overlay with Preview icon + context menu trigger

### D5. List View Improvements
- **Combine thumbnail + title into a single compact row**
- **Convert action icon links to a single kebab menu** (click to reveal dropdown)
- **Add column resize capability** or at minimum remove unnecessary columns
- **Status**: Use the Badge component (already exists) instead of inline styled spans

### D6. Upload Modal Improvements
- **Drag-and-drop zone**: Make it larger and more prominent (the main visual when modal opens, not tucked below form fields)
- **Put drag zone FIRST**, then title + type fields below
- **Upload queue**: Show as a sidebar panel within the modal, not stacked below the drag zone
- **Progress**: Use the Progress component (from ui/) instead of text-based status

---

## E: Implementation Batches

### Batch 1: Design Tokens & Global Component Fixes
**Scope**: Foundation work that all other batches depend on
**Estimated files**: ~20-25 files

1. **Replace font**: Swap Space Grotesk for Plus Jakarta Sans (or Outfit) in `layout.tsx` and tailwind config
2. **Extend CSS variables**: Ensure `var(--primary)`, `var(--success)`, `var(--warning)`, `var(--error)`, `var(--info)` work with actual Tailwind utility classes by adding them to tailwind config as color values
3. **Fix shared components**:
   - Update `Button.tsx` to use CSS variable colors instead of hardcoded hex
   - Update `Modal.tsx` to add `max-h-[85vh] overflow-y-auto` to modal body
   - Update `Badge.tsx` — already good, ensure it's used everywhere
   - Create `TableSkeleton`, `CardGridSkeleton`, `StatsGridSkeleton` components
   - Create `FilterDrawer` component (slide-out panel for advanced filters)
4. **Fix globals.css**: Ensure all `.eh-*` utility classes use CSS variables, not hardcoded hex
5. **Fix dark mode**: Audit all `bg-{color}-50`, `text-{color}-600` patterns and add `dark:` variants or replace with CSS variables

### Batch 2: High-Impact Page Restructuring
**Scope**: Content, Overview, Devices — the 3 most-used pages
**Estimated files**: ~10-15 files

1. **Content page**: Implement the restructured layout from Section D
   - Compact header bar with inline search
   - Flat tab bar for type filters
   - Filter drawer for advanced filters
   - Simplified cards with hover actions
   - Sticky bottom bulk action bar
2. **Overview/Dashboard page**:
   - Normalize stat cards (remove gradient, add sparklines)
   - Fix Quick Actions dark mode
   - Improve Recent Activity with type indicators
   - Compact Getting Started stepper
3. **Devices page**:
   - Compact header with inline search
   - Horizontal group filter chips
   - Simplified table columns
   - IconButton actions
   - Simplified pagination

### Batch 3: Remaining Page Restructuring
**Scope**: Templates, Widgets, Layouts, Playlists, Schedules, Analytics, Settings
**Estimated files**: ~15-20 files

1. **Templates**: Fix carousel, unify card hovers, responsive category navigation
2. **Widgets**: Replace emoji icons, add Stepper wizard, add search
3. **Layouts**: Improve preset grid sizing and zone previews
4. **Playlists**: Simplify cards, consolidate actions into kebab menu, fix builder DnD
5. **Schedules**: Split modal into steps, improve day selector, fix color inconsistencies
6. **Analytics**: Add KPI card differentiation, chart skeletons, themed chart colors
7. **Settings**: Add section navigation, fix timezone search, improve account actions

### Batch 4: Interaction Polish & Sidebar
**Scope**: Animation, transitions, loading states, responsive behavior, sidebar restructure
**Estimated files**: ~15-20 files

1. **Sidebar restructure**: Widen, add section grouping, improve active states
2. **Page transitions**: Add framer-motion `AnimatePresence` for route changes
3. **Staggered reveals**: Add staggered fade-in for card grids and table rows
4. **Skeleton loading**: Replace all LoadingSpinner usage with page-appropriate skeletons
5. **Hover/focus states**: Audit every interactive element for proper hover, active, and focus states
6. **Smooth transitions**: Ensure all color/background transitions use `var(--transition-fast)`
7. **Login/Register pages**: Apply Electric Horizon styling (subtle background texture, better card design)
8. **Responsive polish**: Test all pages at mobile, tablet, desktop breakpoints; fix wrapping issues

---

## Design Principles Applied (from frontend-design plugin)

| Principle | Application |
|-----------|-------------|
| **Bold aesthetic direction** | "Electric Horizon" — deep teal, neon green, warm cream. Execute with precision, not just color swaps |
| **Distinctive typography** | Replace generic Space Grotesk with characterful alternative |
| **Color dominance** | Neon green (#00E5A0) as dominant accent, everything else neutral. Stop using 6 different button colors |
| **Motion for delight** | Staggered reveals on page load, smooth hover transitions, skeleton shimmer |
| **Spatial composition** | De-congest Content page, widen sidebar, add breathing room everywhere |
| **Backgrounds & depth** | Use subtle surface layering (surface > surface-secondary > background) for visual depth instead of flat cards |
| **Avoid generic patterns** | Replace standard table/card patterns with the Electric Horizon aesthetic (neon glow accents, teal depth) |

---

## What We Are NOT Changing

- No functionality changes — purely visual/UX
- Brand identity stays: dark theme + green accents + warm cream
- No features removed — reorganized and improved
- No component API changes — internal styling only
- All existing routes and navigation structure preserved
- Both light and dark mode supported (with dark mode improvements)
