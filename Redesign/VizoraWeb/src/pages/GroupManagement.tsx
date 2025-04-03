import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { DisplayGroup, DisplayGroupSchema } from '@/types/display';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/hooks/useAuth';
import { GroupList } from '@/components/groups/GroupList';
import { GroupForm } from '@/components/groups/GroupForm';
import { GroupStats } from '@/components/groups/GroupStats';
import '@/styles/pages/GroupManagement.css';

export const GroupManagement: React.FC = () => {
  const [groups, setGroups] = useState<DisplayGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<DisplayGroup | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { socket } = useSocket();
  const { user } = useAuth();

  // Fetch initial groups
  useEffect(() => {
    fetchGroups();
  }, []);

  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleGroupUpdate = (data: { group: DisplayGroup }) => {
      setGroups(prev => {
        const index = prev.findIndex(g => g.id === data.group.id);
        if (index === -1) {
          return [...prev, data.group];
        }
        return prev.map(g => g.id === data.group.id ? data.group : g);
      });
    };

    const handleGroupDelete = (data: { groupId: string }) => {
      setGroups(prev => prev.filter(g => g.id !== data.groupId));
    };

    socket.on('display:group:update', handleGroupUpdate);
    socket.on('display:group:delete', handleGroupDelete);

    return () => {
      socket.off('display:group:update', handleGroupUpdate);
      socket.off('display:group:delete', handleGroupDelete);
    };
  }, [socket]);

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups');
      if (!response.ok) throw new Error('Failed to fetch groups');
      const data = await response.json();
      setGroups(data.groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Failed to load groups');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGroup = async (groupData: Omit<DisplayGroup, 'id'>) => {
    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupData),
      });

      if (!response.ok) throw new Error('Failed to create group');
      
      const newGroup = await response.json();
      setGroups(prev => [...prev, newGroup]);
      setIsCreating(false);
      toast.success('Group created successfully');
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Failed to create group');
    }
  };

  const handleUpdateGroup = async (groupData: DisplayGroup) => {
    try {
      const response = await fetch(`/api/groups/${groupData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupData),
      });

      if (!response.ok) throw new Error('Failed to update group');
      
      const updatedGroup = await response.json();
      setGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
      setSelectedGroup(null);
      toast.success('Group updated successfully');
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error('Failed to update group');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete group');
      
      setGroups(prev => prev.filter(g => g.id !== groupId));
      setSelectedGroup(null);
      toast.success('Group deleted successfully');
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Failed to delete group');
    }
  };

  if (isLoading) {
    return <div className="loading">Loading groups...</div>;
  }

  return (
    <div className="group-management">
      <div className="group-management-header">
        <h1>Display Groups</h1>
        {user?.role === 'admin' && (
          <button
            className="primary-button"
            onClick={() => setIsCreating(true)}
          >
            Create New Group
          </button>
        )}
      </div>

      <div className="group-management-content">
        <div className="group-list-section">
          <GroupList
            groups={groups}
            selectedGroup={selectedGroup}
            onSelectGroup={setSelectedGroup}
            onDeleteGroup={handleDeleteGroup}
            isAdmin={user?.role === 'admin'}
          />
        </div>

        <div className="group-details-section">
          {isCreating ? (
            <GroupForm
              onSubmit={handleCreateGroup}
              onCancel={() => setIsCreating(false)}
            />
          ) : selectedGroup ? (
            <GroupForm
              group={selectedGroup}
              onSubmit={handleUpdateGroup}
              onCancel={() => setSelectedGroup(null)}
            />
          ) : (
            <div className="group-stats-container">
              <GroupStats groups={groups} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 