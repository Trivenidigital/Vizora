'use client';

import { useState } from 'react';
import { Icon } from '@/theme/icons';

export default function SchedulesPage() {
  const [schedules] = useState([
    {
      id: '1',
      name: 'Morning Schedule',
      playlist: 'Morning Promotions',
      devices: ['Store Front', 'Lobby Display'],
      time: '6:00 AM - 12:00 PM',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      active: true,
    },
    {
      id: '2',
      name: 'Lunch Schedule',
      playlist: 'Lunch Specials',
      devices: ['Store Front'],
      time: '11:00 AM - 2:00 PM',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      active: true,
    },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Schedules</h2>
          <p className="mt-2 text-gray-600">
            Automate content playback with schedules
          </p>
        </div>
        <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2">
          <span className="text-xl">+</span>
          <span>Create Schedule</span>
        </button>
      </div>

      <div className="space-y-4">
        {schedules.map((schedule) => (
          <div
            key={schedule.id}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <Icon name="schedules" size="2xl" className="text-gray-600" />
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {schedule.name}
                    </h3>
                    {schedule.active && (
                      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Playlist:</span> {schedule.playlist}
                    </div>
                    <div>
                      <span className="font-medium">Time:</span> {schedule.time}
                    </div>
                    <div>
                      <span className="font-medium">Devices:</span>{' '}
                      {schedule.devices.join(', ')}
                    </div>
                    <div>
                      <span className="font-medium">Days:</span>{' '}
                      {schedule.days.join(', ')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
              <button className="px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-medium">
                Edit
              </button>
              <button className="px-4 py-2 text-sm bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition font-medium">
                Duplicate
              </button>
              <button className="px-4 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2"><Icon name="info" size="md" className="text-blue-600" /> Schedule Tips</h4>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>• Schedules automatically control which playlist plays at specific times</li>
          <li>• Multiple schedules can be active on the same device</li>
          <li>• Higher priority schedules override lower priority ones</li>
          <li>• Use schedules to automate morning, lunch, and evening content</li>
        </ul>
      </div>
    </div>
  );
}
