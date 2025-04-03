import React from 'react';
import { DisplayGroup } from '../../types/display';
import { useDisplays } from '../../hooks/useDisplays';
import './GroupList.css';

interface GroupListProps {
  groups: DisplayGroup[];
  selectedGroup: DisplayGroup | null;
  onSelectGroup: (group: DisplayGroup) => void;
  onDeleteGroup: (groupId: string) => void;
  isAdmin: boolean;
}

export const GroupList: React.FC<GroupListProps> = ({
  groups,
  selectedGroup,
  onSelectGroup,
  onDeleteGroup,
  isAdmin,
}) => {
  const { displays } = useDisplays();

  const getDisplayNames = (displayIds: string[]) => {
    return displayIds
      .map(id => displays.find(d => d.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  return (
    <div className="group-list">
      <h2>Display Groups</h2>
      <div className="group-list-content">
        {groups.length === 0 ? (
          <div className="no-groups">
            <p>No display groups found. Create one to get started.</p>
          </div>
        ) : (
          groups.map(group => (
            <div
              key={group.id}
              className={`group-item ${selectedGroup?.id === group.id ? 'selected' : ''}`}
            >
              <div
                className="group-item-content"
                onClick={() => onSelectGroup(group)}
              >
                <div className="group-item-header">
                  <h3>{group.name}</h3>
                  {group.description && (
                    <p className="group-description">{group.description}</p>
                  )}
                </div>
                <div className="group-item-details">
                  <span className="display-count">
                    {group.displayIds.length} display{group.displayIds.length !== 1 ? 's' : ''}
                  </span>
                  <div className="display-names">
                    {getDisplayNames(group.displayIds)}
                  </div>
                </div>
              </div>
              {isAdmin && (
                <div className="group-item-actions">
                  <button
                    className="delete-button"
                    onClick={() => onDeleteGroup(group.id)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}; 