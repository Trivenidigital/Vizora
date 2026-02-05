import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client | null = null;
  private bucket: string;
  private available = false;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('MINIO_BUCKET') || 'vizora-content';
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  /**
   * Connect to MinIO and ensure bucket exists
   */
  private async connect(): Promise<void> {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT');
    const port = this.configService.get<number>('MINIO_PORT') || 9000;
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY');
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY');
    const useSSL = this.configService.get<string>('MINIO_USE_SSL') === 'true';

    // Check for required configuration
    if (!endpoint || !accessKey || !secretKey) {
      this.logger.warn('MinIO configuration incomplete - storage service will be unavailable');
      this.available = false;
      return;
    }

    try {
      this.client = new Minio.Client({
        endPoint: endpoint,
        port: port,
        useSSL: useSSL,
        accessKey: accessKey,
        secretKey: secretKey,
      });

      // Test connection by checking if bucket exists
      const bucketExists = await this.client.bucketExists(this.bucket);

      if (!bucketExists) {
        this.logger.log(`Creating bucket: ${this.bucket}`);
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Bucket created: ${this.bucket}`);
      }

      this.available = true;
      this.logger.log(`MinIO connected successfully (bucket: ${this.bucket})`);
    } catch (error) {
      this.available = false;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`MinIO connection failed: ${errorMessage} - screenshot feature may not work`);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Check if MinIO is available for use
   */
  isMinioAvailable(): boolean {
    return this.available && this.client !== null;
  }

  /**
   * Generate a standardized object key for screenshots
   * Format: screenshots/{organizationId}/{deviceId}/{timestamp}.png
   */
  generateScreenshotKey(orgId: string, deviceId: string): string {
    const timestamp = Date.now();
    return `screenshots/${orgId}/${deviceId}/${timestamp}.png`;
  }

  /**
   * Upload a screenshot to MinIO
   * @param buffer Screenshot data as Buffer
   * @param objectKey The key to store the object under
   * @returns The object key that was used to store the file
   */
  async uploadScreenshot(buffer: Buffer, objectKey: string): Promise<string> {
    if (!this.client || !this.available) {
      throw new Error('MinIO is not available');
    }

    try {
      await this.client.putObject(
        this.bucket,
        objectKey,
        buffer,
        buffer.length,
        {
          'Content-Type': 'image/png',
        },
      );

      this.logger.debug(`Screenshot uploaded to MinIO: ${objectKey}`);
      return objectKey;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to upload screenshot to MinIO: ${errorMessage}`);
      throw new Error(`MinIO upload failed: ${errorMessage}`);
    }
  }

  /**
   * Generate a presigned URL for downloading a screenshot
   * @param objectKey The key of the object
   * @param expirySeconds How long the URL should be valid (default: 1 hour)
   * @returns A presigned URL that can be used to download the file
   */
  async getPresignedUrl(objectKey: string, expirySeconds = 3600): Promise<string> {
    if (!this.client || !this.available) {
      throw new Error('MinIO is not available');
    }

    try {
      const url = await this.client.presignedGetObject(
        this.bucket,
        objectKey,
        expirySeconds,
      );

      this.logger.debug(`Generated presigned URL for: ${objectKey} (expires in ${expirySeconds}s)`);
      return url;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to generate presigned URL: ${errorMessage}`);
      throw new Error(`Failed to generate presigned URL: ${errorMessage}`);
    }
  }
}
