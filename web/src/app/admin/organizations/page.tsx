import { serverFetch } from '@/lib/server-api';
import type { AdminOrganization } from '@/lib/types';
import AdminOrganizationsClient from './page-client';

export default async function AdminOrganizationsPage() {
  let organizations: AdminOrganization[] = [];
  let total = 0;

  try {
    const data = await serverFetch<{ data: AdminOrganization[]; total: number }>('/admin/organizations');
    organizations = data.data;
    total = data.total;
  } catch {
    // Client will handle empty state
  }

  return <AdminOrganizationsClient initialOrganizations={organizations} initialTotal={total} />;
}
