import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupportService } from './support.service';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { UpdateSupportRequestDto } from './dto/update-support-request.dto';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';
import { SupportQueryDto } from './dto/support-query.dto';

@ApiTags('support')
@Controller('support')
@UseGuards(RolesGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  /**
   * Create a new support request
   * Any authenticated user can create a request
   */
  @Post('requests')
  @ApiOperation({ summary: 'Create a new support request' })
  async createRequest(
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateSupportRequestDto,
  ) {
    return this.supportService.createRequest(userId, organizationId, {
      message: dto.message,
      context: dto.context,
    });
  }

  /**
   * List support requests
   * Regular users: own requests only
   * Admins: all org requests
   * SuperAdmins: all requests
   */
  @Get('requests')
  @ApiOperation({ summary: 'List support requests' })
  async findAll(
    @CurrentUser() user: any,
    @Query() query: SupportQueryDto,
  ) {
    return this.supportService.findAll(
      {
        id: user.id,
        organizationId: user.organizationId,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin || false,
      },
      query,
    );
  }

  /**
   * Get support statistics
   * Admin or SuperAdmin only
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get support request statistics' })
  @Roles('admin')
  async getStats(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('isSuperAdmin') isSuperAdmin: boolean,
  ) {
    return this.supportService.getStats(organizationId, isSuperAdmin || false);
  }

  /**
   * Get a single support request with messages
   * Owner, admin, or superadmin
   */
  @Get('requests/:id')
  @ApiOperation({ summary: 'Get a support request with messages' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.supportService.findOne(id, {
      id: user.id,
      organizationId: user.organizationId,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin || false,
    });
  }

  /**
   * Update a support request (admin/superadmin only)
   */
  @Patch('requests/:id')
  @ApiOperation({ summary: 'Update a support request' })
  @Roles('admin')
  async update(
    @Param('id') id: string,
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('isSuperAdmin') isSuperAdmin: boolean,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateSupportRequestDto,
  ) {
    return this.supportService.update(id, organizationId, isSuperAdmin || false, {
      ...dto,
      resolvedById: dto.status === 'resolved' || dto.status === 'closed' ? userId : undefined,
    });
  }

  /**
   * Add a message to a support request
   * Owner sends as 'user', Admin/SuperAdmin sends as 'admin'
   */
  @Post('requests/:id/messages')
  @ApiOperation({ summary: 'Add a message to a support request' })
  async addMessage(
    @Param('id') requestId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateSupportMessageDto,
  ) {
    return this.supportService.addMessage(requestId, {
      id: user.id,
      organizationId: user.organizationId,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin || false,
    }, dto.content);
  }
}
