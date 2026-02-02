import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  MaxFileSizeValidator,
  ParseFilePipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ContentService } from './content.service';
import { ThumbnailService } from './thumbnail.service';
import { FileValidationService } from './file-validation.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import * as fs from 'fs';
import * as path from 'path';

@Controller('content')
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly thumbnailService: ThumbnailService,
    private readonly fileValidationService: FileValidationService,
  ) {}

  @Post()
  async create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() createContentDto: CreateContentDto,
  ) {
    // Validate URL if provided
    if (createContentDto.url) {
      this.fileValidationService.validateUrl(createContentDto.url);
    }
    return this.contentService.create(organizationId, createContentDto);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @CurrentUser('organizationId') organizationId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name?: string,
    @Body('type') type?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file using magic numbers, size, etc.
    const validation = await this.fileValidationService.validateFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // Sanitize filename
    const safeFilename = this.fileValidationService.sanitizeFilename(
      file.originalname,
    );

    // Save file to local uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `${validation.hash}-${safeFilename}`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    // Use full URL so Electron app can access it via HTTP
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const fileUrl = `${baseUrl}/uploads/${filename}`;

    // Determine the content type from the file mimetype
    const contentType = type || (file.mimetype.startsWith('video/') ? 'video' :
                                 file.mimetype.startsWith('image/') ? 'image' :
                                 file.mimetype === 'application/pdf' ? 'pdf' : 'url');

    // For images, use the image URL as the thumbnail
    const thumbnailUrl = contentType === 'image' ? fileUrl : undefined;

    // Create content record (fileHash stored in metadata since not in schema)
    const content = await this.contentService.create(organizationId, {
      name: name || safeFilename,
      type: contentType,
      url: fileUrl,
      thumbnail: thumbnailUrl,
      fileSize: file.size,
      mimeType: file.mimetype,
      metadata: { fileHash: validation.hash },
    } as any);

    return {
      success: true,
      content,
      fileHash: validation.hash,
    };
  }

  @Get()
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.contentService.findAll(organizationId, pagination, { type, status });
  }

  @Get(':id')
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.findOne(organizationId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updateContentDto: UpdateContentDto,
  ) {
    return this.contentService.update(organizationId, id, updateContentDto);
  }

  @Post(':id/thumbnail')
  @HttpCode(HttpStatus.OK)
  async generateThumbnail(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    // Get content
    const content = await this.contentService.findOne(organizationId, id);
    
    if (content.type !== 'image') {
      return { message: 'Thumbnail generation only supported for images', thumbnail: null };
    }

    // Generate thumbnail from URL
    const thumbnailUrl = await this.thumbnailService.generateThumbnailFromUrl(
      content.id,
      content.url,
    );

    // Update content with thumbnail URL
    await this.contentService.update(organizationId, id, { thumbnail: thumbnailUrl } as any);

    return { thumbnail: thumbnailUrl };
  }

  @Post(':id/archive')
  archive(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.archive(organizationId, id);
  }

  @Delete(':id')
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.remove(organizationId, id);
  }
}
