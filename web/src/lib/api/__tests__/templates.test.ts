import { ApiClient } from '../client';
import '../templates';

describe('template api methods', () => {
  it('saves organization-owned templates through the scoped save route', async () => {
    const client = new ApiClient('/api/v1');
    const requestSpy = jest.spyOn(client, 'request').mockResolvedValue({ id: 'template-1' } as any);

    await client.updateTemplate('template-1', { templateHtml: '<div>Org draft</div>' });

    expect(requestSpy).toHaveBeenCalledWith(
      '/template-library/template-1/save',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('updates global library templates through the super-admin route', async () => {
    const client = new ApiClient('/api/v1');
    const requestSpy = jest.spyOn(client, 'request').mockResolvedValue({ id: 'template-1' } as any);

    await client.updateLibraryTemplate('template-1', { templateHtml: '<div>Library draft</div>' });

    expect(requestSpy).toHaveBeenCalledWith(
      '/template-library/template-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});
