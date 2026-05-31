import { fetchAllPaginated, unwrapPaginatedData } from '../pagination';

describe('fetchAllPaginated', () => {
  it('loads every page when the API response includes totalPages', async () => {
    const fetchPage = jest.fn()
      .mockResolvedValueOnce({
        data: ['a', 'b'],
        meta: { page: 1, limit: 2, total: 3, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: ['c'],
        meta: { page: 2, limit: 2, total: 3, totalPages: 2 },
      });

    await expect(fetchAllPaginated<string>(fetchPage, undefined, 2)).resolves.toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(fetchPage).toHaveBeenNthCalledWith(1, { page: 1, limit: 2 });
    expect(fetchPage).toHaveBeenNthCalledWith(2, { page: 2, limit: 2 });
  });

  it('passes through additional query params on every page', async () => {
    const fetchPage = jest.fn().mockResolvedValue({
      data: ['image-1'],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });

    await fetchAllPaginated<string, { type: string }>(fetchPage, { type: 'image' });

    expect(fetchPage).toHaveBeenCalledWith({
      type: 'image',
      page: 1,
      limit: 100,
    });
  });

  it('treats non-paginated array responses as complete', async () => {
    const fetchPage = jest.fn().mockResolvedValue(['one', 'two']);

    await expect(fetchAllPaginated<string>(fetchPage)).resolves.toEqual(['one', 'two']);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('fails visibly when the response exceeds maxPages', async () => {
    const fetchPage = jest.fn().mockResolvedValue({
      data: ['page-item'],
      meta: { page: 1, limit: 100, total: 5000, totalPages: 50 },
    });

    await expect(fetchAllPaginated<string>(fetchPage, undefined, 100, 3))
      .rejects.toThrow('Paginated response exceeded the 3-page safety cap');

    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenLastCalledWith({ page: 3, limit: 100 });
  });

  it('unwraps raw and enveloped paginated responses', () => {
    expect(unwrapPaginatedData<string>({ data: ['raw'], meta: {} })).toEqual(['raw']);
    expect(unwrapPaginatedData<string>({
      success: true,
      data: { data: ['enveloped'], meta: {} },
    })).toEqual(['enveloped']);
    expect(unwrapPaginatedData<string>(['array'])).toEqual(['array']);
    expect(unwrapPaginatedData<string>({ success: true, data: { notData: [] } })).toEqual([]);
  });
});
