const fs = require('fs');
const path = require('path');

const basePath = 'C:/projects/vizora';

const files = [
  'web/src/app/dashboard/page.tsx',
  'web/src/app/dashboard/devices/page.tsx',
  'web/src/app/dashboard/devices/pair/page.tsx',
  'web/src/app/dashboard/content/page.tsx',
  'web/src/app/dashboard/playlists/page.tsx',
  'web/src/app/dashboard/playlists/[id]/page.tsx',
  'web/src/app/dashboard/schedules/page.tsx',
  'web/src/app/dashboard/analytics/page.tsx',
  'web/src/app/dashboard/health/page.tsx',
  'web/src/app/dashboard/settings/page.tsx',
  'web/src/app/dashboard/settings/team/page.tsx',
  'web/src/app/dashboard/settings/api-keys/page.tsx',
  'web/src/app/dashboard/settings/audit-log/page.tsx',
  'web/src/app/dashboard/settings/customization/page.tsx',
  'web/src/app/dashboard/settings/billing/page.tsx',
  'web/src/app/dashboard/settings/billing/plans/page.tsx',
  'web/src/app/dashboard/settings/billing/history/page.tsx',
  'web/src/components/billing/plan-card.tsx',
  'web/src/components/billing/quota-bar.tsx',
  'web/src/components/billing/status-badge.tsx',
];

// Ordered replacements - order matters for specificity
const replacements = [
  // 1. Remove dark: overrides when using CSS variables - bg-white dark:bg-gray-XXX
  [/bg-white\s+dark:bg-gray-\d{3}/g, 'bg-[var(--surface)]'],

  // 2. Remove dark: overrides for bg-gray-50
  [/bg-gray-50\s+dark:bg-gray-\d{3}/g, 'bg-[var(--background)]'],

  // 3. Remove dark: overrides for bg-gray-100
  [/bg-gray-100\s+dark:bg-gray-\d{3}/g, 'bg-[var(--background-secondary)]'],

  // 4. Remove dark: overrides for bg-gray-200
  [/bg-gray-200\s+dark:bg-gray-\d{3}/g, 'bg-[var(--background-tertiary)]'],

  // 5. Remove dark: overrides for text colors
  [/text-gray-900\s+dark:text-gray-\d{2,3}/g, 'text-[var(--foreground)]'],
  [/text-gray-800\s+dark:text-gray-\d{2,3}/g, 'text-[var(--foreground)]'],
  [/text-gray-700\s+dark:text-gray-\d{2,3}/g, 'text-[var(--foreground-secondary)]'],
  [/text-gray-600\s+dark:text-gray-\d{2,3}/g, 'text-[var(--foreground-secondary)]'],
  [/text-gray-500\s+dark:text-gray-\d{2,3}/g, 'text-[var(--foreground-tertiary)]'],
  [/text-gray-400\s+dark:text-gray-\d{2,3}/g, 'text-[var(--foreground-tertiary)]'],

  // 6. Remove dark: overrides for border colors
  [/border-gray-200\s+dark:border-gray-\d{3}/g, 'border-[var(--border)]'],
  [/border-gray-300\s+dark:border-gray-\d{3}/g, 'border-[var(--border)]'],
  [/border-gray-100\s+dark:border-gray-\d{3}/g, 'border-[var(--border)]'],

  // 7. Remove dark: overrides for divide colors
  [/divide-gray-200\s+dark:divide-gray-\d{3}/g, 'divide-[var(--border)]'],
  [/divide-gray-100\s+dark:divide-gray-\d{3}/g, 'divide-[var(--border)]'],

  // 8. Remove dark: overrides for hover
  [/hover:bg-gray-100\s+dark:hover:bg-gray-\d{3}/g, 'hover:bg-[var(--surface-hover)]'],
  [/hover:bg-gray-50\s+dark:hover:bg-gray-\d{3}/g, 'hover:bg-[var(--surface-hover)]'],
  [/hover:bg-gray-200\s+dark:hover:bg-gray-\d{3}/g, 'hover:bg-[var(--surface-hover)]'],

  // 9. Remove dark: overrides for placeholder
  [/placeholder-gray-400\s+dark:placeholder-gray-\d{3}/g, 'placeholder-[var(--foreground-tertiary)]'],
  [/placeholder-gray-500\s+dark:placeholder-gray-\d{3}/g, 'placeholder-[var(--foreground-tertiary)]'],

  // 10. Gradient replacements (before individual bg-blue)
  [/from-blue-600\s+to-purple-600/g, 'from-[#00E5A0] to-[#00B4D8]'],
  [/from-blue-500\s+to-purple-600/g, 'from-[#00E5A0] to-[#00B4D8]'],
  [/from-blue-50\s+to-purple-50/g, 'from-[#00E5A0]/5 to-[#00B4D8]/5'],
  [/from-blue-50\s+to-blue-100/g, 'from-[#00E5A0]/5 to-[#00E5A0]/10'],

  // 11. bg-blue-600 text-white -> bg-[#00E5A0] text-[#061A21]
  [/bg-blue-600\s+text-white/g, 'bg-[#00E5A0] text-[#061A21]'],
  [/bg-blue-500\s+text-white/g, 'bg-[#00E5A0] text-[#061A21]'],

  // 12. Standalone bg-blue button backgrounds
  [/bg-blue-600/g, 'bg-[#00E5A0] text-[#061A21]'],
  [/bg-blue-500/g, 'bg-[#00E5A0] text-[#061A21]'],

  // 13. bg-blue for lighter contexts
  [/bg-blue-100/g, 'bg-[#00E5A0]/10'],
  [/bg-blue-50/g, 'bg-[#00E5A0]/5'],

  // 14. hover:bg-blue
  [/hover:bg-blue-700/g, 'hover:bg-[#00CC8E]'],
  [/hover:bg-blue-600/g, 'hover:bg-[#00CC8E]'],
  [/hover:bg-blue-200/g, 'hover:bg-[#00E5A0]/20'],
  [/hover:bg-blue-100/g, 'hover:bg-[#00E5A0]/10'],
  [/hover:bg-blue-50/g, 'hover:bg-[#00E5A0]/5'],

  // 15. text-blue
  [/text-blue-900/g, 'text-[#00E5A0]'],
  [/text-blue-800/g, 'text-[#00E5A0]'],
  [/text-blue-700/g, 'text-[#00E5A0]'],
  [/text-blue-600/g, 'text-[#00E5A0]'],
  [/text-blue-500/g, 'text-[#00E5A0]'],
  [/text-blue-400/g, 'text-[#00E5A0]'],
  [/text-blue-100/g, 'text-[#00E5A0]/50'],

  // 16. hover:text-blue
  [/hover:text-blue-800/g, 'hover:text-[#00CC8E]'],
  [/hover:text-blue-700/g, 'hover:text-[#00CC8E]'],

  // 17. focus:ring-blue
  [/focus:ring-blue-500/g, 'focus:ring-[#00E5A0]'],
  [/focus:ring-blue-400/g, 'focus:ring-[#00E5A0]'],

  // 18. focus:border-blue
  [/focus:border-blue-500/g, 'focus:border-[#00E5A0]'],

  // 19. ring-blue
  [/ring-blue-500/g, 'ring-[#00E5A0]'],
  [/ring-blue-200/g, 'ring-[#00E5A0]/30'],

  // 20. shadow-blue
  [/shadow-blue-100/g, 'shadow-[#00E5A0]/10'],

  // 21. border-blue
  [/border-blue-500/g, 'border-[#00E5A0]'],
  [/border-blue-200/g, 'border-[#00E5A0]/30'],
  [/border-blue-400/g, 'border-[#00E5A0]'],
  [/border-blue-800/g, 'border-[#00E5A0]'],

  // 22. focus:border for blue
  [/focus:border-blue-500/g, 'focus:border-[#00E5A0]'],

  // 23. dark:text-blue and dark:bg-blue (used in dark mode overrides for blue)
  [/dark:text-blue-400/g, 'dark:text-[#00E5A0]'],
  [/dark:text-blue-300/g, 'dark:text-[#00E5A0]'],
  [/dark:text-blue-200/g, 'dark:text-[#00E5A0]'],
  [/dark:hover:text-blue-300/g, 'dark:hover:text-[#00CC8E]'],
  [/dark:bg-blue-900/g, 'dark:bg-[#00E5A0]/10'],
  [/dark:border-blue-800/g, 'dark:border-[#00E5A0]/30'],
  [/dark:border-blue-700/g, 'dark:border-[#00E5A0]/30'],
  [/dark:group-hover:text-blue-400/g, 'dark:group-hover:text-[#00E5A0]'],

  // 24. group-hover:text-blue
  [/group-hover:text-blue-600/g, 'group-hover:text-[#00E5A0]'],

  // 25. Standalone (no dark: suffix) base replacements
  [/(?<![:\w-])bg-white(?!\s+dark:)/g, 'bg-[var(--surface)]'],
  [/(?<![:\w-])bg-gray-50(?!\s+dark:)/g, 'bg-[var(--background)]'],
  [/(?<![:\w-])bg-gray-100(?!\s+dark:)/g, 'bg-[var(--background-secondary)]'],
  [/(?<![:\w-])bg-gray-200(?!\s+dark:)/g, 'bg-[var(--background-tertiary)]'],

  [/(?<![:\w-])text-gray-900(?!\s+dark:)/g, 'text-[var(--foreground)]'],
  [/(?<![:\w-])text-gray-800(?!\s+dark:)/g, 'text-[var(--foreground)]'],
  [/(?<![:\w-])text-gray-700(?!\s+dark:)/g, 'text-[var(--foreground-secondary)]'],
  [/(?<![:\w-])text-gray-600(?!\s+dark:)/g, 'text-[var(--foreground-secondary)]'],
  [/(?<![:\w-])text-gray-500(?!\s+dark:)/g, 'text-[var(--foreground-tertiary)]'],
  [/(?<![:\w-])text-gray-400(?!\s+dark:)/g, 'text-[var(--foreground-tertiary)]'],

  [/(?<![:\w-])border-gray-200(?!\s+dark:)/g, 'border-[var(--border)]'],
  [/(?<![:\w-])border-gray-300(?!\s+dark:)/g, 'border-[var(--border)]'],
  [/(?<![:\w-])border-gray-100(?!\s+dark:)/g, 'border-[var(--border)]'],

  [/(?<![:\w-])divide-gray-200(?!\s+dark:)/g, 'divide-[var(--border)]'],
  [/(?<![:\w-])divide-gray-100(?!\s+dark:)/g, 'divide-[var(--border)]'],

  [/hover:bg-gray-100(?!\s+dark:)/g, 'hover:bg-[var(--surface-hover)]'],
  [/hover:bg-gray-50(?!\s+dark:)/g, 'hover:bg-[var(--surface-hover)]'],
  [/hover:bg-gray-200(?!\s+dark:)/g, 'hover:bg-[var(--surface-hover)]'],

  [/placeholder-gray-400(?!\s+dark:)/g, 'placeholder-[var(--foreground-tertiary)]'],
  [/placeholder-gray-500(?!\s+dark:)/g, 'placeholder-[var(--foreground-tertiary)]'],

  // 26. Clean up: dark:hover:bg-gray leftover
  [/dark:hover:bg-gray-\d{3}/g, ''],
  // Clean up orphaned dark: overrides for gray colors
  [/\s+dark:text-gray-\d{2,3}/g, ''],
  [/\s+dark:bg-gray-\d{3}/g, ''],
  [/\s+dark:border-gray-\d{3}/g, ''],
  [/\s+dark:divide-gray-\d{3}/g, ''],
  [/\s+dark:placeholder-gray-\d{3}/g, ''],

  // 27. Fix double text-[#061A21] when bg-blue replacement already added one next to existing text-[#061A21]
  [/text-\[#061A21\]\s+text-\[#061A21\]/g, 'text-[#061A21]'],

  // 28. Clean up any double spaces
  [/  +/g, ' '],
];

let processedCount = 0;
let skippedCount = 0;

files.forEach(f => {
  const filePath = path.join(basePath, f);
  if (!fs.existsSync(filePath)) {
    console.log('SKIP (not found): ' + f);
    skippedCount++;
    return;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;

  replacements.forEach(([pattern, replacement]) => {
    content = content.replace(pattern, replacement);
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('UPDATED: ' + f);
    processedCount++;
  } else {
    console.log('NO CHANGES: ' + f);
  }
});

console.log('');
console.log('Total: Processed=' + processedCount + ', Skipped=' + skippedCount);
