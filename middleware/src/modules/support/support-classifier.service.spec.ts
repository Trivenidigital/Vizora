import { SupportClassifierService } from './support-classifier.service';

describe('SupportClassifierService', () => {
  let service: SupportClassifierService;

  beforeEach(() => {
    service = new SupportClassifierService();
  });

  describe('classify', () => {
    it('should classify "the app keeps crashing" as bug_report', () => {
      const result = service.classify('the app keeps crashing');
      expect(result.category).toBe('bug_report');
    });

    it('should classify "can you add dark mode" as feature_request', () => {
      const result = service.classify('can you add dark mode');
      expect(result.category).toBe('feature_request');
    });

    it('should classify "how do I pair a device" as help_question', () => {
      const result = service.classify('how do I pair a device');
      expect(result.category).toBe('help_question');
    });

    it('should classify "I need a restaurant template" as template_request', () => {
      const result = service.classify('I need a restaurant template');
      expect(result.category).toBe('template_request');
    });

    it('should classify "love the new update, amazing work" as feedback', () => {
      const result = service.classify('love the new update, amazing work');
      expect(result.category).toBe('feedback');
    });

    it('should classify "all devices are down!" as urgent_issue with critical priority', () => {
      const result = service.classify('all devices are down!');
      expect(result.category).toBe('urgent_issue');
      expect(result.priority).toBe('critical');
    });

    it('should classify "can\'t access my account" as account_issue with high priority', () => {
      const result = service.classify("can't access my account");
      expect(result.category).toBe('account_issue');
      expect(result.priority).toBe('high');
    });

    it('should classify "the app crashed" as bug_report with critical priority (has "crash")', () => {
      const result = service.classify('the app crashed');
      expect(result.category).toBe('bug_report');
      expect(result.priority).toBe('critical');
    });

    it('should default to help_question for ambiguous messages', () => {
      const result = service.classify('hello there');
      expect(result.category).toBe('help_question');
      expect(result.priority).toBe('medium');
    });
  });

  describe('generateTitle', () => {
    it('should truncate at 100 characters', () => {
      const longMessage = 'A'.repeat(150);
      const title = service.generateTitle(longMessage);
      expect(title.length).toBeLessThanOrEqual(100);
      expect(title).toBe('A'.repeat(97) + '...');
    });

    it('should take first sentence', () => {
      const message = 'First sentence. Second sentence. Third sentence.';
      const title = service.generateTitle(message);
      expect(title).toBe('First sentence');
    });

    it('should handle single sentence without truncation', () => {
      const message = 'Short message';
      const title = service.generateTitle(message);
      expect(title).toBe('Short message');
    });

    it('should handle exclamation mark as sentence delimiter', () => {
      const message = 'Help me! I need assistance.';
      const title = service.generateTitle(message);
      expect(title).toBe('Help me');
    });

    it('should handle question mark as sentence delimiter', () => {
      const message = 'How do I pair? Please help.';
      const title = service.generateTitle(message);
      expect(title).toBe('How do I pair');
    });
  });

  describe('generateSummary', () => {
    it('should generate a summary with category label', () => {
      const summary = service.generateSummary('My screen is broken', 'bug_report');
      expect(summary).toBe('[BUG REPORT] My screen is broken');
    });

    it('should truncate long messages to 300 characters', () => {
      const longMessage = 'X'.repeat(500);
      const summary = service.generateSummary(longMessage, 'help_question');
      expect(summary).toBe('[HELP QUESTION] ' + 'X'.repeat(300));
    });
  });

  describe('suggestAction', () => {
    it('should return action string for bug_report', () => {
      const action = service.suggestAction('bug_report', 'medium');
      expect(action).toBe('Investigate the reported issue and attempt to reproduce it.');
    });

    it('should return action string for feature_request', () => {
      const action = service.suggestAction('feature_request', 'low');
      expect(action).toBe('Review the request and add to roadmap if aligned with product goals.');
    });

    it('should return action string for help_question', () => {
      const action = service.suggestAction('help_question', 'low');
      expect(action).toBe('Provide guidance or point to relevant documentation.');
    });

    it('should return action string for template_request', () => {
      const action = service.suggestAction('template_request', 'low');
      expect(action).toBe('Check if a similar template exists or can be generated via AI Designer.');
    });

    it('should return action string for feedback', () => {
      const action = service.suggestAction('feedback', 'low');
      expect(action).toBe('Acknowledge and log for product insights.');
    });

    it('should return action string for urgent_issue', () => {
      const action = service.suggestAction('urgent_issue', 'critical');
      expect(action).toBe('Immediate attention required. Check system status and investigate.');
    });

    it('should return action string for account_issue', () => {
      const action = service.suggestAction('account_issue', 'high');
      expect(action).toBe('Review account status and assist with access or billing.');
    });

    it('should return default action for unknown category', () => {
      const action = service.suggestAction('unknown_category', 'low');
      expect(action).toBe('Review and respond to the user.');
    });
  });
});
