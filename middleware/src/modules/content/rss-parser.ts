/**
 * Lightweight RSS 2.0 and Atom feed parser using regex.
 * No external dependencies.
 *
 * Note: regex parsing is safe because input is size-limited to 2MB (enforced by controller)
 */

export interface RssFeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
  imageUrl: string | null;
}

/**
 * Extract text content between XML tags.
 * Handles CDATA sections.
 */
function extractTag(xml: string, tagName: string): string {
  // Try with CDATA first
  const cdataRegex = new RegExp(
    `<${tagName}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tagName}>`,
    'i',
  );
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  // Plain text content
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = xml.match(regex);
  if (match) return match[1].trim();

  return '';
}

/**
 * Extract an attribute value from a self-closing or opening tag.
 */
function extractAttr(xml: string, tagName: string, attrName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*\\s${attrName}=["']([^"']*)["']`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Strip HTML tags from a string (for summaries).
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Try to extract an image URL from content.
 * Checks enclosure, media:content, media:thumbnail, and img tags in description.
 */
function extractImage(itemXml: string): string | null {
  // RSS enclosure
  const encUrl = extractAttr(itemXml, 'enclosure', 'url');
  if (encUrl && /\.(jpg|jpeg|png|gif|webp|svg)/i.test(encUrl)) return encUrl;

  // media:content or media:thumbnail
  const mediaUrl =
    extractAttr(itemXml, 'media:content', 'url') ||
    extractAttr(itemXml, 'media:thumbnail', 'url');
  if (mediaUrl) return mediaUrl;

  // img tag in description/content
  const imgMatch = itemXml.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1];

  return null;
}

/**
 * Detect whether the feed is Atom format.
 */
function isAtomFeed(xml: string): boolean {
  return /<feed[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
}

/**
 * Parse RSS 2.0 items from XML.
 */
function parseRssItems(xml: string, limit: number): RssFeedItem[] {
  const items: RssFeedItem[] = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const itemXml = match[1];
    const title = stripHtml(extractTag(itemXml, 'title'));
    const link = extractTag(itemXml, 'link') || '';
    const description = stripHtml(
      extractTag(itemXml, 'description') || extractTag(itemXml, 'content:encoded'),
    );
    const pubDate = extractTag(itemXml, 'pubDate') || null;
    const imageUrl = extractImage(itemXml);

    if (title || description) {
      items.push({ title, link, description, pubDate, imageUrl });
    }
  }

  return items;
}

/**
 * Parse Atom entries from XML.
 */
function parseAtomEntries(xml: string, limit: number): RssFeedItem[] {
  const items: RssFeedItem[] = [];
  const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null && items.length < limit) {
    const entryXml = match[1];
    const title = stripHtml(extractTag(entryXml, 'title'));
    const link = extractAttr(entryXml, 'link', 'href') || extractTag(entryXml, 'link');
    const description = stripHtml(
      extractTag(entryXml, 'summary') || extractTag(entryXml, 'content'),
    );
    const pubDate =
      extractTag(entryXml, 'published') || extractTag(entryXml, 'updated') || null;
    const imageUrl = extractImage(entryXml);

    if (title || description) {
      items.push({ title, link, description, pubDate, imageUrl });
    }
  }

  return items;
}

/**
 * Parse an RSS 2.0 or Atom feed XML string and return items.
 */
export function parseRssFeed(xml: string, limit: number = 10): RssFeedItem[] {
  if (isAtomFeed(xml)) {
    return parseAtomEntries(xml, limit);
  }
  return parseRssItems(xml, limit);
}

/**
 * Extract the feed-level title from RSS or Atom XML.
 */
export function extractFeedTitle(xml: string): string {
  if (isAtomFeed(xml)) {
    // For Atom, the feed title is a direct child of <feed>
    // Extract before the first <entry> to avoid grabbing an entry title
    const feedHeader = xml.split(/<entry[\s>]/i)[0] || xml;
    return stripHtml(extractTag(feedHeader, 'title')) || 'Untitled Feed';
  }

  // For RSS 2.0, the channel title is before the first <item>
  const channelHeader = xml.split(/<item[\s>]/i)[0] || xml;
  return stripHtml(extractTag(channelHeader, 'title')) || 'Untitled Feed';
}
