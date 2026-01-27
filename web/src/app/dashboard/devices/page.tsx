'use client';

import { useState } from 'react';

const mockDevices = [
  { id: '1', nickname: 'Store Front', status: 'online', lastSeen: '2 min ago' },
  { id: '2', nickname: 'Break Room', status: 'online', lastSeen: '5 min ago' },
  { id: '3', nickname: 'Lobby Display', status: 'offline', lastSeen: '2 hours ago' },
];

export default function DevicesPage() {
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [pairingCode] = useState('A1B2C3');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Devices</h2>
          <p className="mt-2 text-gray-600">
            Manage your paired display devices
          </p>
        </div>
        <button
          onClick={() => setShowPairingModal(true)}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition font-semibold"
        >
          + Pair Device
        </button>
      </div>

      {/* Device List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Device
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Seen
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {mockDevices.map((device) => (
              <tr key={device.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">📺</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {device.nickname}
                      </div>
                      <div className="text-sm text-gray-500">ID: {device.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      device.status === 'online'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {device.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {device.lastSeen}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button className="text-blue-600 hover:text-blue-900 mr-4">
                    Edit
                  </button>
                  <button className="text-red-600 hover:text-red-900">
                    Unpair
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pairing Modal */}
      {showPairingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold mb-4">Pair New Device</h3>
            <p className="text-gray-600 mb-6">
              Enter this code on your display device:
            </p>
            <div className="bg-gray-100 p-6 rounded-lg text-center mb-6">
              <p className="text-5xl font-mono font-bold tracking-widest">
                {pairingCode}
              </p>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Code expires in 5 minutes
            </p>
            <button
              onClick={() => setShowPairingModal(false)}
              className="w-full bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
