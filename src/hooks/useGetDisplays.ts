import { useState, useEffect, useCallback } from 'react';
import { displayService, Display } from '@/services/displayService';
import toast from 'react-hot-toast';

export interface DisplayOption {
  id: string;
  name: string;
}

export const useGetDisplays = () => {
  const [displays, setDisplays] = useState<DisplayOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDisplays = useCallback(async () => {
    try {
      setIsLoading(true);
      const displayList = await displayService.getDisplays();
      
      // Format displays for dropdown selection
      const formattedDisplays = displayList.map(display => ({
        id: display.id,
        name: display.name
      }));
      
      setDisplays(formattedDisplays);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch displays');
      toast.error('Failed to load displays');
      console.error('Error fetching displays:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDisplays();
  }, [fetchDisplays]);

  return {
    displays,
    isLoading,
    error,
    refreshDisplays: fetchDisplays
  };
}; 