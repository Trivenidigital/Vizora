import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { CircuitBreakerService } from '../../common/services/circuit-breaker.service';
import { WidgetDataSource } from './widget-data-source.interface';

const RSS_CIRCUIT_CONFIG = {
  failureThreshold: 3,
  resetTimeout: 30000, // 30 seconds
  successThreshold: 2,
  failureWindow: 60000,
};

/**
 * RSS / Atom feed widget data source.
 *
 * Fetches and parses RSS 2.0 and Atom feeds using built-in fetch + simple
 * regex-based XML extraction so we avoid adding an extra dependency.
 */
@Injectable()
export class RssDataSource implements WidgetDataSource {
  private readonly logger = new Logger(RssDataSource.name);

  readonly type = 'rss';

  private readonly REQUEST_TIMEOUT = 15000;

  constructor(private readonly circuitBreaker: CircuitBreakerService) {}

  async fetchData(config: Record<string, any>): Promise<Record<string, any>> {
    const feedUrl = config.feedUrl;
    if (!feedUrl) {
      this.logger.warn('No feedUrl provided, returning sample data');
      return this.getSampleData();
    }

    // SSRF validation: block private/internal addresses
    const url = new URL(feedUrl);
    const hostname = url.hostname.toLowerCase();
    const blockedPatterns = [
      /^localhost$/i, /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./, /^0\./, /^169\.254\./, /^::1$/, /^fc00:/i, /^fe80:/i,
    ];
    if (blockedPatterns.some(p => p.test(hostname))) {
      throw new BadRequestException('Feed URL points to a blocked address');
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new BadRequestException('Feed URL must use HTTP or HTTPS');
    }

    const maxItems = config.maxItems ?? 10;

    return this.circuitBreaker.executeWithFallback(
      'rss-feed',
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

        let xml: string;
        try {
          const res = await fetch(feedUrl, {
            headers: {
              'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml',
              'User-Agent': 'Vizora-Widget/1.0',
            },
            signal: controller.signal,
          });

          if (!res.ok) {
            throw new Error(`Feed returned HTTP ${res.status}`);
          }

          xml = await res.text();
        } finally {
          clearTimeout(timeoutId);
        }

        return this.parseXml(xml, maxItems);
      },
      () => {
        this.logger.warn('RSS feed circuit open or failed, returning sample data');
        return this.getSampleData();
      },
      RSS_CIRCUIT_CONFIG,
    );
  }

  // -----------------------------------------------------------------------
  // Simple XML parsing (regex-based, no extra dependencies)
  // -----------------------------------------------------------------------

  private parseXml(xml: string, maxItems: number): Record<string, any> {
    // Detect Atom vs RSS
    const isAtom = /<feed[\s>]/i.test(xml);

    if (isAtom) {
      return this.parseAtom(xml, maxItems);
    }
    return this.parseRss(xml, maxItems);
  }

  private parseRss(xml: string, maxItems: number): Record<string, any> {
    const feedTitle = this.extractTag(xml, 'title') || '';
    const feedDescription = this.extractTag(xml, 'description') || '';

    const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
    const items: Record<string, any>[] = [];
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
      const block = match[1];
      const title = this.extractTag(block, 'title') || '';
      const link = this.extractTag(block, 'link') || '';
      const description = this.stripHtml(this.extractTag(block, 'description') || '');
      const pubDate = this.extractTag(block, 'pubDate') || '';

      // Try to find an image in <enclosure>, <media:content>, or description HTML
      let imageUrl = this.extractEnclosureUrl(block) || this.extractMediaUrl(block) || '';
      if (!imageUrl) {
        const imgMatch = /<img[^>]+src=["']([^"']+)["']/i.exec(
          this.extractTag(match[1], 'description') || '',
        );
        if (imgMatch) {
          imageUrl = imgMatch[1];
        }
      }

      items.push({ title, link, description, pubDate, imageUrl });
    }

    return { items, feedTitle, feedDescription };
  }

  private parseAtom(xml: string, maxItems: number): Record<string, any> {
    const feedTitle = this.extractTag(xml, 'title') || '';
    const feedDescription = this.extractTag(xml, 'subtitle') || '';

    const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
    const items: Record<string, any>[] = [];
    let match: RegExpExecArray | null;

    while ((match = entryRegex.exec(xml)) !== null && items.length < maxItems) {
      const block = match[1];
      const title = this.extractTag(block, 'title') || '';
      const linkMatch = /<link[^>]+href=["']([^"']+)["']/i.exec(block);
      const link = linkMatch ? linkMatch[1] : '';
      const description = this.stripHtml(
        this.extractTag(block, 'summary') || this.extractTag(block, 'content') || '',
      );
      const pubDate = this.extractTag(block, 'published') || this.extractTag(block, 'updated') || '';
      const imageUrl = this.extractMediaUrl(block) || '';

      items.push({ title, link, description, pubDate, imageUrl });
    }

    return { items, feedTitle, feedDescription };
  }

  /**
   * Extract the text content of the first occurrence of a given XML tag.
   * Handles both regular and CDATA content.
   */
  private extractTag(xml: string, tag: string): string | null {
    // Match <tag>...</tag> or <tag ...>...</tag> (non-greedy)
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
    const match = regex.exec(xml);
    if (!match) return null;

    let content = match[1].trim();
    // Unwrap CDATA
    const cdataMatch = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(content);
    if (cdataMatch) {
      content = cdataMatch[1];
    }
    // Decode common XML entities
    return content
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  private extractEnclosureUrl(block: string): string | null {
    const match = /<enclosure[^>]+url=["']([^"']+)["']/i.exec(block);
    return match ? match[1] : null;
  }

  private extractMediaUrl(block: string): string | null {
    const match = /<media:content[^>]+url=["']([^"']+)["']/i.exec(block);
    return match ? match[1] : null;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').trim();
  }

  // -----------------------------------------------------------------------
  // Interface methods
  // -----------------------------------------------------------------------

  getConfigSchema(): Record<string, any> {
    return {
      type: 'object',
      properties: {
        feedUrl: {
          type: 'string',
          description: 'URL of the RSS or Atom feed',
        },
        maxItems: {
          type: 'number',
          description: 'Maximum number of items to display',
          minimum: 1,
          maximum: 50,
          default: 10,
        },
        showImages: {
          type: 'boolean',
          description: 'Whether to show item images',
          default: true,
        },
        layout: {
          type: 'string',
          enum: ['list', 'ticker', 'cards'],
          description: 'Display layout for the feed',
          default: 'list',
        },
      },
      required: ['feedUrl'],
    };
  }

  getDefaultTemplate(): string {
    return 'rss-list';
  }

  getSampleData(): Record<string, any> {
    return {
      items: [
        {
          title: 'Global Markets Rally as Tech Stocks Surge',
          link: 'https://example.com/news/1',
          description: 'Major stock indices posted strong gains on Monday as technology companies reported better-than-expected earnings.',
          pubDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          imageUrl: 'https://picsum.photos/seed/news1/400/240',
        },
        {
          title: 'New Study Reveals Benefits of Remote Work',
          link: 'https://example.com/news/2',
          description: 'A comprehensive study spanning 50 companies found that hybrid work arrangements led to a 23% increase in employee satisfaction.',
          pubDate: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          imageUrl: 'https://picsum.photos/seed/news2/400/240',
        },
        {
          title: 'City Council Approves Green Infrastructure Plan',
          link: 'https://example.com/news/3',
          description: 'The ambitious $2.5 billion plan includes solar panel installations, EV charging stations, and urban green spaces across the metro area.',
          pubDate: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          imageUrl: 'https://picsum.photos/seed/news3/400/240',
        },
        {
          title: 'SpaceX Successfully Launches New Satellite Constellation',
          link: 'https://example.com/news/4',
          description: 'The latest batch of 60 satellites will provide high-speed internet to underserved regions in Africa and Southeast Asia.',
          pubDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          imageUrl: 'https://picsum.photos/seed/news4/400/240',
        },
        {
          title: 'Breakthrough in Battery Technology Promises Faster Charging',
          link: 'https://example.com/news/5',
          description: 'Researchers have developed a solid-state battery that charges to 80% in just 10 minutes, potentially revolutionizing electric vehicles.',
          pubDate: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
          imageUrl: 'https://picsum.photos/seed/news5/400/240',
        },
      ],
      feedTitle: 'Tech & World News',
      feedDescription: 'The latest technology and world news from around the globe.',
    };
  }
}
