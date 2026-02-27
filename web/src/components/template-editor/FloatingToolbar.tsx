'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface FloatingToolbarProps {
  /** The iframe containing the editor */
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  /** Currently selected element info */
  selectedElement: {
    elementId: string;
    elementType: string;
    rect?: { top: number; left: number; width: number; height: number };
    styles?: Record<string, string>;
  } | null;
  /** Callback when a property changes */
  onPropertyChange: (elementId: string, property: string, oldValue: string, newValue: string) => void;
  /** Current canvas scale factor */
  scale?: number;
  /** Ref to the scrollable canvas container (for scroll-aware positioning) */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

const FONT_SIZES = [16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96, 120];

function rgbToHex(rgb: string): string {
  const match = rgb.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (!match) return rgb.startsWith('#') ? rgb : '#ffffff';
  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

export default function FloatingToolbar({
  iframeRef,
  selectedElement,
  onPropertyChange,
  scale = 1,
  scrollContainerRef,
}: FloatingToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const calcPosition = useCallback(() => {
    if (!selectedElement?.rect || !iframeRef.current) {
      setPosition(null);
      return;
    }

    const iframe = iframeRef.current;
    const iframeRect = iframe.getBoundingClientRect();
    const elRect = selectedElement.rect;

    // Scale the element rect from native coords to visual coords
    const scaledTop = elRect.top * scale;
    const scaledLeft = elRect.left * scale;
    const scaledWidth = elRect.width * scale;

    const top = iframeRect.top + scaledTop - 48;
    const left = iframeRect.left + scaledLeft + scaledWidth / 2;

    setPosition({
      top: Math.max(4, top),
      left: Math.max(100, Math.min(left, window.innerWidth - 200)),
    });
  }, [selectedElement, iframeRef, scale]);

  // Recalculate on selection/scale change
  useEffect(() => {
    calcPosition();
  }, [calcPosition]);

  // Recalculate on scroll
  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!container) return;

    container.addEventListener('scroll', calcPosition);
    return () => container.removeEventListener('scroll', calcPosition);
  }, [scrollContainerRef, calcPosition]);

  if (!selectedElement || selectedElement.elementType !== 'text' || !position) {
    return null;
  }

  const styles = selectedElement.styles || {};
  const fontSize = parseInt(styles.fontSize || '16', 10);
  const isBold = parseInt(styles.fontWeight || '400', 10) >= 700;
  const isItalic = (styles.fontStyle || '') === 'italic';
  const colorHex = rgbToHex(styles.color || '#ffffff');
  const align = styles.textAlign || 'left';

  const change = (prop: string, oldVal: string, newVal: string) => {
    onPropertyChange(selectedElement.elementId, prop, oldVal, newVal);
  };

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-1 rounded-lg bg-gray-800 border border-gray-600 px-2 py-1.5 shadow-xl"
      style={{ top: position.top, left: position.left, transform: 'translateX(-50%)' }}
    >
      {/* Font Size */}
      <select
        className="h-7 rounded bg-gray-700 border border-gray-600 px-1 text-xs text-white focus:outline-none"
        value={fontSize}
        onChange={(e) => change('fontSize', styles.fontSize || '16px', `${e.target.value}px`)}
      >
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>{s}px</option>
        ))}
      </select>

      <div className="w-px h-5 bg-gray-600 mx-0.5" />

      {/* Bold */}
      <button
        className={`h-7 w-7 rounded text-sm font-bold transition ${
          isBold ? 'bg-emerald-600 text-white' : 'text-gray-300 hover:bg-gray-700'
        }`}
        onClick={() => change('fontWeight', styles.fontWeight || '400', isBold ? '400' : '700')}
        title="Bold"
      >
        B
      </button>

      {/* Italic */}
      <button
        className={`h-7 w-7 rounded text-sm italic transition ${
          isItalic ? 'bg-emerald-600 text-white' : 'text-gray-300 hover:bg-gray-700'
        }`}
        onClick={() => change('fontStyle', styles.fontStyle || 'normal', isItalic ? 'normal' : 'italic')}
        title="Italic"
      >
        I
      </button>

      <div className="w-px h-5 bg-gray-600 mx-0.5" />

      {/* Color */}
      <input
        type="color"
        className="h-7 w-7 cursor-pointer rounded border border-gray-600 bg-transparent p-0"
        value={colorHex}
        onChange={(e) => change('color', styles.color || '', e.target.value)}
        title="Text Color"
      />

      <div className="w-px h-5 bg-gray-600 mx-0.5" />

      {/* Alignment */}
      {(['left', 'center', 'right'] as const).map((a) => (
        <button
          key={a}
          className={`h-7 w-7 rounded text-xs transition ${
            align === a ? 'bg-emerald-600 text-white' : 'text-gray-300 hover:bg-gray-700'
          }`}
          onClick={() => change('textAlign', styles.textAlign || 'left', a)}
          title={`Align ${a}`}
        >
          {a === 'left' ? '⫷' : a === 'center' ? '⫸' : '⫸'}
          {a[0].toUpperCase()}
        </button>
      ))}
    </div>
  );
}
