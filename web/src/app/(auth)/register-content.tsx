'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

export default function RegisterContent() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    organizationName: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Register with all required fields
      await apiClient.register(
        formData.email,
        formData.password,
        formData.organizationName,
        formData.firstName,
        formData.lastName
      );
      // After registration, login to get token
      await apiClient.login(formData.email, formData.password);
      // Use window.location for a full page navigation to ensure the
      // httpOnly auth cookie is available when Next.js middleware checks it.
      // router.push() causes a race condition where middleware runs before
      // the browser has processed the Set-Cookie header.
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] py-12">
      <div className="bg-[var(--surface)] p-8 rounded-xl shadow-lg border border-[var(--border)] w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 eh-gradient">Create Account</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                First Name
              </label>
              <input
                id="firstName"
                type="text"
                required
                minLength={2}
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#00E5A0] bg-[var(--background)] text-[var(--foreground)]"
                placeholder="John"
                aria-label="First Name"
              />
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Last Name
              </label>
              <input
                id="lastName"
                type="text"
                required
                minLength={2}
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#00E5A0] bg-[var(--background)] text-[var(--foreground)]"
                placeholder="Doe"
                aria-label="Last Name"
              />
            </div>
          </div>

          <div>
            <label htmlFor="organization" className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
              Organization Name
            </label>
            <input
              id="organization"
              type="text"
              required
              minLength={2}
              value={formData.organizationName}
              onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#00E5A0] bg-[var(--background)] text-[var(--foreground)]"
              placeholder="Acme Corp"
              aria-label="Organization Name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#00E5A0] bg-[var(--background)] text-[var(--foreground)]"
              placeholder="john@acmecorp.com"
              aria-label="Email address"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#00E5A0] bg-[var(--background)] text-[var(--foreground)]"
              placeholder="••••••••"
              aria-label="Password"
              aria-describedby="password-requirements"
            />
            <p id="password-requirements" className="mt-1 text-xs text-[var(--foreground-tertiary)]" role="note">
              Must be 8+ characters with uppercase, lowercase, and number/special char
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00E5A0] text-[#061A21] py-2 rounded-md hover:bg-[#00CC8E] disabled:opacity-50 transition font-semibold"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center mt-6 text-[var(--foreground-secondary)]">
          Already have an account?{' '}
          <Link href="/login" className="text-[#00E5A0] hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
