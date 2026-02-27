'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export const TEMPLATE_WIDTH = 1920;
export const TEMPLATE_HEIGHT = 1080;
const CANVAS_PADDING = 32;

export type ZoomPreset = 'fit' | '50' | '75' | '100';

const PRESET_ORDER: ZoomPreset[] = ['50', '75', 'fit', '100'];

export interface CanvasZoom {
  containerRef: React.RefObject<HTMLDivElement | null>;
  zoomPreset: ZoomPreset;
  scale: number;
  fitScale: number;
  setZoomPreset: (preset: ZoomPreset) => void;
  isScrollable: boolean;
}

export function useCanvasZoom(): CanvasZoom {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoomPreset, setZoomPreset] = useState<ZoomPreset>('fit');
  const [fitScale, setFitScale] = useState(0.5);

  // Recalculate fitScale when container resizes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const recalc = () => {
      const availW = el.clientWidth - CANVAS_PADDING * 2;
      const availH = el.clientHeight - CANVAS_PADDING * 2;
      if (availW <= 0 || availH <= 0) return;
      setFitScale(Math.min(availW / TEMPLATE_WIDTH, availH / TEMPLATE_HEIGHT));
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Derive actual scale from preset
  const scale =
    zoomPreset === 'fit'
      ? fitScale
      : zoomPreset === '50'
        ? 0.5
        : zoomPreset === '75'
          ? 0.75
          : 1;

  const isScrollable = zoomPreset !== 'fit';

  // Keyboard shortcuts: Ctrl+= zoom in, Ctrl+- zoom out, Ctrl+0 fit
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setZoomPreset((prev) => {
          const idx = PRESET_ORDER.indexOf(prev);
          return idx < PRESET_ORDER.length - 1 ? PRESET_ORDER[idx + 1] : prev;
        });
      } else if (e.key === '-') {
        e.preventDefault();
        setZoomPreset((prev) => {
          const idx = PRESET_ORDER.indexOf(prev);
          return idx > 0 ? PRESET_ORDER[idx - 1] : prev;
        });
      } else if (e.key === '0') {
        e.preventDefault();
        setZoomPreset('fit');
      }
    },
    [],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { containerRef, zoomPreset, scale, fitScale, setZoomPreset, isScrollable };
}
