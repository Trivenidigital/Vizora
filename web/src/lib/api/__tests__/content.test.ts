import { ApiClient } from '../client';
import '../content';

describe('content api methods', () => {
  it('maps web title updates to the middleware name field', async () => {
    const client = new ApiClient('/api/v1');
    const requestSpy = jest.spyOn(client, 'request').mockResolvedValue({
      id: 'content-1',
      title: 'Lobby Menu',
    } as any);

    await client.updateContent('content-1', { title: 'Lobby Menu', metadata: { section: 'front' } });

    expect(requestSpy).toHaveBeenCalledWith(
      '/content/content-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(JSON.parse((requestSpy.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      name: 'Lobby Menu',
      metadata: { section: 'front' },
    });
  });
});
