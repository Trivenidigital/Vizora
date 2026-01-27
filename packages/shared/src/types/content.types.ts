export enum ContentType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  WEB = 'WEB',
  HTML = 'HTML',
}

export enum ContentStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export interface Content {
  id: string;
  name: string;
  type: ContentType;
  status: ContentStatus;
  url: string;
  thumbnailUrl?: string;
  duration: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateContentDto {
  name: string;
  type: ContentType;
  url: string;
  thumbnailUrl?: string;
  duration: number;
  metadata?: Record<string, any>;
}

export interface UpdateContentDto {
  name?: string;
  status?: ContentStatus;
  url?: string;
  thumbnailUrl?: string;
  duration?: number;
  metadata?: Record<string, any>;
}
