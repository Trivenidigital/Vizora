import { useState, useCallback } from 'react';
import { api } from '../api/client';
import { useContentStore } from '../stores/content';
import type { Content } from '../types';

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number }
  | { status: 'success'; content: Content }
  | { status: 'error'; message: string };

export function useUpload() {
  const [state, setState] = useState<UploadState>({ status: 'idle' });

  const upload = useCallback(async (uri: string, name: string, mimeType: string) => {
    setState({ status: 'uploading', progress: 0 });

    try {
      const content = await api.uploadFile(uri, name, mimeType, (progress) => {
        setState({ status: 'uploading', progress });
      });

      useContentStore.getState().addItem(content);
      setState({ status: 'success', content });
      return content;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setState({ status: 'error', message });
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  return { state, upload, reset };
}
