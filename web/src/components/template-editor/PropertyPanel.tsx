'use client';

import TextProperties from './TextProperties';
import ImageProperties from './ImageProperties';
import ContainerProperties from './ContainerProperties';

export interface SelectedElement {
  elementId: string;
  elementType: 'text' | 'image' | 'container';
  tagName: string;
  textContent: string;
  src: string;
  styles: Record<string, string>;
}

interface PropertyPanelProps {
  selected: SelectedElement | null;
  onPropertyChange: (elementId: string, property: string, oldValue: string, newValue: string) => void;
  onImageUpload: (file: File) => Promise<string>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export default function PropertyPanel({
  selected,
  onPropertyChange,
  onImageUpload,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: PropertyPanelProps) {
  // ── Empty state ─────────────────────────────────────────────────────
  if (!selected) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <span className="mb-3 text-4xl" role="img" aria-label="Point left">
          👈
        </span>
        <p className="text-sm text-gray-400">
          Click any element on the template to start editing
        </p>
      </div>
    );
  }

  // ── Active state ────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header: tag badge + undo/redo */}
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
        <span className="rounded bg-gray-700 px-2 py-0.5 text-xs font-mono text-gray-400">
          &lt;{selected.tagName}&gt;
        </span>
        <div className="flex gap-1">
          <button
            className="rounded px-2 py-1 text-sm transition-colors hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo"
          >
            ↩
          </button>
          <button
            className="rounded px-2 py-1 text-sm transition-colors hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo"
          >
            ↪
          </button>
        </div>
      </div>

      {/* Property controls */}
      <div className="flex-1 px-4 py-4">
        {selected.elementType === 'text' && (
          <TextProperties
            elementId={selected.elementId}
            textContent={selected.textContent}
            styles={selected.styles}
            onPropertyChange={onPropertyChange}
          />
        )}

        {selected.elementType === 'image' && (
          <ImageProperties
            elementId={selected.elementId}
            src={selected.src}
            styles={selected.styles}
            onPropertyChange={onPropertyChange}
            onImageUpload={onImageUpload}
          />
        )}

        {selected.elementType === 'container' && (
          <ContainerProperties
            elementId={selected.elementId}
            styles={selected.styles}
            onPropertyChange={onPropertyChange}
          />
        )}
      </div>
    </div>
  );
}
