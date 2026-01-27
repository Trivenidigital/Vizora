import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

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

  // Get by ID - only allow access to own organization
  @Get(':id')
  async findOne(
    @CurrentUser('organizationId') userOrgId: string,
    @Param('id') id: string,
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
    @Param('id') id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ) {
    if (userOrgId !== id) {
      throw new ForbiddenException('You can only update your own organization');
    }
    return this.organizationsService.update(id, updateOrganizationDto);
  }

  // Delete - only allow deleting own organization (and must be admin)
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async remove(
    @CurrentUser('organizationId') userOrgId: string,
    @Param('id') id: string,
  ) {
    if (userOrgId !== id) {
      throw new ForbiddenException('You can only delete your own organization');
    }
    return this.organizationsService.remove(id);
  }
}
