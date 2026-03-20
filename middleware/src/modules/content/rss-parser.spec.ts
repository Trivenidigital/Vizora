import { parseRssFeed, extractFeedTitle } from './rss-parser';

describe('RSS Parser', () => {
  const rss2Feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Tech News Daily</title>
    <link>https://example.com</link>
    <description>Latest tech news</description>
    <item>
      <title>Breaking: New Framework Released</title>
      <link>https://example.com/article/1</link>
      <description>A revolutionary new framework has been released today.</description>
      <pubDate>Mon, 18 Mar 2026 10:00:00 GMT</pubDate>
      <enclosure url="https://example.com/images/framework.jpg" type="image/jpeg" />
    </item>
    <item>
      <title>AI Advances in 2026</title>
      <link>https://example.com/article/2</link>
      <description><![CDATA[<p>Artificial intelligence continues to <strong>evolve</strong> rapidly.</p>]]></description>
      <pubDate>Sun, 17 Mar 2026 08:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Open Source Milestone</title>
      <link>https://example.com/article/3</link>
      <description>Open source projects hit a new milestone this quarter.</description>
      <pubDate>Sat, 16 Mar 2026 14:30:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

  const atomFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Tech Blog</title>
  <link href="https://blog.example.com" />
  <entry>
    <title>First Atom Entry</title>
    <link href="https://blog.example.com/entry/1" />
    <summary>This is the first atom entry summary.</summary>
    <published>2026-03-18T12:00:00Z</published>
  </entry>
  <entry>
    <title>Second Atom Entry</title>
    <link href="https://blog.example.com/entry/2" />
    <summary>Summary of the second entry.</summary>
    <updated>2026-03-17T09:00:00Z</updated>
  </entry>
</feed>`;

  describe('parseRssFeed', () => {
    it('should parse RSS 2.0 items correctly', () => {
      const items = parseRssFeed(rss2Feed, 10);
      expect(items).toHaveLength(3);
      expect(items[0]).toEqual({
        title: 'Breaking: New Framework Released',
        link: 'https://example.com/article/1',
        description: 'A revolutionary new framework has been released today.',
        pubDate: 'Mon, 18 Mar 2026 10:00:00 GMT',
        imageUrl: 'https://example.com/images/framework.jpg',
      });
    });

    it('should strip HTML from CDATA descriptions', () => {
      const items = parseRssFeed(rss2Feed, 10);
      expect(items[1].description).toBe(
        'Artificial intelligence continues to evolve rapidly.',
      );
    });

    it('should respect the limit parameter', () => {
      const items = parseRssFeed(rss2Feed, 2);
      expect(items).toHaveLength(2);
    });

    it('should parse Atom feed entries', () => {
      const items = parseRssFeed(atomFeed, 10);
      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({
        title: 'First Atom Entry',
        link: 'https://blog.example.com/entry/1',
        description: 'This is the first atom entry summary.',
        pubDate: '2026-03-18T12:00:00Z',
        imageUrl: null,
      });
    });

    it('should use updated date when published is missing in Atom', () => {
      const items = parseRssFeed(atomFeed, 10);
      expect(items[1].pubDate).toBe('2026-03-17T09:00:00Z');
    });

    it('should return empty array for invalid XML', () => {
      const items = parseRssFeed('not xml at all', 10);
      expect(items).toEqual([]);
    });

    it('should return empty array for empty input', () => {
      const items = parseRssFeed('', 10);
      expect(items).toEqual([]);
    });

    it('should extract media:content images', () => {
      const feedWithMedia = `<rss><channel><item>
        <title>Media Test</title>
        <description>Has media</description>
        <media:content url="https://example.com/media.jpg" medium="image" />
      </item></channel></rss>`;
      const items = parseRssFeed(feedWithMedia, 10);
      expect(items[0].imageUrl).toBe('https://example.com/media.jpg');
    });
  });

  describe('extractFeedTitle', () => {
    it('should extract RSS 2.0 channel title', () => {
      expect(extractFeedTitle(rss2Feed)).toBe('Tech News Daily');
    });

    it('should extract Atom feed title', () => {
      expect(extractFeedTitle(atomFeed)).toBe('Atom Tech Blog');
    });

    it('should return "Untitled Feed" for missing title', () => {
      expect(extractFeedTitle('<rss><channel></channel></rss>')).toBe(
        'Untitled Feed',
      );
    });
  });
});
