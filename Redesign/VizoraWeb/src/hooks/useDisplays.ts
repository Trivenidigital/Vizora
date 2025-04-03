import { useState, useEffect } from 'react';
import { DisplaySettings } from '../types/display';

export const useDisplays = () => {
  const [displays, setDisplays] = useState<DisplaySettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDisplays();
  }, []);

  const fetchDisplays = async () => {
    try {
      const response = await fetch('/api/displays');
      if (!response.ok) throw new Error('Failed to fetch displays');
      const data = await response.json();
      setDisplays(data.displays);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch displays');
      console.error('Error fetching displays:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDisplaysByIds = (ids: string[]) => {
    return displays.filter(display => ids.includes(display.id));
  };

  return {
    displays,
    loading,
    error,
    getDisplaysByIds,
    refreshDisplays: fetchDisplays
  };
}; 