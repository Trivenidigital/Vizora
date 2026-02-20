# Template Admin CRUD Design

**Date:** 2026-02-19
**Status:** Approved
**Scope:** Admin-only CRUD for the global template library

## Problem

The templates section is a read-only library. Admins cannot create, edit, or delete templates through the UI. Templates can only be added via seed scripts. There are no management controls.

## Design Decisions

- **Target user:** Admin-only. Non-admins see no changes to the current browse/clone experience.
- **Editor type:** Code editor (CodeMirror) for Handlebars HTML with live preview.
- **Operations:** Simple CRUD + metadata editing. No bulk operations or import/export.
- **UI location:** Inline on existing pages. Admin controls appear on the browse page and detail page.

## Browse Page Changes (`/dashboard/templates`)

Admin-only additions:
- **"Create Template" button** in the page header (top-right). Navigates to `/dashboard/templates/new`.
- **Three-dot action menu** on each template card (top-right corner). Options: "Edit" (navigates to detail page in edit mode), "Delete" (confirmation modal).

Non-admins see zero changes.

## Detail Page Edit Mode (`/dashboard/templates/[id]`)

### View Mode (default)
Same as today, plus an **"Edit Template"** button for admins in the header.

### Edit Mode (toggled by "Edit Template" button)

**Left side transforms:**
- Name becomes an editable text input
- Description becomes an editable textarea
- Code editor panel (CodeMirror) appears below the preview showing `templateHtml` (Handlebars)
- Preview iframe updates live as HTML is edited
- "Preview" button re-renders with sample data

**Right side transforms:**
- Template Details card: category dropdown, difficulty dropdown, orientation dropdown (all editable)
- Template Variables card: add/remove/edit variable definitions
- Sample Data card: editable JSON textarea
- Tags: editable chip input (add/remove)

**Actions (sticky footer or header):**
- "Save Changes" (PATCH)
- "Cancel" (discard, return to view mode)
- "Delete Template" (red, confirmation modal)

## Create Page (`/dashboard/templates/new`)

Same layout as edit mode with empty fields. "Save" calls POST instead of PATCH. No "Delete" button.

## Backend API

All new endpoints are admin-only (`@Roles('admin')`).

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/template-library` | Create new template |
| PATCH | `/template-library/:id` | Update template |
| DELETE | `/template-library/:id` | Soft-delete (set `status: 'archived'`) |

### POST /template-library (Create)

**Body:**
```typescript
{
  name: string;           // required
  description?: string;
  templateHtml: string;   // required, Handlebars HTML
  category: TemplateCategory; // required
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  orientation: 'landscape' | 'portrait' | 'both';
  tags?: string[];
  sampleData?: Record<string, any>;
  thumbnailUrl?: string;
  duration?: number;
}
```

Creates a Content record with `isGlobal: true`, `type: 'template'`, `status: 'active'`.

### PATCH /template-library/:id (Update)

**Body:** Partial of create body (all fields optional).

Updates the Content record and its JSONB metadata. Returns updated template.

### DELETE /template-library/:id (Soft Delete)

Sets `status: 'archived'`. Preserves DB integrity — cloned content still references the original. Returns `{ success: true }`.

### DTOs

- `CreateTemplateDto` — class-validator decorated, all validations
- `UpdateTemplateDto` — PartialType of CreateTemplateDto

## Data Model

No schema changes required. Templates use the existing `Content` model with:
- `isGlobal: true`
- `type: 'template'`
- Rich metadata in JSONB `metadata` field

## Thumbnail

Admin pastes a URL for the thumbnail. No file upload in v1.

## Out of Scope

- File upload for thumbnails
- Visual drag-and-drop builder
- Bulk import/export
- Community template submissions
- Template versioning/rollback
- Template approval workflows
- Template analytics
