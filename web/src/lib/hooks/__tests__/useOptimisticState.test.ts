// Test Suite for useOptimisticState Hook
// Tests optimistic updates, rollback functionality, and batch operations

import { renderHook, act } from '@testing-library/react';
import { useOptimisticState } from '../useOptimisticState';

interface TestData {
  id: string;
  name: string;
  value: number;
}

describe('useOptimisticState', () => {
  const initialState: TestData[] = [
    { id: '1', name: 'Item 1', value: 10 },
    { id: '2', name: 'Item 2', value: 20 },
  ];

  describe('Basic Optimistic Updates', () => {
    it('should apply optimistic updates', () => {
      const { result } = renderHook(() => useOptimisticState(initialState));

      act(() => {
        result.current.updateOptimistic('update-1', (prev) =>
          prev.map((item) => (item.id === '1' ? { ...item, value: 100 } : item))
        );
      });

      expect(result.current.state[0].value).toBe(100);
    });

    it('should track pending updates', () => {
      const { result } = renderHook(() => useOptimisticState(initialState));

      act(() => {
        result.current.updateOptimistic('update-1', (prev) =>
          prev.map((item) => (item.id === '1' ? { ...item, value: 100 } : item))
        );
      });

      expect(result.current.pendingUpdates.has('update-1')).toBe(true);
      expect(result.current.getPendingCount()).toBe(1);
    });

    it('should commit optimistic updates', () => {
      const onCommit = jest.fn();
      const { result } = renderHook(() =>
        useOptimisticState(initialState, { onCommit })
      );

      act(() => {
        result.current.updateOptimistic('update-1', (prev) =>
          prev.map((item) => (item.id === '1' ? { ...item, value: 100 } : item))
        );
      });

      act(() => {
        result.current.commitOptimistic('update-1');
      });

      expect(onCommit).toHaveBeenCalled();
      expect(result.current.pendingUpdates.has('update-1')).toBe(false);
    });
  });

  describe('Rollback Functionality', () => {
    it('should rollback individual updates', () => {
      const onRollback = jest.fn();
      const { result } = renderHook(() =>
        useOptimisticState(initialState, { onRollback })
      );

      act(() => {
        result.current.updateOptimistic('update-1', (prev) =>
          prev.map((item) => (item.id === '1' ? { ...item, value: 100 } : item))
        );
      });

      expect(result.current.state[0].value).toBe(100);

      act(() => {
        result.current.rollbackOptimistic('update-1');
      });

      expect(result.current.state[0].value).toBe(10);
      expect(onRollback).toHaveBeenCalled();
    });

    it('should rollback all pending updates', () => {
      const { result } = renderHook(() => useOptimisticState(initialState));

      act(() => {
        result.current.updateOptimistic('update-1', (prev) =>
          prev.map((item) => (item.id === '1' ? { ...item, value: 100 } : item))
        );
        result.current.updateOptimistic('update-2', (prev) =>
          prev.map((item) => (item.id === '2' ? { ...item, value: 200 } : item))
        );
      });

      expect(result.current.getPendingCount()).toBe(2);

      act(() => {
        result.current.rollbackAll();
      });

      expect(result.current.state[0].value).toBe(10);
      expect(result.current.state[1].value).toBe(20);
      expect(result.current.getPendingCount()).toBe(0);
    });

    it('should rollback with fallback state', () => {
      const { result } = renderHook(() => useOptimisticState(initialState));

      const fallbackState: TestData[] = [
        { id: '1', name: 'Fallback 1', value: 999 },
      ];

      act(() => {
        result.current.updateOptimistic('update-1', (prev) =>
          prev.map((item) => (item.id === '1' ? { ...item, value: 100 } : item))
        );
      });

      act(() => {
        result.current.rollbackOptimistic('update-1', fallbackState);
      });

      expect(result.current.state).toEqual(fallbackState);
    });
  });

  describe('Batch Operations', () => {
    it('should batch multiple optimistic updates', () => {
      const { result } = renderHook(() => useOptimisticState(initialState));

      act(() => {
        result.current.batchUpdate([
          {
            id: 'batch-1',
            updater: (prev) =>
              prev.map((item) => (item.id === '1' ? { ...item, value: 100 } : item)),
          },
          {
            id: 'batch-2',
            updater: (prev) =>
              prev.map((item) => (item.id === '2' ? { ...item, value: 200 } : item)),
          },
        ]);
      });

      expect(result.current.state[0].value).toBe(100);
      expect(result.current.state[1].value).toBe(200);
      expect(result.current.getPendingCount()).toBe(2);
    });

    it('should apply batch updates sequentially', () => {
      const { result } = renderHook(() => useOptimisticState(initialState));

      act(() => {
        result.current.batchUpdate([
          {
            id: 'batch-1',
            updater: (prev) =>
              prev.map((item) => (item.id === '1' ? { ...item, value: item.value * 2 } : item)),
          },
          {
            id: 'batch-2',
            updater: (prev) =>
              prev.map((item) => (item.id === '1' ? { ...item, value: item.value + 10 } : item)),
          },
        ]);
      });

      // 10 * 2 + 10 = 30
      expect(result.current.state[0].value).toBe(30);
    });

    it('should support metadata in batch updates', () => {
      const { result } = renderHook(() => useOptimisticState(initialState));

      act(() => {
        result.current.batchUpdate([
          {
            id: 'batch-1',
            updater: (prev) =>
              prev.map((item) => (item.id === '1' ? { ...item, value: 100 } : item)),
            metadata: { source: 'batch', priority: 'high' },
          },
        ]);
      });

      const pendingUpdate = result.current.pendingUpdates.get('batch-1');
      expect(pendingUpdate?.metadata).toEqual({ source: 'batch', priority: 'high' });
    });
  });

  describe('State Tracking', () => {
    it('should track previous state in pending updates', () => {
      const { result } = renderHook(() => useOptimisticState(initialState));

      act(() => {
        result.current.updateOptimistic('update-1', (prev) =>
          prev.map((item) => (item.id === '1' ? { ...item, value: 100 } : item))
        );
      });

      const pendingUpdate = result.current.pendingUpdates.get('update-1');
      expect(pendingUpdate?.previousState[0].value).toBe(10);
      expect(pendingUpdate?.optimisticState[0].value).toBe(100);
    });

    it('should maintain update timestamps', () => {
      const { result } = renderHook(() => useOptimisticState(initialState));

      act(() => {
        result.current.updateOptimistic('update-1', (prev) =>
          prev.map((item) => (item.id === '1' ? { ...item, value: 100 } : item))
        );
      });

      const pendingUpdate = result.current.pendingUpdates.get('update-1');
      expect(typeof pendingUpdate?.timestamp).toBe('number');
      expect(pendingUpdate?.timestamp).toBeGreaterThan(0);
    });

    it('should return update queue for inspection', () => {
      const { result } = renderHook(() => useOptimisticState(initialState));

      act(() => {
        result.current.updateOptimistic('update-1', (prev) =>
          prev.map((item) => (item.id === '1' ? { ...item, value: 100 } : item))
        );
      });

      const queue = result.current.getUpdateQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].id).toBe('update-1');
    });
  });

  describe('Pending State Helpers', () => {
    it('should report pending updates correctly', () => {
      const { result } = renderHook(() => useOptimisticState(initialState));

      expect(result.current.hasPendingUpdates()).toBe(false);

      act(() => {
        result.current.updateOptimistic('update-1', (prev) =>
          prev.map((item) => (item.id === '1' ? { ...item, value: 100 } : item))
        );
      });

      expect(result.current.hasPendingUpdates()).toBe(true);
    });

    it('should get correct pending count', () => {
      const { result } = renderHook(() => useOptimisticState(initialState));

      act(() => {
        result.current.updateOptimistic('update-1', (prev) => prev);
        result.current.updateOptimistic('update-2', (prev) => prev);
        result.current.updateOptimistic('update-3', (prev) => prev);
      });

      expect(result.current.getPendingCount()).toBe(3);

      act(() => {
        result.current.commitOptimistic('update-1');
      });

      expect(result.current.getPendingCount()).toBe(2);
    });
  });

  describe('Complex State Changes', () => {
    it('should handle nested state updates', () => {
      interface NestedData {
        users: Array<{ id: string; profile: { name: string; age: number } }>;
      }

      const nestedState: NestedData = {
        users: [
          { id: '1', profile: { name: 'John', age: 30 } },
          { id: '2', profile: { name: 'Jane', age: 28 } },
        ],
      };

      const { result } = renderHook(() => useOptimisticState(nestedState));

      act(() => {
        result.current.updateOptimistic('update-1', (prev) => ({
          ...prev,
          users: prev.users.map((user) =>
            user.id === '1'
              ? { ...user, profile: { ...user.profile, age: 31 } }
              : user
          ),
        }));
      });

      expect(result.current.state.users[0].profile.age).toBe(31);
    });

    it('should handle array additions', () => {
      const { result } = renderHook(() => useOptimisticState(initialState));

      act(() => {
        result.current.updateOptimistic('update-1', (prev) => [
          ...prev,
          { id: '3', name: 'Item 3', value: 30 },
        ]);
      });

      expect(result.current.state.length).toBe(3);
      expect(result.current.state[2].id).toBe('3');
    });

    it('should handle array removal', () => {
      const { result } = renderHook(() => useOptimisticState(initialState));

      act(() => {
        result.current.updateOptimistic('update-1', (prev) =>
          prev.filter((item) => item.id !== '1')
        );
      });

      expect(result.current.state.length).toBe(1);
      expect(result.current.state[0].id).toBe('2');
    });
  });

  describe('Logging', () => {
    it('should log optimistic updates when enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      const { result } = renderHook(() =>
        useOptimisticState(initialState, { enableLogging: true })
      );

      act(() => {
        result.current.updateOptimistic('update-1', (prev) => prev);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[OptimisticState]'),
        expect.anything()
      );

      consoleSpy.mockRestore();
    });

    it('should not log when disabled', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      const { result } = renderHook(() =>
        useOptimisticState(initialState, { enableLogging: false })
      );

      act(() => {
        result.current.updateOptimistic('update-1', (prev) => prev);
      });

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('[OptimisticState]'),
        expect.anything()
      );

      consoleSpy.mockRestore();
    });
  });
});
