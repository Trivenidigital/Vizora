import { NextRequest, NextResponse } from 'next/server';

const PRICING = {
  US: {
    region: 'US',
    currency: 'USD',
    symbol: '$',
    basic: { monthly: 8, annual: 6 },
    pro: { monthly: 10, annual: 7 },
    locale: 'en-US',
  },
  IN: {
    region: 'IN',
    currency: 'INR',
    symbol: '\u20B9',
    basic: { monthly: 499, annual: 375 },
    pro: { monthly: 749, annual: 525 },
    locale: 'en-IN',
  },
};

export async function GET(req: NextRequest) {
  // Check Cloudflare header first, then x-forwarded-for
  const cfCountry = req.headers.get('cf-ipcountry');
  const region = cfCountry === 'IN' ? 'IN' : 'US';
  return NextResponse.json(PRICING[region]);
}
