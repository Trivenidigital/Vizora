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
        <label className={`flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition ${'ml-' + (level * 4)}`}>
          <input
            type="checkbox"
            checked={selectedGroupIds.includes(group.id)}
            onChange={() => handleToggleGroup(group.id)}
            className="rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-50">{group.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
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
          <Icon name="info" size="lg" className="mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-600 dark:text-gray-400">No device groups yet</p>
        </div>
      ) : (
        <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
          {renderGroups()}
        </div>
      )}

      {showCreate && (
        <>
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full px-3 py-2 text-sm border border-dashed border-blue-300 dark:border-blue-700 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 transition"
            >
              + Create New Group
            </button>
          ) : (
            <div className="border border-blue-300 dark:border-blue-700 rounded-lg p-3 space-y-2">
              <input
                type="text"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                placeholder="Group name (e.g., Store 1, NYC Region)"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                value={newGroupDesc}
                onChange={e => setNewGroupDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateGroup}
                  disabled={!newGroupName.trim()}
                  className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewGroupName('');
                    setNewGroupDesc('');
                  }}
                  className="flex-1 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-50 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {selectedGroupIds.length > 0 && (
        <div className="text-xs text-gray-600 dark:text-gray-400">
          {selectedGroupIds.length} group{selectedGroupIds.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}
