import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ContentService } from '../content.service';
import { BulkUpdateDto, BulkArchiveDto, BulkRestoreDto, BulkDeleteDto, BulkTagDto, BulkDurationDto } from '../dto/bulk-operations.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@UseGuards(RolesGuard)
@Controller('content/bulk')
export class BulkOperationsController {
  constructor(private readonly contentService: ContentService) {}

  @Post('update')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  bulkUpdate(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: BulkUpdateDto,
  ) {
    return this.contentService.bulkUpdate(organizationId, dto);
  }

  @Post('archive')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  bulkArchive(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: BulkArchiveDto,
  ) {
    return this.contentService.bulkArchive(organizationId, dto);
  }

  @Post('restore')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  bulkRestore(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: BulkRestoreDto,
  ) {
    return this.contentService.bulkRestore(organizationId, dto);
  }

  @Post('delete')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  bulkDelete(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: BulkDeleteDto,
  ) {
    return this.contentService.bulkDelete(organizationId, dto);
  }

  @Post('tags')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  bulkAddTags(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: BulkTagDto,
  ) {
    return this.contentService.bulkAddTags(organizationId, dto);
  }

  @Post('duration')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  bulkSetDuration(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: BulkDurationDto,
  ) {
    return this.contentService.bulkSetDuration(organizationId, dto);
  }
}
