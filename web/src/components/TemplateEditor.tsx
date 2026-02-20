'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import { Icon } from '@/theme/icons';
import LoadingSpinner from '@/components/LoadingSpinner';

interface TemplateEditorProps {
  initialHtml: string;
  sampleData: Record<string, unknown>;
  onHtmlChange: (html: string) => void;
  onSampleDataChange: (data: Record<string, unknown>) => void;
  onPreviewRequest: () => void;
  previewHtml?: string;
  previewLoading?: boolean;
}

type Tab = 'html' | 'data';

export default function TemplateEditor({
  initialHtml,
  sampleData,
  onHtmlChange,
  onSampleDataChange,
  onPreviewRequest,
  previewHtml,
  previewLoading = false,
}: TemplateEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('html');
  const [dataText, setDataText] = useState(() =>
    JSON.stringify(sampleData, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Stable callback ref so the EditorView listener doesn't go stale
  const onHtmlChangeRef = useRef(onHtmlChange);
  useEffect(() => {
    onHtmlChangeRef.current = onHtmlChange;
  }, [onHtmlChange]);

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorRef.current) return;

    const editorTheme = EditorView.theme({
      '&': { height: '400px' },
      '.cm-scroller': { overflow: 'auto' },
    });

    const state = EditorState.create({
      doc: initialHtml,
      extensions: [
        basicSetup,
        html(),
        oneDark,
        editorTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onHtmlChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run once on mount — initialHtml is captured in initial state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDataChange = useCallback(
    (value: string) => {
      setDataText(value);
      try {
        const parsed = JSON.parse(value) as Record<string, unknown>;
        setJsonError(null);
        onSampleDataChange(parsed);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Invalid JSON';
        setJsonError(message);
      }
    },
    [onSampleDataChange]
  );

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => setActiveTab('html')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'html'
              ? 'border-[#00E5A0] text-[#00E5A0]'
              : 'border-transparent text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'
          }`}
        >
          HTML Template
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('data')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'data'
              ? 'border-[#00E5A0] text-[#00E5A0]'
              : 'border-transparent text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'
          }`}
        >
          Sample Data
        </button>
      </div>

      {/* Editor panels */}
      <div
        className={activeTab === 'html' ? 'block' : 'hidden'}
        aria-hidden={activeTab !== 'html'}
      >
        <div
          ref={editorRef}
          className="rounded-lg overflow-hidden border border-[var(--border)]"
        />
      </div>

      <div
        className={activeTab === 'data' ? 'block' : 'hidden'}
        aria-hidden={activeTab !== 'data'}
      >
        <textarea
          value={dataText}
          onChange={(e) => handleDataChange(e.target.value)}
          className="w-full h-[400px] p-4 font-mono text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] resize-none focus:outline-none focus:ring-2 focus:ring-[#00E5A0]/50 focus:border-[#00E5A0]"
          spellCheck={false}
          placeholder='{ "key": "value" }'
        />
        {jsonError && (
          <p className="mt-2 text-sm text-red-400 flex items-center gap-1.5">
            <Icon name="error" size="sm" className="shrink-0" />
            {jsonError}
          </p>
        )}
      </div>

      {/* Refresh Preview button */}
      <button
        type="button"
        onClick={onPreviewRequest}
        disabled={previewLoading}
        className="flex items-center gap-2 px-4 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition font-medium disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {previewLoading ? (
          <LoadingSpinner size="sm" />
        ) : (
          <Icon name="refresh" size="sm" />
        )}
        Refresh Preview
      </button>

      {/* Preview pane */}
      <div className="rounded-lg border border-[var(--border)] overflow-hidden">
        {previewHtml ? (
          <iframe
            srcDoc={previewHtml}
            sandbox="allow-scripts"
            title="Template preview"
            className="w-full bg-white"
            style={{ minHeight: '400px' }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--foreground-tertiary)]">
            <Icon name="preview" size="2xl" className="mb-3 opacity-50" />
            <p className="text-sm">
              Click Refresh Preview to see the template
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
