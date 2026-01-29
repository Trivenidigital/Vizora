// Optimistic State Management with Rollback Support
// Handles optimistic UI updates with automatic rollback on failure

import { useState, useCallback, useRef } from 'react';

export interface OptimisticUpdate<T> {
  id: string;
  previousState: T;
  optimisticState: T;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface UseOptimisticStateOptions {
  onRollback?: (update: OptimisticUpdate<any>) => void;
  onCommit?: (update: OptimisticUpdate<any>) => void;
  enableLogging?: boolean;
}

export function useOptimisticState<T>(
  initialState: T,
  options: UseOptimisticStateOptions = {}
) {
  const { onRollback, onCommit, enableLogging = true } = options;

  const [state, setState] = useState<T>(initialState);
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, OptimisticUpdate<T>>>(
    new Map()
  );
  const updateQueueRef = useRef<OptimisticUpdate<T>[]>([]);

  // Apply optimistic update
  const updateOptimistic = useCallback(
    (id: string, updater: (prev: T) => T, metadata?: Record<string, any>) => {
      setState((prevState) => {
        const optimisticState = updater(prevState);

        // Track the update
        const update: OptimisticUpdate<T> = {
          id,
          previousState: prevState,
          optimisticState,
          timestamp: Date.now(),
          metadata,
        };

        setPendingUpdates((prev) => new Map(prev).set(id, update));
        updateQueueRef.current.push(update);

        if (enableLogging) {
          console.log('[OptimisticState] Applied optimistic update:', id, {
            previous: prevState,
            optimistic: optimisticState,
          });
        }

        return optimisticState;
      });
    },
    [enableLogging]
  );

  // Commit optimistic update (confirm with server)
  const commitOptimistic = useCallback((id: string) => {
    setPendingUpdates((prev) => {
      const updated = new Map(prev);
      const update = updated.get(id);

      if (update) {
        if (enableLogging) {
          console.log('[OptimisticState] Committed update:', id);
        }
        onCommit?.(update);
        updated.delete(id);
      }

      return updated;
    });
  }, [enableLogging, onCommit]);

  // Rollback optimistic update on failure
  const rollbackOptimistic = useCallback(
    (id: string, fallbackState?: T) => {
      setPendingUpdates((prev) => {
        const updated = new Map(prev);
        const update = updated.get(id);

        if (update) {
          setState(fallbackState ?? update.previousState);

          if (enableLogging) {
            console.log('[OptimisticState] Rolled back update:', id, {
              previousState: update.previousState,
            });
          }

          onRollback?.(update);
          updated.delete(id);
        }

        return updated;
      });
    },
    [enableLogging, onRollback]
  );

  // Rollback all pending updates
  const rollbackAll = useCallback(() => {
    setPendingUpdates((prev) => {
      if (prev.size === 0) return prev;

      // Get the first update to find the original state
      const updates = Array.from(prev.values());
      const originalState = updates[0]?.previousState;

      if (originalState) {
        setState(originalState);

        if (enableLogging) {
          console.log('[OptimisticState] Rolled back all updates:', prev.size);
        }

        updates.forEach((update) => onRollback?.(update));
      }

      return new Map();
    });
  }, [enableLogging, onRollback]);

  // Batch optimistic updates
  const batchUpdate = useCallback(
    (updates: Array<{ id: string; updater: (prev: T) => T; metadata?: Record<string, any> }>) => {
      setState((prevState) => {
        let currentState = prevState;

        updates.forEach(({ id, updater, metadata }) => {
          currentState = updater(currentState);

          const update: OptimisticUpdate<T> = {
            id,
            previousState: prevState,
            optimisticState: currentState,
            timestamp: Date.now(),
            metadata,
          };

          setPendingUpdates((prev) => new Map(prev).set(id, update));
          updateQueueRef.current.push(update);

          if (enableLogging) {
            console.log('[OptimisticState] Batched update:', id);
          }
        });

        return currentState;
      });
    },
    [enableLogging]
  );

  return {
    state,
    pendingUpdates,
    updateOptimistic,
    commitOptimistic,
    rollbackOptimistic,
    rollbackAll,
    batchUpdate,
    getPendingCount: () => pendingUpdates.size,
    hasPendingUpdates: () => pendingUpdates.size > 0,
    getUpdateQueue: () => [...updateQueueRef.current],
  };
}
