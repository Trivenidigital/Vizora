import { useState, useEffect, useCallback } from 'react';
import { contentService, Content } from '@/services/contentService';
import toast from 'react-hot-toast';

export interface ContentOption {
  id: string;
  name: string;
  type: string;
}

export const useGetContent = () => {
  const [content, setContent] = useState<ContentOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    try {
      setIsLoading(true);
      const contentList = await contentService.getContentList();
      
      // Format content for dropdown selection
      const formattedContent = contentList.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type
      }));
      
      setContent(formattedContent);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch content');
      toast.error('Failed to load content');
      console.error('Error fetching content:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  return {
    content,
    isLoading,
    error,
    refreshContent: fetchContent
  };
}; 