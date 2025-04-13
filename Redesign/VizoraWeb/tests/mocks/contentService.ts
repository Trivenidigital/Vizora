import { vi } from 'vitest';

export interface Content {
  id: string;
  name: string;
  type: 'image' | 'video' | 'html' | 'url' | 'pdf';
  url: string;
  thumbnailUrl?: string;
  fileSize?: number;
  duration?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tags?: string[];
  folderId?: string;
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
    codec?: string;
    orientation?: 'landscape' | 'portrait';
    [key: string]: any;
  };
  status: 'active' | 'archived' | 'processing';
  description?: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  contentCount: number;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  contentCount: number;
}

export const mockContent: Content[] = [
  {
    id: 'c1',
    name: 'Welcome Banner',
    type: 'image',
    url: 'https://assets.vizora.io/content/c1.jpg',
    thumbnailUrl: 'https://assets.vizora.io/thumbnails/c1.jpg',
    fileSize: 1024000,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'user1',
    tags: ['welcome', 'banner'],
    folderId: 'f1',
    metadata: {
      width: 1920,
      height: 1080,
      format: 'jpg',
      orientation: 'landscape'
    },
    status: 'active',
    description: 'Main welcome banner for lobby displays'
  },
  {
    id: 'c2',
    name: 'Product Promo Video',
    type: 'video',
    url: 'https://assets.vizora.io/content/c2.mp4',
    thumbnailUrl: 'https://assets.vizora.io/thumbnails/c2.jpg',
    fileSize: 15360000,
    duration: 45,
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'user2',
    tags: ['product', 'promo'],
    folderId: 'f2',
    metadata: {
      width: 1920,
      height: 1080,
      format: 'mp4',
      codec: 'h264',
      orientation: 'landscape',
      bitrate: '4mbps'
    },
    status: 'active',
    description: 'Product promotion video for new spring collection'
  },
  {
    id: 'c3',
    name: 'Digital Menu Board',
    type: 'html',
    url: 'https://assets.vizora.io/content/c3.html',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'user1',
    tags: ['menu', 'cafeteria'],
    folderId: 'f3',
    status: 'active',
    description: 'Interactive menu board for cafeteria displays'
  },
  {
    id: 'c4',
    name: 'Company Newsletter',
    type: 'pdf',
    url: 'https://assets.vizora.io/content/c4.pdf',
    thumbnailUrl: 'https://assets.vizora.io/thumbnails/c4.jpg',
    fileSize: 2048000,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'user3',
    tags: ['newsletter', 'internal'],
    status: 'archived',
    description: 'Monthly company newsletter for internal displays'
  },
  {
    id: 'c5',
    name: 'Event Calendar',
    type: 'url',
    url: 'https://calendar.vizora.io/embed/events',
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'user2',
    tags: ['calendar', 'events'],
    folderId: 'f1',
    status: 'active',
    description: 'Live calendar of upcoming company events'
  }
];

export const mockFolders: Folder[] = [
  {
    id: 'f1',
    name: 'Marketing',
    path: '/Marketing',
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    contentCount: 2
  },
  {
    id: 'f2',
    name: 'Products',
    path: '/Products',
    createdAt: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString(),
    contentCount: 1
  },
  {
    id: 'f3',
    name: 'Food Services',
    path: '/Food Services',
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    contentCount: 1
  },
  {
    id: 'f4',
    name: 'Campaigns',
    parentId: 'f1',
    path: '/Marketing/Campaigns',
    createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    contentCount: 0
  }
];

export const mockTags: Tag[] = [
  { id: 't1', name: 'welcome', color: '#4f46e5', contentCount: 1 },
  { id: 't2', name: 'banner', color: '#0ea5e9', contentCount: 1 },
  { id: 't3', name: 'product', color: '#10b981', contentCount: 1 },
  { id: 't4', name: 'promo', color: '#ef4444', contentCount: 1 },
  { id: 't5', name: 'menu', color: '#f59e0b', contentCount: 1 },
  { id: 't6', name: 'cafeteria', color: '#8b5cf6', contentCount: 1 },
  { id: 't7', name: 'newsletter', color: '#ec4899', contentCount: 1 },
  { id: 't8', name: 'internal', color: '#6366f1', contentCount: 1 },
  { id: 't9', name: 'calendar', color: '#14b8a6', contentCount: 1 },
  { id: 't10', name: 'events', color: '#f97316', contentCount: 1 }
];

export const contentService = {
  getContentList: vi.fn().mockResolvedValue(mockContent),
  
  getContentById: vi.fn().mockImplementation((id: string) => {
    const content = mockContent.find(c => c.id === id);
    return content 
      ? Promise.resolve(content) 
      : Promise.reject(new Error('Content not found'));
  }),
  
  createContent: vi.fn().mockImplementation((contentData: Partial<Content>) => {
    const newContent: Content = {
      id: `c${Date.now()}`,
      name: contentData.name || 'New Content',
      type: contentData.type || 'image',
      url: contentData.url || 'https://assets.vizora.io/content/default.jpg',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: contentData.createdBy || 'user1',
      status: 'active',
      ...contentData
    };
    return Promise.resolve(newContent);
  }),
  
  updateContent: vi.fn().mockImplementation((id: string, contentData: Partial<Content>) => {
    const contentIndex = mockContent.findIndex(c => c.id === id);
    if (contentIndex === -1) {
      return Promise.reject(new Error('Content not found'));
    }
    
    const updatedContent = {
      ...mockContent[contentIndex],
      ...contentData,
      updatedAt: new Date().toISOString()
    };
    
    return Promise.resolve(updatedContent);
  }),
  
  deleteContent: vi.fn().mockImplementation((id: string) => {
    const contentIndex = mockContent.findIndex(c => c.id === id);
    if (contentIndex === -1) {
      return Promise.reject(new Error('Content not found'));
    }
    return Promise.resolve(true);
  }),
  
  archiveContent: vi.fn().mockImplementation((id: string) => {
    const contentIndex = mockContent.findIndex(c => c.id === id);
    if (contentIndex === -1) {
      return Promise.reject(new Error('Content not found'));
    }
    
    const updatedContent = {
      ...mockContent[contentIndex],
      status: 'archived' as const,
      updatedAt: new Date().toISOString()
    };
    
    return Promise.resolve(updatedContent);
  }),
  
  restoreContent: vi.fn().mockImplementation((id: string) => {
    const contentIndex = mockContent.findIndex(c => c.id === id);
    if (contentIndex === -1) {
      return Promise.reject(new Error('Content not found'));
    }
    
    const updatedContent = {
      ...mockContent[contentIndex],
      status: 'active' as const,
      updatedAt: new Date().toISOString()
    };
    
    return Promise.resolve(updatedContent);
  }),
  
  getContentFolders: vi.fn().mockResolvedValue(mockFolders),
  
  createFolder: vi.fn().mockImplementation((folderData: Partial<Folder>) => {
    const newFolder: Folder = {
      id: `f${Date.now()}`,
      name: folderData.name || 'New Folder',
      path: folderData.path || `/${folderData.name || 'New Folder'}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      contentCount: 0,
      ...folderData
    };
    return Promise.resolve(newFolder);
  }),
  
  updateFolder: vi.fn().mockImplementation((id: string, folderData: Partial<Folder>) => {
    const folderIndex = mockFolders.findIndex(f => f.id === id);
    if (folderIndex === -1) {
      return Promise.reject(new Error('Folder not found'));
    }
    
    const updatedFolder = {
      ...mockFolders[folderIndex],
      ...folderData,
      updatedAt: new Date().toISOString()
    };
    
    return Promise.resolve(updatedFolder);
  }),
  
  deleteFolder: vi.fn().mockImplementation((id: string) => {
    const folderIndex = mockFolders.findIndex(f => f.id === id);
    if (folderIndex === -1) {
      return Promise.reject(new Error('Folder not found'));
    }
    return Promise.resolve(true);
  }),
  
  getContentTags: vi.fn().mockResolvedValue(mockTags),
  
  createTag: vi.fn().mockImplementation((tagData: Partial<Tag>) => {
    const newTag: Tag = {
      id: `t${Date.now()}`,
      name: tagData.name || 'New Tag',
      color: tagData.color || '#000000',
      contentCount: 0
    };
    return Promise.resolve(newTag);
  }),
  
  updateTag: vi.fn().mockImplementation((id: string, tagData: Partial<Tag>) => {
    const tagIndex = mockTags.findIndex(t => t.id === id);
    if (tagIndex === -1) {
      return Promise.reject(new Error('Tag not found'));
    }
    
    const updatedTag = {
      ...mockTags[tagIndex],
      ...tagData
    };
    
    return Promise.resolve(updatedTag);
  }),
  
  deleteTag: vi.fn().mockImplementation((id: string) => {
    const tagIndex = mockTags.findIndex(t => t.id === id);
    if (tagIndex === -1) {
      return Promise.reject(new Error('Tag not found'));
    }
    return Promise.resolve(true);
  }),
  
  uploadContent: vi.fn().mockImplementation((file: File, options: any = {}) => {
    return Promise.resolve({
      id: `c${Date.now()}`,
      name: file.name,
      type: file.type.includes('image') ? 'image' : file.type.includes('video') ? 'video' : 'file',
      url: `https://assets.vizora.io/content/${file.name}`,
      thumbnailUrl: `https://assets.vizora.io/thumbnails/${file.name}.jpg`,
      fileSize: file.size,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: options.createdBy || 'user1',
      status: 'active',
      ...(options.metadata && { metadata: options.metadata })
    });
  }),
  
  getContentByFolder: vi.fn().mockImplementation((folderId: string) => {
    const contents = mockContent.filter(c => c.folderId === folderId);
    return Promise.resolve(contents);
  }),
  
  getContentByTag: vi.fn().mockImplementation((tagName: string) => {
    const contents = mockContent.filter(c => c.tags?.includes(tagName));
    return Promise.resolve(contents);
  }),
  
  searchContent: vi.fn().mockImplementation((query: string) => {
    const contents = mockContent.filter(c => 
      c.name.toLowerCase().includes(query.toLowerCase()) || 
      c.description?.toLowerCase().includes(query.toLowerCase())
    );
    return Promise.resolve(contents);
  }),
  
  pushContentToDisplay: vi.fn().mockImplementation((contentId: string, displayId: string) => {
    const content = mockContent.find(c => c.id === contentId);
    if (!content) {
      return Promise.reject(new Error('Content not found'));
    }
    return Promise.resolve({ success: true, message: 'Content pushed to display' });
  })
}; 