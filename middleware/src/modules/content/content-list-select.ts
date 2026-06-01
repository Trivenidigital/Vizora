import { Prisma } from '@vizora/database';

export const CONTENT_LIST_SELECT = {
  id: true,
  organizationId: true,
  name: true,
  type: true,
  thumbnail: true,
  duration: true,
  fileSize: true,
  status: true,
  folderId: true,
  createdAt: true,
  updatedAt: true,
  tags: {
    select: {
      id: true,
      contentId: true,
      tagId: true,
      createdAt: true,
      tag: {
        select: {
          id: true,
          name: true,
          color: true,
          organizationId: true,
          createdAt: true,
        },
      },
    },
  },
} satisfies Prisma.ContentSelect;

export type ContentListRecord = Prisma.ContentGetPayload<{
  select: typeof CONTENT_LIST_SELECT;
}>;

export function mapContentListResponse(content: ContentListRecord) {
  return {
    ...content,
    title: content.name,
    thumbnailUrl: content.thumbnail,
  };
}
