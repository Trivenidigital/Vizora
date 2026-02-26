export interface PlaylistContentItem {
  id: string;
  contentId: string;
  content: {
    id: string;
    name: string;
    type: string;
    url: string;
    thumbnail?: string;
  };
}

export interface PlaylistResponse {
  id: string;
  name: string;
  items: PlaylistContentItem[];
}
