'use client';

import { useState } from 'react';
import { Icon } from '@/theme/icons';

export interface ContentTag {
  id: string;
  name: string;
  color: string;
}

interface ContentTaggerProps {
  tags: ContentTag[];
  selectedTags: string[];
  onChange: (tagIds: string[]) => void;
  onCreateTag?: (name: string, color: string) => void;
  className?: string;
}

/*
 * NOT CONVERTED, and this is a resolution rather than a skip.
 *
 * These are CATEGORICAL identity colours: the user picks one and the `name`
 * ('blue', 'red', …) is PERSISTED via `onCreateTag(name, color)`. Changing what
 * 'blue' renders as therefore changes stored semantics, not just pixels — a
 * tag someone named blue would stop being blue.
 *
 * They also cannot map onto the status tokens: `--success`/`--error` assert a
 * STATE that a tag does not have. What they need is the `--cat-*` categorical
 * set proposed in `tasks/redesign-colour-map.json` (proposedTokens), mirroring
 * the chart series, which are already contrast- and separability-checked. That
 * is a product decision about existing customer data, so it is deliberately
 * left open rather than decided by a batch.
 *
 * The `-300` borders here are counted by the `darkThemeForegroundShades`
 * ratchet metric and are EXAMINED: they sit on their own `-100` fills, not on
 * the ivory page, so they are not the invisible-on-light failure that metric
 * exists to surface. They stay until the categorical decision lands.
 */
const TAG_COLORS = [
  { name: 'blue', bg: 'bg-info/10', text: 'text-[var(--info-ink)]', border: 'border-[#00B4D8]/30' },
  { name: 'red', bg: 'bg-red-100 dark:bg-red-900', text: 'text-[var(--error-ink)]', border: 'border-red-300 dark:border-red-700' },
  { name: 'green', bg: 'bg-green-100 dark:bg-green-900', text: 'text-[var(--success-ink)]', border: 'border-green-300 dark:border-green-700' },
  { name: 'purple', bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-[var(--accent-brass-ink)]', border: 'border-purple-300 dark:border-purple-700' },
  { name: 'yellow', bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-[var(--warning-ink)]', border: 'border-yellow-300 dark:border-yellow-700' },
  { name: 'pink', bg: 'bg-pink-100 dark:bg-pink-900', text: 'text-[var(--accent-coral-ink)]', border: 'border-pink-300 dark:border-pink-700' },
];

export default function ContentTagger({
  tags,
  selectedTags,
  onChange,
  onCreateTag,
  className = '',
}: ContentTaggerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0].name);

  const handleToggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onChange(selectedTags.filter(id => id !== tagId));
    } else {
      onChange([...selectedTags, tagId]);
    }
  };

  const handleCreateTag = () => {
    if (newTagName.trim() && onCreateTag) {
      onCreateTag(newTagName, selectedColor);
      setNewTagName('');
      setSelectedColor(TAG_COLORS[0].name);
      setIsCreating(false);
    }
  };

  const getColorClasses = (color: string) => {
    return TAG_COLORS.find(c => c.name === color) || TAG_COLORS[0];
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Tag Display */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => {
            const isSelected = selectedTags.includes(tag.id);
            const colorClasses = getColorClasses(tag.color);

            return (
              <button
                key={tag.id}
                onClick={() => handleToggleTag(tag.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isSelected
                    ? `${colorClasses.bg} ${colorClasses.text} ring-2 ring-offset-1 ring-[var(--foreground-tertiary)]`
                    : `${colorClasses.bg} ${colorClasses.text} opacity-60 hover:opacity-100`
                }`}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Create New Tag */}
      {onCreateTag && (
        <>
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="px-3 py-1.5 rounded-full text-xs font-medium border-2 border-dashed border-[var(--border)] text-[var(--foreground-secondary)] hover:border-[var(--primary-ink)] hover:text-[var(--primary-ink)] transition"
            >
              + Add Tag
            </button>
          ) : (
            <div className="border border-[var(--border)] rounded-lg p-3 space-y-2">
              <input
                type="text"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                placeholder="Tag name (e.g., Holiday, Promotion, Q4)"
                className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary-ink)]"
                autoFocus
              />

              {/* Color Picker */}
              <div className="flex gap-2">
                {TAG_COLORS.map(color => (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColor(color.name)}
                    className={`w-6 h-6 rounded-full border-2 transition ${
                      selectedColor === color.name
                        ? 'border-[var(--foreground)]'
                        : 'border-transparent'
                    } ${color.bg}`}
                    title={color.name}
                  />
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim()}
                  className="flex-1 px-3 py-1.5 text-sm bg-[var(--primary)] text-[var(--lw-on-forest)] rounded hover:bg-[var(--primary-light)] disabled:opacity-50 transition"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewTagName('');
                    setSelectedColor(TAG_COLORS[0].name);
                  }}
                  className="flex-1 px-3 py-1.5 text-sm bg-[var(--background-tertiary)] text-[var(--foreground)] rounded hover:bg-[var(--surface-hover)] transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Selected Tags Count */}
      {selectedTags.length > 0 && (
        <div className="text-xs text-[var(--foreground-secondary)]">
          {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}
