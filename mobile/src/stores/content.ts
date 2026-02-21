import { create } from 'zustand';
import { api } from '../api/client';
import type { Content, ContentFilterParams } from '../types';

type ContentState = {
  items: Content[];
  isLoading: boolean;
  error: string | null;

  fetchContent: (params?: ContentFilterParams) => Promise<void>;
  deleteContent: (id: string) => Promise<void>;
  addItem: (item: Content) => void;
};

export const useContentStore = create<ContentState>((set) => ({
  items: [],
  isLoading: false,
  error: null,

  fetchContent: async (params?: ContentFilterParams) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.getContent(params);
      const items = Array.isArray(result) ? result : [];
      set({ items, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load content';
      set({ error: message, isLoading: false });
    }
  },

  deleteContent: async (id: string) => {
    await api.deleteContent(id);
    set((state) => ({
      items: state.items.filter((c) => c.id !== id),
    }));
  },

  addItem: (item: Content) => {
    set((state) => ({ items: [item, ...state.items] }));
  },
}));
