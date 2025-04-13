import { Content } from '@vizora/common';

// Sample mock data for development/testing purposes
export const MOCK_CONTENT: Content[] = [
  {
    id: '1',
    title: 'Product Banner',
    type: 'image',
    url: 'https://picsum.photos/id/1/800/600',
    thumbnail: 'https://picsum.photos/id/1/800/600',
    status: 'active',
    createdAt: '2023-05-01T10:30:00Z',
    updatedAt: '2023-05-01T10:30:00Z',
    size: 1024 * 1024 * 2.5, // 2.5 MB
  },
  {
    id: '2',
    title: 'Company Introduction',
    type: 'video',
    url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
    thumbnail: 'https://picsum.photos/id/2/800/600',
    status: 'active',
    createdAt: '2023-05-10T14:45:00Z',
    updatedAt: '2023-05-15T09:20:00Z',
    size: 1024 * 1024 * 15, // 15 MB
  },
  {
    id: '3',
    title: 'Summer Sale Promo',
    type: 'image',
    url: 'https://picsum.photos/id/3/800/600',
    thumbnail: 'https://picsum.photos/id/3/800/600',
    status: 'active',
    createdAt: '2023-06-05T11:15:00Z',
    updatedAt: '2023-06-05T11:15:00Z',
    size: 1024 * 1024 * 1.2, // 1.2 MB
  }
]; 