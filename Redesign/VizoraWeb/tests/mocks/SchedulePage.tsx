import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

// Mock schedules
const mockSchedules = [
  {
    _id: 'sched-001',
    name: 'Business Hours',
    displayId: 'disp-001',
    displayName: 'Main Lobby Display',
    contentId: 'content-001',
    contentName: 'Welcome Message',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    startTime: '09:00',
    endTime: '17:00',
    daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    repeat: 'weekly',
    priority: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'sched-002',
    name: 'Weekend Special',
    displayId: 'disp-002',
    displayName: 'Conference Room Display',
    contentId: 'content-002',
    contentName: 'Company Intro Video',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    startTime: '10:00',
    endTime: '18:00',
    daysOfWeek: ['saturday', 'sunday'],
    repeat: 'weekly',
    priority: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Mock displays for select options
const mockDisplays = [
  { id: 'disp-001', name: 'Main Lobby Display' },
  { id: 'disp-002', name: 'Conference Room Display' },
  { id: 'disp-003', name: 'Cafeteria Display' },
];

// Mock content for select options
const mockContent = [
  { id: 'content-001', name: 'Welcome Message' },
  { id: 'content-002', name: 'Company Intro Video' },
  { id: 'content-003', name: 'Cafeteria Menu' },
];

const SchedulePage: React.FC = () => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [filteredSchedules, setFilteredSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayFilter, setDisplayFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    displayId: '',
    contentId: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    daysOfWeek: [] as string[],
    repeat: 'weekly',
    priority: 1,
  });

  useEffect(() => {
    loadSchedules();
  }, []);

  useEffect(() => {
    filterSchedules();
  }, [schedules, displayFilter]);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      // Simulate API call
      setTimeout(() => {
        setSchedules(mockSchedules);
        setLoading(false);
      }, 300);
    } catch (error) {
      console.error('Error loading schedules:', error);
      toast.error('Failed to load schedules');
      setLoading(false);
    }
  };

  const filterSchedules = () => {
    let filtered = [...schedules];
    
    // Apply display filter
    if (displayFilter) {
      filtered = filtered.filter(item => item.displayId === displayFilter);
    }
    
    setFilteredSchedules(filtered);
  };

  const handleDisplayFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDisplayFilter(e.target.value);
  };

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

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Simulate API call
      const newSchedule = {
        _id: `sched-${Date.now()}`,
        ...formData,
        displayName: mockDisplays.find(d => d.id === formData.displayId)?.name || '',
        contentName: mockContent.find(c => c.id === formData.contentId)?.name || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      setSchedules([...schedules, newSchedule]);
      toast.success('Schedule created successfully');
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating schedule:', error);
      toast.error('Failed to create schedule');
    }
  };

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleEditClick = (schedule: any) => {
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

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSchedule) return;
    
    try {
      // Update the schedule
      const updatedSchedule = {
        ...selectedSchedule,
        ...formData,
        displayName: mockDisplays.find(d => d.id === formData.displayId)?.name || '',
        contentName: mockContent.find(c => c.id === formData.contentId)?.name || '',
        updatedAt: new Date().toISOString(),
      };
      
      setSchedules(schedules.map(item => 
        item._id === selectedSchedule._id ? updatedSchedule : item
      ));
      
      toast.success('Schedule updated successfully');
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast.error('Failed to update schedule');
    }
  };

  const handleDeleteClick = (schedule: any) => {
    setSelectedSchedule(schedule);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedSchedule) return;
    
    try {
      setSchedules(schedules.filter(item => item._id !== selectedSchedule._id));
      toast.success('Schedule deleted successfully');
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Failed to delete schedule');
    } finally {
      setShowDeleteModal(false);
      setSelectedSchedule(null);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="schedule-page">
      <h1>Schedule Management</h1>
      
      <div className="schedule-filters">
        <div className="filter-group">
          <label htmlFor="displayFilter">Display:</label>
          <select 
            id="displayFilter" 
            value={displayFilter} 
            onChange={handleDisplayFilterChange}
          >
            <option value="">All Displays</option>
            {mockDisplays.map(display => (
              <option key={display.id} value={display.id}>{display.name}</option>
            ))}
          </select>
        </div>
        
        <button onClick={handleAddScheduleClick}>Add Schedule</button>
      </div>
      
      <div className="schedule-list">
        {filteredSchedules.map(schedule => (
          <div key={schedule._id} className="schedule-card">
            <h3>{schedule.name}</h3>
            <p>Display: {schedule.displayName}</p>
            <p>Content: {schedule.contentName}</p>
            <p>{schedule.startTime} - {schedule.endTime}</p>
            <p>Days: {schedule.daysOfWeek.map((day: string) => day.charAt(0).toUpperCase() + day.slice(1)).join(', ')}</p>
            <p>Schedule: {schedule.startDate} to {schedule.endDate}</p>
            <div className="schedule-actions">
              <button onClick={() => handleEditClick(schedule)}>Edit</button>
              <button onClick={() => handleDeleteClick(schedule)}>Delete</button>
            </div>
          </div>
        ))}
        
        {filteredSchedules.length === 0 && (
          <div className="no-schedules">
            <p>No schedules found.</p>
          </div>
        )}
      </div>
      
      {/* Create Schedule Modal */}
      {showCreateModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Create New Schedule</h2>
            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label htmlFor="name">Name:</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="displayId">Display:</label>
                <select
                  id="displayId"
                  name="displayId"
                  value={formData.displayId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Display</option>
                  {mockDisplays.map(display => (
                    <option key={display.id} value={display.id}>{display.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="contentId">Content:</label>
                <select
                  id="contentId"
                  name="contentId"
                  value={formData.contentId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Content</option>
                  {mockContent.map(content => (
                    <option key={content.id} value={content.id}>{content.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="startDate">Start Date:</label>
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="endDate">End Date:</label>
                <input
                  id="endDate"
                  name="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="startTime">Start Time:</label>
                <input
                  id="startTime"
                  name="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="endTime">End Time:</label>
                <input
                  id="endTime"
                  name="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Days of Week:</label>
                <div className="checkbox-group">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                    <div key={day} className="checkbox-item">
                      <input
                        id={`day-${day}`}
                        type="checkbox"
                        checked={formData.daysOfWeek.includes(day)}
                        onChange={() => handleDayCheckboxChange(day)}
                      />
                      <label htmlFor={`day-${day}`}>{day.charAt(0).toUpperCase() + day.slice(1)}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="repeat">Repeat:</label>
                <select
                  id="repeat"
                  name="repeat"
                  value={formData.repeat}
                  onChange={handleInputChange}
                  required
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="submit">Create</button>
                <button type="button" onClick={() => setShowCreateModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Edit Schedule Modal */}
      {showEditModal && selectedSchedule && (
        <div className="modal">
          <div className="modal-content">
            <h2>Edit Schedule</h2>
            <form onSubmit={handleUpdateSubmit}>
              <div className="form-group">
                <label htmlFor="edit-name">Name:</label>
                <input
                  id="edit-name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-displayId">Display:</label>
                <select
                  id="edit-displayId"
                  name="displayId"
                  value={formData.displayId}
                  onChange={handleInputChange}
                  required
                >
                  {mockDisplays.map(display => (
                    <option key={display.id} value={display.id}>{display.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="edit-contentId">Content:</label>
                <select
                  id="edit-contentId"
                  name="contentId"
                  value={formData.contentId}
                  onChange={handleInputChange}
                  required
                >
                  {mockContent.map(content => (
                    <option key={content.id} value={content.id}>{content.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="edit-startTime">Start Time:</label>
                <input
                  id="edit-startTime"
                  name="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-endTime">End Time:</label>
                <input
                  id="edit-endTime"
                  name="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="submit">Update</button>
                <button type="button" onClick={() => setShowEditModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedSchedule && (
        <div className="modal">
          <div className="modal-content">
            <h2>Confirm Deletion</h2>
            <p>Are you sure you want to delete the schedule "{selectedSchedule.name}"?</p>
            <div className="modal-actions">
              <button onClick={handleConfirmDelete}>Confirm</button>
              <button onClick={() => setShowDeleteModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulePage; 