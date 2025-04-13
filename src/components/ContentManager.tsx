import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contentService, Content } from '../services/contentService';

const ContentManager = () => {
  const [selectedContentId, setSelectedContentId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [type, setType] = React.useState('image');
  const [url, setUrl] = React.useState('');

  const queryClient = useQueryClient();

  // Query to fetch all content
  const contentListQuery = useQuery({
    queryKey: ['contents'],
    queryFn: () => contentService.getContentList()
  });

  // Query to fetch a specific content item
  const contentDetailQuery = useQuery({
    queryKey: ['content', selectedContentId],
    queryFn: () => selectedContentId ? contentService.getContentById(selectedContentId) : null,
    enabled: !!selectedContentId
  });

  // Mutation to create new content
  const createMutation = useMutation({
    mutationFn: (newContent: { title: string; type: string; url: string; status: string }) => 
      contentService.createContent(newContent),
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['contents'] });
    }
  });

  // Mutation to delete content
  const deleteMutation = useMutation({
    mutationFn: (id: string) => contentService.deleteContent(id),
    onSuccess: () => {
      setSelectedContentId(null);
      queryClient.invalidateQueries({ queryKey: ['contents'] });
    }
  });

  const handleSelectContent = (id: string) => {
    setSelectedContentId(id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !url) return;
    
    createMutation.mutate({ title, type, url, status: 'active' });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    deleteMutation.mutate(id);
  };

  const resetForm = () => {
    setTitle('');
    setType('image');
    setUrl('');
  };

  // If we're loading the initial content list
  if (contentListQuery.isLoading) {
    return <div data-testid="loading-state">Loading content...</div>;
  }

  // If there was an error loading the content list
  if (contentListQuery.isError) {
    return <div data-testid="error-state">Error loading content</div>;
  }

  return (
    <div data-testid="content-manager">
      <div className="content-list">
        <h2>Content List</h2>
        {contentListQuery.data && contentListQuery.data.length > 0 ? (
          <ul data-testid="content-list">
            {contentListQuery.data.map((content: Content) => (
              <li 
                key={content.id} 
                data-testid={`content-item-${content.id}`}
                onClick={() => handleSelectContent(content.id)}
                className="flex justify-between items-center p-2 hover:bg-gray-100 cursor-pointer"
              >
                <span data-testid={`content-title-${content.id}`}>{content.title}</span>
                <button 
                  onClick={(e) => handleDelete(e, content.id)}
                  data-testid={`delete-button-${content.id}`}
                  className="text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div data-testid="empty-state">No content available</div>
        )}
      </div>

      <div className="content-detail">
        {selectedContentId && contentDetailQuery.isLoading && (
          <div data-testid="detail-loading">Loading content details...</div>
        )}
        {selectedContentId && contentDetailQuery.isError && (
          <div data-testid="detail-error">Error loading content details</div>
        )}
        {selectedContentId && contentDetailQuery.data && (
          <div data-testid="content-detail">
            <h3 data-testid="detail-title">{contentDetailQuery.data.title}</h3>
            <p data-testid="detail-type">Type: {contentDetailQuery.data.type}</p>
            <p data-testid="detail-url">URL: {contentDetailQuery.data.url}</p>
            <p data-testid="detail-status">Status: {contentDetailQuery.data.status}</p>
          </div>
        )}
      </div>

      <div className="content-form">
        <h2>Add New Content</h2>
        {createMutation.isPending && <div data-testid="saving-state">Saving...</div>}
        {createMutation.isError && (
          <div data-testid="save-error">Failed to save content</div>
        )}
        {createMutation.isSuccess && (
          <div data-testid="save-success">Content saved successfully!</div>
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
            data-testid="submit-button"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Saving...' : 'Add Content'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ContentManager; 