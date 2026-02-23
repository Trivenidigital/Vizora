import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A single change record in the editor history stack.
 */
export interface HistoryEntry {
  elementId: string;
  property: string;
  oldValue: string;
  newValue: string;
}

const MAX_HISTORY = 50;

/**
 * Manages undo/redo history for the WYSIWYG template editor.
 *
 * Each change pushed via `pushChange` is recorded as a { elementId, property,
 * oldValue, newValue } entry. Undo/redo send `update-property` postMessages
 * to the iframe runtime so the template DOM stays in sync.
 *
 * Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y / Ctrl+Shift+Z (redo).
 */
export function useEditorHistory(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
) {
  // History stack and current position.
  // position == -1 means "nothing to undo" (empty or fully undone).
  const historyRef = useRef<HistoryEntry[]>([]);
  const positionRef = useRef(-1);

  // Revision counter drives re-renders so canUndo/canRedo stay reactive.
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((r) => r + 1), []);

  // ── Helpers ──────────────────────────────────────────────────────────

  /** Post an update-property message to the iframe. */
  const postToIframe = useCallback(
    (elementId: string, property: string, value: string) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      iframe.contentWindow.postMessage(
        { type: 'update-property', elementId, property, value },
        '*',
      );
    },
    [iframeRef],
  );

  // ── Public API ───────────────────────────────────────────────────────

  /**
   * Record a property change. Any redo entries beyond the current position
   * are discarded (standard undo/redo semantics). The stack is capped at
   * MAX_HISTORY entries — oldest entries are dropped when the limit is hit.
   */
  const pushChange = useCallback(
    (entry: HistoryEntry) => {
      const history = historyRef.current;
      const pos = positionRef.current;

      // Discard any redo entries past the current position.
      historyRef.current = history.slice(0, pos + 1);

      // Append the new entry.
      historyRef.current.push(entry);

      // Enforce max size — drop oldest entries.
      if (historyRef.current.length > MAX_HISTORY) {
        const overflow = historyRef.current.length - MAX_HISTORY;
        historyRef.current = historyRef.current.slice(overflow);
      }

      // Position always points at the newest entry.
      positionRef.current = historyRef.current.length - 1;
      bump();
    },
    [bump],
  );

  /**
   * Undo the change at the current position by sending the oldValue
   * to the iframe, then step back.
   */
  const undo = useCallback(() => {
    const pos = positionRef.current;
    if (pos < 0) return;

    const entry = historyRef.current[pos];
    postToIframe(entry.elementId, entry.property, entry.oldValue);
    positionRef.current = pos - 1;
    bump();
  }, [postToIframe, bump]);

  /**
   * Redo the next change by sending its newValue to the iframe,
   * then step forward.
   */
  const redo = useCallback(() => {
    const pos = positionRef.current;
    const history = historyRef.current;
    if (pos >= history.length - 1) return;

    const nextPos = pos + 1;
    const entry = history[nextPos];
    postToIframe(entry.elementId, entry.property, entry.newValue);
    positionRef.current = nextPos;
    bump();
  }, [postToIframe, bump]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      // Ctrl+Z — undo
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Y — redo
      if (e.key === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl+Shift+Z — redo (alternative)
      if (e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl+Shift+Z on some keyboards sends key === 'Z' (uppercase)
      if (e.key === 'Z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // ── Derived state ────────────────────────────────────────────────────

  // Reading refs inside the render is fine — `revision` ensures freshness.
  void revision; // consumed so the linter doesn't flag it unused
  const canUndo = positionRef.current >= 0;
  const canRedo = positionRef.current < historyRef.current.length - 1;

  return { pushChange, undo, redo, canUndo, canRedo } as const;
}
