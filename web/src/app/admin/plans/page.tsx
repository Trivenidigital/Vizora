import { serverFetch } from '@/lib/server-api';
import AdminPlansClient from './page-client';

export default async function AdminPlansPage() {
  let initialPlans: any = null;

  try {
    initialPlans = await serverFetch('/admin/plans');
  } catch {
    // Client has fallback fetch
  }

  return <AdminPlansClient initialPlans={initialPlans} />;
}
