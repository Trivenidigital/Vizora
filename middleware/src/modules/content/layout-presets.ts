export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  layoutType: string;
  gridTemplate: { columns: string; rows: string };
  zones: Array<{ id: string; name: string; gridArea: string }>;
  previewAspectRatio: string;
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'split-horizontal',
    name: 'Split Horizontal',
    description: 'Two equal zones stacked horizontally',
    layoutType: 'split-horizontal',
    gridTemplate: { columns: '1fr 1fr', rows: '1fr' },
    zones: [
      { id: 'left', name: 'Left', gridArea: '1 / 1 / 2 / 2' },
      { id: 'right', name: 'Right', gridArea: '1 / 2 / 2 / 3' },
    ],
    previewAspectRatio: '16/9',
  },
  {
    id: 'split-vertical',
    name: 'Split Vertical',
    description: 'Two equal zones stacked vertically',
    layoutType: 'split-vertical',
    gridTemplate: { columns: '1fr', rows: '1fr 1fr' },
    zones: [
      { id: 'top', name: 'Top', gridArea: '1 / 1 / 2 / 2' },
      { id: 'bottom', name: 'Bottom', gridArea: '2 / 1 / 3 / 2' },
    ],
    previewAspectRatio: '16/9',
  },
  {
    id: 'grid-2x2',
    name: '2x2 Grid',
    description: 'Four equal zones in a grid',
    layoutType: 'grid-2x2',
    gridTemplate: { columns: '1fr 1fr', rows: '1fr 1fr' },
    zones: [
      { id: 'top-left', name: 'Top Left', gridArea: '1 / 1 / 2 / 2' },
      { id: 'top-right', name: 'Top Right', gridArea: '1 / 2 / 2 / 3' },
      { id: 'bottom-left', name: 'Bottom Left', gridArea: '2 / 1 / 3 / 2' },
      { id: 'bottom-right', name: 'Bottom Right', gridArea: '2 / 2 / 3 / 3' },
    ],
    previewAspectRatio: '16/9',
  },
  {
    id: 'main-sidebar',
    name: 'Main + Sidebar',
    description: 'Large main area with sidebar (70/30 split)',
    layoutType: 'main-sidebar',
    gridTemplate: { columns: '7fr 3fr', rows: '1fr' },
    zones: [
      { id: 'main', name: 'Main', gridArea: '1 / 1 / 2 / 2' },
      { id: 'sidebar', name: 'Sidebar', gridArea: '1 / 2 / 2 / 3' },
    ],
    previewAspectRatio: '16/9',
  },
  {
    id: 'l-shape',
    name: 'L-Shape',
    description: 'Main area with ticker and sidebar',
    layoutType: 'l-shape',
    gridTemplate: { columns: '7fr 3fr', rows: '4fr 1fr' },
    zones: [
      { id: 'main', name: 'Main', gridArea: '1 / 1 / 2 / 2' },
      { id: 'sidebar', name: 'Sidebar', gridArea: '1 / 2 / 3 / 3' },
      { id: 'ticker', name: 'Ticker', gridArea: '2 / 1 / 3 / 2' },
    ],
    previewAspectRatio: '16/9',
  },
];
