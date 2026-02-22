import { GeoService } from './geo.service';

describe('GeoService', () => {
  let service: GeoService;

  beforeEach(() => {
    service = new GeoService();
  });

  it('returns IN/INR/razorpay for Indian IP', () => {
    const result = service.detect('49.36.128.1');
    expect(result.country).toBe('IN');
    expect(result.currency).toBe('INR');
    expect(result.provider).toBe('razorpay');
  });

  it('returns US/USD/stripe for US IP', () => {
    const result = service.detect('8.8.8.8');
    expect(result.country).toBe('US');
    expect(result.currency).toBe('USD');
    expect(result.provider).toBe('stripe');
  });

  it('defaults to US/USD/stripe for unknown IP', () => {
    const result = service.detect('127.0.0.1');
    expect(result.country).toBe('US');
    expect(result.currency).toBe('USD');
    expect(result.provider).toBe('stripe');
  });
});
