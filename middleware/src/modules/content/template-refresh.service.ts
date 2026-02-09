import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@vizora/database';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { TemplateRenderingService } from './template-rendering.service';
import { TemplateMetadata } from './content.service';

/**
 * Service for handling scheduled template data refreshes
 */
@Injectable()
export class TemplateRefreshService {
  private readonly logger = new Logger(TemplateRefreshService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly templateRendering: TemplateRenderingService,
  ) {}

  /**
   * Cron job that runs every minute to check for templates that need refreshing
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processTemplateRefresh(): Promise<{ processed: number; errors: number }> {
    const now = new Date();
    let processed = 0;
    let errors = 0;

    try {
      // Find all template content with refresh enabled
      const templates = await this.db.content.findMany({
        where: {
          type: 'template',
          status: 'active',
        },
      });

      for (const template of templates) {
        const metadata = template.metadata as TemplateMetadata | null;

        if (!metadata || !metadata.refreshConfig?.enabled) {
          continue;
        }

        // Check if refresh is due
        const lastRefresh = metadata.refreshConfig.lastRefresh
          ? new Date(metadata.refreshConfig.lastRefresh)
          : null;

        const intervalMs = metadata.refreshConfig.intervalMinutes * 60 * 1000;
        const nextRefresh = lastRefresh
          ? new Date(lastRefresh.getTime() + intervalMs)
          : new Date(0); // If never refreshed, refresh now

        if (now >= nextRefresh) {
          try {
            await this.refreshTemplate(template.id, template);
            processed++;
            this.logger.debug(`Refreshed template: ${template.name} (${template.id})`);
          } catch (error) {
            errors++;
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to refresh template ${template.id}: ${message}`);
          }
        }
      }

      if (processed > 0 || errors > 0) {
        this.logger.log(`Template refresh completed: ${processed} processed, ${errors} errors`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Template refresh job failed: ${message}`);
    }

    return { processed, errors };
  }

  /**
   * Refresh a single template by ID
   */
  async refreshTemplate(contentId: string, prefetchedContent?: any): Promise<void> {
    const content = prefetchedContent ?? await this.db.content.findUnique({
      where: { id: contentId },
    });

    if (!content || content.type !== 'template') {
      throw new Error(`Content ${contentId} is not a template`);
    }

    const metadata = content.metadata as TemplateMetadata | null;

    if (!metadata?.templateHtml) {
      throw new Error(`Template ${contentId} has no HTML`);
    }

    // Fetch fresh data
    let data = metadata.sampleData || {};

    try {
      if (metadata.dataSource.type !== 'manual' && metadata.dataSource.url) {
        data = await this.templateRendering.fetchDataFromSource(metadata.dataSource);
      } else if (metadata.dataSource.type === 'manual' && metadata.dataSource.manualData) {
        data = metadata.dataSource.manualData;
      }

      // Render template with fresh data
      const renderedHtml = this.templateRendering.processTemplate(
        metadata.templateHtml,
        data,
      );

      // Update the content with new rendered HTML
      const updatedMetadata: TemplateMetadata = {
        ...metadata,
        renderedHtml,
        renderedAt: new Date().toISOString(),
        refreshConfig: {
          ...metadata.refreshConfig,
          lastRefresh: new Date().toISOString(),
          lastError: undefined,
        },
      };

      await this.db.content.update({
        where: { id: contentId },
        data: {
          metadata: updatedMetadata as unknown as Prisma.InputJsonValue,
        },
      });

      this.logger.debug(`Template ${contentId} refreshed successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Update error in metadata but keep the old rendered HTML
      const updatedMetadata: TemplateMetadata = {
        ...metadata,
        refreshConfig: {
          ...metadata.refreshConfig,
          lastRefresh: new Date().toISOString(),
          lastError: message,
        },
      };

      await this.db.content.update({
        where: { id: contentId },
        data: {
          metadata: updatedMetadata as unknown as Prisma.InputJsonValue,
        },
      });

      throw error;
    }
  }

  /**
   * Manually trigger a refresh for a specific template
   * This is called from the ContentService
   */
  async triggerManualRefresh(contentId: string): Promise<void> {
    await this.refreshTemplate(contentId);
  }
}
