import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly db: DatabaseService) {}

  async create(createOrganizationDto: CreateOrganizationDto) {
    const existing = await this.db.organization.findUnique({
      where: { slug: createOrganizationDto.slug },
    });

    if (existing) {
      throw new ConflictException('Organization with this slug already exists');
    }

    return this.db.organization.create({
      data: createOrganizationDto,
    });
  }

  async findAll(pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.db.organization.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.organization.count(),
    ]);

    return new PaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string) {
    const organization = await this.db.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            displays: true,
            content: true,
            playlists: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async findBySlug(slug: string) {
    const organization = await this.db.organization.findUnique({
      where: { slug },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async update(id: string, updateOrganizationDto: UpdateOrganizationDto) {
    await this.findOne(id);

    if (updateOrganizationDto.slug) {
      const existing = await this.db.organization.findFirst({
        where: {
          slug: updateOrganizationDto.slug,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException('Organization with this slug already exists');
      }
    }

    return this.db.organization.update({
      where: { id },
      data: updateOrganizationDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.db.organization.delete({
      where: { id },
    });
  }
}
