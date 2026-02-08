'use client';

import { useState } from 'react';
import { Icon } from '@/theme/icons';

export interface DeviceGroup {
  id: string;
  name: string;
  description: string;
  parentGroupId?: string;
  deviceIds: string[];
}

interface DeviceGroupSelectorProps {
  groups: DeviceGroup[];
  selectedGroupIds: string[];
  onChange: (groupIds: string[]) => void;
  showCreate?: boolean;
  onCreateGroup?: (name: string, description: string) => void;
  className?: string;
}

export default function DeviceGroupSelector({
  groups,
  selectedGroupIds,
  onChange,
  showCreate = false,
  onCreateGroup,
  className = '',
}: DeviceGroupSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  const handleToggleGroup = (groupId: string) => {
    if (selectedGroupIds.includes(groupId)) {
      onChange(selectedGroupIds.filter(id => id !== groupId));
    } else {
      onChange([...selectedGroupIds, groupId]);
    }
  };

  const handleCreateGroup = () => {
    if (newGroupName.trim() && onCreateGroup) {
      onCreateGroup(newGroupName, newGroupDesc);
      setNewGroupName('');
      setNewGroupDesc('');
      setIsCreating(false);
    }
  };

  // Get device count for a group
  const getGroupDeviceCount = (group: DeviceGroup) => {
    return group.deviceIds.length;
  };

  // Build hierarchical structure
  const renderGroups = (parentId?: string, level = 0) => {
    const childGroups = groups.filter(g => g.parentGroupId === parentId);

    return childGroups.map(group => (
      <div key={group.id} className="space-y-2">
        <label className={`flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-[var(--surface-hover)] transition ${'ml-' + (level * 4)}`}>
          <input
            type="checkbox"
            checked={selectedGroupIds.includes(group.id)}
            onChange={() => handleToggleGroup(group.id)}
            className="rounded border-[var(--border)] text-[#00E5A0] focus:ring-[#00E5A0]"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-[var(--foreground)]">{group.name}</div>
            <div className="text-xs text-[var(--foreground-tertiary)]">
              {getGroupDeviceCount(group)} device{getGroupDeviceCount(group) !== 1 ? 's' : ''}
            </div>
          </div>
          {group.description && (
            <Icon name="info" size="sm" title={group.description} />
          )}
        </label>

        {/* Nested groups */}
        {renderGroups(group.id, level + 1)}
      </div>
    ));
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {groups.length === 0 ? (
        <div className="text-center py-6">
          <Icon name="info" size="lg" className="mx-auto mb-2 text-[var(--foreground-tertiary)]" />
          <p className="text-sm text-[var(--foreground-secondary)]">No device groups yet</p>
        </div>
      ) : (
        <div className="border border-[var(--border)] rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
          {renderGroups()}
        </div>
      )}

      {showCreate && (
        <>
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full px-3 py-2 text-sm border border-dashed border-[#00E5A0]/30 rounded-lg text-[#00E5A0] hover:bg-[#00E5A0]/5 transition"
            >
              + Create New Group
            </button>
          ) : (
            <div className="border border-[#00E5A0]/30 rounded-lg p-3 space-y-2">
              <input
                type="text"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                placeholder="Group name (e.g., Store 1, NYC Region)"
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0]"
              />
              <textarea
                value={newGroupDesc}
                onChange={e => setNewGroupDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0]"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateGroup}
                  disabled={!newGroupName.trim()}
                  className="flex-1 px-3 py-2 text-sm bg-[#00E5A0] text-[#061A21] rounded hover:bg-[#00CC8E] disabled:opacity-50 transition"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewGroupName('');
                    setNewGroupDesc('');
                  }}
                  className="flex-1 px-3 py-2 text-sm bg-[var(--background-tertiary)] text-[var(--foreground)] rounded hover:bg-[var(--surface-hover)] transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {selectedGroupIds.length > 0 && (
        <div className="text-xs text-[var(--foreground-secondary)]">
          {selectedGroupIds.length} group{selectedGroupIds.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}
