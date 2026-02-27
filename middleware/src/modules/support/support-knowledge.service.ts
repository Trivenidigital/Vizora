import { Injectable } from '@nestjs/common';

interface KnowledgeEntry {
  id: string;
  keywords: string[];
  question: string;
  answer: string;
}

@Injectable()
export class SupportKnowledgeService {
  private entries: KnowledgeEntry[] = [
    {
      id: 'pair_device',
      keywords: ['pair', 'connect', 'device', 'android', 'tv', 'screen', 'add device'],
      question: 'How do I pair a device?',
      answer: 'To pair a device:\n1. Go to the **Devices** page\n2. Click **Pair Device**\n3. Enter the 6-digit code shown on your display screen\n\nThe device will connect within seconds.',
    },
    {
      id: 'use_templates',
      keywords: ['template', 'use', 'customize', 'edit', 'design'],
      question: 'How do I use templates?',
      answer: 'Browse templates at the **Templates** page. Click any template to preview it, then click **Clone & Customize** to make it your own. Edit text and images, then push to your screens.',
    },
    {
      id: 'create_playlist',
      keywords: ['playlist', 'create', 'schedule', 'content', 'rotation'],
      question: 'How do I create a playlist?',
      answer: 'Go to **Playlists** → **Create New**. Add content items, set the order and duration for each. Assign the playlist to a device or display group to start showing it.',
    },
    {
      id: 'push_content',
      keywords: ['push', 'send', 'display', 'show', 'screen', 'broadcast'],
      question: 'How do I push content to a screen?',
      answer: 'From any content item or template, click **Push to Device**. Select the target device(s) and confirm. Content appears on screen within seconds.',
    },
    {
      id: 'schedule_content',
      keywords: ['schedule', 'time', 'when', 'automate', 'rotation', 'calendar'],
      question: 'How do I schedule content?',
      answer: 'Go to **Schedules** → **Create Schedule**. Select a playlist, choose target devices, set the start/end time and recurrence pattern. The schedule will run automatically.',
    },
    {
      id: 'pricing_plans',
      keywords: ['price', 'plan', 'cost', 'subscription', 'billing', 'free', 'trial', 'upgrade'],
      question: 'What are the pricing plans?',
      answer: 'View plans at **Settings** → **Billing** → **Plans**. We offer multiple tiers from Free to Enterprise. Each plan includes different screen quotas and features.',
    },
    {
      id: 'device_offline',
      keywords: ['offline', 'disconnected', 'not showing', 'black screen', 'no signal'],
      question: 'My device shows offline',
      answer: 'If your device shows offline:\n1. Check the device\'s internet connection\n2. Restart the Vizora app on the device\n3. Verify the device hasn\'t been unpaired\n\nIf issues persist, try re-pairing the device from **Devices** → **Pair Device**.',
    },
    {
      id: 'upload_content',
      keywords: ['upload', 'file', 'image', 'video', 'add content', 'media'],
      question: 'How do I upload content?',
      answer: 'Go to **Content** → **Upload**. Drag and drop files or click to browse. Supported formats: images (JPG, PNG, GIF), videos (MP4, WebM), and URLs.',
    },
    {
      id: 'team_members',
      keywords: ['team', 'invite', 'member', 'user', 'permission', 'role', 'add user'],
      question: 'How do I manage team members?',
      answer: 'Go to **Settings** → **Team**. Click **Invite Member** to add users by email. Assign roles: **Admin** (full access), **Manager** (manage content/devices), or **Viewer** (read-only).',
    },
    {
      id: 'ai_designer',
      keywords: ['ai', 'generate', 'create', 'ai template', 'designer', 'artificial intelligence'],
      question: 'How do I use the AI Designer?',
      answer: 'Go to **Templates** and click **New Design** → **AI Designer**. Describe what you want, select your industry and style preferences, and the AI will generate a custom template you can edit.',
    },
    {
      id: 'display_groups',
      keywords: ['group', 'display group', 'multiple', 'batch', 'bulk'],
      question: 'How do I manage display groups?',
      answer: 'Go to **Devices** and look for the **Groups** tab. Create a group, then add devices to it. You can push content or assign playlists to an entire group at once.',
    },
    {
      id: 'analytics',
      keywords: ['analytics', 'stats', 'views', 'performance', 'data', 'metrics', 'report'],
      question: 'How do I view analytics?',
      answer: 'Go to **Analytics** to see device uptime, content performance, and usage trends. Filter by date range and device. Export data as CSV for external analysis.',
    },
  ];

  search(query: string): KnowledgeEntry | null {
    const lower = query.toLowerCase();
    let bestMatch: KnowledgeEntry | null = null;
    let bestScore = 0;

    for (const entry of this.entries) {
      let score = 0;
      for (const keyword of entry.keywords) {
        if (lower.includes(keyword)) {
          score += keyword.length; // Longer keyword matches score higher
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    }

    // Require minimum threshold (at least one keyword match with length >= 3)
    return bestScore >= 3 ? bestMatch : null;
  }
}
