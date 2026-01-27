export default function SchedulesPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Schedules</h2>
          <p className="mt-2 text-gray-600">
            Create automated content schedules
          </p>
        </div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition font-semibold">
          + Create Schedule
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-8 text-center">
        <span className="text-6xl">📅</span>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">
          Schedule Your Content
        </h3>
        <p className="mt-2 text-gray-600">
          Create time-based rules to automatically display playlists on your devices
        </p>
        <button className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition font-semibold">
          Get Started
        </button>
      </div>
    </div>
  );
}
