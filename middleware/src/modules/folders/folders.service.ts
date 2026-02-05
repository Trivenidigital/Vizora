import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { MoveContentDto } from './dto/move-content.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';

export interface FolderWithChildren {
  id: string;
  name: string;
  parentId: string | null;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  children?: FolderWithChildren[];
  contentCount?: number;
}

@Injectable()
export class FoldersService {
  constructor(private readonly db: DatabaseService) {}

  async create(organizationId: string, dto: CreateFolderDto) {
    // Validate parent folder belongs to organization if provided
    if (dto.parentId) {
      const parent = await this.db.contentFolder.findFirst({
        where: { id: dto.parentId, organizationId },
      });
      if (!parent) {
        throw new BadRequestException('Parent folder not found or does not belong to your organization');
      }
    }

    return this.db.contentFolder.create({
      data: {
        name: dto.name,
        parentId: dto.parentId || null,
        organizationId,
      },
      include: {
        _count: {
          select: { content: true },
        },
      },
    });
  }

  async findAll(organizationId: string) {
    const folders = await this.db.contentFolder.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { content: true },
        },
      },
    });

    return folders.map((folder) => ({
      ...folder,
      contentCount: folder._count.content,
    }));
  }

  async findTree(organizationId: string): Promise<FolderWithChildren[]> {
    const folders = await this.db.contentFolder.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { content: true },
        },
      },
    });

    // Build a map for quick lookup
    const folderMap = new Map<string, FolderWithChildren>();
    folders.forEach((folder) => {
      folderMap.set(folder.id, {
        ...folder,
        contentCount: folder._count.content,
        children: [],
      });
    });

    // Build tree structure
    const rootFolders: FolderWithChildren[] = [];
    folders.forEach((folder) => {
      const node = folderMap.get(folder.id)!;
      if (folder.parentId && folderMap.has(folder.parentId)) {
        folderMap.get(folder.parentId)!.children!.push(node);
      } else {
        rootFolders.push(node);
      }
    });

    return rootFolders;
  }

  async findOne(organizationId: string, id: string) {
    const folder = await this.db.contentFolder.findFirst({
      where: { id, organizationId },
      include: {
        parent: true,
        children: true,
        _count: {
          select: { content: true },
        },
      },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return {
      ...folder,
      contentCount: folder._count.content,
    };
  }

  async update(organizationId: string, id: string, dto: UpdateFolderDto) {
    await this.findOne(organizationId, id);

    // Validate parent folder if being updated
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('A folder cannot be its own parent');
      }

      if (dto.parentId) {
        const parent = await this.db.contentFolder.findFirst({
          where: { id: dto.parentId, organizationId },
        });
        if (!parent) {
          throw new BadRequestException('Parent folder not found or does not belong to your organization');
        }

        // Prevent circular references
        const isDescendant = await this.isDescendant(organizationId, dto.parentId, id);
        if (isDescendant) {
          throw new BadRequestException('Cannot move folder into its own descendant');
        }
      }
    }

    return this.db.contentFolder.update({
      where: { id },
      data: {
        name: dto.name,
        parentId: dto.parentId,
      },
      include: {
        parent: true,
        children: true,
        _count: {
          select: { content: true },
        },
      },
    });
  }

  async remove(organizationId: string, id: string) {
    const folder = await this.findOne(organizationId, id);

    // Move content from this folder to parent folder (or null if no parent)
    await this.db.content.updateMany({
      where: { folderId: id, organizationId },
      data: { folderId: folder.parentId },
    });

    // Move child folders to parent folder (or make them root)
    await this.db.contentFolder.updateMany({
      where: { parentId: id, organizationId },
      data: { parentId: folder.parentId },
    });

    return this.db.contentFolder.delete({
      where: { id },
    });
  }

  async moveContent(organizationId: string, folderId: string, dto: MoveContentDto) {
    // Verify the folder exists and belongs to the organization
    await this.findOne(organizationId, folderId);

    // Verify all content items exist and belong to the organization
    const contentCount = await this.db.content.count({
      where: {
        id: { in: dto.contentIds },
        organizationId,
      },
    });

    if (contentCount !== dto.contentIds.length) {
      throw new BadRequestException('Some content items not found or not accessible');
    }

    // Move content to the folder
    const result = await this.db.content.updateMany({
      where: {
        id: { in: dto.contentIds },
        organizationId,
      },
      data: { folderId },
    });

    return { moved: result.count };
  }

  async getContents(
    organizationId: string,
    folderId: string,
    pagination: PaginationDto,
  ) {
    // Verify folder exists
    await this.findOne(organizationId, folderId);

    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.db.content.findMany({
        where: { folderId, organizationId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tags: {
            include: { tag: true },
          },
        },
      }),
      this.db.content.count({ where: { folderId, organizationId } }),
    ]);

    // Map content response for frontend compatibility
    const mappedData = data.map((content) => ({
      ...content,
      title: content.name,
      thumbnailUrl: content.thumbnail,
    }));

    return new PaginatedResponse(mappedData, total, page, limit);
  }

  async removeContentFromFolder(organizationId: string, contentIds: string[]) {
    // Verify all content items exist and belong to the organization
    const contentCount = await this.db.content.count({
      where: {
        id: { in: contentIds },
        organizationId,
      },
    });

    if (contentCount !== contentIds.length) {
      throw new BadRequestException('Some content items not found or not accessible');
    }

    const result = await this.db.content.updateMany({
      where: {
        id: { in: contentIds },
        organizationId,
      },
      data: { folderId: null },
    });

    return { removed: result.count };
  }

  /**
   * Check if targetId is a descendant of parentId
   */
  private async isDescendant(
    organizationId: string,
    targetId: string,
    parentId: string,
  ): Promise<boolean> {
    let currentId: string | null = targetId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === parentId) {
        return true;
      }
      if (visited.has(currentId)) {
        break; // Prevent infinite loop
      }
      visited.add(currentId);

      const folder = await this.db.contentFolder.findFirst({
        where: { id: currentId, organizationId },
        select: { parentId: true },
      });

      currentId = folder?.parentId || null;
    }

    return false;
  }
}
