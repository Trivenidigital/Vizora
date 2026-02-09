import { Injectable } from '@nestjs/common';
import {
  WeatherDataSource,
  RssDataSource,
  InstagramDataSource,
  TwitterDataSource,
  FacebookDataSource,
} from './widget-data-sources';
import type { WidgetDataSource } from './widget-data-sources';

@Injectable()
export class DataSourceRegistryService {
  private readonly registry = new Map<string, WidgetDataSource>();

  constructor(
    private readonly weatherDataSource: WeatherDataSource,
    private readonly rssDataSource: RssDataSource,
    private readonly instagramDataSource: InstagramDataSource,
    private readonly twitterDataSource: TwitterDataSource,
    private readonly facebookDataSource: FacebookDataSource,
  ) {
    this.registry.set(this.weatherDataSource.type, this.weatherDataSource);
    this.registry.set(this.rssDataSource.type, this.rssDataSource);
    this.registry.set(this.instagramDataSource.type, this.instagramDataSource);
    this.registry.set(this.twitterDataSource.type, this.twitterDataSource);
    this.registry.set(this.facebookDataSource.type, this.facebookDataSource);
  }

  get(type: string): WidgetDataSource {
    const source = this.registry.get(type);
    if (!source) {
      throw new Error(`Unknown data source type: ${type}`);
    }
    return source;
  }

  getAll(): Array<[string, WidgetDataSource]> {
    return Array.from(this.registry.entries());
  }
}
