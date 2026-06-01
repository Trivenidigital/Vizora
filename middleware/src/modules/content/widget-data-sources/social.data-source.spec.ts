import { ServiceUnavailableException } from '@nestjs/common';
import {
  FacebookDataSource,
  InstagramDataSource,
  TwitterDataSource,
} from './social.data-source';

describe('Social widget data sources', () => {
  it.each([
    ['Instagram', new InstagramDataSource()],
    ['Twitter', new TwitterDataSource()],
    ['Facebook', new FacebookDataSource()],
  ])(
    '%s keeps preview/non-strict mode sample-backed but rejects strict persistence',
    async (_name, source) => {
      await expect(source.fetchData({})).resolves.toHaveProperty('posts');

      await expect(source.fetchData({}, { strict: true })).rejects.toThrow(
        ServiceUnavailableException,
      );
    },
  );
});
