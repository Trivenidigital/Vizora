# Template Overhaul Plan — 2026-02-26

## Overview

Replace all 75+ templates with OptiSigns-level visual quality and fix the broken template editor so users can customize templates through a hybrid WYSIWYG experience.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Editor UX | Hybrid (inline edit + property panel) | Double-click for quick text editing, property panel for precise styling |
| Template markup | `data-editable` only (no Handlebars) | Simpler, works directly with visual editor |
| Thumbnails | Puppeteer auto-generation | Every template gets a high-quality preview |
| Storage format | Standalone `.html` files | Easier to edit, preview in browser, version control |

## Current State

### Template System
- 79 templates across 7 categories in TypeScript seed files
- Two parallel seeding systems (middleware Handlebars + restaurant data-editable)
- No Puppeteer — thumbnails manually provided or missing
- Quality score: **4.3/10** average against OptiSigns standard

### Template Editor
- Visual editor exists (iframe + postMessage + property panel)
- "Use Template" clones but never opens editor (3-step detour)
- No inline contenteditable editing
- Save flow calls wrong API endpoint
- Serialize timeout fails silently

---

## Work Stream A: Fix Template Editor

### A1. Fix "Use Template" Flow

**Current**: Use Template → clone → redirect to `/dashboard/content` (wrong)
**Target**: Use Template → clone → redirect to `/dashboard/templates/{clonedId}/edit`

**Files to change:**
- `web/src/app/dashboard/templates/page.tsx` — `handleCloneConfirm()` redirect target
- No backend changes needed

### A2. Add Inline Contenteditable (Hybrid Mode)

**Behavior:**
- Single-click on `data-editable` element → select it (blue outline, property panel opens)
- Double-click on `data-editable` text element → activate contenteditable inline
- Click elsewhere → deactivate contenteditable, keep selection
- Elements WITHOUT `data-editable="true"` are not interactive

**Files to change:**
- `web/src/components/template-editor/TemplateEditorCanvas.tsx` — editor runtime:
  - Filter clicks to only `data-editable="true"` elements
  - Add double-click handler for contenteditable activation
  - Add hover indicator (dashed outline) for editable elements
  - Track contenteditable state

### A3. Add Floating Mini-Toolbar

**Appears when**: text element is selected (single or double click)
**Controls**: Bold, Italic, Font Size dropdown, Color picker, Text Align (L/C/R)
**Position**: Above selected element, within iframe

**Files to create:**
- `web/src/components/template-editor/FloatingToolbar.tsx` — toolbar UI component

**Files to change:**
- `web/src/components/template-editor/TemplateEditorCanvas.tsx` — inject toolbar into iframe
- `web/src/app/dashboard/templates/[id]/edit/page-client.tsx` — toolbar state management

### A4. Fix Save Flow

**Current bug**: "Save as Draft" calls `publishTemplate()` with empty displayIds
**Fix**: Create dedicated save endpoint or use existing `updateTemplate()`

**Files to change:**
- `web/src/app/dashboard/templates/[id]/edit/page-client.tsx` — save handler
- `web/src/lib/api.ts` — add `saveTemplateEdit()` method if needed
- `middleware/src/modules/template-library/template-library.controller.ts` — verify PATCH endpoint works for org-scoped templates

### A5. Fix Serialize Timeout

**Current bug**: Returns empty string on 5s timeout, no error
**Fix**: Reject promise on timeout, show error toast

**Files to change:**
- `web/src/components/template-editor/TemplateEditorCanvas.tsx` — serialize() method

### A6. Editor Polish

- Property panel: add Bold/Italic toggle buttons to TextProperties
- Error handling: image upload failures, network errors
- Validation: prevent saving empty HTML

---

## Work Stream B: Replace All 75 Templates

### File Structure

```
templates/seed/
├── restaurant/
│   ├── 01-daily-specials.html
│   ├── 02-full-menu.html
│   ├── ... (12 total)
│   └── thumbnails/
├── retail/
│   ├── 01-big-sale.html
│   ├── ... (15 total)
│   └── thumbnails/
├── general/
│   ├── 01-building-directory.html
│   ├── ... (12 total)
│   └── thumbnails/
├── corporate/
│   ├── 01-welcome-screen.html
│   ├── ... (12 total)
│   └── thumbnails/
├── education/
│   ├── 01-campus-announcement.html
│   ├── ... (8 total)
│   └── thumbnails/
├── healthcare/
│   ├── 01-wayfinding-directory.html
│   ├── ... (8 total)
│   └── thumbnails/
├── events/
│   ├── 01-event-announcement.html
│   ├── ... (8 total)
│   └── thumbnails/
├── seed-all-templates.ts          # Unified seed script
└── generate-thumbnails.ts         # Puppeteer thumbnail generator
```

### Template HTML Skeleton

Every template follows this structure:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1920, height=1080">
  <link href="https://fonts.googleapis.com/css2?family=..." rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { width:1920px; height:1080px; overflow:hidden; position:relative; }
    /* 3+ gradient layers */
    /* Decorative CSS elements */
    /* Glass-morphism cards */
    /* CSS patterns/textures */
    /* Typography hierarchy */
  </style>
</head>
<body>
  <!-- Background + decorative layers -->
  <!-- Inline SVG decorations -->
  <!-- Content with data-editable attributes -->
  <h1 data-editable="true" data-field="title">Sample Title</h1>
  <!-- NO JavaScript, NO external images -->
</body>
</html>
```

### 10 CSS Quality Rules (enforced)

1. Multi-layer backgrounds (3+ gradient layers)
2. Decorative CSS elements (glowing circles, ornamental lines)
3. Typography mixing (2-3 Google Fonts, heading 72-120px, body 24-32px)
4. Depth via shadows + glass-morphism (backdrop-filter:blur)
5. Inline SVG decorations (geometric patterns, ornamental shapes)
6. CSS patterns/textures (dot grids, stripes, noise)
7. Large emoji as graphics (100-200px with drop-shadow)
8. Magazine/editorial layouts (CSS Grid, NOT centered stacks)
9. Rich color palettes (4-6 colors per template)
10. Store test (would a business owner proudly display this?)

### Category Counts

| Category | Templates | Featured |
|----------|-----------|----------|
| Restaurant | 12 | 2 |
| Retail | 15 | 3 |
| General | 12 | 2 |
| Corporate | 12 | 2 |
| Education | 8 | 1 |
| Healthcare | 8 | 1 |
| Events | 8 | 1 |
| **Total** | **75** | **12** |

### Unified Seed Script

- Reads `.html` files from `/templates/seed/{category}/`
- Creates Content records with type='template', isGlobal=true
- Metadata: category, libraryTags, difficulty, orientation, sampleData
- Flags: `--clear` (delete all library templates first), `--category=X` (seed single category)
- Replaces both existing seed scripts

### Puppeteer Thumbnail Generator

- Script: `templates/seed/generate-thumbnails.ts`
- Launches headless Chromium
- Renders each `.html` at 1920×1080 viewport
- Screenshots → Sharp resize to 400×225 → save as PNG
- Output: `templates/seed/{category}/thumbnails/{name}.png`
- Seed script references these paths as previewImageUrl

---

## Execution Order

1. **A1-A5**: Fix editor bugs (Use Template flow, contenteditable, save, serialize)
2. **A3**: Add floating toolbar
3. **A6**: Editor polish
4. **B - Restaurant**: Generate 12 templates + seed + thumbnails
5. **B - Retail**: Generate 15 templates + seed + thumbnails
6. **B - General**: Generate 12 templates + seed + thumbnails
7. **B - Corporate**: Generate 12 templates + seed + thumbnails
8. **B - Education**: Generate 8 templates + seed + thumbnails
9. **B - Healthcare**: Generate 8 templates + seed + thumbnails
10. **B - Events**: Generate 8 templates + seed + thumbnails
11. **Verification**: Full quality pass on all 75 templates + editor flow

---

## Hard Rules

- NO JavaScript in template HTML
- NO external image URLs
- NO single flat gradients — minimum 3 layers
- NO centered-text-on-gradient layouts
- EVERY editable element: `data-editable="true" data-field="name"`
- Template HTML: self-contained (embedded styles, inline fonts)
- Google Fonts with system font fallbacks
- Resolution: 1920×1080 (landscape) or 1080×1920 (portrait)
- Each template within a category must be visually DISTINCT
