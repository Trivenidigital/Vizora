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

  it('serializes array content filters as repeated query params', async () => {
    const client = new ApiClient('/api/v1');
    const requestSpy = jest.spyOn(client, 'request').mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
    } as any);

    await client.getContent({
      page: 1,
      limit: 50,
      tagNames: ['Lunch, Dinner', 'Marketing'],
      tagIds: ['tag-menu', 'tag-promo'],
    });

    expect(requestSpy).toHaveBeenCalledWith(
      '/content?page=1&limit=50&tagNames=Lunch%2C+Dinner&tagNames=Marketing&tagIds=tag-menu&tagIds=tag-promo',
    );
  });

  it('sends title + duration on updateContent', async () => {
    const client = new ApiClient('/api/v1');
    const requestSpy = jest.spyOn(client, 'request').mockResolvedValue({ id: 'c1' } as any);

    await client.updateContent('c1', { title: 'Menu', duration: 20 });

    expect(JSON.parse((requestSpy.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      name: 'Menu',
      duration: 20,
    });
  });

  it('PATCHes expiration with replacement when provided', async () => {
    const client = new ApiClient('/api/v1');
    const requestSpy = jest.spyOn(client, 'request').mockResolvedValue({ id: 'c1' } as any);

    await client.setContentExpiration('c1', '2099-01-01T00:00:00.000Z', 'repl-1');

    expect(requestSpy).toHaveBeenCalledWith(
      '/content/c1/expiration',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(JSON.parse((requestSpy.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      expiresAt: '2099-01-01T00:00:00.000Z',
      replacementContentId: 'repl-1',
    });
  });

  it('omits replacementContentId when not provided', async () => {
    const client = new ApiClient('/api/v1');
    const requestSpy = jest.spyOn(client, 'request').mockResolvedValue({ id: 'c1' } as any);

    await client.setContentExpiration('c1', '2099-01-01T00:00:00.000Z');

    expect(JSON.parse((requestSpy.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
  });

  it('DELETEs expiration on clearContentExpiration', async () => {
    const client = new ApiClient('/api/v1');
    const requestSpy = jest.spyOn(client, 'request').mockResolvedValue({ id: 'c1' } as any);

    await client.clearContentExpiration('c1');

    expect(requestSpy).toHaveBeenCalledWith(
      '/content/c1/expiration',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('GETs the version chain and POSTs a restore', async () => {
    const client = new ApiClient('/api/v1');
    const requestSpy = jest.spyOn(client, 'request').mockResolvedValue([] as any);

    await client.getContentVersions('c1');
    expect(requestSpy).toHaveBeenCalledWith('/content/c1/versions');

    await client.restoreContentVersion('v2');
    expect(requestSpy).toHaveBeenCalledWith(
      '/content/v2/restore',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uploads a replacement file as multipart with keepBackup flag', async () => {
    const client = new ApiClient('/api/v1');
    const formSpy = jest
      .spyOn(client, 'requestFormData')
      .mockResolvedValue({ content: { id: 'c1' }, fileHash: 'abc' } as any);
    const file = new File(['x'], 'new.png', { type: 'image/png' });

    await client.replaceContentFile('c1', file, { keepBackup: true });

    expect(formSpy).toHaveBeenCalledWith('/content/c1/replace', expect.any(FormData), 'POST');
    const sentForm = formSpy.mock.calls[0][1] as FormData;
    expect(sentForm.get('file')).toBe(file);
    expect(sentForm.get('keepBackup')).toBe('true');
  });

  it('routes bulk delete/archive/duration to the safe bulk endpoints', async () => {
    const client = new ApiClient('/api/v1');
    const requestSpy = jest.spyOn(client, 'request').mockResolvedValue({} as any);

    await client.bulkDeleteContent(['a', 'b']);
    expect(requestSpy).toHaveBeenCalledWith(
      '/content/bulk/delete',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse((requestSpy.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      ids: ['a', 'b'],
    });

    await client.bulkArchiveContent(['a']);
    expect(requestSpy).toHaveBeenLastCalledWith(
      '/content/bulk/archive',
      expect.objectContaining({ method: 'POST' }),
    );

    await client.bulkSetContentDuration(['a', 'b'], 15);
    expect(requestSpy).toHaveBeenLastCalledWith(
      '/content/bulk/duration',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse((requestSpy.mock.calls[2][1] as RequestInit).body as string)).toEqual({
      ids: ['a', 'b'],
      duration: 15,
    });
  });
});
