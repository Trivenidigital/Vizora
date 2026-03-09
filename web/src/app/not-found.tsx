import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="text-center px-6 max-w-md animate-[fadeIn_0.3s_ease-out]">
        <h1 className="text-8xl font-bold eh-gradient mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-4">
          Page Not Found
        </h2>
        <p className="text-[var(--foreground-secondary)] mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 eh-btn-neon rounded-lg"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 border border-[var(--border)] text-[var(--foreground)] font-semibold rounded-lg hover:bg-[var(--surface-hover)] transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
