import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CircuitBreakerService } from '../common/services/circuit-breaker.service';
import * as Minio from 'minio';

const MINIO_CIRCUIT_CONFIG = {
  failureThreshold: 3,
  resetTimeout: 15000, // 15 seconds
  successThreshold: 2,
  failureWindow: 60000,
};

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client | null = null;
  private bucket: string;
  private available = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {
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
      this.logger.warn(`MinIO connection failed: ${errorMessage} - falling back to local storage`);
      // Don't throw - graceful degradation to local storage
    }
  }

  /**
   * Check if MinIO is available for use
   */
  isMinioAvailable(): boolean {
    return this.available && this.client !== null;
  }

  /**
   * Generate a standardized object key for storage
   * Format: {organizationId}/{hash}-{filename}
   */
  generateObjectKey(orgId: string, hash: string, filename: string): string {
    // Sanitize filename - remove path separators and dangerous characters
    const sanitizedFilename = filename
      .replace(/[/\\:*?"<>|]/g, '-')
      .replace(/\s+/g, '_')
      .toLowerCase();

    return `${orgId}/${hash}-${sanitizedFilename}`;
  }

  /**
   * Upload a file to MinIO
   * @param buffer File content as Buffer
   * @param objectKey The key to store the object under
   * @param mimeType The MIME type of the file
   * @returns The object key that was used to store the file
   */
  async uploadFile(buffer: Buffer, objectKey: string, mimeType: string): Promise<string> {
    if (!this.client || !this.available) {
      throw new Error('MinIO is not available');
    }

    return this.circuitBreaker.execute(
      'minio-upload',
      async () => {
        await this.client!.putObject(
          this.bucket,
          objectKey,
          buffer,
          buffer.length,
          {
            'Content-Type': mimeType,
          },
        );

        this.logger.debug(`File uploaded to MinIO: ${objectKey}`);
        return objectKey;
      },
      MINIO_CIRCUIT_CONFIG,
    );
  }

  /**
   * Generate a presigned URL for downloading a file
   * @param objectKey The key of the object
   * @param expirySeconds How long the URL should be valid (default: 1 hour)
   * @returns A presigned URL that can be used to download the file
   */
  async getPresignedUrl(objectKey: string, expirySeconds = 3600): Promise<string> {
    if (!this.client || !this.available) {
      throw new Error('MinIO is not available');
    }

    return this.circuitBreaker.execute(
      'minio-presigned-url',
      async () => {
        const url = await this.client!.presignedGetObject(
          this.bucket,
          objectKey,
          expirySeconds,
        );

        this.logger.debug(`Generated presigned URL for: ${objectKey} (expires in ${expirySeconds}s)`);
        return url;
      },
      MINIO_CIRCUIT_CONFIG,
    );
  }

  /**
   * Delete a file from MinIO
   * @param objectKey The key of the object to delete
   */
  async deleteFile(objectKey: string): Promise<void> {
    if (!this.client || !this.available) {
      throw new Error('MinIO is not available');
    }

    return this.circuitBreaker.execute(
      'minio-delete',
      async () => {
        await this.client!.removeObject(this.bucket, objectKey);
        this.logger.debug(`File deleted from MinIO: ${objectKey}`);
      },
      MINIO_CIRCUIT_CONFIG,
    );
  }

  /**
   * Check if a file exists in MinIO
   * @param objectKey The key of the object to check
   * @returns True if the object exists, false otherwise
   */
  async fileExists(objectKey: string): Promise<boolean> {
    if (!this.client || !this.available) {
      return false;
    }

    try {
      await this.client.statObject(this.bucket, objectKey);
      return true;
    } catch (error) {
      // NotFound errors are expected for non-existent objects
      if (error instanceof Error && error.message.includes('Not Found')) {
        return false;
      }
      // Log unexpected errors
      this.logger.error(`Error checking file existence: ${error}`);
      return false;
    }
  }

  /**
   * Get file metadata from MinIO
   * @param objectKey The key of the object
   * @returns Object metadata or null if not found
   */
  async getFileMetadata(objectKey: string): Promise<{
    size: number;
    lastModified: Date;
    contentType: string;
  } | null> {
    if (!this.client || !this.available) {
      return null;
    }

    try {
      const stat = await this.client.statObject(this.bucket, objectKey);
      return {
        size: stat.size,
        lastModified: stat.lastModified,
        contentType: stat.metaData?.['content-type'] || 'application/octet-stream',
      };
    } catch (error) {
      this.logger.debug(`File metadata not found for: ${objectKey}`);
      return null;
    }
  }

  /**
   * Get the bucket name being used
   */
  getBucket(): string {
    return this.bucket;
  }

  /**
   * Get an object stream from MinIO
   * @param objectKey The key of the object
   * @returns A readable stream of the object data
   */
  async getObject(objectKey: string): Promise<NodeJS.ReadableStream> {
    if (!this.client || !this.available) {
      throw new Error('MinIO is not available');
    }

    return this.circuitBreaker.execute(
      'minio-get-object',
      () => this.client!.getObject(this.bucket, objectKey),
      MINIO_CIRCUIT_CONFIG,
    );
  }

  /**
   * Health check for MinIO connection
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    bucket: string;
    error?: string;
  }> {
    if (!this.client || !this.available) {
      return {
        healthy: false,
        bucket: this.bucket,
        error: 'MinIO client not available',
      };
    }

    try {
      const exists = await this.client.bucketExists(this.bucket);
      return {
        healthy: exists,
        bucket: this.bucket,
        error: exists ? undefined : 'Bucket does not exist',
      };
    } catch (error) {
      return {
        healthy: false,
        bucket: this.bucket,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * List objects in a prefix (directory-like listing)
   * @param prefix The prefix to list objects under
   * @param maxKeys Maximum number of keys to return
   */
  async listObjects(prefix: string, maxKeys = 100): Promise<string[]> {
    if (!this.client || !this.available) {
      return [];
    }

    const objects: string[] = [];
    const stream = this.client.listObjects(this.bucket, prefix, true);

    return new Promise((resolve, reject) => {
      let count = 0;
      stream.on('data', (obj) => {
        if (obj.name) {
          objects.push(obj.name);
          count++;
          if (count >= maxKeys) {
            stream.destroy();
          }
        }
      });
      stream.on('error', (err) => {
        this.logger.error(`Error listing objects: ${err}`);
        reject(err);
      });
      stream.on('end', () => {
        resolve(objects);
      });
      stream.on('close', () => {
        resolve(objects);
      });
    });
  }

  /**
   * Copy an object within the same bucket
   * @param sourceKey Source object key
   * @param destKey Destination object key
   */
  async copyFile(sourceKey: string, destKey: string): Promise<void> {
    if (!this.client || !this.available) {
      throw new Error('MinIO is not available');
    }

    return this.circuitBreaker.execute(
      'minio-copy',
      async () => {
        const conditions = new Minio.CopyConditions();
        await this.client!.copyObject(
          this.bucket,
          destKey,
          `/${this.bucket}/${sourceKey}`,
          conditions,
        );
        this.logger.debug(`File copied: ${sourceKey} -> ${destKey}`);
      },
      MINIO_CIRCUIT_CONFIG,
    );
  }
}
