import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ContentService } from '../content.service';
import { CreateWidgetDto } from '../dto/create-widget.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

/** Maximum response body size from Google Sheets (2 MB). */
const MAX_SHEET_RESPONSE_BYTES = 2 * 1024 * 1024;

@UseGuards(RolesGuard)
@Controller('content/widgets')
export class WidgetsController {
  private readonly logger = new Logger(WidgetsController.name);

  constructor(private readonly contentService: ContentService) {}

  @Get()
  @Roles('admin', 'manager', 'viewer')
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.contentService.findAllWidgets(organizationId, pagination);
  }

  @Get('types')
  @Roles('admin', 'manager', 'viewer')
  getWidgetTypes() {
    return this.contentService.getWidgetTypes();
  }

  @Get('weather/preview')
  @Roles('admin', 'manager', 'viewer')
  getWeatherPreview(
    @Query('location') location: string,
    @Query('units') units: string = 'metric',
  ) {
    // Whitelist units to prevent parameter injection (e.g., "metric&appid=STOLEN")
    if (!['metric', 'imperial', 'standard'].includes(units)) {
      units = 'metric';
    }
    // Sanitize location to prevent URL injection
    const sanitizedLocation = encodeURIComponent(location || 'New York');
    return this.contentService.getWeatherPreview(decodeURIComponent(sanitizedLocation), units);
  }

  @Get('sheets/preview')
  @Roles('admin', 'manager', 'viewer')
  async getSheetData(
    @Query('url') sheetUrl: string,
    @Query('sheet') sheetName: string = 'Sheet1',
  ) {
    // ---- URL validation ----
    if (!sheetUrl || !sheetUrl.includes('docs.google.com/spreadsheets')) {
      throw new BadRequestException('Invalid Google Sheets URL');
    }

    // SSRF: only allow Google Sheets domain
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(sheetUrl);
    } catch {
      throw new BadRequestException('Malformed URL');
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname !== 'docs.google.com') {
      throw new BadRequestException('URL must be a Google Sheets URL (docs.google.com)');
    }
    if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
      throw new BadRequestException('URL must use HTTPS or HTTP');
    }

    // SSRF: block private / internal IP patterns (defense-in-depth)
    const blockedPatterns = [
      /^localhost$/i, /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./, /^0\./, /^169\.254\./, /^::1$/, /^fc00:/i, /^fe80:/i,
    ];
    if (blockedPatterns.some(p => p.test(hostname))) {
      throw new BadRequestException('URL points to a blocked address');
    }

    // Extract sheet ID
    const idMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!idMatch) {
      throw new BadRequestException('Could not extract sheet ID from URL');
    }
    const sheetId = idMatch[1];

    // ---- Fetch published sheet data ----
    const fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

    let response: Response;
    try {
      response = await fetch(fetchUrl, {
        signal: AbortSignal.timeout(10_000),
        headers: { 'User-Agent': 'Vizora/1.0 Digital Signage' },
      });
    } catch (err: any) {
      this.logger.warn(`Google Sheets fetch failed: ${err.message}`);
      throw new NotFoundException('Could not fetch sheet data. Ensure the sheet is published to web.');
    }

    if (!response.ok) {
      throw new NotFoundException('Could not fetch sheet data. Ensure the sheet is published to web.');
    }

    const text = await response.text();

    // Enforce 2 MB size limit
    if (Buffer.byteLength(text, 'utf8') > MAX_SHEET_RESPONSE_BYTES) {
      throw new BadRequestException('Sheet data exceeds the 2 MB size limit');
    }

    // Google wraps JSON in: google.visualization.Query.setResponse({...})
    const jsonStr = text.replace(/^[^(]*\(/, '').replace(/\);?\s*$/, '');
    let data: any;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      throw new BadRequestException('Failed to parse sheet data. Ensure the sheet is published to web.');
    }

    // Extract headers and rows
    const headers = (data.table?.cols || []).map((col: any) => col.label || col.id);
    const rows = (data.table?.rows || []).map((row: any) =>
      (row.c || []).map((cell: any) => cell?.v ?? cell?.f ?? ''),
    );

    return {
      sheetId,
      sheetName,
      headers,
      rows,
      rowCount: rows.length,
      fetchedAt: new Date().toISOString(),
    };
  }

  @Post()
  @Roles('admin', 'manager')
  createWidget(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateWidgetDto,
  ) {
    return this.contentService.createWidget(organizationId, dto);
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  updateWidget(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: Partial<CreateWidgetDto>,
  ) {
    return this.contentService.updateWidget(organizationId, id, dto);
  }

  @Post(':id/refresh')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  refreshWidget(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
  ) {
    return this.contentService.refreshWidget(organizationId, id);
  }
}
