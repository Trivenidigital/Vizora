import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  ForbiddenException,
  BadRequestException,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrganizationsService } from './organizations.service';
import { FeatureFlagService } from './feature-flags.service';
import { StorageQuotaService } from '../storage/storage-quota.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateFeatureFlagsDto } from './dto/update-feature-flags.dto';
import { BrandingConfigDto } from './dto/branding-config.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly featureFlagService: FeatureFlagService,
    private readonly storageQuotaService: StorageQuotaService,
  ) {}

  // Create organization is handled during registration
  // This endpoint should be admin-only for creating additional orgs
  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() createOrganizationDto: CreateOrganizationDto) {
    return this.organizationsService.create(createOrganizationDto);
  }

  // Users can only get their own organization
  @Get('current')
  findCurrent(@CurrentUser('organizationId') organizationId: string) {
    return this.organizationsService.findOne(organizationId);
  }

  // Get storage usage and quota for the current user's organization
  @Get('storage')
  async getStorageInfo(@CurrentUser('organizationId') organizationId: string) {
    return this.storageQuotaService.getStorageInfo(organizationId);
  }

  // Get feature flags for the current user's organization
  @Get('feature-flags')
  async getFeatureFlags(@CurrentUser('organizationId') organizationId: string) {
    return this.featureFlagService.getFlags(organizationId);
  }

  // Update feature flags (admin only)
  @Patch('feature-flags')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async updateFeatureFlags(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: UpdateFeatureFlagsDto,
  ) {
    return this.featureFlagService.setFlags(organizationId, dto as Record<string, boolean>);
  }

  // Get by ID - only allow access to own organization
  @Get(':id')
  async findOne(
    @CurrentUser('organizationId') userOrgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (userOrgId !== id) {
      throw new ForbiddenException('You can only access your own organization');
    }
    return this.organizationsService.findOne(id);
  }

  // Update - only allow updating own organization
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async update(
    @CurrentUser('organizationId') userOrgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ) {
    if (userOrgId !== id) {
      throw new ForbiddenException('You can only update your own organization');
    }
    return this.organizationsService.update(id, updateOrganizationDto);
  }

  // Delete - only allow deleting own organization (and must be admin)
  // Performs full cleanup: MinIO storage, Redis cache, then cascade delete
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async remove(
    @CurrentUser('organizationId') userOrgId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (userOrgId !== id) {
      throw new ForbiddenException('You can only delete your own organization');
    }
    await this.organizationsService.remove(id, userId);
    return { message: 'Organization deleted successfully' };
  }

  // Get branding config for organization
  @Get(':id/branding')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'viewer')
  async getBranding(
    @CurrentUser('organizationId') userOrgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (userOrgId !== id) {
      throw new ForbiddenException('You can only access your own organization');
    }
    return this.organizationsService.getBranding(id);
  }

  // Update branding config for organization
  @Put(':id/branding')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async updateBranding(
    @CurrentUser('organizationId') userOrgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() brandingDto: BrandingConfigDto,
  ) {
    if (userOrgId !== id) {
      throw new ForbiddenException('You can only update your own organization');
    }
    return this.organizationsService.updateBranding(id, brandingDto);
  }

  // Upload logo for organization branding
  @Post(':id/branding/logo')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async uploadLogo(
    @CurrentUser('organizationId') userOrgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (userOrgId !== id) {
      throw new ForbiddenException('You can only update your own organization');
    }
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are accepted. SVG is not allowed.');
    }

    // Validate magic bytes — reject files that lie about their type
    const magicBytes = file.buffer.slice(0, 12);
    const isJpeg = magicBytes[0] === 0xFF && magicBytes[1] === 0xD8 && magicBytes[2] === 0xFF;
    const isPng = magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47;
    const isWebp = magicBytes[0] === 0x52 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46 && magicBytes[3] === 0x46
      && magicBytes[8] === 0x57 && magicBytes[9] === 0x45 && magicBytes[10] === 0x42 && magicBytes[11] === 0x50;

    if (!isJpeg && !isPng && !isWebp) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are accepted. SVG is not allowed.');
    }

    return this.organizationsService.uploadLogo(id, file);
  }
}
