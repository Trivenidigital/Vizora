import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

// Mock content
const mockContent = [
  {
    id: '1',
    title: 'Welcome Message',
    type: 'text',
    content: 'Welcome to our office!',
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'Admin',
    tags: ['welcome', 'text'],
  },
  {
    id: '2',
    title: 'Company Intro Video',
    type: 'video',
    content: 'https://example.com/videos/intro.mp4',
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'Marketing',
    tags: ['video', 'company'],
  },
  {
    id: '3',
    title: 'Office Map',
    type: 'image',
    content: 'https://example.com/images/map.jpg',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'Admin',
    tags: ['image', 'map', 'office'],
  },
];

// Available content types
const contentTypes = ['text', 'image', 'video', 'url'];

const ContentPage: React.FC = () => {
  const [content, setContent] = useState<any[]>([]);
  const [filteredContent, setFilteredContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedContent, setSelectedContent] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    type: 'text',
    content: '',
    tags: '',
  });

  useEffect(() => {
    loadContent();
  }, []);

  useEffect(() => {
    filterContent();
  }, [content, activeFilter, searchQuery]);

  const loadContent = async () => {
    try {
      setLoading(true);
      // Simulate API call
      setTimeout(() => {
        setContent(mockContent);
        setLoading(false);
      }, 300);
    } catch (error) {
      console.error('Error loading content:', error);
      toast.error('Failed to load content');
      setLoading(false);
    }
  };

  const filterContent = () => {
    let filtered = [...content];
    
    // Apply type filter
    if (activeFilter) {
      const filterMap: {[key: string]: string} = {
        'Images': 'image',
        'Videos': 'video',
        'Text': 'text',
      };
      
      const type = filterMap[activeFilter];
      if (type) {
        filtered = filtered.filter(item => item.type === type);
      }
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(query) || 
        (item.tags && item.tags.some((tag: string) => tag.toLowerCase().includes(query)))
      );
    }
    
    setFilteredContent(filtered);
  };

  const handleFilterClick = (filter: string) => {
    setActiveFilter(activeFilter === filter ? null : filter);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleAddContentClick = () => {
    setFormData({
      title: '',
      type: 'text',
      content: '',
      tags: '',
    });
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Create new content
      const newContent = {
        id: `content-${Date.now()}`,
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()),
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'Current User',
      };
      
      setContent([...content, newContent]);
      toast.success('Content created successfully');
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating content:', error);
      toast.error('Failed to create content');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleDeleteClick = (contentItem: any) => {
    setSelectedContent(contentItem);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedContent) return;
    
    try {
      setContent(content.filter(item => item.id !== selectedContent.id));
      toast.success('Content deleted successfully');
    } catch (error) {
      console.error('Error deleting content:', error);
      toast.error('Failed to delete content');
    } finally {
      setShowDeleteModal(false);
      setSelectedContent(null);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="content-page">
      <h1>Content Management</h1>
      
      <div className="content-filters">
        <button 
          className={activeFilter === null ? 'active' : ''}
          onClick={() => setActiveFilter(null)}
        >
          All
        </button>
        <button 
          className={activeFilter === 'Images' ? 'active' : ''}
          onClick={() => handleFilterClick('Images')}
        >
          Images
        </button>
        <button 
          className={activeFilter === 'Videos' ? 'active' : ''}
          onClick={() => handleFilterClick('Videos')}
        >
          Videos
        </button>
        <input 
          type="text" 
          placeholder="Search content..." 
          value={searchQuery}
          onChange={handleSearchChange}
        />
        <button onClick={handleAddContentClick}>Add Content</button>
      </div>
      
      <div className="content-grid">
        {filteredContent.map(item => (
          <article key={item.id} className="content-card">
            <h3>{item.title}</h3>
            <p>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}</p>
            <p>Status: {item.status}</p>
            {item.tags && item.tags.length > 0 && (
              <div className="content-tags">
                {item.tags.map((tag: string) => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            )}
            <div className="content-actions">
              <button onClick={() => handleDeleteClick(item)}>Delete</button>
            </div>
          </article>
        ))}
        
        {filteredContent.length === 0 && (
          <div className="no-content">
            <p>No content found.</p>
          </div>
        )}
      </div>
      
      {/* Create Content Modal */}
      {showCreateModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Add New Content</h2>
            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label htmlFor="title">Title:</label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="type">Type:</label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  required
                >
                  {contentTypes.map(type => (
                    <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="content">Content:</label>
                <textarea
                  id="content"
                  name="content"
                  value={formData.content}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="tags">Tags (comma separated):</label>
                <input
                  id="tags"
                  name="tags"
                  type="text"
                  value={formData.tags}
                  onChange={handleInputChange}
                />
              </div>
              <div className="modal-actions">
                <button type="submit">Create</button>
                <button type="button" onClick={() => setShowCreateModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedContent && (
        <div className="modal">
          <div className="modal-content">
            <h2>Confirm Deletion</h2>
            <p>Are you sure you want to delete the content "{selectedContent.title}"?</p>
            <div className="modal-actions">
              <button onClick={handleConfirmDelete}>Confirm</button>
              <button onClick={() => setShowDeleteModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentPage; 