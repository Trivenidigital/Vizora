import { Injectable } from '@nestjs/common';
import * as geoip from 'geoip-lite';

export interface GeoResult {
  country: string; // ISO 3166-1 alpha-2
  currency: string; // 'USD' or 'INR'
  provider: string; // 'stripe' or 'razorpay'
}

@Injectable()
export class GeoService {
  detect(ip: string): GeoResult {
    const lookup = geoip.lookup(ip);
    const country = lookup?.country || 'US';
    return {
      country,
      currency: country === 'IN' ? 'INR' : 'USD',
      provider: country === 'IN' ? 'razorpay' : 'stripe',
    };
  }
}
