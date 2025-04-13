import { Folder, Tag } from './organization';

export interface Content {
  id: string;
  name: string;
  type: string;
  url: string;
  thumbnailUrl?: string;
  size: number;
  duration?: number;
  status: 'processing' | 'ready' | 'error';
  createdAt: string;
  updatedAt: string;
  owner: string;
  folder?: Folder;
  tags: Tag[];
  metadata?: Record<string, any>;
} 