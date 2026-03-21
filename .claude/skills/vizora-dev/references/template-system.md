# Template System

## Overview

Vizora has two template subsystems:

1. **Template Library** (middleware seeded) -- pre-built Handlebars templates stored in the database
2. **Visual Template Editor** (web dashboard) -- iframe-based WYSIWYG editor for customizing templates

## Template Data Model

Templates live in the `Content` model with `type: 'template'` or via the dedicated template-library module.

Key fields:
- `templateHtml` -- Handlebars HTML source (exempted from XSS sanitization)
- `sampleData` -- JSON object with placeholder values for preview
- `category` -- one of: retail, restaurant, corporate, education, healthcare, events, general, indian
- `difficulty` -- beginner, intermediate, advanced
- `orientation` -- landscape, portrait, both
- `libraryTags` -- array of string tags for search
- `thumbnailUrl` -- URL to generated thumbnail image
- `duration` -- display duration in seconds (1-300)
- `isFeatured` -- boolean for homepage showcase

## Template Categories and Counts

| Category | Count | Source File |
|----------|-------|-------------|
| Retail | 15 | `middleware/src/modules/template-library/seed/_retail-restaurant.ts` |
| Restaurant | 12 | `middleware/src/modules/template-library/seed/_retail-restaurant.ts` |
| Corporate | 12 | `middleware/src/modules/template-library/seed/_corporate-education.ts` |
| Education | 8 | `middleware/src/modules/template-library/seed/_corporate-education.ts` |
| Healthcare | 8 | `middleware/src/modules/template-library/seed/_healthcare-events.ts` |
| Events | 8 | `middleware/src/modules/template-library/seed/_healthcare-events.ts` |
| General | 12 | `middleware/src/modules/template-library/seed/_general.ts` |
| Indian | 12 | `templates/seed/indian/` (HTML files + seed-all-templates.ts) |
| **Total** | **87** | |

## Indian Cuisine Templates (12)

Located in `templates/seed/indian/`:
1. South Indian Tiffin (breakfast menu, brass/banana-leaf aesthetic)
2. Dosa Varieties (crispy dosa menu, tawa-inspired)
3. South Indian Meals (banana leaf thali, temple-town aesthetic)
4. Filter Coffee & Snacks (coffee house, evening tiffin)
5. Weekly Lunch Specials (daily rotating, temple-town design)
6. Chettinad & Kerala Specials (spicy non-veg, coastal)
7. South Indian Sweets (festive sweet shop, rangoli-inspired)
8. South Indian Combos (value meals, canteen feel)
9. Tandoor & Kebab (smoky tandoor, Mughal arch design) -- featured
10. Dum Biryani (Hyderabadi, saffron/Mughal aesthetic)
11. Chaat & Street Food (vibrant street food, market energy)
12. Sweets & Mithai (North Indian mithai, festive gold)

## Template Rendering Pipeline

### Server-side (Preview API)
```
GET /api/v1/template-library/:id/preview
  -> TemplateLibraryService.getPreview(id)
  -> Handlebars.compile(template.templateHtml)
  -> compiled(template.sampleData)
  -> Returns { html: renderedString }
```

### Client-side (Live Preview in Editor)
```
TemplateEditor component (CodeMirror for HTML editing)
  -> User edits HTML in CodeMirror editor
  -> Clicks "Preview" button
  -> Client-side Handlebars.compile(templateHtml)(sampleData)
  -> Rendered HTML displayed in preview panel
```

### Display Client Rendering
```
Device receives content via WebSocket
  -> If type is template: receives pre-compiled HTML
  -> Renders in webview/iframe
  -> No Handlebars on device -- server pre-compiles
```

## Template Seed System

Two parallel seed systems exist:

### 1. Middleware Seeds (NestJS command)
Located in `middleware/src/modules/template-library/seed/`:
- `seed-templates.command.ts` -- NestJS CLI command
- `template-seeds.ts` -- aggregates all category seeds
- `_retail-restaurant.ts` -- 15 retail + 12 restaurant templates
- `_corporate-education.ts` -- 12 corporate + 8 education
- `_healthcare-events.ts` -- 8 healthcare + 8 events
- `_general.ts` -- 12 general purpose

These templates have inline Handlebars HTML in TypeScript files.

### 2. HTML File Seeds (templates/ directory)
Located in `templates/seed/`:
- 8 category directories with standalone HTML files
- `seed-all-templates.ts` -- reads HTML files and seeds via API
- `generate-thumbnails.ts` -- uses Puppeteer to screenshot templates
- Each category dir has a `thumbnails/` subdir

The Indian cuisine templates use this system (HTML files, not inline).

## Visual Template Editor

### Architecture
The editor uses an iframe + postMessage architecture:

```
EditPageClient (page-client.tsx)
  |-- TemplateEditorCanvas (iframe with editor-runtime.js)
  |-- FloatingToolbar (text formatting controls)
  |-- PropertyPanel (element properties sidebar)
  |-- DisplayPickerModal (send to device)
  |-- useEditorHistory (undo/redo)
  |-- useCanvasZoom (zoom controls)
```

### How It Works
1. Template HTML loaded into an iframe
2. `editor-runtime.js` injected as IIFE into iframe
3. Runtime adds click handlers to all elements
4. On element click: postMessage sends element info to parent
5. Parent shows PropertyPanel with editable properties
6. Property changes sent back via postMessage to update element
7. FloatingToolbar provides text formatting (font size, color, alignment)

### Editor Components
- `TemplateEditorCanvas.tsx` -- iframe container, postMessage bridge
- `editor-runtime.js` -- IIFE running inside iframe (element selection, hover highlights, inline editing)
- `FloatingToolbar.tsx` -- floating text format bar (font size, colors, alignment)
- `PropertyPanel.tsx` -- right sidebar for selected element properties
- `TextProperties.tsx` -- text-specific property controls
- `ImageProperties.tsx` -- image-specific property controls
- `ContainerProperties.tsx` -- div/container property controls
- `DisplayPickerModal.tsx` -- modal to push template to device
- `useEditorHistory.ts` -- undo/redo stack
- `useCanvasZoom.ts` -- zoom level management, preset sizes

### Current Broken/Limited State

The template editor is **functional but limited**:

1. **Element support**: Only text (h1-h6, p, span, etc.), images, and containers (divs). No support for tables, lists, or custom widgets.

2. **No drag-and-drop repositioning**: Elements can only be edited in-place. Cannot reorder or move elements visually.

3. **No layer management**: No z-index control, no element tree/layer panel.

4. **No responsive preview**: Fixed canvas size (TEMPLATE_WIDTH x TEMPLATE_HEIGHT from useCanvasZoom). No breakpoint switching.

5. **No template marketplace/import**: Templates are seeded by admins only. No user-created template sharing.

6. **contenteditable quirks**: Inline text editing uses contenteditable which has known cross-browser inconsistencies.

7. **Property panel scope**: Limited style properties -- color, fontSize, fontFamily, fontWeight, textAlign, backgroundColor, borderRadius, padding, objectFit. Missing: margins, borders, shadows, transforms, animations.

8. **No undo persistence**: Undo/redo history is in-memory only, lost on page navigation.

### Code-Level Editor (TemplateEditor.tsx)
Separate from the visual editor. Located at `web/src/components/TemplateEditor.tsx`.
- CodeMirror 6 with HTML syntax highlighting
- Dark theme (oneDark)
- Two tabs: HTML code and Sample Data (JSON)
- Used in the "Create Template" page (`/dashboard/templates/new`)
- The visual editor is used in the "Edit Template" page (`/dashboard/templates/[id]/edit`)

## Template Library UI

### Components
- `TemplateHeroSearch.tsx` -- search bar with hero styling
- `TemplateSidebar.tsx` -- category filters, orientation, difficulty
- `TemplateCard.tsx` -- template preview card
- `TemplateCardSkeleton.tsx` -- loading skeleton
- `TemplateDetailModal.tsx` -- full preview with metadata
- `AIDesignerModal.tsx` -- AI template generation (placeholder/future)

### Dashboard Pages
- `/dashboard/templates` -- browsable library with sidebar filters
- `/dashboard/templates/new` -- create template (code editor, admin only)
- `/dashboard/templates/[id]` -- template detail view
- `/dashboard/templates/[id]/edit` -- visual WYSIWYG editor
