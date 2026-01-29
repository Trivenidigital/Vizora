import {
  BarChart3,
  Monitor,
  Image,
  List,
  Calendar,
  TrendingUp,
  Settings,
  Plus,
  Trash2,
  Edit,
  Eye,
  Download,
  Search,
  Video,
  FileText,
  Link as LinkIcon,
  LogOut,
  Zap,
  AlertCircle,
  AlertTriangle,
  Info,
  Upload,
  Grid,
  Menu,
  Folder,
  CheckCircle2,
} from 'lucide-react';

export const ICON_SIZES = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
  '4xl': 56,
  '6xl': 96,
} as const;

export type IconSize = keyof typeof ICON_SIZES;

export const iconMap = {
  // Dashboard & Navigation
  overview: BarChart3,
  devices: Monitor,
  content: Image,
  playlists: List,
  schedules: Calendar,
  analytics: TrendingUp,
  settings: Settings,

  // Actions
  add: Plus,
  create: Plus,
  delete: Trash2,
  remove: Trash2,
  edit: Edit,
  view: Eye,
  preview: Eye,
  download: Download,
  search: Search,
  upload: Upload,
  push: Upload,

  // Content Types
  image: Image,
  video: Video,
  pdf: FileText,
  document: FileText,
  link: LinkIcon,
  folder: Folder,

  // Status & Alerts
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,

  // UI Elements
  logout: LogOut,
  power: Zap,
  grid: Grid,
  list: Menu,
  storage: Folder,
} as const;

export type IconName = keyof typeof iconMap;

/**
 * Get icon component by name
 */
export function getIcon(name: IconName) {
  return iconMap[name];
}

/**
 * React component for rendering an icon
 */
export function Icon({
  name,
  size = 'md',
  className = '',
  ...props
}: {
  name: IconName;
  size?: IconSize;
  className?: string;
  [key: string]: any;
}) {
  const Component = iconMap[name];
  const sizePixels = ICON_SIZES[size];

  return (
    <Component
      width={sizePixels}
      height={sizePixels}
      className={className}
      {...props}
    />
  );
}

/**
 * Get size in pixels
 */
export function getIconSize(size: IconSize): number {
  return ICON_SIZES[size];
}
