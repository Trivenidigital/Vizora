import { serverFetch } from '@/lib/server-api';
import type { AdminUser } from '@/lib/types';
import AdminUsersClient from './page-client';

export default async function AdminUsersPage() {
  let users: AdminUser[] = [];
  let total = 0;

  try {
    const data = await serverFetch<{ data: AdminUser[]; total: number }>('/admin/users');
    users = data.data;
    total = data.total;
  } catch {
    // Client will handle empty state
  }

  return <AdminUsersClient initialUsers={users} initialTotal={total} />;
}
