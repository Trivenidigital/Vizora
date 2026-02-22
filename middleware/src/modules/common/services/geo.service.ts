import { Injectable, Logger } from '@nestjs/common';

export interface GeoResult {
  country: string; // ISO 3166-1 alpha-2
  currency: string; // 'USD' or 'INR'
  provider: string; // 'stripe' or 'razorpay'
}

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  private geoip: typeof import('geoip-lite') | null = null;

  constructor() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.geoip = require('geoip-lite');
    } catch {
      this.logger.warn('geoip-lite data not available, defaulting to US');
    }
  }

  detect(ip: string): GeoResult {
    let country = 'US';
    try {
      if (this.geoip) {
        const lookup = this.geoip.lookup(ip);
        country = lookup?.country || 'US';
      }
    } catch {
      // Fall back to US on any lookup error
    }
    return {
      country,
      currency: country === 'IN' ? 'INR' : 'USD',
      provider: country === 'IN' ? 'razorpay' : 'stripe',
    };
  }
}
