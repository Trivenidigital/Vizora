import React, { useState, useEffect } from 'react';
import { contentService } from '@/services/contentService';
import { cachingService } from '@/services/storage';
import CacheStatus from '@/components/CacheStatus';

const CacheSettingsPage: React.FC = () => {
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const [recentContent, setRecentContent] = useState<Array<{id: string, title: string}>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRecentlyViewed = async () => {
      try {
        setIsLoading(true);
        // Get recently viewed content IDs
        const recentIds = await cachingService.getRecentlyViewedIds();
        setRecentlyViewed(recentIds);

        // Load content details for each ID
        const contentPromises = recentIds.map(async (id) => {
          try {
            const content = await cachingService.getContent(id);
            return content ? { id, title: content.title } : null;
          } catch (error) {
            console.error(`Error loading content ${id}:`, error);
            return null;
          }
        });

        const contentResults = await Promise.all(contentPromises);
        setRecentContent(contentResults.filter((item): item is {id: string, title: string} => item !== null));
      } catch (error) {
        console.error('Error loading recently viewed content:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecentlyViewed();
  }, []);

  const handleRemoveFromCache = async (contentId: string) => {
    try {
      await cachingService.removeContent(contentId);
      // Update the lists
      setRecentlyViewed(prev => prev.filter(id => id !== contentId));
      setRecentContent(prev => prev.filter(item => item.id !== contentId));
    } catch (error) {
      console.error(`Error removing content ${contentId} from cache:`, error);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Content Cache Settings</h1>
      
      <div className="mb-8">
        <CacheStatus showControls={true} className="mb-4" />
        
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <h2 className="text-lg font-medium text-blue-800 mb-2">About Content Caching</h2>
          <p className="text-blue-700 mb-2">
            Content caching allows your browser to store content locally, making it available offline
            and improving loading performance.
          </p>
          <p className="text-blue-700">
            When enabled, recently viewed content will be cached automatically. Caching also improves
            performance when online by loading content from your device instead of the network.
          </p>
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-md p-6 mb-8">
        <h2 className="text-xl font-medium mb-4">Recently Cached Content</h2>
        
        {isLoading ? (
          <p className="text-gray-500">Loading cached content...</p>
        ) : recentContent.length === 0 ? (
          <p className="text-gray-500">No content has been cached yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Content Title
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentContent.map((content) => (
                  <tr key={content.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{content.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{content.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => handleRemoveFromCache(content.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white shadow-md rounded-md p-6">
        <h2 className="text-xl font-medium mb-4">Cache Management Tips</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-700">
          <li>Caching is enabled by default and helps improve your experience even when offline.</li>
          <li>The cache is automatically cleaned up to remove old content that hasn't been accessed recently.</li>
          <li>You can manually clear the cache at any time using the "Clear Cache" button above.</li>
          <li>If you are experiencing issues, try disabling and re-enabling caching.</li>
          <li>Content is cached as you view it. Browse content you want available offline to ensure it's cached.</li>
        </ul>
      </div>
    </div>
  );
};

export default CacheSettingsPage; 