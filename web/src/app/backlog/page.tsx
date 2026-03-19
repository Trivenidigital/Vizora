import BacklogClient from '../admin/backlog/page-client';

export const metadata = {
  title: 'Project Backlog | Vizora',
  description: 'Vizora product backlog and roadmap',
};

export default function PublicBacklogPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BacklogClient />
      </div>
    </div>
  );
}
