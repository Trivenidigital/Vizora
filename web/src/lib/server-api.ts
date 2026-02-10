import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export async function serverFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    cache: options?.cache || 'no-store',
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
