'use client';

import { useMemo } from 'react';
import { ContentFolder } from '@/lib/types';
import { Icon } from '@/theme/icons';

interface FolderBreadcrumbProps {
  folders: ContentFolder[];
  currentFolderId?: string | null;
  onNavigate: (id: string | null) => void;
}

export default function FolderBreadcrumb({
  folders,
  currentFolderId,
  onNavigate,
}: FolderBreadcrumbProps) {
  // Build the breadcrumb path from root to current folder
  const breadcrumbPath = useMemo(() => {
    if (!currentFolderId) {
      return [];
    }

    // Create a map for quick lookup
    const folderMap = new Map<string, ContentFolder>();
    const buildMap = (folderList: ContentFolder[]) => {
      for (const folder of folderList) {
        folderMap.set(folder.id, folder);
        if (folder.children) {
          buildMap(folder.children);
        }
      }
    };
    buildMap(folders);

    // Traverse from current folder to root
    const path: ContentFolder[] = [];
    let currentId: string | null = currentFolderId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const folder = folderMap.get(currentId);
      if (folder) {
        path.unshift(folder);
        currentId = folder.parentId;
      } else {
        break;
      }
    }

    return path;
  }, [folders, currentFolderId]);

  return (
    <nav className="flex items-center space-x-1 text-sm" aria-label="Breadcrumb">
      {/* All Content (root) */}
      <button
        onClick={() => onNavigate(null)}
        className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${
          currentFolderId === null
            ? 'text-[var(--foreground)] font-medium'
            : 'text-[#00E5A0] hover:bg-[var(--surface-hover)]'
        }`}
      >
        <Icon name="folder" size="sm" />
        <span>All Content</span>
      </button>

      {/* Folder Path */}
      {breadcrumbPath.map((folder, index) => (
        <div key={folder.id} className="flex items-center">
          {/* Separator */}
          <svg
            className="w-4 h-4 text-[var(--foreground-tertiary)]"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>

          {/* Folder Link */}
          <button
            onClick={() => onNavigate(folder.id)}
            className={`px-2 py-1 rounded-md transition ${
              index === breadcrumbPath.length - 1
                ? 'text-[var(--foreground)] font-medium'
                : 'text-[#00E5A0] hover:bg-[var(--surface-hover)]'
            }`}
          >
            {folder.name}
          </button>
        </div>
      ))}
    </nav>
  );
}
