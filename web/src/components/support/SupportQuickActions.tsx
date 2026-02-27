'use client';

import { useSupportChat } from './useSupportChat';

const quickActions = [
  { label: 'Report a bug', prefill: 'I found a bug: ' },
  { label: 'Request a feature', prefill: "I'd like to suggest: " },
  { label: 'Get help', prefill: 'I need help with ' },
  { label: 'Template suggestion', prefill: "I'm looking for a template for " },
];

export default function SupportQuickActions() {
  const { startComposing } = useSupportChat();

  return (
    <div className="px-4 py-3 border-t border-white/5">
      <p className="text-xs text-gray-500 mb-2">Quick actions</p>
      <div className="flex flex-wrap gap-2">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => startComposing(action.prefill)}
            className="px-3 py-1.5 text-sm text-gray-300 border border-white/10 rounded-full hover:bg-white/10 transition-all duration-200"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
