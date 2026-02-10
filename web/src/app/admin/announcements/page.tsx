import { serverFetch } from '@/lib/server-api';
import AdminAnnouncementsClient from './page-client';

export default async function AdminAnnouncementsPage() {
  let initialAnnouncements: any = null;

  try {
    initialAnnouncements = await serverFetch('/admin/announcements');
  } catch {
    // Client has fallback fetch
  }

  return <AdminAnnouncementsClient initialAnnouncements={initialAnnouncements} />;
}
