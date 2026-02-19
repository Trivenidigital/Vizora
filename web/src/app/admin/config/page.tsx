import { serverFetch } from '@/lib/server-api';
import AdminConfigClient from './page-client';

export default async function AdminConfigPage() {
  let initialConfigs: any = null;

  try {
    initialConfigs = await serverFetch('/admin/config');
  } catch {
    // Client has fallback fetch
  }

  return <AdminConfigClient initialConfigs={initialConfigs} />;
}
