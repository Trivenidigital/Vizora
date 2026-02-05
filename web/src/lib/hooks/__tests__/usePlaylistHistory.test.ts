// Test Suite for usePlaylistHistory Hook
// Tests undo/redo functionality, history limits, and state management

import { renderHook, act } from '@testing-library/react';
import { usePlaylistHistory } from '../usePlaylistHistory';

interface TestItem {
  id: string;
  name: string;
  duration: number;
}

describe('usePlaylistHistory', () => {
  const initialItems: TestItem[] = [
    { id: '1', name: 'Item 1', duration: 10 },
    { id: '2', name: 'Item 2', duration: 20 },
  ];

  describe('Initial State', () => {
    it('should initialize with correct state', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      expect(result.current.state).toEqual(initialItems);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it('should initialize with empty array', () => {
      const { result } = renderHook(() => usePlaylistHistory<TestItem[]>([]));

      expect(result.current.state).toEqual([]);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it('should track undo/redo counts as zero initially', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      expect(result.current.getUndoCount()).toBe(0);
      expect(result.current.getRedoCount()).toBe(0);
    });
  });

  describe('pushState', () => {
    it('should add state to past and update present', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      const newItems = [...initialItems, { id: '3', name: 'Item 3', duration: 30 }];

      act(() => {
        result.current.pushState(newItems);
      });

      expect(result.current.state).toEqual(newItems);
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
      expect(result.current.getUndoCount()).toBe(1);
    });

    it('should clear future stack on new action', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      // Push state then undo, creating a future
      act(() => {
        result.current.pushState([{ id: '3', name: 'Item 3', duration: 30 }]);
      });
      act(() => {
        result.current.undo();
      });

      expect(result.current.canRedo).toBe(true);

      // Push new state should clear future
      act(() => {
        result.current.pushState([{ id: '4', name: 'Item 4', duration: 40 }]);
      });

      expect(result.current.canRedo).toBe(false);
      expect(result.current.getRedoCount()).toBe(0);
    });

    it('should handle multiple consecutive pushes', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      act(() => {
        result.current.pushState([...initialItems, { id: '3', name: 'Item 3', duration: 30 }]);
      });
      act(() => {
        result.current.pushState([...initialItems, { id: '4', name: 'Item 4', duration: 40 }]);
      });
      act(() => {
        result.current.pushState([...initialItems, { id: '5', name: 'Item 5', duration: 50 }]);
      });

      expect(result.current.getUndoCount()).toBe(3);
      expect(result.current.canUndo).toBe(true);
    });
  });

  describe('undo', () => {
    it('should restore previous state', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      const newItems = [...initialItems, { id: '3', name: 'Item 3', duration: 30 }];

      act(() => {
        result.current.pushState(newItems);
      });

      expect(result.current.state).toEqual(newItems);

      act(() => {
        result.current.undo();
      });

      expect(result.current.state).toEqual(initialItems);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(true);
    });

    it('should move present to future stack', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      const newItems = [...initialItems, { id: '3', name: 'Item 3', duration: 30 }];

      act(() => {
        result.current.pushState(newItems);
      });
      act(() => {
        result.current.undo();
      });

      expect(result.current.getRedoCount()).toBe(1);
    });

    it('should be no-op when past is empty', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      const stateBefore = result.current.state;

      act(() => {
        result.current.undo();
      });

      expect(result.current.state).toBe(stateBefore);
      expect(result.current.canUndo).toBe(false);
    });

    it('should support multiple undo operations', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      const state1 = [...initialItems, { id: '3', name: 'Item 3', duration: 30 }];
      const state2 = [...state1, { id: '4', name: 'Item 4', duration: 40 }];
      const state3 = [...state2, { id: '5', name: 'Item 5', duration: 50 }];

      act(() => {
        result.current.pushState(state1);
      });
      act(() => {
        result.current.pushState(state2);
      });
      act(() => {
        result.current.pushState(state3);
      });

      act(() => {
        result.current.undo();
      });
      expect(result.current.state).toEqual(state2);

      act(() => {
        result.current.undo();
      });
      expect(result.current.state).toEqual(state1);

      act(() => {
        result.current.undo();
      });
      expect(result.current.state).toEqual(initialItems);
      expect(result.current.canUndo).toBe(false);
    });
  });

  describe('redo', () => {
    it('should restore future state', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      const newItems = [...initialItems, { id: '3', name: 'Item 3', duration: 30 }];

      act(() => {
        result.current.pushState(newItems);
      });
      act(() => {
        result.current.undo();
      });

      expect(result.current.state).toEqual(initialItems);

      act(() => {
        result.current.redo();
      });

      expect(result.current.state).toEqual(newItems);
      expect(result.current.canRedo).toBe(false);
      expect(result.current.canUndo).toBe(true);
    });

    it('should move present to past stack', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      const newItems = [...initialItems, { id: '3', name: 'Item 3', duration: 30 }];

      act(() => {
        result.current.pushState(newItems);
      });
      act(() => {
        result.current.undo();
      });
      act(() => {
        result.current.redo();
      });

      expect(result.current.getUndoCount()).toBe(1);
    });

    it('should be no-op when future is empty', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      act(() => {
        result.current.pushState([...initialItems, { id: '3', name: 'Item 3', duration: 30 }]);
      });

      const stateBefore = result.current.state;

      act(() => {
        result.current.redo();
      });

      expect(result.current.state).toBe(stateBefore);
      expect(result.current.canRedo).toBe(false);
    });

    it('should support multiple redo operations', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      const state1 = [...initialItems, { id: '3', name: 'Item 3', duration: 30 }];
      const state2 = [...state1, { id: '4', name: 'Item 4', duration: 40 }];
      const state3 = [...state2, { id: '5', name: 'Item 5', duration: 50 }];

      act(() => {
        result.current.pushState(state1);
      });
      act(() => {
        result.current.pushState(state2);
      });
      act(() => {
        result.current.pushState(state3);
      });

      // Undo all
      act(() => {
        result.current.undo();
        result.current.undo();
        result.current.undo();
      });

      expect(result.current.state).toEqual(initialItems);

      // Redo all
      act(() => {
        result.current.redo();
      });
      expect(result.current.state).toEqual(state1);

      act(() => {
        result.current.redo();
      });
      expect(result.current.state).toEqual(state2);

      act(() => {
        result.current.redo();
      });
      expect(result.current.state).toEqual(state3);
      expect(result.current.canRedo).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear history and set new present', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      // Build up some history
      act(() => {
        result.current.pushState([...initialItems, { id: '3', name: 'Item 3', duration: 30 }]);
      });
      act(() => {
        result.current.pushState([...initialItems, { id: '4', name: 'Item 4', duration: 40 }]);
      });

      const newInitial: TestItem[] = [{ id: 'new', name: 'Fresh Start', duration: 100 }];

      act(() => {
        result.current.reset(newInitial);
      });

      expect(result.current.state).toEqual(newInitial);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
      expect(result.current.getUndoCount()).toBe(0);
      expect(result.current.getRedoCount()).toBe(0);
    });

    it('should clear both past and future', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      // Create some history
      act(() => {
        result.current.pushState([...initialItems, { id: '3', name: 'Item 3', duration: 30 }]);
      });
      act(() => {
        result.current.undo();
      });

      // At this point we have past and future
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(true);

      act(() => {
        result.current.reset(initialItems);
      });

      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });
  });

  describe('maxHistory', () => {
    it('should limit past array to maxHistory', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems, 3));

      // Push 5 states
      for (let i = 1; i <= 5; i++) {
        act(() => {
          result.current.pushState([{ id: `${i}`, name: `State ${i}`, duration: i * 10 }]);
        });
      }

      // Should only have 3 in history
      expect(result.current.getUndoCount()).toBe(3);
    });

    it('should use default maxHistory of 50', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      // Push 55 states
      for (let i = 1; i <= 55; i++) {
        act(() => {
          result.current.pushState([{ id: `${i}`, name: `State ${i}`, duration: i * 10 }]);
        });
      }

      // Should only have 50 in history
      expect(result.current.getUndoCount()).toBe(50);
    });
  });

  describe('Undo/Redo Cycles', () => {
    it('should handle multiple undo/redo cycles correctly', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      const state1 = [{ id: '1', name: 'State 1', duration: 10 }];
      const state2 = [{ id: '2', name: 'State 2', duration: 20 }];

      // Push -> Undo -> Redo -> Push new
      act(() => {
        result.current.pushState(state1);
      });
      act(() => {
        result.current.undo();
      });
      act(() => {
        result.current.redo();
      });

      expect(result.current.state).toEqual(state1);

      act(() => {
        result.current.pushState(state2);
      });

      expect(result.current.state).toEqual(state2);
      expect(result.current.canRedo).toBe(false);
      expect(result.current.getUndoCount()).toBe(2);
    });

    it('should preserve state integrity through complex operations', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      // Add item
      const withNewItem = [...initialItems, { id: '3', name: 'Item 3', duration: 30 }];
      act(() => {
        result.current.pushState(withNewItem);
      });

      // Remove item
      const withoutItem = initialItems.filter((i) => i.id !== '1');
      act(() => {
        result.current.pushState(withoutItem);
      });

      // Update item
      const withUpdate = withoutItem.map((i) =>
        i.id === '2' ? { ...i, duration: 999 } : i
      );
      act(() => {
        result.current.pushState(withUpdate);
      });

      // Undo back to start
      act(() => {
        result.current.undo();
        result.current.undo();
        result.current.undo();
      });

      expect(result.current.state).toEqual(initialItems);

      // Redo to middle
      act(() => {
        result.current.redo();
      });

      expect(result.current.state).toEqual(withNewItem);
    });
  });

  describe('canUndo and canRedo', () => {
    it('canUndo is false when past is empty', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));
      expect(result.current.canUndo).toBe(false);
    });

    it('canUndo is true when past has items', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      act(() => {
        result.current.pushState([{ id: '3', name: 'Item 3', duration: 30 }]);
      });

      expect(result.current.canUndo).toBe(true);
    });

    it('canRedo is false when future is empty', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      act(() => {
        result.current.pushState([{ id: '3', name: 'Item 3', duration: 30 }]);
      });

      expect(result.current.canRedo).toBe(false);
    });

    it('canRedo is true when future has items', () => {
      const { result } = renderHook(() => usePlaylistHistory(initialItems));

      act(() => {
        result.current.pushState([{ id: '3', name: 'Item 3', duration: 30 }]);
      });
      act(() => {
        result.current.undo();
      });

      expect(result.current.canRedo).toBe(true);
    });
  });
});
