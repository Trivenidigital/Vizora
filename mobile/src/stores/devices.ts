import { create } from 'zustand';
import { api } from '../api/client';
import type { Display, UpdateDisplayData, DeviceStatusEvent } from '../types';

type DevicesState = {
  displays: Display[];
  isLoading: boolean;
  error: string | null;

  fetchDisplays: () => Promise<void>;
  updateDisplayStatus: (event: DeviceStatusEvent) => void;
  updateDisplay: (id: string, data: UpdateDisplayData) => Promise<Display>;
  removeDisplay: (id: string) => Promise<void>;
  setDisplays: (displays: Display[]) => void;
};

export const useDevicesStore = create<DevicesState>((set, get) => ({
  displays: [],
  isLoading: false,
  error: null,

  fetchDisplays: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.getDisplays();
      // Handle both envelope-unwrapped array and legacy response shapes
      const displays = Array.isArray(result)
        ? result
        : (result as Record<string, unknown>).data as Display[]
          ?? (result as Record<string, unknown>).displays as Display[]
          ?? (result as Record<string, unknown>).items as Display[]
          ?? [];
      set({ displays, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load displays';
      set({ error: message, isLoading: false });
    }
  },

  updateDisplayStatus: (event: DeviceStatusEvent) => {
    set((state) => ({
      displays: state.displays.map((d) =>
        d.id === event.deviceId
          ? { ...d, status: event.status, lastSeen: event.timestamp }
          : d,
      ),
    }));
  },

  updateDisplay: async (id: string, data: UpdateDisplayData) => {
    const updated = await api.updateDisplay(id, data);
    set((state) => ({
      displays: state.displays.map((d) => (d.id === id ? { ...d, ...updated } : d)),
    }));
    return updated;
  },

  removeDisplay: async (id: string) => {
    await api.deleteDisplay(id);
    set((state) => ({
      displays: state.displays.filter((d) => d.id !== id),
    }));
  },

  setDisplays: (displays: Display[]) => set({ displays }),
}));
