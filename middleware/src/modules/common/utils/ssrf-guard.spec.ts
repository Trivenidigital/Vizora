import * as dns from 'dns/promises';
import {
  assertUrlIsPublic,
  fetchWithSsrfGuard,
  isPrivateAddress,
  SsrfError,
} from './ssrf-guard';

jest.mock('dns/promises');

describe('ssrf-guard', () => {
  const mockLookup = dns.lookup as unknown as jest.Mock;

  beforeEach(() => {
    mockLookup.mockReset();
  });

  // ---------------------------------------------------------------------------
  // Protocol + parse validation (runs before DNS)
  // ---------------------------------------------------------------------------
  describe('protocol gating', () => {
    it('rejects a non-URL string', async () => {
      await expect(assertUrlIsPublic('not-a-url')).rejects.toThrow(SsrfError);
      expect(mockLookup).not.toHaveBeenCalled();
    });

    it('rejects ftp:// even with allowHttp', async () => {
      await expect(
        assertUrlIsPublic('ftp://example.com/x', { allowHttp: true }),
      ).rejects.toThrow(/HTTP or HTTPS/);
    });

    it('rejects http:// without allowHttp', async () => {
      await expect(assertUrlIsPublic('http://example.com/x')).rejects.toThrow(
        /HTTPS/,
      );
    });

    it('allows http:// with allowHttp', async () => {
      mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
      await expect(
        assertUrlIsPublic('http://example.com/x', { allowHttp: true }),
      ).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Hostname pre-checks (before DNS)
  // ---------------------------------------------------------------------------
  describe('literal localhost', () => {
    it('rejects "localhost" before resolving', async () => {
      await expect(
        assertUrlIsPublic('https://localhost/path'),
      ).rejects.toThrow(/blocked address/);
      expect(mockLookup).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // DNS resolution — the core SSRF defense
  // ---------------------------------------------------------------------------
  describe('DNS-resolved IP classification', () => {
    it('rejects a public-looking hostname that resolves to loopback', async () => {
      mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
      await expect(
        assertUrlIsPublic('https://attacker.example/x'),
      ).rejects.toThrow(/blocked address/);
    });

    it('rejects when ANY resolved record is private (mixed A/AAAA)', async () => {
      // Public IPv4 + private IPv6 → still blocked.
      mockLookup.mockResolvedValue([
        { address: '93.184.216.34', family: 4 },
        { address: 'fc00::1', family: 6 },
      ]);
      await expect(
        assertUrlIsPublic('https://attacker.example/x'),
      ).rejects.toThrow(/blocked address/);
    });

    it('rejects AWS IMDS via DNS rebind (169.254.169.254)', async () => {
      mockLookup.mockResolvedValue([
        { address: '169.254.169.254', family: 4 },
      ]);
      await expect(
        assertUrlIsPublic('https://attacker.example/x'),
      ).rejects.toThrow(/blocked address/);
    });

    it('rejects RFC1918 10/8 via DNS', async () => {
      mockLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);
      await expect(
        assertUrlIsPublic('https://attacker.example/x'),
      ).rejects.toThrow(/blocked address/);
    });

    it('rejects RFC1918 192.168/16 via DNS', async () => {
      mockLookup.mockResolvedValue([{ address: '192.168.1.1', family: 4 }]);
      await expect(
        assertUrlIsPublic('https://attacker.example/x'),
      ).rejects.toThrow(/blocked address/);
    });

    it('rejects RFC1918 172.16/12 via DNS', async () => {
      mockLookup.mockResolvedValue([{ address: '172.20.0.5', family: 4 }]);
      await expect(
        assertUrlIsPublic('https://attacker.example/x'),
      ).rejects.toThrow(/blocked address/);
    });

    it('rejects IPv6 ULA fc00::/7', async () => {
      mockLookup.mockResolvedValue([{ address: 'fd12:3456::1', family: 6 }]);
      await expect(
        assertUrlIsPublic('https://attacker.example/x'),
      ).rejects.toThrow(/blocked address/);
    });

    it('rejects IPv6 link-local fe80::/10', async () => {
      mockLookup.mockResolvedValue([{ address: 'fe80::1', family: 6 }]);
      await expect(
        assertUrlIsPublic('https://attacker.example/x'),
      ).rejects.toThrow(/blocked address/);
    });

    it('rejects empty resolution result', async () => {
      mockLookup.mockResolvedValue([]);
      await expect(
        assertUrlIsPublic('https://attacker.example/x'),
      ).rejects.toThrow(/did not resolve/);
    });

    it('rejects when DNS resolution fails (ENOTFOUND)', async () => {
      mockLookup.mockRejectedValue(new Error('ENOTFOUND'));
      await expect(
        assertUrlIsPublic('https://nonexistent.invalid/x'),
      ).rejects.toThrow(/does not resolve/);
    });

    it('allows a hostname that resolves to a fully-public IP', async () => {
      mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
      await expect(
        assertUrlIsPublic('https://example.com/x'),
      ).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Literal-IP URLs (Node's dns.lookup just echoes them back)
  // ---------------------------------------------------------------------------
  describe('literal IP URLs', () => {
    it('rejects http://127.0.0.1', async () => {
      mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
      await expect(
        assertUrlIsPublic('http://127.0.0.1/x', { allowHttp: true }),
      ).rejects.toThrow(/blocked address/);
    });

    it('rejects http://[::1]', async () => {
      mockLookup.mockResolvedValue([{ address: '::1', family: 6 }]);
      await expect(
        assertUrlIsPublic('http://[::1]/x', { allowHttp: true }),
      ).rejects.toThrow(/blocked address/);
    });
  });

  // ---------------------------------------------------------------------------
  // isPrivateAddress unit coverage (the IP classifier itself)
  // ---------------------------------------------------------------------------
  describe('isPrivateAddress', () => {
    it.each([
      ['127.0.0.1', true],
      ['127.255.255.255', true],
      ['10.0.0.1', true],
      ['172.16.0.1', true],
      ['172.31.255.255', true],
      ['172.15.0.1', false], // outside RFC1918 12-bit range
      ['172.32.0.1', false],
      ['192.168.0.1', true],
      ['169.254.169.254', true],
      ['0.0.0.0', true],
      ['8.8.8.8', false],
      ['93.184.216.34', false],
      ['::', true],
      ['::1', true],
      ['::ffff:127.0.0.1', true], // IPv4-mapped loopback
      ['::ffff:8.8.8.8', false], // IPv4-mapped public
      ['2002:7f00:1::', true], // 6to4 of 127.0.0.1
      ['2002:0808:0808::', false], // 6to4 of 8.8.8.8
      ['fc00::1', true],
      ['fd12:3456::1', true],
      ['fe80::1', true],
      ['feb0::1', true],
      ['2001:db8::1', false],
      ['not-an-ip', false],
    ])('classifies %s → private=%s', (ip, expected) => {
      expect(isPrivateAddress(ip)).toBe(expected);
    });
  });

  describe('fetchWithSsrfGuard', () => {
    const originalFetch = global.fetch;
    const mockFetch = jest.fn();

    beforeEach(() => {
      global.fetch = mockFetch;
      mockFetch.mockReset();
      mockLookup.mockReset();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('follows a public redirect after validating the redirected URL', async () => {
      mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
      const finalResponse = { ok: true, status: 200, headers: { get: jest.fn() } } as any;
      mockFetch
        .mockResolvedValueOnce({
          status: 302,
          headers: {
            get: jest.fn((name: string) => (name.toLowerCase() === 'location' ? '/final' : null)),
          },
        })
        .mockResolvedValueOnce(finalResponse);

      const result = await fetchWithSsrfGuard('https://example.com/start');

      expect(result).toBe(finalResponse);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://example.com/start',
        expect.objectContaining({ redirect: 'manual' }),
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://example.com/final',
        expect.objectContaining({ redirect: 'manual' }),
      );
      expect(mockLookup).toHaveBeenCalledTimes(2);
    });

    it('rejects a private redirect target before fetching it', async () => {
      mockLookup
        .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
        .mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }]);
      mockFetch.mockResolvedValueOnce({
        status: 302,
        headers: {
          get: jest.fn((name: string) => (
            name.toLowerCase() === 'location'
              ? 'http://169.254.169.254/latest'
              : null
          )),
        },
      });

      await expect(
        fetchWithSsrfGuard('https://example.com/start', {}, { allowHttp: true }),
      ).rejects.toThrow(/blocked address/);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('drops non-safe headers on cross-origin redirects when requested', async () => {
      mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
      mockFetch
        .mockResolvedValueOnce({
          status: 302,
          headers: {
            get: jest.fn((name: string) => (
              name.toLowerCase() === 'location'
                ? 'https://api2.example.com/final'
                : null
            )),
          },
        })
        .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: jest.fn() } });

      await fetchWithSsrfGuard(
        'https://api1.example.com/start',
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Vizora-Test/1.0',
            'X-Api-Key': 'secret-value',
          },
        },
        { dropHeadersOnCrossOriginRedirect: true },
      );

      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://api2.example.com/final',
        expect.objectContaining({
          headers: {
            accept: 'application/json',
            'user-agent': 'Vizora-Test/1.0',
          },
        }),
      );
    });
  });
});
