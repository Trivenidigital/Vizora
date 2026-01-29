import Link from 'next/link';

export default function Index() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="text-center text-white space-y-8 p-8">
        <h1 className="text-6xl font-bold">Vizora</h1>
        <p className="text-2xl">Cloud-Based Digital Signage Platform</p>
        <div className="space-x-4">
          <Link
            href="/login"
            className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="inline-block bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition"
          >
            Get Started
          </Link>
        </div>
        <div className="mt-12 space-y-4">
          <p className="text-lg">Quick Links:</p>
          <div className="flex justify-center space-x-4">
            <Link href="/dashboard" className="hover:underline">
              Dashboard
            </Link>
            <Link href="/dashboard/devices" className="hover:underline">
              Devices
            </Link>
            <Link href="/dashboard/content" className="hover:underline">
              Content
            </Link>
            <Link href="/dashboard/playlists" className="hover:underline">
              Playlists
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
