'use client';

import { useState, useMemo } from 'react';
import { Icon } from '@/theme/icons';
import type { IconName } from '@/theme/icons';

interface FAQ {
  question: string;
  answer: string;
}

interface Category {
  name: string;
  icon: IconName;
  faqs: FAQ[];
}

const helpCategories: Category[] = [
  {
    name: 'Getting Started',
    icon: 'power',
    faqs: [
      {
        question: 'How do I pair my first display device?',
        answer:
          'Navigate to the Devices page from the sidebar, then click "Pair Device." You will see a 6-digit pairing code. On your display device (Electron desktop app or Android TV app), enter this code during setup. The device will appear in your device list within a few seconds once paired successfully.',
      },
      {
        question: 'How do I create my first template?',
        answer:
          'Go to the Templates page and click "Create Template." You can start from a blank canvas or choose from the template library. The visual editor lets you add text, images, and video zones. Once you are happy with the layout, save it and it will be available for use in your content.',
      },
      {
        question: 'How do I push content to a device?',
        answer:
          'First, upload or create your content on the Content page. Then go to Devices, select the target device, and click "Push Content." Choose the content item you want to display. The content will be sent to the device in real time via WebSocket and will appear on screen within seconds.',
      },
      {
        question: 'How do I set up a playlist?',
        answer:
          'Navigate to the Playlists page and click "Create Playlist." Add content items in the order you want them displayed, set the duration for each item, and configure transition effects. Once saved, you can assign the playlist to one or more devices from the Devices page.',
      },
      {
        question: "What's the recommended workflow for new users?",
        answer:
          'We recommend this order: (1) Pair at least one display device, (2) Upload your content (images, videos, or URLs), (3) Optionally create templates for branded layouts, (4) Build a playlist with your content, (5) Assign the playlist to your device, (6) Set up a schedule if you need time-based content rotation.',
      },
    ],
  },
  {
    name: 'Templates & Content',
    icon: 'grid',
    faqs: [
      {
        question: 'How do I browse the template library?',
        answer:
          'Go to the Templates page from the sidebar. You will see a library of pre-built templates organized by category (e.g., retail, restaurant, corporate). Use the search bar or filter by category to find a template that fits your needs. Click any template to preview it before using it.',
      },
      {
        question: 'How do I customize a template?',
        answer:
          'Select a template and click "Customize" or "Edit." The visual editor lets you modify text, swap images, change colors, adjust fonts, and reposition elements. All changes are saved to your copy of the template  &mdash; the original library template remains unchanged.',
      },
      {
        question: 'What file formats are supported for upload?',
        answer:
          'Images: JPEG, PNG, GIF, WebP, SVG. Videos: MP4 (H.264), WebM, MOV. Documents: PDF. You can also add web URLs and raw HTML content directly. All uploaded files go through validation including magic number verification to ensure file integrity.',
      },
      {
        question: 'How do I organize content with folders and tags?',
        answer:
          'On the Content page, you can create folders to group related content. Click "New Folder" to create one, then drag content items into it. You can also add tags to any content item by selecting it and clicking "Add Tag." Use the search and filter bar to find content by name, tag, or type.',
      },
      {
        question: 'What are the recommended image/video dimensions?',
        answer:
          'For Full HD displays: 1920x1080 pixels (landscape) or 1080x1920 (portrait). For 4K displays: 3840x2160 or 2160x3840. Videos should use H.264 encoding at 30fps for best compatibility. Keep file sizes under 100MB for fast delivery. The system will scale content to fit, but native resolution gives the sharpest results.',
      },
    ],
  },
  {
    name: 'Devices',
    icon: 'devices',
    faqs: [
      {
        question: 'How do I pair a new display device?',
        answer:
          'On the Devices page, click "Pair Device" to generate a pairing code. This 6-digit code is valid for 5 minutes. Enter it on your display device during its initial setup or from its settings menu. Once paired, the device authenticates with a device-specific JWT token and maintains a persistent WebSocket connection.',
      },
      {
        question: 'What do the device status indicators mean?',
        answer:
          'Green (Online): The device has an active WebSocket connection and is receiving content. Yellow (Idle): The device is connected but has no active playlist or content assigned. Red (Offline): The device has lost its connection. Gray (Never Connected): The device was paired but has not connected yet.',
      },
      {
        question: 'My device shows as offline  &mdash; how do I troubleshoot?',
        answer:
          'Check these in order: (1) Verify the device has internet connectivity, (2) Ensure the device is powered on and the Vizora app is running, (3) Check your network firewall allows WebSocket connections on port 3002, (4) Try restarting the Vizora app on the device, (5) If the issue persists, un-pair and re-pair the device from the dashboard.',
      },
      {
        question: 'How do I remotely reload or restart a device?',
        answer:
          'Select the device on the Devices page and open the device details panel. Click the "Reload" button to force the device to re-fetch and re-render its current content. Use "Restart App" to fully restart the Vizora application on the device. Both commands are sent via WebSocket and execute immediately if the device is online.',
      },
      {
        question: 'What happens when a device loses internet connection?',
        answer:
          'Devices cache their current content locally. If the connection drops, the device continues displaying the last-known content (or playlist) from its local cache. When connectivity is restored, the device automatically reconnects, syncs any content updates, and resumes normal operation. The dashboard will show the device as offline during the outage.',
      },
    ],
  },
  {
    name: 'Playlists & Scheduling',
    icon: 'playlists',
    faqs: [
      {
        question: 'How do I create a playlist?',
        answer:
          'Go to the Playlists page and click "Create Playlist." Give it a name, then add content items by clicking "Add Content." You can reorder items by dragging them, set individual display durations (in seconds), and choose transition effects between items. Save when you are done.',
      },
      {
        question: 'How do I assign a playlist to a device or group?',
        answer:
          'From the Devices page, select one or more devices (or a device group), then click "Assign Playlist." Choose the playlist from the dropdown. The playlist will begin playing on the selected devices immediately. You can also assign playlists from the Playlists page by clicking "Assign" on any playlist.',
      },
      {
        question: 'How do I set up a schedule for content rotation?',
        answer:
          'Navigate to the Schedules page and click "Create Schedule." Select the playlist or content to schedule, choose the target devices, and set the start/end times. You can create recurring schedules (daily, weekly) or one-time schedules for events. Schedules automatically activate and deactivate at the specified times.',
      },
      {
        question: 'Can I set different schedules for different days?',
        answer:
          'Yes. When creating a schedule, select "Weekly" recurrence and choose specific days of the week. You can create multiple schedules for the same device with different playlists  &mdash; for example, a lunch menu playlist on weekdays and a brunch menu on weekends. The system handles overlapping schedules by priority.',
      },
      {
        question: 'How does emergency content override work?',
        answer:
          'Emergency content takes priority over all schedules and playlists. Go to Content, select the item you want to push as an emergency, and click "Emergency Push." Choose the target devices or "All Devices." The emergency content will display immediately, overriding whatever was playing. Dismiss the emergency from the dashboard to resume normal scheduling.',
      },
    ],
  },
  {
    name: 'Billing & Plans',
    icon: 'document',
    faqs: [
      {
        question: 'What plans are available?',
        answer:
          'Vizora offers three plans: Starter (up to 5 devices, basic templates, email support), Professional (up to 25 devices, full template library, priority support, analytics), and Enterprise (unlimited devices, custom integrations, dedicated account manager, SLA). Visit the Settings page to view current pricing and feature comparisons.',
      },
      {
        question: 'How do I upgrade my subscription?',
        answer:
          'Go to Settings > Billing and click "Upgrade Plan." Select your desired plan and enter your payment information. The upgrade takes effect immediately  &mdash; you will have instant access to the new plan features. Your billing cycle resets on the upgrade date, and you will receive a prorated credit for the unused portion of your previous plan.',
      },
      {
        question: 'How do I cancel my subscription?',
        answer:
          'Navigate to Settings > Billing and click "Cancel Subscription." You will retain access to your current plan features until the end of your billing period. Your content and device configurations are preserved for 30 days after cancellation in case you decide to resubscribe.',
      },
      {
        question: 'Where can I find my invoices?',
        answer:
          'All invoices are available in Settings > Billing > Invoice History. You can view, download as PDF, or have them sent to a specific email address. Invoices are generated on each billing cycle date and are available immediately.',
      },
      {
        question: 'What payment methods are accepted?',
        answer:
          'We accept all major credit cards (Visa, Mastercard, American Express), debit cards, and ACH bank transfers for annual plans. Enterprise customers can also pay by invoice with net-30 terms. All payments are processed securely through Stripe.',
      },
    ],
  },
  {
    name: 'Account & Security',
    icon: 'shield',
    faqs: [
      {
        question: 'How do I edit my profile?',
        answer:
          'Go to Settings from the sidebar. On the Profile tab, you can update your name, email address, and password. Changes take effect immediately. If you change your email address, you will need to verify the new address before it becomes active.',
      },
      {
        question: 'How do I invite team members?',
        answer:
          'Navigate to Settings > Team and click "Invite Member." Enter their email address and select a role (Admin, Editor, or Viewer). They will receive an email invitation with a link to create their account. You can manage pending invitations and revoke access from the same page.',
      },
      {
        question: 'How do I delete my account?',
        answer:
          'Go to Settings > Account and scroll to "Delete Account." This action is permanent and will remove all your data, devices, content, and team members. You must type your email address to confirm. If you are the only admin in your organization, you must transfer ownership first or delete the organization.',
      },
      {
        question: 'How is my data protected?',
        answer:
          'Vizora uses industry-standard security measures: all data is encrypted in transit (TLS 1.3) and at rest (AES-256). Authentication uses secure httpOnly cookies with CSRF protection. Passwords are hashed with bcrypt. We run regular security audits and maintain SOC 2 compliance. Device communication is authenticated with separate JWT tokens.',
      },
      {
        question: 'What roles and permissions are available?',
        answer:
          'Three roles are available: Admin (full access  &mdash; manage team, billing, devices, and content), Editor (create and manage content, templates, playlists, and schedules  &mdash; cannot manage team or billing), and Viewer (read-only access to dashboards and analytics  &mdash; cannot modify content or devices). Organization owners can customize permissions further in Settings > Roles.',
      },
    ],
  },
];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return helpCategories;

    const query = searchQuery.toLowerCase();
    return helpCategories
      .map((category) => ({
        ...category,
        faqs: category.faqs.filter(
          (faq) =>
            faq.question.toLowerCase().includes(query) ||
            faq.answer.toLowerCase().includes(query)
        ),
      }))
      .filter((category) => category.faqs.length > 0);
  }, [searchQuery]);

  const totalResults = filteredCategories.reduce(
    (sum, cat) => sum + cat.faqs.length,
    0
  );

  const toggleCategory = (name: string) => {
    if (openCategory === name) {
      setOpenCategory(null);
      setOpenQuestion(null);
    } else {
      setOpenCategory(name);
      setOpenQuestion(null);
    }
  };

  const toggleQuestion = (id: string) => {
    setOpenQuestion(openQuestion === id ? null : id);
  };

  // When searching, show all matching results expanded
  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="eh-dash-title">Help &amp; Documentation</h1>
        <p className="mt-1 text-[var(--foreground-secondary)]">
          Find answers to common questions about using Vizora
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-xl">
        <Icon
          name="search"
          size="md"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-tertiary)]"
        />
        <input
          type="text"
          placeholder="Search help articles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="eh-input w-full pl-10 pr-4 py-2.5"
        />
        {isSearching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--foreground-tertiary)]">
            {totalResults} result{totalResults !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Categories Grid */}
      {filteredCategories.length === 0 ? (
        <div className="eh-dash-card p-12 text-center">
          <Icon
            name="search"
            size="xl"
            className="mx-auto text-[var(--foreground-tertiary)] mb-3"
          />
          <p className="text-[var(--foreground-secondary)]">
            No results found for &quot;{searchQuery}&quot;
          </p>
          <p className="text-sm text-[var(--foreground-tertiary)] mt-1">
            Try a different search term
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCategories.map((category) => {
            const isCategoryOpen =
              isSearching || openCategory === category.name;

            return (
              <div
                key={category.name}
                className={`eh-dash-card overflow-hidden transition-all duration-200 ${
                  isCategoryOpen ? 'md:col-span-2' : ''
                }`}
              >
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category.name)}
                  className="w-full flex items-center justify-between p-4 hover:bg-[var(--surface-hover)] transition-colors duration-150"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                      <Icon
                        name={category.icon}
                        size="md"
                        className="text-[var(--primary)]"
                      />
                    </div>
                    <div className="text-left">
                      <h2 className="eh-dash-subtitle">{category.name}</h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="eh-badge">
                      {category.faqs.length}{' '}
                      {category.faqs.length === 1 ? 'article' : 'articles'}
                    </span>
                    <Icon
                      name={isCategoryOpen ? 'chevronUp' : 'chevronDown'}
                      size="md"
                      className="text-[var(--foreground-tertiary)]"
                    />
                  </div>
                </button>

                {/* Questions Accordion */}
                <div
                  className={`grid transition-all duration-200 ${
                    isCategoryOpen
                      ? 'grid-rows-[1fr] opacity-100'
                      : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                  <div className="border-t border-[var(--border)]">
                    {category.faqs.map((faq, idx) => {
                      const questionId = `${category.name}-${idx}`;
                      const isOpen =
                        isSearching || openQuestion === questionId;

                      return (
                        <div
                          key={questionId}
                          className="border-b border-[var(--border)] last:border-b-0"
                        >
                          <button
                            onClick={() => toggleQuestion(questionId)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--surface-hover)] transition-colors duration-150"
                          >
                            <span className="text-sm font-medium text-[var(--foreground)] pr-4">
                              {faq.question}
                            </span>
                            <Icon
                              name={isOpen ? 'chevronUp' : 'chevronDown'}
                              size="sm"
                              className="text-[var(--foreground-tertiary)] flex-shrink-0"
                            />
                          </button>
                          <div
                            className={`grid transition-all duration-200 ${
                              isOpen
                                ? 'grid-rows-[1fr] opacity-100'
                                : 'grid-rows-[0fr] opacity-0'
                            }`}
                          >
                            <div className="overflow-hidden">
                              <div className="px-4 pb-4 text-sm text-[var(--foreground-secondary)] leading-relaxed">
                                {faq.answer}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer help link */}
      <div className="text-center text-sm text-[var(--foreground-tertiary)] pb-4">
        Can&apos;t find what you&apos;re looking for? Use the support chat in
        the bottom-right corner.
      </div>
    </div>
  );
}
