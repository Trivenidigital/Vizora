'use client';

const mockContent = [
  { id: '1', title: 'Summer Sale Banner', type: 'image', status: 'ready' },
  { id: '2', title: 'Product Video', type: 'video', status: 'ready' },
  { id: '3', title: 'Weekly Menu', type: 'pdf', status: 'processing' },
];

export default function ContentPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Content</h2>
          <p className="mt-2 text-gray-600">
            Manage your media assets and content
          </p>
        </div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition font-semibold">
          + Upload Content
        </button>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {mockContent.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition"
          >
            <div className="h-48 bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
              <span className="text-6xl">
                {item.type === 'image' && '🖼️'}
                {item.type === 'video' && '🎥'}
                {item.type === 'pdf' && '📄'}
              </span>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900">{item.title}</h3>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-gray-500 uppercase">{item.type}</span>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    item.status === 'ready'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {item.status}
                </span>
              </div>
              <div className="mt-4 flex space-x-2">
                <button className="flex-1 text-sm bg-blue-50 text-blue-600 py-2 rounded hover:bg-blue-100 transition">
                  Edit
                </button>
                <button className="flex-1 text-sm bg-red-50 text-red-600 py-2 rounded hover:bg-red-100 transition">
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
