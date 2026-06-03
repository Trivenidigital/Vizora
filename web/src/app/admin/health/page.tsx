import { serverFetch } from '@/lib/server-api';
import AdminHealthClient from './page-client';

export default async function AdminHealthPage() {
  let initialHealth: any = null;

  try {
    initialHealth = await serverFetch('/admin/health');
  } catch {
    // Client renders a conservative unavailable state.
  }

  return <AdminHealthClient initialHealth={initialHealth} />;
}
