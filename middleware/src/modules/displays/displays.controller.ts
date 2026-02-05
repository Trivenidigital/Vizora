import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { DisplaysService } from './displays.service';
import { CreateDisplayDto } from './dto/create-display.dto';
import { UpdateDisplayDto } from './dto/update-display.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('displays')
export class DisplaysController {
  constructor(private readonly displaysService: DisplaysService) {}

  @Post()
  create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() createDisplayDto: CreateDisplayDto,
  ) {
    return this.displaysService.create(organizationId, createDisplayDto);
  }

  @Get()
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.displaysService.findAll(organizationId, pagination);
  }

  @Get(':id')
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.displaysService.findOne(organizationId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updateDisplayDto: UpdateDisplayDto,
  ) {
    return this.displaysService.update(organizationId, id, updateDisplayDto);
  }

  @Post(':id/pair')
  async generatePairingToken(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.displaysService.generatePairingToken(organizationId, id);
  }

  @Post(':deviceId/heartbeat')
  @Public()
  heartbeat(@Param('deviceId') deviceId: string) {
    return this.displaysService.updateHeartbeat(deviceId);
  }

  @Delete(':id')
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.displaysService.remove(organizationId, id);
  }

  @Get(':id/tags')
  getTags(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.displaysService.getTags(organizationId, id);
  }

  @Post(':id/tags')
  addTags(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() body: { tagIds: string[] },
  ) {
    return this.displaysService.addTags(organizationId, id, body.tagIds);
  }

  @Delete(':id/tags')
  removeTags(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() body: { tagIds: string[] },
  ) {
    return this.displaysService.removeTags(organizationId, id, body.tagIds);
  }

  @Post(':id/push-content')
  pushContent(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() body: { contentId: string; duration?: number },
  ) {
    return this.displaysService.pushContent(
      organizationId,
      id,
      body.contentId,
      body.duration,
    );
  }
}
