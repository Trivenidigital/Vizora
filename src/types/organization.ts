export interface Folder {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  contentCount: number;
  children?: Folder[];
}

export interface Tag {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  contentCount: number;
}

export interface ContentOrganization {
  folderId?: string;
  tagIds: string[];
}

export interface OrganizationFilters {
  folderId?: string;
  tagIds?: string[];
  includeSubfolders?: boolean;
  search?: string;
} 