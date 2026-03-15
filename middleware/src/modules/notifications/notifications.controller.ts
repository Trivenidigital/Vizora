import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService, NotificationFilters } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';

@UseGuards(RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Create a manual/system notification (admin only)
   */
  @Post()
  @Roles('admin')
  create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() createNotificationDto: CreateNotificationDto,
  ) {
    return this.notificationsService.create({
      ...createNotificationDto,
      organizationId,
    });
  }

  /**
   * Get all notifications with pagination and filters
   */
  @Get()
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: NotificationQueryDto,
  ) {
    // Parse read filter
    const filters: NotificationFilters = {};
    if (query.read === 'true') {
      filters.read = true;
    } else if (query.read === 'false') {
      filters.read = false;
    }
    if (query.severity) {
      filters.severity = query.severity;
    }

    return this.notificationsService.findAll(organizationId, filters, {
      page: query.page,
      limit: query.limit,
    });
  }

  /**
   * Get unread notification count
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser('organizationId') organizationId: string) {
    const count = await this.notificationsService.getUnreadCount(organizationId);
    return { count };
  }

  /**
   * Mark all notifications as read
   */
  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  markAllAsRead(@CurrentUser('organizationId') organizationId: string) {
    return this.notificationsService.markAllAsRead(organizationId);
  }

  /**
   * Mark a single notification as read
   */
  @Patch(':id/read')
  markAsRead(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
  ) {
    return this.notificationsService.markAsRead(organizationId, id);
  }

  /**
   * Dismiss a notification
   */
  @Patch(':id/dismiss')
  dismiss(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
  ) {
    return this.notificationsService.dismiss(organizationId, id);
  }
}
