# Template Admin CRUD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add admin-only Create, Edit, and Delete operations to the template library — both backend API and dashboard UI.

**Architecture:** New POST/PATCH/DELETE endpoints in the existing `template-library` module. Frontend adds edit mode toggle on the detail page, a create page at `/dashboard/templates/new`, and admin action menus on the browse page. CodeMirror for HTML editing with live Handlebars preview.

**Tech Stack:** NestJS 11, Prisma, Next.js 16 (App Router), CodeMirror 6, Handlebars, Electric Horizon design system

---

### Task 1: Backend — Create DTOs

**Files:**
- Create: `middleware/src/modules/template-library/dto/create-template.dto.ts`
- Create: `middleware/src/modules/template-library/dto/update-template.dto.ts`
- Modify: `middleware/src/modules/template-library/dto/index.ts` (add exports)

**Step 1: Create CreateTemplateDto**

Create `middleware/src/modules/template-library/dto/create-template.dto.ts`:

```typescript
import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  IsInt,
  Min,
  Max,
  MinLength,
} from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MinLength(1)
  templateHtml: string;

  @IsEnum(['retail', 'restaurant', 'corporate', 'education', 'healthcare', 'events', 'general'])
  category: string;

  @IsOptional()
  @IsEnum(['beginner', 'intermediate', 'advanced'])
  difficulty?: string;

  @IsOptional()
  @IsEnum(['landscape', 'portrait', 'both'])
  orientation?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  sampleData?: Record<string, any>;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  duration?: number;
}
```

**Step 2: Create UpdateTemplateDto**

Create `middleware/src/modules/template-library/dto/update-template.dto.ts`:

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateTemplateDto } from './create-template.dto';

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}
```

**Step 3: Export from dto/index.ts**

Check if `middleware/src/modules/template-library/dto/index.ts` exists. If so, add exports for both new DTOs. If not, create it with all DTO exports:

```typescript
export { SearchTemplatesDto } from './search-templates.dto';
export { CloneTemplateDto } from './clone-template.dto';
export { CreateTemplateDto } from './create-template.dto';
export { UpdateTemplateDto } from './update-template.dto';
```

**Step 4: Verify compilation**

Run: `cd middleware && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to the new DTOs.

**Step 5: Commit**

```bash
git add middleware/src/modules/template-library/dto/
git commit -m "feat(template-library): add CreateTemplateDto and UpdateTemplateDto"
```

---

### Task 2: Backend — Add Service Methods (create, update, delete)

**Files:**
- Modify: `middleware/src/modules/template-library/template-library.service.ts`

**Step 1: Write failing tests for create/update/delete**

Add to `middleware/src/modules/template-library/template-library.service.spec.ts`:

```typescript
describe('createTemplate', () => {
  it('should create a global template with correct metadata', async () => {
    const dto = {
      name: 'Test Template',
      description: 'A test',
      templateHtml: '<h1>{{title}}</h1>',
      category: 'retail',
      difficulty: 'beginner',
      orientation: 'landscape',
      tags: ['sale', 'promo'],
      sampleData: { title: 'Hello' },
      duration: 15,
    };

    const created = makeTemplate({
      id: 'new-1',
      name: dto.name,
      description: dto.description,
      duration: dto.duration,
      templateOrientation: dto.orientation,
      metadata: {
        templateHtml: dto.templateHtml,
        isLibraryTemplate: true,
        category: dto.category,
        libraryTags: dto.tags,
        difficulty: dto.difficulty,
        isFeatured: false,
        sampleData: dto.sampleData,
        dataSource: { type: 'manual', manualData: dto.sampleData },
        refreshConfig: { enabled: false, intervalMinutes: 0 },
      },
    });

    mockDb.content.create.mockResolvedValue(created);
    mockTemplateRendering.processTemplate.mockReturnValue('<h1>Hello</h1>');

    const result = await service.createTemplate(dto);
    expect(result).toBeDefined();
    expect(result.name).toBe('Test Template');
    expect(mockDb.content.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Test Template',
          type: 'template',
          isGlobal: true,
        }),
      }),
    );
  });
});

describe('updateTemplate', () => {
  it('should update template name and metadata', async () => {
    const existing = makeTemplate({ id: 'tmpl-1' });
    mockDb.content.findFirst.mockResolvedValue(existing);
    mockDb.content.update.mockResolvedValue({ ...existing, name: 'Updated Name' });

    const result = await service.updateTemplate('tmpl-1', { name: 'Updated Name' });
    expect(result.name).toBe('Updated Name');
    expect(mockDb.content.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tmpl-1' },
      }),
    );
  });

  it('should throw NotFoundException for missing template', async () => {
    mockDb.content.findFirst.mockResolvedValue(null);
    await expect(service.updateTemplate('missing', { name: 'X' })).rejects.toThrow(NotFoundException);
  });
});

describe('deleteTemplate', () => {
  it('should soft-delete by setting status to archived', async () => {
    const existing = makeTemplate({ id: 'tmpl-1' });
    mockDb.content.findFirst.mockResolvedValue(existing);
    mockDb.content.update.mockResolvedValue({ ...existing, status: 'archived' });

    await service.deleteTemplate('tmpl-1');
    expect(mockDb.content.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tmpl-1' },
        data: expect.objectContaining({ status: 'archived' }),
      }),
    );
  });

  it('should throw NotFoundException for missing template', async () => {
    mockDb.content.findFirst.mockResolvedValue(null);
    await expect(service.deleteTemplate('missing')).rejects.toThrow(NotFoundException);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vizora/middleware test -- --testPathPattern=template-library.service`
Expected: FAIL — methods `createTemplate`, `updateTemplate`, `deleteTemplate` do not exist.

**Step 3: Implement service methods**

Add to `template-library.service.ts` (import `BadRequestException` alongside `NotFoundException`, import `Prisma` from `@vizora/database`, import `CreateTemplateDto` and `UpdateTemplateDto`):

```typescript
async createTemplate(dto: CreateTemplateDto): Promise<any> {
  // Build metadata
  const metadata: LibraryTemplateMetadata = {
    templateHtml: dto.templateHtml,
    isLibraryTemplate: true,
    category: dto.category,
    libraryTags: dto.tags || [],
    difficulty: dto.difficulty || 'beginner',
    isFeatured: false,
    sampleData: dto.sampleData,
    dataSource: {
      type: 'manual',
      manualData: dto.sampleData,
    },
    refreshConfig: {
      enabled: false,
      intervalMinutes: 0,
    },
  };

  if (dto.thumbnailUrl) {
    metadata.previewImageUrl = dto.thumbnailUrl;
  }

  // Try to render with sample data
  if (dto.sampleData) {
    try {
      const rendered = this.templateRendering.processTemplate(dto.templateHtml, dto.sampleData);
      metadata.renderedHtml = rendered;
      metadata.renderedAt = new Date().toISOString();
    } catch (error) {
      this.logger.warn(`Initial template render failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  // Use a system org ID for global templates — find any org or use a dedicated one
  const content = await this.db.content.create({
    data: {
      name: dto.name,
      description: dto.description || '',
      type: 'template',
      url: '',
      duration: dto.duration || 30,
      isGlobal: true,
      status: 'active',
      templateOrientation: dto.orientation || 'landscape',
      metadata: metadata as unknown as Prisma.InputJsonValue,
      organizationId: 'system', // Will be set by controller
    },
  });

  return this.mapToSummary(content);
}

async createTemplateForOrg(dto: CreateTemplateDto, organizationId: string): Promise<any> {
  // Build metadata
  const metadata: LibraryTemplateMetadata = {
    templateHtml: dto.templateHtml,
    isLibraryTemplate: true,
    category: dto.category,
    libraryTags: dto.tags || [],
    difficulty: dto.difficulty || 'beginner',
    isFeatured: false,
    sampleData: dto.sampleData,
    dataSource: {
      type: 'manual',
      manualData: dto.sampleData,
    },
    refreshConfig: {
      enabled: false,
      intervalMinutes: 0,
    },
  };

  if (dto.thumbnailUrl) {
    metadata.previewImageUrl = dto.thumbnailUrl;
  }

  // Try to render with sample data
  if (dto.sampleData) {
    try {
      const rendered = this.templateRendering.processTemplate(dto.templateHtml, dto.sampleData);
      metadata.renderedHtml = rendered;
      metadata.renderedAt = new Date().toISOString();
    } catch (error) {
      this.logger.warn(`Initial template render failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  const content = await this.db.content.create({
    data: {
      name: dto.name,
      description: dto.description || '',
      type: 'template',
      url: '',
      duration: dto.duration || 30,
      isGlobal: true,
      status: 'active',
      templateOrientation: dto.orientation || 'landscape',
      metadata: metadata as unknown as Prisma.InputJsonValue,
      organizationId,
    },
  });

  return this.mapToSummary(content);
}

async updateTemplate(id: string, dto: UpdateTemplateDto): Promise<any> {
  const template = await this.db.content.findFirst({
    where: { id, isGlobal: true, type: 'template' },
  });

  if (!template) {
    throw new NotFoundException(`Template ${id} not found`);
  }

  const existingMeta = (template.metadata as Record<string, unknown>) || {};

  // Build update data
  const data: Record<string, any> = {};
  if (dto.name !== undefined) data.name = dto.name;
  if (dto.description !== undefined) data.description = dto.description;
  if (dto.duration !== undefined) data.duration = dto.duration;
  if (dto.orientation !== undefined) data.templateOrientation = dto.orientation;

  // Update metadata fields
  const metadata = { ...existingMeta };
  if (dto.templateHtml !== undefined) metadata.templateHtml = dto.templateHtml;
  if (dto.category !== undefined) metadata.category = dto.category;
  if (dto.difficulty !== undefined) metadata.difficulty = dto.difficulty;
  if (dto.tags !== undefined) metadata.libraryTags = dto.tags;
  if (dto.sampleData !== undefined) {
    metadata.sampleData = dto.sampleData;
    metadata.dataSource = { type: 'manual', manualData: dto.sampleData };
  }
  if (dto.thumbnailUrl !== undefined) metadata.previewImageUrl = dto.thumbnailUrl;

  // Re-render if HTML or sample data changed
  const html = (dto.templateHtml || metadata.templateHtml) as string;
  const sampleData = (dto.sampleData || metadata.sampleData) as Record<string, any> | undefined;
  if ((dto.templateHtml !== undefined || dto.sampleData !== undefined) && html && sampleData) {
    try {
      metadata.renderedHtml = this.templateRendering.processTemplate(html, sampleData);
      metadata.renderedAt = new Date().toISOString();
    } catch (error) {
      this.logger.warn(`Template re-render failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  data.metadata = metadata as unknown as Prisma.InputJsonValue;

  const updated = await this.db.content.update({
    where: { id },
    data,
  });

  return this.mapToSummary(updated);
}

async deleteTemplate(id: string): Promise<void> {
  const template = await this.db.content.findFirst({
    where: { id, isGlobal: true, type: 'template' },
  });

  if (!template) {
    throw new NotFoundException(`Template ${id} not found`);
  }

  await this.db.content.update({
    where: { id },
    data: { status: 'archived' },
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @vizora/middleware test -- --testPathPattern=template-library.service`
Expected: All new tests PASS.

**Step 5: Commit**

```bash
git add middleware/src/modules/template-library/
git commit -m "feat(template-library): add create, update, delete service methods"
```

---

### Task 3: Backend — Add Controller Endpoints

**Files:**
- Modify: `middleware/src/modules/template-library/template-library.controller.ts`

**Step 1: Add POST, PATCH, DELETE endpoints**

Add imports for `CreateTemplateDto`, `UpdateTemplateDto`, `Delete`, `HttpStatus`, and `Patch` (some may already be imported). Add these methods to the controller:

```typescript
@Post()
@Roles('admin')
@HttpCode(HttpStatus.CREATED)
create(
  @CurrentUser('organizationId') organizationId: string,
  @Body() dto: CreateTemplateDto,
) {
  return this.templateLibraryService.createTemplateForOrg(dto, organizationId);
}

@Patch(':id')
@Roles('admin')
update(
  @Param('id') id: string,
  @Body() dto: UpdateTemplateDto,
) {
  return this.templateLibraryService.updateTemplate(id, dto);
}

@Delete(':id')
@Roles('admin')
@HttpCode(HttpStatus.NO_CONTENT)
remove(@Param('id') id: string) {
  return this.templateLibraryService.deleteTemplate(id);
}
```

**Step 2: Verify compilation**

Run: `cd middleware && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

**Step 3: Commit**

```bash
git add middleware/src/modules/template-library/template-library.controller.ts
git commit -m "feat(template-library): add POST/PATCH/DELETE controller endpoints"
```

---

### Task 4: Frontend — Add API Client Methods

**Files:**
- Modify: `web/src/lib/api.ts`

**Step 1: Add createTemplate, updateTemplate, deleteTemplate methods**

Add to the `ApiClient` class in `web/src/lib/api.ts`, near the existing template methods (around line 1254):

```typescript
// Create a new template (admin only)
async createTemplate(data: {
  name: string;
  description?: string;
  templateHtml: string;
  category: string;
  difficulty?: string;
  orientation?: string;
  tags?: string[];
  sampleData?: Record<string, any>;
  thumbnailUrl?: string;
  duration?: number;
}): Promise<any> {
  return this.request<any>('/template-library', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Update a template (admin only)
async updateTemplate(id: string, data: {
  name?: string;
  description?: string;
  templateHtml?: string;
  category?: string;
  difficulty?: string;
  orientation?: string;
  tags?: string[];
  sampleData?: Record<string, any>;
  thumbnailUrl?: string;
  duration?: number;
}): Promise<any> {
  return this.request<any>(`/template-library/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Delete a template (admin only)
async deleteTemplate(id: string): Promise<void> {
  await this.request<void>(`/template-library/${id}`, {
    method: 'DELETE',
  });
}
```

**Step 2: Verify build**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No type errors.

**Step 3: Commit**

```bash
git add web/src/lib/api.ts
git commit -m "feat(web): add template CRUD API client methods"
```

---

### Task 5: Frontend — Browse Page Admin Controls

**Files:**
- Modify: `web/src/app/dashboard/templates/page.tsx`

**Step 1: Add admin detection and state**

At the top of the component (near existing state declarations), add:

```typescript
import { useAuth } from '@/lib/hooks/useAuth';
// ... inside component:
const { user } = useAuth();
const isAdmin = user?.role === 'admin';
const [deleteModalId, setDeleteModalId] = useState<string | null>(null);
const [deleting, setDeleting] = useState(false);
```

**Step 2: Add "Create Template" button in header**

In the page header area (near the title/description), add a "Create Template" button visible only to admins:

```tsx
{isAdmin && (
  <Link href="/dashboard/templates/new"
    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition font-semibold shadow-md hover:shadow-lg text-sm">
    <Icon name="add" size="md" />
    Create Template
  </Link>
)}
```

**Step 3: Add action menu (three-dot) on template cards**

In the card rendering section (grid cards around lines 442-511), add admin-only action buttons in the top-right of each card:

```tsx
{isAdmin && (
  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
    <Link href={`/dashboard/templates/${template.id}?edit=true`}
      className="p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-md hover:bg-[var(--surface-hover)] transition"
      title="Edit template">
      <Icon name="edit" size="sm" className="text-[#00E5A0]" />
    </Link>
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteModalId(template.id); }}
      className="p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-md hover:bg-red-50 transition"
      title="Delete template">
      <Icon name="delete" size="sm" className="text-red-500" />
    </button>
  </div>
)}
```

Ensure the card's parent `<div>` or `<Link>` has `className="group relative ..."` for the hover reveal.

**Step 4: Add delete confirmation modal**

At the bottom of the component (before the closing fragment), add:

```tsx
{deleteModalId && (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !deleting && setDeleteModalId(null)} />
    <div className="relative bg-[var(--surface)] rounded-lg shadow-xl border border-[var(--border)] w-full max-w-sm mx-4 p-6 z-10">
      <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Delete Template</h3>
      <p className="text-sm text-[var(--foreground-secondary)] mb-6">
        Are you sure you want to delete this template? This action cannot be undone.
      </p>
      <div className="flex justify-end gap-3">
        <button onClick={() => setDeleteModalId(null)} disabled={deleting}
          className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition disabled:opacity-50">
          Cancel
        </button>
        <button onClick={async () => {
          try {
            setDeleting(true);
            await apiClient.deleteTemplate(deleteModalId);
            setDeleteModalId(null);
            // Refresh the list
            loadTemplates();
            loadFeatured();
          } catch (err: any) {
            setError(err.message || 'Failed to delete template');
          } finally {
            setDeleting(false);
          }
        }} disabled={deleting}
          className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2">
          {deleting ? <><LoadingSpinner size="sm" /> Deleting...</> : 'Delete'}
        </button>
      </div>
    </div>
  </div>
)}
```

**Step 5: Verify build**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No type errors.

**Step 6: Commit**

```bash
git add web/src/app/dashboard/templates/page.tsx
git commit -m "feat(web): add admin controls to templates browse page"
```

---

### Task 6: Frontend — Install CodeMirror

**Step 1: Install CodeMirror packages**

```bash
cd web && pnpm add @codemirror/view @codemirror/state @codemirror/lang-html @codemirror/theme-one-dark @codemirror/basic-setup
```

**Step 2: Commit**

```bash
git add web/package.json pnpm-lock.yaml
git commit -m "chore(web): install CodeMirror 6 for template editor"
```

---

### Task 7: Frontend — Create Template Editor Component

**Files:**
- Create: `web/src/components/TemplateEditor.tsx`

**Step 1: Create the TemplateEditor component**

This is a reusable component used by both the create page and the edit mode on the detail page.

```tsx
'use client';

import { useRef, useEffect, useState } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState } from '@codemirror/state';
import { Icon } from '@/theme/icons';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface TemplateEditorProps {
  initialHtml: string;
  sampleData: Record<string, any>;
  onHtmlChange: (html: string) => void;
  onSampleDataChange: (data: Record<string, any>) => void;
  onPreviewRequest: () => void;
  previewHtml?: string;
  previewLoading?: boolean;
}

export function TemplateEditor({
  initialHtml,
  sampleData,
  onHtmlChange,
  onSampleDataChange,
  onPreviewRequest,
  previewHtml,
  previewLoading,
}: TemplateEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [sampleDataText, setSampleDataText] = useState(JSON.stringify(sampleData, null, 2));
  const [sampleDataError, setSampleDataError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'html' | 'data'>('html');

  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: initialHtml,
      extensions: [
        basicSetup,
        html(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onHtmlChange(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': { height: '400px' },
          '.cm-scroller': { overflow: 'auto' },
        }),
      ],
    });

    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSampleDataChange = (text: string) => {
    setSampleDataText(text);
    try {
      const parsed = JSON.parse(text);
      setSampleDataError(null);
      onSampleDataChange(parsed);
    } catch {
      setSampleDataError('Invalid JSON');
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab('html')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'html'
              ? 'border-[#00E5A0] text-[#00E5A0]'
              : 'border-transparent text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'
          }`}
        >
          HTML Template
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'data'
              ? 'border-[#00E5A0] text-[#00E5A0]'
              : 'border-transparent text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'
          }`}
        >
          Sample Data
        </button>
      </div>

      {/* HTML editor */}
      {activeTab === 'html' && (
        <div className="border border-[var(--border)] rounded-lg overflow-hidden">
          <div ref={editorRef} />
        </div>
      )}

      {/* Sample data editor */}
      {activeTab === 'data' && (
        <div>
          <textarea
            value={sampleDataText}
            onChange={(e) => handleSampleDataChange(e.target.value)}
            rows={12}
            className="w-full px-4 py-3 font-mono text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
            placeholder='{"key": "value"}'
          />
          {sampleDataError && (
            <p className="mt-1 text-xs text-red-500">{sampleDataError}</p>
          )}
        </div>
      )}

      {/* Preview button */}
      <div className="flex justify-end">
        <button
          onClick={onPreviewRequest}
          disabled={previewLoading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition disabled:opacity-50"
        >
          {previewLoading ? <LoadingSpinner size="sm" /> : <Icon name="display" size="sm" />}
          Refresh Preview
        </button>
      </div>

      {/* Preview pane */}
      <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-white">
        {previewHtml ? (
          <iframe
            srcDoc={previewHtml}
            sandbox="allow-scripts"
            className="w-full border-0"
            style={{ minHeight: '400px' }}
            title="Template preview"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-[var(--foreground-tertiary)]">
            <Icon name="display" size="3xl" className="opacity-30 mb-3" />
            <p className="text-sm">Click "Refresh Preview" to see the template</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No type errors.

**Step 3: Commit**

```bash
git add web/src/components/TemplateEditor.tsx
git commit -m "feat(web): create TemplateEditor component with CodeMirror + live preview"
```

---

### Task 8: Frontend — Create Template Page (`/dashboard/templates/new`)

**Files:**
- Create: `web/src/app/dashboard/templates/new/page.tsx`

**Step 1: Create the page**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api';
import { Icon } from '@/theme/icons';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { TemplateEditor } from '@/components/TemplateEditor';
import Link from 'next/link';

const CATEGORIES = ['retail', 'restaurant', 'corporate', 'education', 'healthcare', 'events', 'general'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
const ORIENTATIONS = ['landscape', 'portrait', 'both'];

export default function CreateTemplatePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [difficulty, setDifficulty] = useState('beginner');
  const [orientation, setOrientation] = useState('landscape');
  const [tags, setTags] = useState('');
  const [templateHtml, setTemplateHtml] = useState('<div>\n  <h1>{{title}}</h1>\n  <p>{{description}}</p>\n</div>');
  const [sampleData, setSampleData] = useState<Record<string, any>>({ title: 'Sample Title', description: 'Sample description' });
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [duration, setDuration] = useState(30);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-2">Access Denied</h1>
        <p className="text-[var(--foreground-secondary)]">Only admins can create templates.</p>
        <Link href="/dashboard/templates" className="mt-4 text-[#00E5A0] hover:underline">
          Back to Templates
        </Link>
      </div>
    );
  }

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      // Client-side Handlebars rendering for instant preview
      const Handlebars = (await import('handlebars')).default;
      const compiled = Handlebars.compile(templateHtml);
      const rendered = compiled(sampleData);
      setPreviewHtml(rendered);
    } catch (err: any) {
      setPreviewHtml(`<div style="color: red; padding: 20px;">Preview error: ${err.message}</div>`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }
    if (!templateHtml.trim()) {
      setError('Template HTML is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const result = await apiClient.createTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        templateHtml,
        category,
        difficulty,
        orientation,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        sampleData: Object.keys(sampleData).length > 0 ? sampleData : undefined,
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        duration,
      });
      router.push(`/dashboard/templates/${result.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/templates"
            className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition text-[var(--foreground-secondary)]">
            <Icon name="chevron-left" size="md" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Create Template</h1>
            <p className="text-sm text-[var(--foreground-secondary)]">Add a new template to the global library</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/templates"
            className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition">
            Cancel
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition disabled:opacity-50">
            {saving ? <><LoadingSpinner size="sm" /> Saving...</> : 'Save Template'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">Template Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-[var(--foreground)] bg-[var(--background)]"
              placeholder="e.g., Flash Sale Banner" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-[var(--foreground)] bg-[var(--background)]"
              placeholder="Brief description of this template..." />
          </div>

          {/* Code editor + preview */}
          <TemplateEditor
            initialHtml={templateHtml}
            sampleData={sampleData}
            onHtmlChange={setTemplateHtml}
            onSampleDataChange={setSampleData}
            onPreviewRequest={handlePreview}
            previewHtml={previewHtml}
            previewLoading={previewLoading}
          />
        </div>

        {/* Right column — metadata */}
        <div className="space-y-4">
          <div className="bg-[var(--surface)] rounded-lg shadow border border-[var(--border)] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wider">Metadata</h3>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">Category *</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent">
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>

            {/* Orientation */}
            <div>
              <label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">Orientation</label>
              <select value={orientation} onChange={(e) => setOrientation(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent">
                {ORIENTATIONS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">Tags (comma-separated)</label>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                placeholder="sale, promotion, urgent" />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">Duration (seconds)</label>
              <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={1} max={300}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent" />
            </div>

            {/* Thumbnail URL */}
            <div>
              <label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">Thumbnail URL</label>
              <input type="text" value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                placeholder="https://..." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No type errors.

**Step 3: Commit**

```bash
git add web/src/app/dashboard/templates/new/
git commit -m "feat(web): add create template page with code editor and metadata form"
```

---

### Task 9: Frontend — Detail Page Edit Mode

**Files:**
- Modify: `web/src/app/dashboard/templates/[id]/page.tsx`

**Step 1: Add edit mode state and admin detection**

At the top of the component, add:

```typescript
import { useAuth } from '@/lib/hooks/useAuth';
import { useSearchParams } from 'next/navigation';
import { TemplateEditor } from '@/components/TemplateEditor';

// Inside the component:
const { user } = useAuth();
const isAdmin = user?.role === 'admin';
const searchParams = useSearchParams();
const startInEditMode = searchParams.get('edit') === 'true';

const [editMode, setEditMode] = useState(false);
const [editName, setEditName] = useState('');
const [editDescription, setEditDescription] = useState('');
const [editCategory, setEditCategory] = useState('');
const [editDifficulty, setEditDifficulty] = useState('');
const [editOrientation, setEditOrientation] = useState('');
const [editTags, setEditTags] = useState('');
const [editHtml, setEditHtml] = useState('');
const [editSampleData, setEditSampleData] = useState<Record<string, any>>({});
const [editThumbnailUrl, setEditThumbnailUrl] = useState('');
const [saving, setSaving] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [deleting, setDeleting] = useState(false);
```

**Step 2: Populate edit fields when entering edit mode**

Add a function and effect:

```typescript
const enterEditMode = () => {
  if (!template) return;
  setEditName(template.name || '');
  setEditDescription(template.description || '');
  setEditCategory(template.category || 'general');
  setEditDifficulty(template.difficulty || 'beginner');
  setEditOrientation(template.orientation || 'landscape');
  setEditTags((template.tags || []).join(', '));
  setEditHtml(template.templateHtml || template.htmlTemplate || '');
  setEditSampleData(template.sampleData || {});
  setEditThumbnailUrl(template.thumbnailUrl || template.thumbnail || '');
  setEditMode(true);
};

useEffect(() => {
  if (startInEditMode && template && !editMode) {
    enterEditMode();
  }
}, [template, startInEditMode]); // eslint-disable-line react-hooks/exhaustive-deps
```

**Step 3: Add save and delete handlers**

```typescript
const handleSave = async () => {
  try {
    setSaving(true);
    setSaveError(null);
    await apiClient.updateTemplate(templateId, {
      name: editName.trim() || undefined,
      description: editDescription.trim() || undefined,
      templateHtml: editHtml || undefined,
      category: editCategory || undefined,
      difficulty: editDifficulty || undefined,
      orientation: editOrientation || undefined,
      tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
      sampleData: Object.keys(editSampleData).length > 0 ? editSampleData : undefined,
      thumbnailUrl: editThumbnailUrl.trim() || undefined,
    });
    setEditMode(false);
    loadTemplate(); // Refresh data
  } catch (err: any) {
    setSaveError(err.message || 'Failed to save changes');
  } finally {
    setSaving(false);
  }
};

const handleDelete = async () => {
  try {
    setDeleting(true);
    await apiClient.deleteTemplate(templateId);
    router.push('/dashboard/templates');
  } catch (err: any) {
    setSaveError(err.message || 'Failed to delete template');
    setDeleting(false);
  }
};
```

**Step 4: Add "Edit Template" button in header (view mode)**

In the header area where the clone button is, add an edit button for admins when not in edit mode:

```tsx
{isAdmin && !editMode && (
  <button onClick={enterEditMode}
    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition text-[var(--foreground)]">
    <Icon name="edit" size="sm" className="text-[#00E5A0]" />
    Edit Template
  </button>
)}
```

**Step 5: Add edit mode header with Save/Cancel/Delete**

When in edit mode, replace the header action buttons:

```tsx
{editMode && (
  <div className="flex items-center gap-3">
    <button onClick={() => setShowDeleteModal(true)}
      className="px-4 py-2 text-sm font-medium text-red-600 bg-[var(--surface)] border border-red-200 rounded-lg hover:bg-red-50 transition">
      Delete
    </button>
    <button onClick={() => setEditMode(false)}
      className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition">
      Cancel
    </button>
    <button onClick={handleSave} disabled={saving}
      className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition disabled:opacity-50">
      {saving ? <><LoadingSpinner size="sm" /> Saving...</> : 'Save Changes'}
    </button>
  </div>
)}
```

**Step 6: Conditionally render edit form vs view mode in the body**

In the left column, when `editMode` is true, show editable name/description + the TemplateEditor component instead of the read-only display:

```tsx
{editMode ? (
  <div className="space-y-4">
    {saveError && (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{saveError}</div>
    )}
    <div>
      <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">Name</label>
      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
        className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-[var(--foreground)] bg-[var(--background)]" />
    </div>
    <div>
      <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">Description</label>
      <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3}
        className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-[var(--foreground)] bg-[var(--background)]" />
    </div>
    <TemplateEditor
      initialHtml={editHtml}
      sampleData={editSampleData}
      onHtmlChange={setEditHtml}
      onSampleDataChange={setEditSampleData}
      onPreviewRequest={handlePreview}
      previewHtml={previewHtml}
      previewLoading={previewLoading}
    />
  </div>
) : (
  /* existing view-mode content */
)}
```

In the right column, when `editMode` is true, show editable dropdowns for category/difficulty/orientation/tags instead of read-only badges. Follow the same pattern as the create page metadata panel.

**Step 7: Add delete confirmation modal**

At the bottom of the component:

```tsx
{showDeleteModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !deleting && setShowDeleteModal(false)} />
    <div className="relative bg-[var(--surface)] rounded-lg shadow-xl border border-[var(--border)] w-full max-w-sm mx-4 p-6 z-10">
      <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Delete Template</h3>
      <p className="text-sm text-[var(--foreground-secondary)] mb-6">
        Are you sure? This will remove "{template?.name}" from the global library.
      </p>
      <div className="flex justify-end gap-3">
        <button onClick={() => setShowDeleteModal(false)} disabled={deleting}
          className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition disabled:opacity-50">
          Cancel
        </button>
        <button onClick={handleDelete} disabled={deleting}
          className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2">
          {deleting ? <><LoadingSpinner size="sm" /> Deleting...</> : 'Delete Template'}
        </button>
      </div>
    </div>
  </div>
)}
```

**Step 8: Wire up the handlePreview function for edit mode**

Update or add a preview handler that uses client-side Handlebars for the edit mode preview:

```typescript
const handlePreview = async () => {
  setPreviewLoading(true);
  try {
    if (editMode) {
      const Handlebars = (await import('handlebars')).default;
      const compiled = Handlebars.compile(editHtml);
      setPreviewHtml(compiled(editSampleData));
    } else {
      const data = await apiClient.getTemplatePreview(templateId);
      setPreviewHtml(data.html || '');
    }
  } catch (err: any) {
    setPreviewHtml(`<div style="color: red; padding: 20px;">Preview error: ${err.message}</div>`);
  } finally {
    setPreviewLoading(false);
  }
};
```

**Step 9: Verify build**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No type errors.

**Step 10: Commit**

```bash
git add web/src/app/dashboard/templates/\[id\]/page.tsx
git commit -m "feat(web): add edit mode and delete to template detail page"
```

---

### Task 10: Install Handlebars for Client-Side Preview

**Step 1: Check if handlebars is already installed**

Run: `cd web && cat package.json | grep handlebars`

If not installed:

```bash
cd web && pnpm add handlebars
```

**Step 2: Commit if new dependency**

```bash
git add web/package.json pnpm-lock.yaml
git commit -m "chore(web): add handlebars for client-side template preview"
```

---

### Task 11: End-to-End Smoke Test

**Step 1: Start services**

Ensure middleware and web are running. Use the MCP service tools or:
```bash
npx nx serve @vizora/middleware &
npx nx dev @vizora/web &
```

**Step 2: Manual verification checklist**

1. Navigate to `/dashboard/templates` — verify "Create Template" button appears for admin users
2. Click "Create Template" — verify the create page loads with code editor, metadata form, preview
3. Fill in template details, click "Refresh Preview" — verify Handlebars renders
4. Click "Save Template" — verify redirect to the new template's detail page
5. Click "Edit Template" on detail page — verify edit mode with pre-populated fields
6. Make changes, click "Save Changes" — verify changes persist
7. Click "Delete" — verify confirmation modal, then redirect to browse page
8. Verify non-admin users do NOT see Create/Edit/Delete controls
9. Hover over a template card in browse page — verify Edit/Delete action icons appear (admin only)

**Step 3: Run existing tests to confirm no regressions**

```bash
pnpm --filter @vizora/middleware test -- --testPathPattern=template-library
pnpm --filter @vizora/web test
```

Expected: All existing tests pass. New service tests pass.

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(templates): address smoke test issues"
```

---

## Task Dependency Order

```
Task 1 (DTOs) → Task 2 (Service) → Task 3 (Controller) → Task 4 (API Client)
                                                              ↓
Task 6 (CodeMirror install) → Task 7 (Editor Component) → Task 5 (Browse Page)
                                                              ↓
Task 10 (Handlebars install) → Task 8 (Create Page) + Task 9 (Detail Edit Mode)
                                                              ↓
                                                      Task 11 (Smoke Test)
```

Tasks 1-4 (backend) and Tasks 6-7 (frontend dependencies/components) can run in parallel.
Tasks 8 and 9 can run in parallel after their dependencies.
Task 11 is always last.
