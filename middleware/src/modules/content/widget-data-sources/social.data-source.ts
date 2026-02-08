import { Injectable, Logger } from '@nestjs/common';
import { WidgetDataSource } from './widget-data-source.interface';

// =============================================================================
// Instagram Data Source (stub -- real API integration deferred)
// =============================================================================

@Injectable()
export class InstagramDataSource implements WidgetDataSource {
  private readonly logger = new Logger(InstagramDataSource.name);

  readonly type = 'social_instagram';

  async fetchData(config: Record<string, any>): Promise<Record<string, any>> {
    // Stub: real Instagram Graph API integration deferred
    this.logger.debug('Instagram fetchData called (stub), returning sample data');
    return this.getSampleData();
  }

  getConfigSchema(): Record<string, any> {
    return {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          description: 'Instagram Graph API access token',
        },
        feedType: {
          type: 'string',
          enum: ['user', 'hashtag', 'tagged'],
          description: 'Type of feed to display',
          default: 'user',
        },
        maxPosts: {
          type: 'number',
          description: 'Maximum number of posts to display',
          minimum: 1,
          maximum: 30,
          default: 9,
        },
        showCaptions: {
          type: 'boolean',
          description: 'Whether to show post captions',
          default: true,
        },
        layout: {
          type: 'string',
          enum: ['grid', 'carousel', 'wall'],
          description: 'Display layout for the posts',
          default: 'grid',
        },
      },
      required: ['accessToken'],
    };
  }

  getDefaultTemplate(): string {
    return 'social-grid';
  }

  getSampleData(): Record<string, any> {
    return {
      platform: 'instagram',
      username: '@vizora_official',
      profileImage: 'https://picsum.photos/seed/ig-profile/150/150',
      posts: [
        {
          id: 'ig-001',
          imageUrl: 'https://picsum.photos/seed/ig1/600/600',
          caption: 'Transforming digital signage one screen at a time! #DigitalSignage #Innovation',
          likes: 245,
          comments: 18,
          timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          type: 'image',
        },
        {
          id: 'ig-002',
          imageUrl: 'https://picsum.photos/seed/ig2/600/600',
          caption: 'Behind the scenes at our product launch event.',
          likes: 189,
          comments: 12,
          timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
          type: 'image',
        },
        {
          id: 'ig-003',
          imageUrl: 'https://picsum.photos/seed/ig3/600/600',
          caption: 'New feature alert: real-time analytics dashboard!',
          likes: 312,
          comments: 27,
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          type: 'image',
        },
        {
          id: 'ig-004',
          imageUrl: 'https://picsum.photos/seed/ig4/600/600',
          caption: 'Our team celebrating a successful deployment.',
          likes: 156,
          comments: 9,
          timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
          type: 'image',
        },
        {
          id: 'ig-005',
          imageUrl: 'https://picsum.photos/seed/ig5/600/600',
          caption: 'Content management made beautiful.',
          likes: 278,
          comments: 21,
          timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
          type: 'image',
        },
        {
          id: 'ig-006',
          imageUrl: 'https://picsum.photos/seed/ig6/600/600',
          caption: 'Weekend vibes at Vizora HQ.',
          likes: 198,
          comments: 14,
          timestamp: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(),
          type: 'image',
        },
      ],
    };
  }
}

// =============================================================================
// Twitter / X Data Source (stub -- real API integration deferred)
// =============================================================================

@Injectable()
export class TwitterDataSource implements WidgetDataSource {
  private readonly logger = new Logger(TwitterDataSource.name);

  readonly type = 'social_twitter';

  async fetchData(config: Record<string, any>): Promise<Record<string, any>> {
    this.logger.debug('Twitter fetchData called (stub), returning sample data');
    return this.getSampleData();
  }

  getConfigSchema(): Record<string, any> {
    return {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          description: 'Twitter / X API bearer token',
        },
        feedType: {
          type: 'string',
          enum: ['user', 'hashtag', 'list', 'search'],
          description: 'Type of feed to display',
          default: 'user',
        },
        maxPosts: {
          type: 'number',
          description: 'Maximum number of tweets to display',
          minimum: 1,
          maximum: 50,
          default: 10,
        },
        showCaptions: {
          type: 'boolean',
          description: 'Whether to show tweet text',
          default: true,
        },
        layout: {
          type: 'string',
          enum: ['grid', 'carousel', 'wall'],
          description: 'Display layout for the tweets',
          default: 'wall',
        },
      },
      required: ['accessToken'],
    };
  }

  getDefaultTemplate(): string {
    return 'social-wall';
  }

  getSampleData(): Record<string, any> {
    return {
      platform: 'twitter',
      username: '@vizora',
      profileImage: 'https://picsum.photos/seed/tw-profile/150/150',
      posts: [
        {
          id: 'tw-001',
          text: 'Excited to announce our new widget architecture! Build custom dashboards for any digital signage scenario. #DigitalSignage',
          likes: 87,
          retweets: 34,
          replies: 12,
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          imageUrl: 'https://picsum.photos/seed/tw1/800/400',
          author: { name: 'Vizora', handle: '@vizora', avatar: 'https://picsum.photos/seed/tw-av/48/48' },
        },
        {
          id: 'tw-002',
          text: 'Weather widgets, RSS feeds, social walls -- all rendered beautifully on your displays. The future of digital signage is here.',
          likes: 65,
          retweets: 22,
          replies: 8,
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          imageUrl: '',
          author: { name: 'Vizora', handle: '@vizora', avatar: 'https://picsum.photos/seed/tw-av/48/48' },
        },
        {
          id: 'tw-003',
          text: 'Just shipped real-time content refresh for template widgets. Your screens stay up to date automatically.',
          likes: 112,
          retweets: 45,
          replies: 19,
          timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          imageUrl: 'https://picsum.photos/seed/tw3/800/400',
          author: { name: 'Vizora', handle: '@vizora', avatar: 'https://picsum.photos/seed/tw-av/48/48' },
        },
        {
          id: 'tw-004',
          text: 'Proud of our team for hitting 99.9% uptime this quarter across all managed displays.',
          likes: 201,
          retweets: 78,
          replies: 32,
          timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
          imageUrl: '',
          author: { name: 'Vizora', handle: '@vizora', avatar: 'https://picsum.photos/seed/tw-av/48/48' },
        },
      ],
    };
  }
}

// =============================================================================
// Facebook Data Source (stub -- real API integration deferred)
// =============================================================================

@Injectable()
export class FacebookDataSource implements WidgetDataSource {
  private readonly logger = new Logger(FacebookDataSource.name);

  readonly type = 'social_facebook';

  async fetchData(config: Record<string, any>): Promise<Record<string, any>> {
    this.logger.debug('Facebook fetchData called (stub), returning sample data');
    return this.getSampleData();
  }

  getConfigSchema(): Record<string, any> {
    return {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          description: 'Facebook Page access token',
        },
        feedType: {
          type: 'string',
          enum: ['page', 'group', 'events'],
          description: 'Type of feed to display',
          default: 'page',
        },
        maxPosts: {
          type: 'number',
          description: 'Maximum number of posts to display',
          minimum: 1,
          maximum: 30,
          default: 10,
        },
        showCaptions: {
          type: 'boolean',
          description: 'Whether to show post text',
          default: true,
        },
        layout: {
          type: 'string',
          enum: ['grid', 'carousel', 'wall'],
          description: 'Display layout for the posts',
          default: 'carousel',
        },
      },
      required: ['accessToken'],
    };
  }

  getDefaultTemplate(): string {
    return 'social-carousel';
  }

  getSampleData(): Record<string, any> {
    return {
      platform: 'facebook',
      pageName: 'Vizora Digital Signage',
      pageImage: 'https://picsum.photos/seed/fb-page/150/150',
      posts: [
        {
          id: 'fb-001',
          text: 'We are thrilled to launch our new Widget Architecture! Create stunning data-driven displays with weather, news, and social media widgets.',
          likes: 156,
          shares: 42,
          comments: 23,
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          imageUrl: 'https://picsum.photos/seed/fb1/800/600',
          type: 'photo',
        },
        {
          id: 'fb-002',
          text: 'Check out our latest case study: How Retail Corp increased customer engagement by 35% using dynamic digital signage.',
          likes: 98,
          shares: 28,
          comments: 15,
          timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
          imageUrl: 'https://picsum.photos/seed/fb2/800/600',
          type: 'link',
        },
        {
          id: 'fb-003',
          text: 'Join us for our upcoming webinar on "The Future of Digital Signage" -- live demo of our new widget features included!',
          likes: 73,
          shares: 19,
          comments: 8,
          timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
          imageUrl: 'https://picsum.photos/seed/fb3/800/600',
          type: 'event',
        },
        {
          id: 'fb-004',
          text: 'Happy to share that Vizora has been recognized as a top innovator in the digital signage space by Industry Magazine.',
          likes: 234,
          shares: 67,
          comments: 41,
          timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
          imageUrl: 'https://picsum.photos/seed/fb4/800/600',
          type: 'photo',
        },
      ],
    };
  }
}
