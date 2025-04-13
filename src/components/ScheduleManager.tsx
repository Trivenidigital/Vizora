import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schedulerService } from '../services/schedulerService';
import { contentService } from '../services/contentService';

const ScheduleManager = () => {
  const [selectedItem, setSelectedItem] = React.useState<any>(null);
  const [isEditing, setIsEditing] = React.useState(false);

  const queryClient = useQueryClient();

  // Query to fetch schedule
  const scheduleQuery = useQuery({
    queryKey: ['schedule'],
    queryFn: () => schedulerService.getSchedule()
  });

  // Query to fetch content list
  const contentQuery = useQuery({
    queryKey: ['content'],
    queryFn: () => contentService.getContentList()
  });

  // Mutation to add schedule item
  const addMutation = useMutation({
    mutationFn: (item: any) => schedulerService.addScheduleItem(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      setIsEditing(false);
      setSelectedItem(null);
    }
  });

  // Mutation to update schedule item
  const updateMutation = useMutation({
    mutationFn: (item: any) => schedulerService.updateScheduleItem(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      setIsEditing(false);
      setSelectedItem(null);
    }
  });

  // Mutation to delete schedule item
  const deleteMutation = useMutation({
    mutationFn: (id: string) => schedulerService.deleteScheduleItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    }
  });

  // Mutation to toggle schedule item active state
  const toggleMutation = useMutation({
    mutationFn: (id: string) => schedulerService.activateScheduleItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    }
  });

  const handleAdd = () => {
    setSelectedItem({
      contentId: contentQuery.data?.[0]?.id || '',
      startTime: '08:00',
      endTime: '17:00',
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      isActive: true
    });
    setIsEditing(true);
  };

  const handleEdit = (item: any) => {
    setSelectedItem(item);
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleToggleActive = (id: string) => {
    toggleMutation.mutate(id);
  };

  const handleSave = (item: any) => {
    if (item.id) {
      updateMutation.mutate(item);
    } else {
      addMutation.mutate(item);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedItem(null);
  };

  // Get content title by ID
  const getContentTitle = (contentId: string) => {
    return contentQuery.data?.find(c => c.id === contentId)?.title || 'Unknown Content';
  };

  if (scheduleQuery.isLoading || contentQuery.isLoading) {
    return <div data-testid="loading-state">Loading...</div>;
  }

  if (scheduleQuery.isError || contentQuery.isError) {
    return <div data-testid="error-state">Error loading data</div>;
  }

  return (
    <div>
      <h2 data-testid="schedule-title">Content Schedule</h2>
      
      <button 
        data-testid="add-schedule" 
        onClick={handleAdd}
        disabled={!contentQuery.data?.length}
      >
        Add Schedule
      </button>
      
      {scheduleQuery.data && scheduleQuery.data.length > 0 ? (
        <ul data-testid="schedule-list">
          {scheduleQuery.data.map(item => (
            <li key={item.id} data-testid={`schedule-item-${item.id}`}>
              <span data-testid={`content-title-${item.id}`}>
                {getContentTitle(item.contentId)}
              </span>
              <span data-testid={`schedule-time-${item.id}`}>
                {item.startTime} - {item.endTime}
              </span>
              <span data-testid={`schedule-days-${item.id}`}>
                {item.daysOfWeek.join(', ')}
              </span>
              <span data-testid={`schedule-status-${item.id}`}>
                {item.isActive ? 'Active' : 'Inactive'}
              </span>
              
              <button 
                data-testid={`edit-button-${item.id}`}
                onClick={() => handleEdit(item.id)}
              >
                Edit
              </button>
              
              <button 
                data-testid={`toggle-button-${item.id}`}
                onClick={() => handleToggleActive(item.id)}
              >
                {item.isActive ? 'Deactivate' : 'Activate'}
              </button>
              
              <button 
                data-testid={`delete-button-${item.id}`}
                onClick={() => handleDelete(item.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div data-testid="no-schedules">No schedules configured</div>
      )}
      
      {isEditing && selectedItem && (
        <div data-testid="schedule-form">
          <h3 data-testid="schedule-form-title">
            {selectedItem.id ? 'Edit Schedule' : 'Add Schedule'}
          </h3>
          
          <button 
            data-testid="save-button"
            onClick={() => handleSave(selectedItem)}
          >
            Save
          </button>
          
          <button 
            data-testid="cancel-button"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default ScheduleManager; 