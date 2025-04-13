import { vi, describe, it, expect, beforeEach } from 'vitest';
import axios from 'axios';
import organizationService from '../organizationService';
import { Folder, Tag, ContentOrganization, OrganizationFilters } from '../../types/organization';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OrganizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Folder operations', () => {
    const mockFolder: Folder = {
      id: '1',
      name: 'Test Folder',
      owner: 'user1',
      contentCount: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    };

    it('creates a folder successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: mockFolder });

      const result = await organizationService.createFolder({
        name: 'Test Folder',
        owner: 'user1'
      });

      expect(result).toEqual(mockFolder);
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/folders', {
        name: 'Test Folder',
        owner: 'user1'
      });
    });

    it('handles folder creation error', async () => {
      mockedAxios.post.mockRejectedValueOnce({ response: { status: 409 } });

      await expect(organizationService.createFolder({
        name: 'Test Folder',
        owner: 'user1'
      })).rejects.toThrow('Failed to create folder');
    });

    it('gets folders successfully', async () => {
      const mockFolders = [mockFolder];
      mockedAxios.get.mockResolvedValueOnce({ data: mockFolders });

      const result = await organizationService.getFolders();

      expect(result).toEqual(mockFolders);
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/folders');
    });

    it('updates folder successfully', async () => {
      const updatedFolder = { ...mockFolder, name: 'Updated Folder' };
      mockedAxios.patch.mockResolvedValueOnce({ data: updatedFolder });

      const result = await organizationService.updateFolder('1', {
        name: 'Updated Folder'
      });

      expect(result).toEqual(updatedFolder);
      expect(mockedAxios.patch).toHaveBeenCalledWith('/api/folders/1', {
        name: 'Updated Folder'
      });
    });

    it('handles folder update error', async () => {
      mockedAxios.patch.mockRejectedValueOnce({ response: { status: 404 } });

      await expect(organizationService.updateFolder('1', {
        name: 'Updated Folder'
      })).rejects.toThrow('Failed to update folder');
    });

    it('deletes folder successfully', async () => {
      mockedAxios.delete.mockResolvedValueOnce({});

      await expect(organizationService.deleteFolder('1')).resolves.not.toThrow();
      expect(mockedAxios.delete).toHaveBeenCalledWith('/api/folders/1');
    });

    it('handles folder deletion error', async () => {
      mockedAxios.delete.mockRejectedValueOnce({ response: { status: 404 } });

      await expect(organizationService.deleteFolder('1')).rejects.toThrow('Failed to delete folder');
    });
  });

  describe('Tag operations', () => {
    const mockTag: Tag = {
      id: '1',
      name: 'Test Tag',
      owner: 'user1',
      contentCount: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    };

    it('creates a tag successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: mockTag });

      const result = await organizationService.createTag({
        name: 'Test Tag',
        owner: 'user1'
      });

      expect(result).toEqual(mockTag);
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/tags', {
        name: 'Test Tag',
        owner: 'user1'
      });
    });

    it('handles tag creation error', async () => {
      mockedAxios.post.mockRejectedValueOnce({ response: { status: 409 } });

      await expect(organizationService.createTag({
        name: 'Test Tag',
        owner: 'user1'
      })).rejects.toThrow('Failed to create tag');
    });

    it('gets tags successfully', async () => {
      const mockTags = [mockTag];
      mockedAxios.get.mockResolvedValueOnce({ data: mockTags });

      const result = await organizationService.getTags();

      expect(result).toEqual(mockTags);
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/tags');
    });

    it('updates tag successfully', async () => {
      const updatedTag = { ...mockTag, name: 'Updated Tag' };
      mockedAxios.patch.mockResolvedValueOnce({ data: updatedTag });

      const result = await organizationService.updateTag('1', {
        name: 'Updated Tag'
      });

      expect(result).toEqual(updatedTag);
      expect(mockedAxios.patch).toHaveBeenCalledWith('/api/tags/1', {
        name: 'Updated Tag'
      });
    });

    it('handles tag update error', async () => {
      mockedAxios.patch.mockRejectedValueOnce({ response: { status: 404 } });

      await expect(organizationService.updateTag('1', {
        name: 'Updated Tag'
      })).rejects.toThrow('Failed to update tag');
    });

    it('deletes tag successfully', async () => {
      mockedAxios.delete.mockResolvedValueOnce({});

      await expect(organizationService.deleteTag('1')).resolves.not.toThrow();
      expect(mockedAxios.delete).toHaveBeenCalledWith('/api/tags/1');
    });

    it('handles tag deletion error', async () => {
      mockedAxios.delete.mockRejectedValueOnce({ response: { status: 404 } });

      await expect(organizationService.deleteTag('1')).rejects.toThrow('Failed to delete tag');
    });
  });

  describe('Content organization operations', () => {
    it('updates content organization successfully', async () => {
      const organization: ContentOrganization = {
        folderId: '1',
        tagIds: ['1', '2']
      };

      mockedAxios.patch.mockResolvedValueOnce({});

      await expect(organizationService.updateContentOrganization('content-1', organization))
        .resolves.not.toThrow();
      expect(mockedAxios.patch).toHaveBeenCalledWith('/api/content/content-1/organization', organization);
    });

    it('handles content organization update error', async () => {
      const organization: ContentOrganization = {
        folderId: '1',
        tagIds: ['1', '2']
      };

      mockedAxios.patch.mockRejectedValueOnce({ response: { status: 404 } });

      await expect(organizationService.updateContentOrganization('content-1', organization))
        .rejects.toThrow('Failed to update content organization');
    });

    it('gets content by organization successfully', async () => {
      const filters: OrganizationFilters = {
        folderId: '1',
        tagIds: ['1', '2'],
        includeSubfolders: true
      };

      const mockContentIds = ['content-1', 'content-2'];
      mockedAxios.get.mockResolvedValueOnce({ data: mockContentIds });

      const result = await organizationService.getContentByOrganization(filters);

      expect(result).toEqual(mockContentIds);
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/content/organization', { params: filters });
    });

    it('handles get content by organization error', async () => {
      const filters: OrganizationFilters = {
        folderId: '1',
        tagIds: ['1', '2']
      };

      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(organizationService.getContentByOrganization(filters))
        .rejects.toThrow('Failed to fetch content by organization');
    });
  });
}); 