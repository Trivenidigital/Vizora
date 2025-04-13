import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contentService } from '../services/contentService';

interface ContentFormData {
  title: string;
  type: string;
  url: string;
  status: string;
}

const ContentForm: React.FC = () => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('image');
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (newContent: ContentFormData) => 
      contentService.createContent(newContent),
    onSuccess: () => {
      // Reset form fields
      setTitle('');
      setType('image');
      setUrl('');
      
      // Invalidate and refetch content list
      queryClient.invalidateQueries({ queryKey: ['contents'] });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !url) return;

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await createMutation.mutateAsync({ title, type, url, status: 'active' });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div data-testid="content-form-container">
      <h2>Add New Content</h2>
      {isLoading && (
        <div className="text-blue-600" data-testid="loading-state">
          Saving...
        </div>
      )}
      {error && (
        <div className="text-red-600" data-testid="error-message">
          {error}
        </div>
      )}
      {success && (
        <div className="text-green-600" data-testid="success-message">
          Content saved successfully!
        </div>
      )}
      
      <form onSubmit={handleSubmit} data-testid="content-form">
        <div>
          <label htmlFor="title">Title:</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="title-input"
            required
          />
        </div>
        
        <div>
          <label htmlFor="type">Type:</label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            data-testid="type-select"
            required
          >
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="url">URL:</label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            data-testid="url-input"
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
            isLoading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          data-testid="submit-button"
        >
          {isLoading ? 'Saving...' : 'Save Content'}
        </button>
      </form>
    </div>
  );
};

export default ContentForm;