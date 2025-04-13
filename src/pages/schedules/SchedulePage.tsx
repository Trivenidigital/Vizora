import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { useGetDisplays, DisplayOption } from '@/hooks/useGetDisplays';
import { useGetContent, ContentOption } from '@/hooks/useGetContent';
import { formatDate, formatTime } from '@/utils/formatters';
import { useSchedules, Schedule, ScheduleFormData } from '@/hooks/useSchedules';

const SchedulePage: React.FC = () => {
  // Fetch schedules, displays, and content
  const { 
    schedules, 
    loading, 
    createSchedule, 
    updateSchedule, 
    deleteSchedule 
  } = useSchedules();
  
  const { displays, isLoading: displaysLoading } = useGetDisplays();
  const { content, isLoading: contentLoading } = useGetContent();
  
  // State for filtered schedules
  const [filteredSchedules, setFilteredSchedules] = useState<Schedule[]>([]);
  
  // Filter state
  const [displayFilter, setDisplayFilter] = useState<string>('');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<ScheduleFormData>({
    name: '',
    displayId: '',
    contentId: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    daysOfWeek: [],
    repeat: 'weekly',
    priority: 1,
  });

  // Filter schedules when schedules or filter changes
  useEffect(() => {
    if (schedules) {
      filterSchedules();
    }
  }, [schedules, displayFilter]);

  // Filter schedules based on selected filters
  const filterSchedules = () => {
    let filtered = [...schedules];
    
    // Apply display filter
    if (displayFilter) {
      filtered = filtered.filter(item => item.displayId === displayFilter);
    }
    
    setFilteredSchedules(filtered);
  };

  // Handle display filter change
  const handleDisplayFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDisplayFilter(e.target.value);
  };

  // Reset form and open create modal
  const handleAddScheduleClick = () => {
    setFormData({
      name: '',
      displayId: '',
      contentId: '',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      daysOfWeek: [],
      repeat: 'weekly',
      priority: 1,
    });
    setShowCreateModal(true);
  };

  // Handle form submission for creating schedule
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await createSchedule(formData);
      if (result) {
        setShowCreateModal(false);
      }
    } catch (error) {
      console.error('Error in create submit handler:', error);
    }
  };

  // Handle day checkbox changes
  const handleDayCheckboxChange = (day: string) => {
    const updatedDays = [...formData.daysOfWeek];
    if (updatedDays.includes(day)) {
      setFormData({
        ...formData,
        daysOfWeek: updatedDays.filter(d => d !== day),
      });
    } else {
      setFormData({
        ...formData,
        daysOfWeek: [...updatedDays, day],
      });
    }
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Handle edit button click
  const handleEditClick = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setFormData({
      name: schedule.name,
      displayId: schedule.displayId,
      contentId: schedule.contentId,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      daysOfWeek: [...schedule.daysOfWeek],
      repeat: schedule.repeat,
      priority: schedule.priority,
    });
    setShowEditModal(true);
  };

  // Handle update submission
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSchedule) return;
    
    try {
      const result = await updateSchedule(selectedSchedule._id, formData);
      if (result) {
        setShowEditModal(false);
      }
    } catch (error) {
      console.error('Error in update submit handler:', error);
    }
  };

  // Handle delete button click
  const handleDeleteClick = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setShowDeleteModal(true);
  };

  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    if (!selectedSchedule) return;
    
    try {
      const success = await deleteSchedule(selectedSchedule._id);
      if (success) {
        setShowDeleteModal(false);
        setSelectedSchedule(null);
      }
    } catch (error) {
      console.error('Error in delete handler:', error);
    }
  };

  // Show loading spinner if data is loading
  if (loading || displaysLoading || contentLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader 
        title="Schedule Management"
        description="Create and manage schedules for your displays"
      />
      
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="w-full md:w-64">
          <Select
            label="Filter by Display"
            name="displayFilter"
            value={displayFilter}
            onChange={handleDisplayFilterChange}
          >
            <option value="">All Displays</option>
            {displays.map(display => (
              <option key={display.id} value={display.id}>
                {display.name}
              </option>
            ))}
          </Select>
        </div>
        
        <Button 
          variant="primary"
          onClick={handleAddScheduleClick}
          className="w-full md:w-auto"
        >
          Add New Schedule
        </Button>
      </div>
      
      {filteredSchedules.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500">No schedules found. Click "Add New Schedule" to create one.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredSchedules.map((schedule) => (
            <Card key={schedule._id} className="p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{schedule.name}</h3>
                  <p className="text-sm text-gray-600">
                    {schedule.displayName} • {schedule.contentName}
                  </p>
                  <div className="mt-2 text-sm">
                    <p>
                      <span className="font-medium">Time:</span> {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                    </p>
                    <p>
                      <span className="font-medium">Date Range:</span> {formatDate(schedule.startDate)} - {formatDate(schedule.endDate)}
                    </p>
                    <p>
                      <span className="font-medium">Days:</span> {schedule.daysOfWeek.map(d => 
                        d.charAt(0).toUpperCase() + d.slice(1)
                      ).join(', ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleEditClick(schedule)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteClick(schedule)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      
      {/* Create Schedule Modal */}
      {showCreateModal && (
        <Modal
          title="Add New Schedule"
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <Input
              label="Schedule Name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
            
            <Select
              label="Display"
              name="displayId"
              value={formData.displayId}
              onChange={handleInputChange}
              required
            >
              <option value="">Select Display</option>
              {displays.map(display => (
                <option key={display.id} value={display.id}>
                  {display.name}
                </option>
              ))}
            </Select>
            
            <Select
              label="Content"
              name="contentId"
              value={formData.contentId}
              onChange={handleInputChange}
              required
            >
              <option value="">Select Content</option>
              {content.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.type})
                </option>
              ))}
            </Select>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="date"
                label="Start Date"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
                required
              />
              <Input
                type="date"
                label="End Date"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="time"
                label="Start Time"
                name="startTime"
                value={formData.startTime}
                onChange={handleInputChange}
                required
              />
              <Input
                type="time"
                label="End Time"
                name="endTime"
                value={formData.endTime}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <fieldset>
              <legend className="text-sm font-medium mb-2">Days of Week</legend>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                  <Checkbox
                    key={day}
                    label={day.charAt(0).toUpperCase() + day.slice(1)}
                    checked={formData.daysOfWeek.includes(day)}
                    onChange={() => handleDayCheckboxChange(day)}
                  />
                ))}
              </div>
            </fieldset>
            
            <Select
              label="Repeat"
              name="repeat"
              value={formData.repeat}
              onChange={handleInputChange}
              required
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="none">No Repeat</option>
            </Select>
            
            <Input
              type="number"
              label="Priority"
              name="priority"
              min="1"
              max="10"
              value={formData.priority.toString()}
              onChange={handleInputChange}
              required
            />
            
            <div className="flex justify-end gap-2 mt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create Schedule
              </Button>
            </div>
          </form>
        </Modal>
      )}
      
      {/* Edit Schedule Modal */}
      {showEditModal && selectedSchedule && (
        <Modal
          title="Edit Schedule"
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
        >
          <form onSubmit={handleUpdateSubmit} className="space-y-4">
            <Input
              label="Schedule Name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
            
            <Select
              label="Display"
              name="displayId"
              value={formData.displayId}
              onChange={handleInputChange}
              required
            >
              <option value="">Select Display</option>
              {displays.map(display => (
                <option key={display.id} value={display.id}>
                  {display.name}
                </option>
              ))}
            </Select>
            
            <Select
              label="Content"
              name="contentId"
              value={formData.contentId}
              onChange={handleInputChange}
              required
            >
              <option value="">Select Content</option>
              {content.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.type})
                </option>
              ))}
            </Select>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="date"
                label="Start Date"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
                required
              />
              <Input
                type="date"
                label="End Date"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="time"
                label="Start Time"
                name="startTime"
                value={formData.startTime}
                onChange={handleInputChange}
                required
              />
              <Input
                type="time"
                label="End Time"
                name="endTime"
                value={formData.endTime}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <fieldset>
              <legend className="text-sm font-medium mb-2">Days of Week</legend>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                  <Checkbox
                    key={day}
                    label={day.charAt(0).toUpperCase() + day.slice(1)}
                    checked={formData.daysOfWeek.includes(day)}
                    onChange={() => handleDayCheckboxChange(day)}
                  />
                ))}
              </div>
            </fieldset>
            
            <Select
              label="Repeat"
              name="repeat"
              value={formData.repeat}
              onChange={handleInputChange}
              required
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="none">No Repeat</option>
            </Select>
            
            <Input
              type="number"
              label="Priority"
              name="priority"
              min="1"
              max="10"
              value={formData.priority.toString()}
              onChange={handleInputChange}
              required
            />
            
            <div className="flex justify-end gap-2 mt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Update Schedule
              </Button>
            </div>
          </form>
        </Modal>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedSchedule && (
        <Modal
          title="Delete Schedule"
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
        >
          <div className="space-y-4">
            <p>
              Are you sure you want to delete the schedule "{selectedSchedule.name}"?
              This action cannot be undone.
            </p>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                variant="danger"
                onClick={handleConfirmDelete}
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SchedulePage; 