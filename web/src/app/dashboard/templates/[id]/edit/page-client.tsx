'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import TemplateEditorCanvas from '@/components/template-editor/TemplateEditorCanvas';
import type { CanvasHandle } from '@/components/template-editor/TemplateEditorCanvas';
import PropertyPanel from '@/components/template-editor/PropertyPanel';
import type { SelectedElement } from '@/components/template-editor/PropertyPanel';
import DisplayPickerModal from '@/components/template-editor/DisplayPickerModal';
import { useEditorHistory } from '@/components/template-editor/useEditorHistory';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/hooks/useToast';

interface EditPageClientProps {
  templateId: string;
}

export default function EditPageClient({ templateId }: EditPageClientProps) {
  const router = useRouter();
  const toast = useToast();

  // ── State ────────────────────────────────────────────────────────────
  const [templateName, setTemplateName] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [editorReady, setEditorReady] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [showDisplayPicker, setShowDisplayPicker] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────
  const canvasRef = useRef<CanvasHandle>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Editor History (undo/redo) ────────────────────────────────────────
  const history = useEditorHistory(iframeRef);

  // Populate iframeRef by finding the iframe inside the canvas container
  // after the editor is ready.
  useEffect(() => {
    if (editorReady && containerRef.current) {
      const iframe = containerRef.current.querySelector('iframe');
      if (iframe) {
        (iframeRef as React.MutableRefObject<HTMLIFrameElement | null>).current = iframe;
      }
    }
  }, [editorReady]);

  // ── Load template data on mount ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        const [detail, preview] = await Promise.all([
          apiClient.getTemplateDetail(templateId),
          apiClient.getTemplatePreview(templateId),
        ]);

        if (cancelled) return;

        setTemplateName(detail.name || 'Untitled Template');
        setPreviewHtml(preview.html || '');
      } catch (err: any) {
        if (cancelled) return;
        toast.error(err.message || 'Failed to load template');
        router.push('/dashboard/templates');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleEditorReady = useCallback(() => {
    setEditorReady(true);
  }, []);

  const handleElementSelected = useCallback((element: SelectedElement | null) => {
    setSelectedElement(element);
  }, []);

  const handlePropertyChange = useCallback(
    (elementId: string, property: string, oldValue: string, newValue: string) => {
      canvasRef.current?.sendUpdate(elementId, property, newValue);
      history.pushChange({ elementId, property, oldValue, newValue });
    },
    [history],
  );

  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    const result = await apiClient.createContent({
      title: file.name,
      type: 'image',
      file,
    });
    // Return the URL of the uploaded content
    return result.url || '';
  }, []);

  const handleSaveDraft = useCallback(async () => {
    if (!canvasRef.current) return;

    setSaving(true);
    try {
      const renderedHtml = await canvasRef.current.serialize();

      await apiClient.publishTemplate(templateId, {
        renderedHtml,
        name: `${templateName} - Edited`,
        displayIds: [],
      });

      toast.success('Draft saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  }, [templateId, templateName, toast]);

  const handlePublish = useCallback(
    async (displayIds: string[]) => {
      if (!canvasRef.current) return;

      setPublishing(true);
      try {
        const renderedHtml = await canvasRef.current.serialize();
        const now = new Date();
        const dateLabel = now.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        await apiClient.publishTemplate(templateId, {
          renderedHtml,
          name: `${templateName} - ${dateLabel}`,
          displayIds,
          duration: 30,
        });

        toast.success('Published to screens successfully');
        setShowDisplayPicker(false);
        router.push('/dashboard/content');
      } catch (err: any) {
        toast.error(err.message || 'Failed to publish');
      } finally {
        setPublishing(false);
      }
    },
    [templateId, templateName, toast, router],
  );

  // ── Loading state ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="h-8 w-8 animate-spin text-emerald-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-sm text-gray-400">Loading template...</span>
        </div>
      </div>
    );
  }

  if (!previewHtml) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="text-center">
          <p className="text-gray-400">No template preview available</p>
          <button
            onClick={() => router.back()}
            className="mt-4 rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ── Full-screen editor layout ────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-white">
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-3">
        {/* Left: back + name */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-400 transition hover:bg-gray-800 hover:text-white"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-sm font-semibold text-gray-200 truncate max-w-xs">
            {templateName}
          </h1>
          {!editorReady && (
            <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-500">
              Loading editor...
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving || !editorReady}
            className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            onClick={() => setShowDisplayPicker(true)}
            disabled={!editorReady}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Push to Screen →
          </button>
        </div>
      </div>

      {/* ── Main content area ────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div ref={containerRef} className="flex-1 p-4">
          <TemplateEditorCanvas
            ref={canvasRef}
            templateHtml={previewHtml}
            onElementSelected={handleElementSelected}
            onReady={handleEditorReady}
          />
        </div>

        {/* Property Panel */}
        <div className="w-72 shrink-0 border-l border-gray-800 bg-gray-900">
          <PropertyPanel
            selected={selectedElement}
            onPropertyChange={handlePropertyChange}
            onImageUpload={handleImageUpload}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            onUndo={history.undo}
            onRedo={history.redo}
          />
        </div>
      </div>

      {/* ── Display Picker Modal ─────────────────────────────────────── */}
      <DisplayPickerModal
        isOpen={showDisplayPicker}
        onClose={() => setShowDisplayPicker(false)}
        onConfirm={handlePublish}
        loading={publishing}
      />
    </div>
  );
}
