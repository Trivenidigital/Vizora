import { Injectable } from '@nestjs/common';

@Injectable()
export class SupportClassifierService {
  classify(message: string): { category: string; priority: string } {
    const lower = message.toLowerCase();

    // Urgent
    if (this.matchesAny(lower, ['down', 'outage', 'emergency', 'all devices', 'production', 'critical']))
      return { category: 'urgent_issue', priority: 'critical' };

    // Account/billing
    if (this.matchesAny(lower, ['account', 'billing', 'payment', 'subscription', 'login', 'password', 'locked out', 'cant access', "can't access", 'invoice']))
      return { category: 'account_issue', priority: 'high' };

    // Bug
    if (this.matchesAny(lower, ['bug', 'broken', 'error', 'crash', 'not working', 'doesnt work', "doesn't work", 'fails', 'failed', 'issue', 'problem', 'wrong', 'fix', 'glitch']))
      return { category: 'bug_report', priority: lower.includes('crash') || lower.includes('down') ? 'critical' : 'medium' };

    // Help
    if (this.matchesAny(lower, ['how do i', 'how to', 'where is', 'can i', 'help me', 'what is', 'how can', 'guide', 'tutorial', 'where can']))
      return { category: 'help_question', priority: 'low' };

    // Template
    if (this.matchesAny(lower, ['template', 'design', 'layout', 'menu board', 'signage', 'poster']))
      return { category: 'template_request', priority: 'low' };

    // Feature
    if (this.matchesAny(lower, ['feature', 'request', 'would be nice', 'can you add', 'please add', 'suggestion', 'wish', 'it would help']))
      return { category: 'feature_request', priority: 'low' };

    // Feedback
    if (this.matchesAny(lower, ['love', 'great', 'awesome', 'thank', 'amazing', 'feedback', 'good job', 'impressed']))
      return { category: 'feedback', priority: 'low' };

    return { category: 'help_question', priority: 'medium' };
  }

  generateTitle(message: string): string {
    // Take the first sentence or first 100 chars
    const firstSentence = message.split(/[.!?\n]/)[0].trim();
    return firstSentence.length > 100 ? firstSentence.substring(0, 97) + '...' : firstSentence;
  }

  generateSummary(message: string, category: string): string {
    return `[${category.replace(/_/g, ' ').toUpperCase()}] ${message.substring(0, 300)}`;
  }

  suggestAction(category: string, priority: string): string {
    const actions: Record<string, string> = {
      bug_report: 'Investigate the reported issue and attempt to reproduce it.',
      feature_request: 'Review the request and add to roadmap if aligned with product goals.',
      help_question: 'Provide guidance or point to relevant documentation.',
      template_request: 'Check if a similar template exists or can be generated via AI Designer.',
      feedback: 'Acknowledge and log for product insights.',
      urgent_issue: 'Immediate attention required. Check system status and investigate.',
      account_issue: 'Review account status and assist with access or billing.',
    };
    return actions[category] || 'Review and respond to the user.';
  }

  private matchesAny(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }
}
