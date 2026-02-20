'use client';

import { useState, useCallback } from 'react';
import { ContentFolder } from '@/lib/types';
import { Icon } from '@/theme/icons';

interface FolderTreeProps {
  folders: ContentFolder[];
  selectedFolderId?: string | null;
  onSelectFolder: (id: string | null) => void;
  onCreateFolder?: () => void;
}

interface FolderNodeProps {
  folder: ContentFolder;
  level: number;
  selectedFolderId?: string | null;
  expandedFolders: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelectFolder: (id: string | null) => void;
}

function FolderNode({
  folder,
  level,
  selectedFolderId,
  expandedFolders,
  onToggleExpand,
  onSelectFolder,
}: FolderNodeProps) {
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const hasChildren = folder.children && folder.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center py-2 px-2 rounded-md cursor-pointer transition-colors ${
          isSelected
            ? 'bg-[#00E5A0]/10 text-[#00E5A0]'
            : 'hover:bg-[var(--surface-hover)] text-[var(--foreground-secondary)]'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelectFolder(folder.id)}
      >
        {/* Expand/Collapse Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(folder.id);
          }}
          className={`mr-1 p-0.5 rounded hover:bg-[var(--surface-hover)] ${
            !hasChildren ? 'invisible' : ''
          }`}
        >
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Folder Icon */}
        <Icon
          name={isExpanded ? 'folder' : 'folder'}
          size="md"
          className={`mr-2 ${isSelected ? 'text-[#00E5A0]' : 'text-yellow-500'}`}
        />

        {/* Folder Name */}
        <span className="flex-1 text-sm font-medium truncate">{folder.name}</span>

        {/* Content Count Badge */}
        {folder.contentCount !== undefined && folder.contentCount > 0 && (
          <span className="ml-2 px-2 py-0.5 text-xs bg-[var(--background-tertiary)] text-[var(--foreground-secondary)] rounded-full">
            {folder.contentCount}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {folder.children!.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              level={level + 1}
              selectedFolderId={selectedFolderId}
              expandedFolders={expandedFolders}
              onToggleExpand={onToggleExpand}
              onSelectFolder={onSelectFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FolderTree({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
}: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Folders</h3>
        {onCreateFolder && (
          <button
            onClick={onCreateFolder}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#00E5A0] bg-[#00E5A0]/10 rounded-md hover:bg-[#00E5A0]/20 transition"
          >
            <Icon name="add" size="sm" />
            New Folder
          </button>
        )}
      </div>

      {/* Folder List */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* All Content Option */}
        <div
          className={`flex items-center py-2 px-3 rounded-md cursor-pointer transition-colors ${
            selectedFolderId === null
              ? 'bg-[#00E5A0]/10 text-[#00E5A0]'
              : 'hover:bg-[var(--surface-hover)] text-[var(--foreground-secondary)]'
          }`}
          onClick={() => onSelectFolder(null)}
        >
          <Icon name="grid" size="md" className="mr-2 text-[var(--foreground-tertiary)]" />
          <span className="text-sm font-medium">All Content</span>
        </div>

        {/* Folder Tree */}
        {folders.length > 0 ? (
          <div className="mt-2">
            {folders.map((folder) => (
              <FolderNode
                key={folder.id}
                folder={folder}
                level={0}
                selectedFolderId={selectedFolderId}
                expandedFolders={expandedFolders}
                onToggleExpand={toggleExpand}
                onSelectFolder={onSelectFolder}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 text-center text-sm text-[var(--foreground-tertiary)]">
            No folders yet
          </div>
        )}
      </div>

    </div>
  );
}
