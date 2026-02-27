import { SupportKnowledgeService } from './support-knowledge.service';

describe('SupportKnowledgeService', () => {
  let service: SupportKnowledgeService;

  beforeEach(() => {
    service = new SupportKnowledgeService();
  });

  describe('search', () => {
    it('should find "pair device" entry for "how to pair a device"', () => {
      const result = service.search('how to pair a device');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('pair_device');
    });

    it('should find "pricing" entry for "what are the plans"', () => {
      const result = service.search('what are the plans and pricing');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('pricing_plans');
    });

    it('should find "offline" entry for "my screen is offline"', () => {
      const result = service.search('my screen is offline');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('device_offline');
    });

    it('should return null for unrelated queries like "quantum physics"', () => {
      const result = service.search('quantum physics');
      expect(result).toBeNull();
    });

    it('should return null for very short queries', () => {
      const result = service.search('hi');
      expect(result).toBeNull();
    });

    it('should find template entry for "how do I use templates"', () => {
      const result = service.search('how do I use templates');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('use_templates');
    });

    it('should find playlist entry for "create a playlist"', () => {
      const result = service.search('create a playlist');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('create_playlist');
    });

    it('should find analytics entry for "view analytics report"', () => {
      const result = service.search('view analytics report');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('analytics');
    });
  });

  describe('knowledge base entries', () => {
    it('all 12 entries should have required fields (id, keywords, question, answer)', () => {
      // Access internal entries through search behavior
      const queries = [
        'pair device',
        'use template',
        'create playlist',
        'push content to display',
        'schedule content calendar',
        'plan price subscription',
        'offline disconnected',
        'upload file image',
        'team invite member',
        'ai generate designer',
        'display group batch',
        'analytics stats report',
      ];

      const foundEntries = new Set<string>();

      for (const query of queries) {
        const result = service.search(query);
        expect(result).not.toBeNull();
        expect(result!.id).toBeDefined();
        expect(result!.keywords).toBeDefined();
        expect(Array.isArray(result!.keywords)).toBe(true);
        expect(result!.keywords.length).toBeGreaterThan(0);
        expect(result!.question).toBeDefined();
        expect(typeof result!.question).toBe('string');
        expect(result!.answer).toBeDefined();
        expect(typeof result!.answer).toBe('string');
        foundEntries.add(result!.id);
      }

      // Verify we found all 12 unique entries
      expect(foundEntries.size).toBe(12);
    });
  });
});
