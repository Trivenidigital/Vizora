import EditPageClient from './page-client';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditTemplatePage({ params }: Props) {
  const { id } = await params;
  return <EditPageClient templateId={id} />;
}
