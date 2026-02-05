import { useState, useCallback } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

/**
 * Hook for managing undo/redo history for playlist items.
 *
 * @param initialState - The initial state value
 * @param maxHistory - Maximum number of past states to keep (default: 50)
 * @returns Object with state, pushState, undo, redo, reset, canUndo, and canRedo
 */
export function usePlaylistHistory<T>(initialState: T, maxHistory: number = 50) {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  /**
   * Push a new state onto the history stack.
   * This clears the redo (future) stack.
   */
  const pushState = useCallback((newState: T) => {
    setHistory(prev => ({
      past: [...prev.past, prev.present].slice(-maxHistory),
      present: newState,
      future: [], // Clear redo stack on new action
    }));
  }, [maxHistory]);

  /**
   * Undo the last action, restoring the previous state.
   * The current state moves to the future stack.
   */
  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev;
      const newPast = [...prev.past];
      const newPresent = newPast.pop()!;
      return {
        past: newPast,
        present: newPresent,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  /**
   * Redo the last undone action, restoring the future state.
   * The current state moves to the past stack.
   */
  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev;
      const newFuture = [...prev.future];
      const newPresent = newFuture.shift()!;
      return {
        past: [...prev.past, prev.present],
        present: newPresent,
        future: newFuture,
      };
    });
  }, []);

  /**
   * Reset the history with a new initial state.
   * This clears both past and future stacks.
   */
  const reset = useCallback((newState: T) => {
    setHistory({
      past: [],
      present: newState,
      future: [],
    });
  }, []);

  /**
   * Get the number of states in the past (undo) stack.
   */
  const getUndoCount = useCallback(() => history.past.length, [history.past.length]);

  /**
   * Get the number of states in the future (redo) stack.
   */
  const getRedoCount = useCallback(() => history.future.length, [history.future.length]);

  return {
    state: history.present,
    pushState,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
    getUndoCount,
    getRedoCount,
  };
}
