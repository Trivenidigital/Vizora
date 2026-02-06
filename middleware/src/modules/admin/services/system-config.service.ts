import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface SetConfigDto {
  value: unknown;
  dataType?: 'string' | 'number' | 'boolean' | 'json';
  category?: string;
  description?: string;
  isSecret?: boolean;
}

export interface BulkConfigUpdate {
  key: string;
  value: unknown;
}

@Injectable()
export class SystemConfigService {
  private readonly logger = new Logger(SystemConfigService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get all system configurations
   */
  async findAll() {
    return this.db.systemConfig.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  /**
   * Get configurations by category
   */
  async findByCategory(category: string) {
    return this.db.systemConfig.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });
  }

  /**
   * Get a specific configuration value
   */
  async get(key: string) {
    const config = await this.db.systemConfig.findUnique({
      where: { key },
    });

    if (!config) {
      return null;
    }

    return this.parseValue(config.value, config.dataType);
  }

  /**
   * Get raw config record (for admin UI)
   */
  async getRecord(key: string) {
    const config = await this.db.systemConfig.findUnique({
      where: { key },
    });

    if (!config) {
      throw new NotFoundException(`Configuration '${key}' not found`);
    }

    return config;
  }

  /**
   * Set a configuration value
   */
  async set(key: string, value: unknown, adminUserId: string, options?: Omit<SetConfigDto, 'value'>) {
    const dataType = options?.dataType ?? this.inferDataType(value);
    const jsonValue = this.serializeValue(value, dataType);

    const config = await this.db.systemConfig.upsert({
      where: { key },
      create: {
        key,
        value: jsonValue,
        dataType,
        category: options?.category ?? 'general',
        description: options?.description,
        isSecret: options?.isSecret ?? false,
        updatedBy: adminUserId,
      },
      update: {
        value: jsonValue,
        dataType,
        category: options?.category,
        description: options?.description,
        isSecret: options?.isSecret,
        updatedBy: adminUserId,
      },
    });

    this.logger.log(`Config '${key}' updated by admin ${adminUserId}`);
    return config;
  }

  /**
   * Delete a configuration
   */
  async delete(key: string) {
    const config = await this.db.systemConfig.findUnique({
      where: { key },
    });

    if (!config) {
      throw new NotFoundException(`Configuration '${key}' not found`);
    }

    await this.db.systemConfig.delete({
      where: { key },
    });

    this.logger.log(`Config '${key}' deleted`);
    return { deleted: true };
  }

  /**
   * Bulk update multiple configurations
   */
  async bulkUpdate(configs: BulkConfigUpdate[], adminUserId: string) {
    const results = await this.db.$transaction(
      configs.map(({ key, value }) => {
        const dataType = this.inferDataType(value);
        const jsonValue = this.serializeValue(value, dataType);

        return this.db.systemConfig.upsert({
          where: { key },
          create: {
            key,
            value: jsonValue,
            dataType,
            category: 'general',
            updatedBy: adminUserId,
          },
          update: {
            value: jsonValue,
            dataType,
            updatedBy: adminUserId,
          },
        });
      })
    );

    this.logger.log(`Bulk updated ${configs.length} configs by admin ${adminUserId}`);
    return results;
  }

  /**
   * Get non-secret configurations for frontend
   */
  async getPublic() {
    const configs = await this.db.systemConfig.findMany({
      where: { isSecret: false },
      orderBy: { key: 'asc' },
    });

    // Convert to key-value object
    return configs.reduce(
      (acc, config) => {
        acc[config.key] = this.parseValue(config.value, config.dataType);
        return acc;
      },
      {} as Record<string, unknown>
    );
  }

  /**
   * Infer data type from value
   */
  private inferDataType(value: unknown): string {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') return 'string';
    return 'json';
  }

  /**
   * Serialize value to JSON format for storage
   */
  private serializeValue(value: unknown, dataType: string): unknown {
    // Prisma JsonB accepts the value directly
    return value;
  }

  /**
   * Parse stored JSON value to appropriate type
   */
  private parseValue(value: unknown, dataType: string): unknown {
    switch (dataType) {
      case 'boolean':
        return Boolean(value);
      case 'number':
        return Number(value);
      case 'string':
        return String(value);
      default:
        return value;
    }
  }
}
