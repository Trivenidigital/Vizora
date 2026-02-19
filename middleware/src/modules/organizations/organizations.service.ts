import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { BrandingConfigDto } from './dto/branding-config.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

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

  async getBranding(orgId: string) {
    const org = await this.db.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    const settings = (org.settings as Record<string, unknown>) || {};
    return settings.branding || {
      name: org.name,
      logoUrl: org.logoUrl,
      primaryColor: '#0284c7',
      secondaryColor: '#38bdf8',
      accentColor: '#0ea5e9',
      fontFamily: 'sans',
      showPoweredBy: true,
      customDomain: '',
      customCSS: '',
    };
  }

  async updateBranding(orgId: string, brandingDto: BrandingConfigDto) {
    const org = await this.findOne(orgId);
    if (brandingDto.customCSS) {
      brandingDto.customCSS = this.sanitizeCSS(brandingDto.customCSS);
    }
    const currentSettings = (org.settings as Record<string, unknown>) || {};
    return this.db.organization.update({
      where: { id: orgId },
      data: {
        settings: { ...currentSettings, branding: brandingDto },
      },
    });
  }

  async uploadLogo(orgId: string, file: Express.Multer.File) {
    await this.findOne(orgId);
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'png';
    const objectKey = `branding/${orgId}/logo.${ext}`;

    if (this.storageService.isMinioAvailable()) {
      await this.storageService.uploadFile(file.buffer, objectKey, file.mimetype);
      const logoUrl = `minio://${objectKey}`;
      await this.db.organization.update({
        where: { id: orgId },
        data: { logoUrl },
      });
      return { logoUrl, objectKey };
    } else {
      const fs = await import('fs');
      const path = await import('path');
      const uploadsDir = path.join(process.cwd(), 'uploads', 'branding');
      await fs.promises.mkdir(uploadsDir, { recursive: true });
      const filePath = path.join(uploadsDir, `${orgId}-logo.${ext}`);
      await fs.promises.writeFile(filePath, file.buffer);
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
      const logoUrl = `${baseUrl}/uploads/branding/${orgId}-logo.${ext}`;
      await this.db.organization.update({
        where: { id: orgId },
        data: { logoUrl },
      });
      return { logoUrl };
    }
  }

  private sanitizeCSS(css: string): string {
    const dangerous = [
      /@import\b/gi,
      /expression\s*\(/gi,
      /javascript\s*:/gi,
      /behavior\s*:/gi,
      /-moz-binding\s*:/gi,
      /url\s*\(\s*['"]?\s*(?!https?:\/\/|data:)/gi,
    ];
    let sanitized = css;
    for (const pattern of dangerous) {
      sanitized = sanitized.replace(pattern, '/* blocked */');
    }
    return sanitized;
  }
}
