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

const TAG_COLORS = [
  { name: 'blue', bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200', border: 'border-blue-300 dark:border-blue-700' },
  { name: 'red', bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200', border: 'border-red-300 dark:border-red-700' },
  { name: 'green', bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200', border: 'border-green-300 dark:border-green-700' },
  { name: 'purple', bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-200', border: 'border-purple-300 dark:border-purple-700' },
  { name: 'yellow', bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200', border: 'border-yellow-300 dark:border-yellow-700' },
  { name: 'pink', bg: 'bg-pink-100 dark:bg-pink-900', text: 'text-pink-800 dark:text-pink-200', border: 'border-pink-300 dark:border-pink-700' },
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
                    ? `${colorClasses.bg} ${colorClasses.text} ring-2 ring-offset-1 dark:ring-offset-gray-900 ring-gray-400`
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
              className="px-3 py-1.5 rounded-full text-xs font-medium border-2 border-dashed border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              + Add Tag
            </button>
          ) : (
            <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-3 space-y-2">
              <input
                type="text"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                placeholder="Tag name (e.g., Holiday, Promotion, Q4)"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 focus:ring-2 focus:ring-blue-500"
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
                        ? 'border-gray-900 dark:border-white'
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
                  className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewTagName('');
                    setSelectedColor(TAG_COLORS[0].name);
                  }}
                  className="flex-1 px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-50 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
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
        <div className="text-xs text-gray-600 dark:text-gray-400">
          {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}
