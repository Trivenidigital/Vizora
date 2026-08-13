jest.mock('../common/device-token-auth.util', () => ({
  getDeviceTokenFromRequest: jest.fn(() => 'device-token'),
  verifyCurrentDeviceToken: jest.fn(),
}));

import { resolveEffectiveContent, serializeDeviceContent } from '@vizora/database';
import { verifyCurrentDeviceToken } from '../common/device-token-auth.util';
import { DeviceMeController } from './device-me.controller';

const asMock = (fn: unknown) => fn as jest.Mock;

describe('DeviceMeController — device-JWT self-identity, cross-tenant zero-effect (T2 pull)', () => {
  let controller: DeviceMeController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new DeviceMeController({} as any, { display: {}, schedule: {}, playlist: {} } as any);
    asMock(resolveEffectiveContent).mockResolvedValue({ playlist: null, source: 'none', scheduleId: null, version: '' });
    asMock(serializeDeviceContent).mockReturnValue({ source: 'none', version: '', playlist: null });
  });

  it('resolves with org+displayId from the VERIFIED JWT, ignoring request-supplied ids', async () => {
    asMock(verifyCurrentDeviceToken).mockResolvedValue({ payload: { sub: 'disp-A', organizationId: 'org-A' } });
    // A device attempts to inject another device/tenant's ids via the query string.
    const req = { query: { displayId: 'disp-B', organizationId: 'org-B' }, params: { displayId: 'disp-B' }, headers: {} } as any;

    await controller.getMyContent(req);

    expect(resolveEffectiveContent).toHaveBeenCalledTimes(1);
    const [, displayId, organizationId] = asMock(resolveEffectiveContent).mock.calls[0];
    expect(displayId).toBe('disp-A'); // JWT sub — NOT the query/param displayId
    expect(organizationId).toBe('org-A'); // JWT org — NOT the query organizationId
  });

  it('a tenant-A device JWT can NEVER resolve tenant-B content, however the request is shaped', async () => {
    asMock(verifyCurrentDeviceToken).mockResolvedValue({ payload: { sub: 'disp-A', organizationId: 'org-A' } });
    await controller.getMyContent({ query: { organizationId: 'org-B' }, headers: { 'x-org': 'org-B' } } as any);

    const [, , organizationId] = asMock(resolveEffectiveContent).mock.calls[0];
    expect(organizationId).toBe('org-A');
    expect(organizationId).not.toBe('org-B');
  });

  it('serializes the resolver output (source/version carried through)', async () => {
    asMock(verifyCurrentDeviceToken).mockResolvedValue({ payload: { sub: 'disp-A', organizationId: 'org-A' } });
    const effective = { playlist: { id: 'pl-1', items: [] }, source: 'currentPlaylist', scheduleId: null, version: 'v42' };
    asMock(resolveEffectiveContent).mockResolvedValue(effective);
    asMock(serializeDeviceContent).mockReturnValue({ source: 'currentPlaylist', version: 'v42', playlist: { id: 'pl-1', items: [] } });

    const out = await controller.getMyContent({ query: {}, headers: {} } as any);

    expect(serializeDeviceContent).toHaveBeenCalledWith(effective, expect.objectContaining({ contentBaseUrl: expect.any(String) }));
    expect(out).toEqual({ source: 'currentPlaylist', version: 'v42', playlist: { id: 'pl-1', items: [] } });
  });

  it('an invalid device token rejects and never reaches the resolver', async () => {
    asMock(verifyCurrentDeviceToken).mockRejectedValue(new Error('unauthorized'));
    await expect(controller.getMyContent({ query: {}, headers: {} } as any)).rejects.toThrow();
    expect(resolveEffectiveContent).not.toHaveBeenCalled();
  });
});
