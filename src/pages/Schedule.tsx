import { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  MoreVertical,
  Monitor,
  PlaySquare,
  Eye,
  Edit,
  Trash2,
  Copy
} from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';

// Mock data
const scheduleEvents = [
  {
    id: 1,
    title: 'Welcome Sequence',
    display: 'Lobby Display',
    start: '08:00',
    end: '20:00',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    playlist: 'Welcome Sequence',
    type: 'playlist'
  },
  {
    id: 2,
    title: 'Product Showcase',
    display: 'Showroom Display',
    start: '09:00',
    end: '18:00',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    playlist: 'Product Showcase',
    type: 'playlist'
  },
  {
    id: 3,
    title: 'Cafeteria Menu',
    display: 'Cafeteria Display',
    start: '07:00',
    end: '15:00',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    color: 'bg-green-100 text-green-800 border-green-200',
    playlist: 'Cafeteria Menu',
    type: 'playlist'
  },
  {
    id: 4,
    title: 'Holiday Special',
    display: 'All Displays',
    start: '00:00',
    end: '23:59',
    days: ['Saturday', 'Sunday'],
    color: 'bg-red-100 text-red-800 border-red-200',
    playlist: 'Holiday Special',
    type: 'playlist'
  },
  {
    id: 5,
    title: 'Company News',
    display: 'Reception Display',
    start: '09:00',
    end: '17:00',
    days: ['Monday', 'Wednesday', 'Friday'],
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    playlist: 'Company News',
    type: 'playlist'
  },
  {
    id: 6,
    title: 'System Maintenance',
    display: 'All Displays',
    start: '02:00',
    end: '04:00',
    days: ['Tuesday'],
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    type: 'maintenance'
  }
];

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const timeSlots = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

const Schedule = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week');
  
  const formatMonth = (date: Date) => {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };
  
  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };
  
  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };
  
  const handleToday = () => {
    setCurrentDate(new Date());
  };
  
  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Schedule</h1>
          <p className="text-secondary-500">Plan and manage your content scheduling</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button className="btn btn-primary flex items-center">
            <Plus className="h-4 w-4 mr-2" />
            Add Schedule
          </button>
        </div>
      </div>
      
      {/* Calendar header */}
      <div className="bg-white rounded-t-lg border border-secondary-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevious}
              className="p-1.5 rounded-full hover:bg-secondary-100 text-secondary-600"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 rounded-full hover:bg-secondary-100 text-secondary-600"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-secondary-900">
              {formatMonth(currentDate)}
            </h2>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-sm font-medium text-secondary-700 hover:bg-secondary-100 rounded-md"
            >
              Today
            </button>
            <div className="border border-secondary-300 rounded-md overflow-hidden">
              <button
                className={`px-3 py-1.5 text-sm font-medium ${
                  viewMode === 'week' 
                    ? 'bg-primary-50 text-primary-700' 
                    : 'text-secondary-700 hover:bg-secondary-50'
                }`}
                onClick={() => setViewMode('week')}
              >
                Week
              </button>
              <button
                className={`px-3 py-1.5 text-sm font-medium ${
                  viewMode === 'month' 
                    ? 'bg-primary-50 text-primary-700' 
                    : 'text-secondary-700 hover:bg-secondary-50'
                }`}
                onClick={() => setViewMode('month')}
              >
                Month
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Week view */}
      {viewMode === 'week' && (
        <div className="bg-white rounded-b-lg border-l border-r border-b border-secondary-200 overflow-auto">
          <div className="min-w-full divide-y divide-secondary-200">
            {/* Day headers */}
            <div className="grid grid-cols-8 divide-x divide-secondary-200">
              <div className="py-2 px-4 text-center text-xs font-medium text-secondary-500 uppercase tracking-wider bg-secondary-50">
                Time
              </div>
              {daysOfWeek.map((day) => (
                <div 
                  key={day} 
                  className="py-2 px-4 text-center text-xs font-medium text-secondary-500 uppercase tracking-wider bg-secondary-50"
                >
                  {day}
                </div>
              ))}
            </div>
            
            {/* Time slots */}
            <div>
              {timeSlots.map((time, index) => (
                <div key={time} className="grid grid-cols-8 divide-x divide-secondary-200">
                  <div className="py-3 px-4 text-right text-xs text-secondary-500 bg-secondary-50">
                    {time}
                  </div>
                  {daysOfWeek.map((day) => {
                    const eventsForTimeSlot = scheduleEvents.filter(event => {
                      const eventStartHour = parseInt(event.start.split(':')[0]);
                      const eventEndHour = parseInt(event.end.split(':')[0]);
                      const currentHour = parseInt(time.split(':')[0]);
                      
                      return (
                        event.days.includes(day) &&
                        eventStartHour <= currentHour &&
                        eventEndHour > currentHour
                      );
                    });
                    
                    return (
                      <div 
                        key={day} 
                        className={`py-3 px-2 min-h-[60px] ${
                          index % 2 === 0 ? 'bg-white' : 'bg-secondary-50/30'
                        }`}
                      >
                        {eventsForTimeSlot.map(event => (
                          <div 
                            key={`${event.id}-${day}-${time}`}
                            className={`mb-1 px-2 py-1 rounded-md border ${event.color} text-xs relative group`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{event.title}</span>
                              <Menu as="div" className="relative inline-block text-left">
                                <div>
                                  <Menu.Button className="invisible group-hover:visible p-1 rounded-full hover:bg-white/50 text-secondary-600">
                                    <MoreVertical className="h-3 w-3" />
                                  </Menu.Button>
                                </div>
                                <Transition
                                  as={Fragment}
                                  enter="transition ease-out duration-100"
                                  enterFrom="transform opacity-0 scale-95"
                                  enterTo="transform opacity-100 scale-100"
                                  leave="transition ease-in duration-75"
                                  leaveFrom="transform opacity-100 scale-100"
                                  leaveTo="transform opacity-0 scale-95"
                                >
                                  <Menu.Items className="absolute right-0 z-10 mt-1 w-40 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                    <div className="py-1">
                                      <Menu.Item>
                                        {({ active }) => (
                                          <a
                                            href="#"
                                            className={`${
                                              active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                            } flex items-center px-4 py-2 text-xs`}
                                          >
                                            <Eye className="mr-3 h-4 w-4 text-secondary-400" />
                                            View Details
                                          </a>
                                        )}
                                      </Menu.Item>
                                      <Menu.Item>
                                        {({ active }) => (
                                          <a
                                            href="#"
                                            className={`${
                                              active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                            } flex items-center px-4 py-2 text-xs`}
                                          >
                                            <Edit className="mr-3 h-4 w-4 text-secondary-400" />
                                            Edit
                                          </a>
                                        )}
                                      </Menu.Item>
                                      <Menu.Item>
                                        {({ active }) => (
                                          <a
                                            href="#"
                                            className={`${
                                              active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                                            } flex items-center px-4 py-2 text-xs`}
                                          >
                                            <Copy className="mr-3 h-4 w-4 text-secondary-400" />
                                            Duplicate
                                          </a>
                                        )}
                                      </Menu.Item>
                                      <Menu.Item>
                                        {({ active }) => (
                                          <a
                                            href="#"
                                            className={`${
                                              active ? 'bg-red-50 text-red-700' : 'text-red-600'
                                            } flex items-center px-4 py-2 text-xs`}
                                          >
                                            <Trash2 className="mr-3 h-4 w-4 text-red-400" />
                                            Delete
                                          </a>
                                        )}
                                      </Menu.Item>
                                    </div>
                                  </Menu.Items>
                                </Transition>
                              </Menu>
                            </div>
                            <div className="flex items-center mt-1 text-xs opacity-80">
                              {event.type === 'playlist' ? (
                                <>
                                  <PlaySquare className="h-3 w-3 mr-1" />
                                  <span>{event.playlist}</span>
                                </>
                              ) : (
                                <span>Maintenance</span>
                              )}
                            </div>
                            <div className="flex items-center mt-1 text-xs opacity-80">
                              <Monitor className="h-3 w-3 mr-1" />
                              <span>{event.display}</span>
                            </div>
                            <div className="flex items-center mt-1 text-xs opacity-80">
                              <Clock className="h-3 w-3 mr-1" />
                              <span>{event.start} - {event.end}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Month view */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-b-lg border-l border-r border-b border-secondary-200">
          <div className="grid grid-cols-7 gap-px bg-secondary-200">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div 
                key={day} 
                className="py-2 text-center text-xs font-medium text-secondary-500 uppercase tracking-wider bg-secondary-50"
              >
                {day}
              </div>
            ))}
            
            {/* Generate a 5-week calendar grid */}
            {Array.from({ length: 35 }, (_, i) => (
              <div 
                key={i} 
                className="min-h-[120px] bg-white p-2 border-t border-secondary-200"
              >
                <div className="text-sm font-medium text-secondary-900 mb-1">
                  {((i % 7) + 1)}
                </div>
                <div className="space-y-1">
                  {i < 15 && (
                    <div className="px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs truncate">
                      Welcome Sequence
                    </div>
                  )}
                  {i >= 7 && i < 20 && (
                    <div className="px-2 py-1 rounded-md bg-green-100 text-green-800 text-xs truncate">
                      Cafeteria Menu
                    </div>
                  )}
                  {i % 7 >= 5 && (
                    <div className="px-2 py-1 rounded-md bg-red-100 text-red-800 text-xs truncate">
                      Holiday Special
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Schedule legend */}
      <div className="mt-6 bg-white rounded-lg border border-secondary-200 p-4">
        <h3 className="text-sm font-medium text-secondary-900 mb-3">Schedule Legend</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {scheduleEvents.map(event => (
            <div 
              key={event.id}
              className={`px-3 py-2 rounded-md border ${event.color} text-sm`}
            >
              <div className="font-medium">{event.title}</div>
              <div className="flex items-center mt-1 text-xs">
                <Monitor className="h-3 w-3 mr-1" />
                <span>{event.display}</span>
              </div>
              <div className="flex items-center mt-1 text-xs">
                <Clock className="h-3 w-3 mr-1" />
                <span>{event.start} - {event.end}</span>
              </div>
              <div className="flex items-center mt-1 text-xs">
                <CalendarIcon className="h-3 w-3 mr-1" />
                <span>{event.days.join(', ')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Schedule;
