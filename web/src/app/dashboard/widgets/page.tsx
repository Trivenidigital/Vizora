'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import Modal from '@/components/Modal';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/lib/hooks/useToast';
import { Icon } from '@/theme/icons';
import type { IconName } from '@/theme/icons';
import WeatherWidget from '@/components/widgets/WeatherWidget';
import SheetsWidget from '@/components/widgets/SheetsWidget';
import SocialFeedWidget, { parsePostUrls } from '@/components/widgets/SocialFeedWidget';
import ClockWidget from '@/components/widgets/ClockWidget';
import RssWidget from '@/components/widgets/RssWidget';

// Default widget type definitions used as fallback when API is unavailable
const DEFAULT_WIDGET_TYPES = [
  {
    type: 'weather',
    name: 'Weather',
    description: 'Display current weather conditions and forecasts for any location.',
    icon: 'sun',
    configSchema: {
      location: { type: 'string', label: 'Location', placeholder: 'e.g., New York, NY', required: true },
      units: { type: 'select', label: 'Units', options: ['imperial', 'metric'], default: 'imperial' },
      refreshInterval: { type: 'select', label: 'Refresh Interval', options: ['15', '30', '60', '120'], default: '30' },
      theme: { type: 'select', label: 'Theme', options: ['dark', 'light', 'auto'], default: 'dark' },
      showForecast: { type: 'boolean', label: 'Show Forecast', default: true },
    },
  },
  {
    type: 'rss',
    name: 'News & RSS Feed',
    description: 'Display headlines from any RSS or Atom feed source.',
    icon: 'list',
    configSchema: {
      feedUrl: { type: 'string', label: 'Feed URL', placeholder: 'https://example.com/rss', required: true },
      maxItems: { type: 'number', label: 'Max Items', default: 10, min: 1, max: 50 },
      showImages: { type: 'boolean', label: 'Show Images', default: true },
      showSummary: { type: 'boolean', label: 'Show Summary', default: true },
      scrollSpeed: { type: 'select', label: 'Auto-Scroll', options: ['none', 'slow', 'medium', 'fast'], default: 'slow' },
      refreshInterval: { type: 'select', label: 'Refresh (min)', options: ['5', '15', '30', '60'], default: '15' },
      theme: { type: 'select', label: 'Theme', options: ['dark', 'light', 'auto'], default: 'dark' },
    },
  },
  {
    type: 'social-feed',
    name: 'Social Media Feed',
    description: 'Display curated social media posts from Instagram, Twitter/X, TikTok, and LinkedIn.',
    icon: 'link',
    configSchema: {
      postUrls: { type: 'textarea', label: 'Post URLs (one per line)', placeholder: 'https://instagram.com/p/...\nhttps://twitter.com/...', default: '' },
      rotateInterval: { type: 'select', label: 'Rotate Every (seconds)', options: ['5', '10', '15', '30'], default: '10' },
      showPlatformIcon: { type: 'boolean', label: 'Show Platform Icon', default: true },
      theme: { type: 'select', label: 'Theme', options: ['dark', 'light', 'auto'], default: 'dark' },
    },
  },
  {
    type: 'clock',
    name: 'Clock & Countdown',
    description: 'Display current time or countdown to an event with customizable themes.',
    icon: 'clock',
    configSchema: {
      mode: { type: 'select', label: 'Mode', options: ['clock', 'countdown'], default: 'clock' },
      format: { type: 'select', label: 'Time Format', options: ['12h', '24h'], default: '12h' },
      showDate: { type: 'boolean', label: 'Show Date', default: true },
      showSeconds: { type: 'boolean', label: 'Show Seconds', default: true },
      timezone: { type: 'string', label: 'Timezone', placeholder: 'e.g. America/New_York or "local"', default: 'local' },
      targetDate: { type: 'string', label: 'Countdown Target', placeholder: 'YYYY-MM-DD HH:MM (for countdown mode)' },
      eventName: { type: 'string', label: 'Event Name', placeholder: 'e.g. Grand Opening' },
      theme: { type: 'select', label: 'Theme', options: ['dark', 'light', 'auto'], default: 'dark' },
    },
  },
  {
    type: 'sheets',
    name: 'Google Sheets',
    description: 'Display live data from Google Sheets — menus, price lists, schedules, leaderboards.',
    icon: 'content',
    configSchema: {
      sheetUrl: { type: 'string', label: 'Sheet URL', placeholder: 'https://docs.google.com/spreadsheets/d/...', required: true },
      sheetName: { type: 'string', label: 'Sheet Name', placeholder: 'Sheet1', default: 'Sheet1' },
      title: { type: 'string', label: 'Display Title', placeholder: "e.g. Today's Menu" },
      showHeader: { type: 'boolean', label: 'Show Header Row', default: true },
      stripedRows: { type: 'boolean', label: 'Striped Rows', default: true },
      fontSize: { type: 'select', label: 'Font Size', options: ['small', 'medium', 'large'], default: 'medium' },
      refreshInterval: { type: 'select', label: 'Refresh (min)', options: ['1', '5', '15', '30'], default: '5' },
      theme: { type: 'select', label: 'Theme', options: ['dark', 'light', 'auto'], default: 'dark' },
    },
  },
];

interface WidgetType {
  type: string;
  name: string;
  description: string;
  icon?: string;
  configSchema: Record<string, any>;
  available?: boolean;
  unavailableReason?: string;
}

interface Widget {
  id: string;
  name: string;
  widgetType: string;
  widgetConfig: Record<string, any>;
  description?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

const WIDGET_TYPES_UNAVAILABLE_MESSAGE = 'Widget types could not be loaded. Try again before creating widgets.';

/*
 * WIDGET TYPE TILES — one map for the hue, the glyph ink and the icon.
 *
 * These were TWO maps, `getColorForType` and `getIconForType`, keyed on the same
 * strings — and they fell through for the same four types, so the Widget Gallery
 * rendered six cards of which four shared one colour AND one icon and were
 * indistinguishable. Fusing them is the point: a type can no longer have a hue
 * but no icon, and a fall-through cannot happen to one map and not the other.
 *
 * THE KEYS ARE THE REGISTRY'S SPELLINGS, NOT THE GALLERY'S LABELS. The six types
 * the middleware actually serves are the `readonly type` values of the six
 * providers registered in `ContentModule`, returned by
 * `ContentService.getWidgetTypes()` and fetched here by `apiClient.getWidgetTypes()`:
 *
 *   weather · rss · social_instagram · social_twitter · social_facebook · generic-api
 *
 * The social ones carry UNDERSCORES. `type.replace(/_/g, ' ')` in the merge step
 * below turns `social_instagram` into the label "Social Instagram", so the visible
 * name is not the key — a grep for `social-instagram` finds nothing and proves
 * nothing. `clock` and `countdown` are `CreateWidgetDto` enum members, so a SAVED
 * widget can carry them and the My Widgets list keys on `widget.widgetType`;
 * `social-feed` and `sheets` reach this map only through `DEFAULT_WIDGET_TYPES`,
 * i.e. only when the types request throws. All ten are therefore reachable.
 *
 * The hue is IDENTITY, not status — non-ordinal, so `--cat-*` and never the status
 * tokens, which would assert a condition the type does not have.
 *
 * Each tile is a FLAT hue, not a gradient. The gradients ran from the hue's `-bg`
 * tint to the hue, and a white glyph on that measured 1.33-1.37:1 at the tint end
 * and 2.63-3.14:1 across the midpoint — the gallery's `white/80` was 2.23-2.59:1.
 * Every hue failed the 3:1 floor for a graphical object. On the flat hue the worst
 * of the ten is `--cat-pink` at 6.12:1, so the glyph is legible wherever it lands.
 */
type WidgetTypeTile = { tile: string; ink: string; icon: IconName };

const WIDGET_TYPE_TILES: Record<string, WidgetTypeTile> = {
  weather: { tile: 'bg-[var(--cat-blue)]', ink: 'text-white', icon: 'sun' },
  rss: { tile: 'bg-[var(--cat-orange)]', ink: 'text-white', icon: 'list' },
  social_instagram: { tile: 'bg-[var(--cat-pink)]', ink: 'text-white', icon: 'grid' },
  social_twitter: { tile: 'bg-[var(--cat-teal)]', ink: 'text-white', icon: 'bell' },
  social_facebook: { tile: 'bg-[var(--cat-indigo)]', ink: 'text-white', icon: 'document' },
  'generic-api': { tile: 'bg-[var(--cat-yellow)]', ink: 'text-white', icon: 'power' },
  'social-feed': { tile: 'bg-[var(--cat-rose)]', ink: 'text-white', icon: 'link' },
  clock: { tile: 'bg-[var(--cat-purple)]', ink: 'text-white', icon: 'clock' },
  countdown: { tile: 'bg-[var(--cat-red)]', ink: 'text-white', icon: 'clock' },
  sheets: { tile: 'bg-[var(--cat-green)]', ink: 'text-white', icon: 'content' },
};

/*
 * UNKNOWN TYPE — neutral, on purpose.
 *
 * The fallback used to be the brand gradient and the `content` icon, which made an
 * unrecognised type read as a first-class category rather than as an absence. A
 * quiet `--background-tertiary` band says "no identity assigned" instead. The ink
 * has to come from the map for the same reason: the hue tiles are dark and take
 * white, this one is light and takes `--foreground-tertiary` (4.73:1).
 *
 * `help` rather than `content`, because `content` and `image` are the same glyph
 * and `sheets` already uses it — a fallback that looks like a real type is the bug
 * this map exists to prevent.
 */
const WIDGET_TYPE_TILE_FALLBACK: WidgetTypeTile = {
  tile: 'bg-[var(--background-tertiary)]',
  ink: 'text-[var(--foreground-tertiary)]',
  icon: 'help',
};

const humanizeFieldName = (key: string) =>
  key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeConfigSchema = (schema: Record<string, any> = {}) => {
  const requiredFields = Array.isArray(schema.required) ? schema.required : [];
  const properties =
    schema.type === 'object' && schema.properties && typeof schema.properties === 'object'
      ? schema.properties
      : schema;

  return Object.entries(properties).reduce<Record<string, any>>((acc, [key, rawField]) => {
    if (!rawField || typeof rawField !== 'object') {
      acc[key] = { type: 'string', label: humanizeFieldName(key) };
      return acc;
    }

    const field = rawField as Record<string, any>;
    const fieldType = field.options || field.enum ? 'select' : field.type || 'string';
    acc[key] = {
      ...field,
      type: fieldType === 'integer' ? 'number' : fieldType,
      label: field.label || humanizeFieldName(key),
      placeholder: field.placeholder || field.description || '',
      required: field.required ?? requiredFields.includes(key),
      options: field.options || field.enum,
      min: field.min ?? field.minimum,
      max: field.max ?? field.maximum,
    };
    return acc;
  }, {});
};

const normalizeWidget = (widget: any): Widget => {
  const metadata = widget?.metadata || {};
  return {
    ...widget,
    name: widget?.name || widget?.title || 'Untitled Widget',
    widgetType: widget?.widgetType || metadata.widgetType || widget?.type || 'unknown',
    widgetConfig: widget?.widgetConfig || metadata.widgetConfig || widget?.config || {},
    metadata,
  };
};

const normalizeWidgetTypes = (types: WidgetType[]) =>
  types.map((type) => ({ ...type, configSchema: normalizeConfigSchema(type.configSchema) }));

const getAvailableWidgetTypes = (types: WidgetType[]) => types.filter((type) => type.available !== false);

const getMissingRequiredFields = (schema: Record<string, any> = {}, config: Record<string, any> = {}) =>
  Object.entries(schema)
    .filter(([, field]) => (field as any)?.required)
    .map(([key, field]) => {
      const value = config[key];
      const isMissing =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0);
      return isMissing ? ((field as any).label || humanizeFieldName(key)) : null;
    })
    .filter((label): label is string => Boolean(label));

const unavailableFallbackWidgetTypes = () =>
  normalizeWidgetTypes(DEFAULT_WIDGET_TYPES as WidgetType[]).map((type) => ({
    ...type,
    available: false,
    unavailableReason: WIDGET_TYPES_UNAVAILABLE_MESSAGE,
  }));

export default function WidgetsPage() {
  const toast = useToast();
  const [widgetTypes, setWidgetTypes] = useState<WidgetType[]>([]);
  const [myWidgets, setMyWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshingWidgetIds, setRefreshingWidgetIds] = useState<Set<string>>(new Set());
  const [widgetTypesLoadError, setWidgetTypesLoadError] = useState<string | null>(null);

  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<'select' | 'configure' | 'preview'>('select');
  const [selectedType, setSelectedType] = useState<WidgetType | null>(null);
  const [widgetName, setWidgetName] = useState('');
  const [widgetDescription, setWidgetDescription] = useState('');
  const [widgetConfig, setWidgetConfig] = useState<Record<string, any>>({});

  // Edit state
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<Record<string, any>>({});
  const availableWidgetTypes = getAvailableWidgetTypes(widgetTypes);
  const canOpenWizard = !loading && availableWidgetTypes.length > 0;
  const createMissingFields = selectedType ? getMissingRequiredFields(selectedType.configSchema, widgetConfig) : [];
  const editTypeInfo = editingWidget
    ? widgetTypes.find((t) => t.type === editingWidget.widgetType)
    : null;
  const editMissingFields = editTypeInfo ? getMissingRequiredFields(editTypeInfo.configSchema, editConfig) : [];

  useEffect(() => {
    loadData();
  }, []);

  const loadWidgets = async () => {
    const response = await apiClient.get<any>('/content/widgets');
    const widgets = response?.data || response || [];
    return Array.isArray(widgets) ? widgets.map(normalizeWidget) : [];
  };

  const refreshWidgetListAfterMutation = async () => {
    try {
      setMyWidgets(await loadWidgets());
    } catch {
      toast.error('Widget list refresh failed. Showing the latest local change.');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const types = await apiClient.getWidgetTypes();
      if (types && Array.isArray(types) && types.length > 0) {
        // Merge API types with defaults to ensure name/description are never empty
        const merged = types.map((t: WidgetType) => {
          const fallback = DEFAULT_WIDGET_TYPES.find(d => d.type === t.type);
          return {
            ...t,
            name: t.name || fallback?.name || t.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            description: t.description || fallback?.description || '',
            configSchema: normalizeConfigSchema(t.configSchema || fallback?.configSchema || {}),
            available: true,
          };
        });
        setWidgetTypes(merged);
        setWidgetTypesLoadError(null);
      } else {
        setWidgetTypes([]);
        setWidgetTypesLoadError(null);
      }
    } catch {
      // Use default widget types as fallback — already set as initial state
      setWidgetTypes(unavailableFallbackWidgetTypes());
      setWidgetTypesLoadError(WIDGET_TYPES_UNAVAILABLE_MESSAGE);
    }

    try {
      setMyWidgets(await loadWidgets());
    } catch {
      // Widgets may not exist yet
      setMyWidgets([]);
    }
    setLoading(false);
  };

  const tileForType = (type: string): WidgetTypeTile =>
    WIDGET_TYPE_TILES[type] ?? WIDGET_TYPE_TILE_FALLBACK;
  const getIconForType = (type: string) => tileForType(type).icon;
  const getColorForType = (type: string) => tileForType(type).tile;
  const getGlyphInkForType = (type: string) => tileForType(type).ink;

  const openWizard = (type: WidgetType) => {
    if (type.available === false) {
      toast.error(type.unavailableReason || WIDGET_TYPES_UNAVAILABLE_MESSAGE);
      return;
    }

    const normalizedType = {
      ...type,
      configSchema: normalizeConfigSchema(type.configSchema),
    };

    setSelectedType(normalizedType);
    setWidgetName('');
    setWidgetDescription('');
    // Initialize config with defaults from schema
    const defaults: Record<string, any> = {};
    if (normalizedType.configSchema) {
      Object.entries(normalizedType.configSchema).forEach(([key, schema]: [string, any]) => {
        if (schema.default !== undefined) {
          defaults[key] = schema.default;
        } else if (schema.type === 'boolean') {
          defaults[key] = false;
        } else if (schema.type === 'number') {
          defaults[key] = schema.min || 0;
        } else {
          defaults[key] = '';
        }
      });
    }
    setWidgetConfig(defaults);
    setWizardStep('configure');
    setIsWizardOpen(true);
  };

  const handleCreateWidget = async () => {
    if (!selectedType || !widgetName.trim()) {
      toast.error('Widget name is required');
      return;
    }
    if (createMissingFields.length > 0) {
      toast.error(`Complete required fields: ${createMissingFields.join(', ')}`);
      return;
    }

    setActionLoading(true);
    try {
      const created = normalizeWidget(await apiClient.createWidget({
        name: widgetName.trim(),
        widgetType: selectedType.type,
        widgetConfig: widgetConfig,
        description: widgetDescription.trim() || undefined,
      }));
      if (created.id) {
        setMyWidgets((prev) => [created, ...prev.filter((widget) => widget.id !== created.id)]);
      }
      toast.success('Widget created successfully');
      setIsWizardOpen(false);
      setSelectedType(null);
      setWizardStep('select');
      void refreshWidgetListAfterMutation();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create widget');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefreshWidget = async (id: string) => {
    setRefreshingWidgetIds((prev) => new Set(prev).add(id));
    try {
      const refreshed = normalizeWidget(await apiClient.refreshWidget(id));
      if (refreshed.id) {
        setMyWidgets((prev) =>
          prev.map((widget) => (widget.id === refreshed.id ? { ...widget, ...refreshed } : widget)),
        );
      }
      toast.success('Widget data refreshed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh widget');
    } finally {
      setRefreshingWidgetIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const openEditModal = (widget: Widget) => {
    setEditingWidget(widget);
    setEditConfig(widget.widgetConfig || {});
    setIsEditModalOpen(true);
  };

  const handleUpdateWidget = async () => {
    if (!editingWidget) return;
    if (editMissingFields.length > 0) {
      toast.error(`Complete required fields: ${editMissingFields.join(', ')}`);
      return;
    }

    setActionLoading(true);
    try {
      const updated = normalizeWidget(await apiClient.updateWidget(editingWidget.id, {
        widgetConfig: editConfig,
      }));
      if (updated.id) {
        setMyWidgets((prev) =>
          prev.map((widget) => (widget.id === updated.id ? { ...widget, ...updated } : widget)),
        );
      }
      toast.success('Widget updated successfully');
      setIsEditModalOpen(false);
      setEditingWidget(null);
      void refreshWidgetListAfterMutation();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update widget');
    } finally {
      setActionLoading(false);
    }
  };

  const renderConfigField = (
    key: string,
    schema: any,
    value: any,
    onChange: (key: string, val: any) => void
  ) => {
    const fieldType = schema.type || 'string';
    const label = schema.label || humanizeFieldName(key);

    if (fieldType === 'object') {
      return (
        <div key={key} className="space-y-1">
          <label className="block text-sm font-medium text-[var(--foreground-secondary)]">
            {label}
            {schema.required && <span className="text-[var(--error-ink)] ml-1">*</span>}
          </label>
          <textarea
            aria-label={label}
            value={typeof value === 'string' ? value : JSON.stringify(value || {}, null, 2)}
            placeholder={schema.placeholder || ''}
            rows={4}
            onChange={(e) => {
              try {
                onChange(key, JSON.parse(e.target.value));
              } catch {
                onChange(key, e.target.value);
              }
            }}
            className="eh-input w-full px-3 py-2 rounded-lg resize-y font-mono text-sm"
          />
        </div>
      );
    }

    if (fieldType === 'textarea') {
      return (
        <div key={key} className="space-y-1">
          <label className="block text-sm font-medium text-[var(--foreground-secondary)]">
            {label}
            {schema.required && <span className="text-[var(--error-ink)] ml-1">*</span>}
          </label>
          <textarea
            aria-label={label}
            value={value || ''}
            placeholder={schema.placeholder || ''}
            rows={4}
            onChange={(e) => onChange(key, e.target.value)}
            className="eh-input w-full px-3 py-2 rounded-lg resize-y"
          />
        </div>
      );
    }

    if (fieldType === 'boolean') {
      return (
        <label key={key} className="flex items-center gap-3 py-2">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(key, e.target.checked)}
            className="w-4 h-4 rounded border-[var(--border)] text-[var(--primary-ink)] focus:ring-[var(--primary-ink)]"
          />
          <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
        </label>
      );
    }

    if (fieldType === 'select') {
      return (
        <div key={key} className="space-y-1">
          <label className="block text-sm font-medium text-[var(--foreground-secondary)]">
            {label}
            {schema.required && <span className="text-[var(--error-ink)] ml-1">*</span>}
          </label>
          <select
            aria-label={label}
            value={value || ''}
            onChange={(e) => onChange(key, e.target.value)}
            className="eh-select w-full px-3 py-2 rounded-lg"
          >
            <option value="">Select...</option>
            {(schema.options || []).map((opt: string) => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (fieldType === 'number') {
      return (
        <div key={key} className="space-y-1">
          <label className="block text-sm font-medium text-[var(--foreground-secondary)]">
            {label}
          </label>
          <input
            aria-label={label}
            type="number"
            value={value ?? ''}
            min={schema.min}
            max={schema.max}
            onChange={(e) => onChange(key, parseInt(e.target.value) || 0)}
            className="eh-input w-full px-3 py-2 rounded-lg"
          />
        </div>
      );
    }

    // Default: string
    return (
      <div key={key} className="space-y-1">
        <label className="block text-sm font-medium text-[var(--foreground-secondary)]">
          {label}
          {schema.required && <span className="text-[var(--error-ink)] ml-1">*</span>}
        </label>
        <input
          aria-label={label}
          type="text"
          value={value || ''}
          placeholder={schema.placeholder || ''}
          onChange={(e) => onChange(key, e.target.value)}
          className="eh-input w-full px-3 py-2 rounded-lg"
        />
      </div>
    );
  };

  const getConfigSummary = (type: string, config: Record<string, any>) => {
    switch (type) {
      case 'weather': {
        if (!config.location) return 'Not configured';
        const unit = config.units === 'metric' ? '\u00B0C' : '\u00B0F';
        const interval = config.refreshInterval ? `${config.refreshInterval}min` : '30min';
        return `${config.location} (${unit}, ${interval})`;
      }
      case 'rss':
        return config.feedUrl ? `${config.feedUrl.substring(0, 40)}...` : 'No feed URL';
      case 'social-media':
        return config.handle ? `${config.platform || 'social'}: ${config.handle}` : 'Not configured';
      case 'social-feed': {
        const urls = (config.postUrls || '').split('\n').filter((l: string) => l.trim());
        return urls.length > 0 ? `${urls.length} post(s), ${config.rotateInterval || 10}s rotation` : 'No posts configured';
      }
      case 'clock':
        if (config.mode === 'countdown') {
          return config.eventName || config.targetDate || 'Countdown - not configured';
        }
        return `${config.timezone || 'Local'} - ${config.format || '12h'}`;
      case 'countdown':
        return config.title || config.targetDate || 'Not configured';
      case 'sheets':
        return config.sheetUrl ? `${config.title || config.sheetName || 'Sheet1'} (${config.refreshInterval || 5}min)` : 'No Sheet URL';
      default:
        return 'Configured';
    }
  };

  return (
    <div className="space-y-8">
      <toast.ToastContainer />

      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="eh-dash-title font-sora text-2xl">Widgets</h2>
          <p className="mt-2 text-[var(--foreground-secondary)]">
            Add dynamic data widgets like weather, RSS feeds, clocks, and more to your displays.
          </p>
        </div>
        <button
          disabled={!canOpenWizard}
          onClick={() => {
            setWizardStep('select');
            setSelectedType(null);
            setIsWizardOpen(true);
          }}
          className="eh-btn-neon rounded-xl px-6 py-3 transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="add" size="lg" />
          <span>Create Widget</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-[var(--surface)] rounded-lg shadow p-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {/* My Widgets Section */}
          {myWidgets.length > 0 && (
            <div>
              <h3 className="eh-dash-subtitle text-xl font-semibold mb-4">My Widgets</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {myWidgets.map((widget) => (
                  <div
                    key={widget.id}
                    className="eh-dash-card rounded-lg shadow overflow-hidden hover:-translate-y-[2px] hover:border-brand/20 hover:shadow-md transition-all duration-300"
                  >
                    <div className={`h-2 ${getColorForType(widget.widgetType)}`} />
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${getColorForType(widget.widgetType)} flex items-center justify-center`}>
                            <Icon name={getIconForType(widget.widgetType)} size="md" className={getGlyphInkForType(widget.widgetType)} />
                          </div>
                          <div>
                            <h4 className="font-semibold text-[var(--foreground)]">{widget.name}</h4>
                            <p className="text-xs text-[var(--foreground-tertiary)] uppercase">{widget.widgetType}</p>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-[var(--foreground-secondary)] mb-3 line-clamp-2">
                        {widget.description || getConfigSummary(widget.widgetType, widget.widgetConfig || {})}
                      </p>
                      {widget.createdAt && (
                        <p className="text-xs text-[var(--foreground-tertiary)] mb-3">
                          Created {new Date(widget.createdAt).toLocaleDateString()}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(widget)}
                          className="flex-1 text-sm py-2 rounded-lg bg-brand/10 text-[var(--primary-ink)] hover:bg-brand/20 transition font-medium flex items-center justify-center gap-1"
                        >
                          <Icon name="edit" size="sm" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleRefreshWidget(widget.id)}
                          disabled={refreshingWidgetIds.has(widget.id)}
                          className="flex-1 text-sm py-2 rounded-lg bg-[var(--surface-hover)] text-[var(--foreground-secondary)] hover:bg-[var(--border)] transition font-medium flex items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-wait"
                        >
                          {refreshingWidgetIds.has(widget.id) ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <Icon name="refresh" size="sm" />
                          )}
                          {refreshingWidgetIds.has(widget.id) ? 'Refreshing...' : 'Refresh'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Widget Type Gallery */}
          <div>
            <h3 className="eh-dash-subtitle text-xl font-semibold mb-4">
              {myWidgets.length > 0 ? 'Available Widget Types' : 'Widget Gallery'}
            </h3>
            {widgetTypesLoadError && (
              <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-[var(--warning-ink)]">
                {widgetTypesLoadError}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {widgetTypes.map((wType) => (
                <div
                  key={wType.type}
                  className={`eh-dash-card rounded-lg shadow overflow-hidden transition-all duration-300 group ${wType.available === false ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-[2px] hover:border-brand/20 hover:shadow-md'}`}
                  onClick={() => openWizard(wType)}
                >
                  <div className={`h-32 ${getColorForType(wType.type)} flex items-center justify-center relative`}>
                    <Icon name={getIconForType(wType.type)} size="4xl" className={`${getGlyphInkForType(wType.type)} transition`} />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
                  </div>
                  <div className="p-5">
                    <h4 className="text-lg font-semibold text-[var(--foreground)] mb-1">{wType.name}</h4>
                    <p className="text-sm text-[var(--foreground-secondary)] mb-4">{wType.description}</p>
                    {wType.available === false && (
                      <p className="text-xs text-[var(--warning-ink)] mb-3">
                        Reload widget types before creating.
                      </p>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openWizard(wType);
                      }}
                      disabled={wType.available === false}
                      className="w-full py-2 text-sm font-medium rounded-lg border border-[var(--primary-ink)] text-[var(--primary-ink)] hover:bg-[var(--primary)] hover:text-[var(--lw-on-forest)] transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[var(--primary-ink)]"
                    >
                      <Icon name="add" size="sm" />
                      Create {wType.name} Widget
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {myWidgets.length === 0 && widgetTypes.length === 0 && (
            <EmptyState
              icon="content"
              title="No widgets available"
              description="Widget types will appear here once the backend is configured."
            />
          )}
        </>
      )}

      {/* Create Widget Wizard Modal */}
      <Modal
        isOpen={isWizardOpen}
        onClose={() => {
          setIsWizardOpen(false);
          setSelectedType(null);
          setWizardStep('select');
        }}
        title={
          wizardStep === 'select'
            ? 'Select Widget Type'
            : wizardStep === 'configure'
            ? `Configure ${selectedType?.name || 'Widget'}`
            : `Preview ${selectedType?.name || 'Widget'}`
        }
        size="lg"
      >
        {wizardStep === 'select' && (
          <div className="space-y-4">
            <p className="text-[var(--foreground-secondary)]">Choose a widget type to get started:</p>
            {widgetTypesLoadError && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-[var(--warning-ink)]">
                {widgetTypesLoadError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {widgetTypes.map((wType) => (
                <button
                  key={wType.type}
                  onClick={() => openWizard(wType)}
                  disabled={wType.available === false}
                  className="flex items-center gap-3 p-4 rounded-lg border border-[var(--border)] hover:border-[var(--primary-ink)] hover:bg-brand/5 transition text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[var(--border)] disabled:hover:bg-transparent"
                >
                  <div className={`w-12 h-12 rounded-lg ${getColorForType(wType.type)} flex items-center justify-center flex-shrink-0`}>
                    <Icon name={getIconForType(wType.type)} size="lg" className={getGlyphInkForType(wType.type)} />
                  </div>
                  <div>
                    <div className="font-medium text-[var(--foreground)]">{wType.name}</div>
                    <div className="text-xs text-[var(--foreground-tertiary)] line-clamp-1">{wType.description}</div>
                  </div>
                </button>
              ))}
            </div>
            {widgetTypes.length === 0 && (
              <EmptyState
                icon="content"
                title="No widget types available"
                description="Widget types will appear here once the backend is configured."
              />
            )}
          </div>
        )}

        {wizardStep === 'configure' && selectedType && (
          <div className="space-y-4">
            {/* Widget Name */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Widget Name <span className="text-[var(--error-ink)]">*</span>
              </label>
              <input
                aria-label="Widget Name"
                type="text"
                value={widgetName}
                onChange={(e) => setWidgetName(e.target.value)}
                placeholder={`My ${selectedType.name} Widget`}
                className="eh-input w-full px-3 py-2 rounded-lg"
              />
            </div>

            {/* Widget Description */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Description (optional)
              </label>
              <input
                aria-label="Description"
                type="text"
                value={widgetDescription}
                onChange={(e) => setWidgetDescription(e.target.value)}
                placeholder="A brief description..."
                className="eh-input w-full px-3 py-2 rounded-lg"
              />
            </div>

            {/* Dynamic Config Fields */}
            {selectedType.configSchema && Object.keys(selectedType.configSchema).length > 0 && (
              <div className="border-t border-[var(--border)] pt-4">
                <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">Widget Configuration</h4>
                <div className="space-y-4">
                  {Object.entries(selectedType.configSchema).map(([key, schema]) =>
                    renderConfigField(key, schema, widgetConfig[key], (k, v) =>
                      setWidgetConfig((prev) => ({ ...prev, [k]: v }))
                    )
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setWizardStep('select')}
                className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition"
              >
                Back
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setWizardStep('preview')}
                  disabled={!widgetName.trim() || createMissingFields.length > 0}
                  className="px-4 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition disabled:opacity-50"
                >
                  Preview
                </button>
                <button
                  onClick={handleCreateWidget}
                  disabled={actionLoading || !widgetName.trim() || createMissingFields.length > 0}
                  className="eh-btn-neon rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading && <LoadingSpinner size="sm" />}
                  Create Widget
                </button>
              </div>
            </div>
          </div>
        )}

        {wizardStep === 'preview' && selectedType && (
          <div className="space-y-4">
            {/* Live Preview for Weather widget */}
            {selectedType.type === 'weather' ? (
              <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] overflow-hidden p-4">
                <h4 className="font-semibold text-[var(--foreground)] mb-1">{widgetName || 'Untitled Widget'}</h4>
                <p className="text-xs text-[var(--foreground-tertiary)] uppercase mb-3">{selectedType.name}</p>
                {widgetDescription && (
                  <p className="text-sm text-[var(--foreground-secondary)] mb-3">{widgetDescription}</p>
                )}
                <WeatherWidget
                  location={widgetConfig.location || 'New York'}
                  units={(widgetConfig.units as 'metric' | 'imperial') || 'imperial'}
                  theme={(widgetConfig.theme as 'dark' | 'light' | 'auto') || 'dark'}
                  refreshInterval={0}
                  showForecast={widgetConfig.showForecast !== false}
                  compact
                />
              </div>
            ) : selectedType.type === 'sheets' ? (
              <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] overflow-hidden p-4">
                <h4 className="font-semibold text-[var(--foreground)] mb-1">{widgetName || 'Untitled Widget'}</h4>
                <p className="text-xs text-[var(--foreground-tertiary)] uppercase mb-3">{selectedType.name}</p>
                {widgetDescription && (
                  <p className="text-sm text-[var(--foreground-secondary)] mb-3">{widgetDescription}</p>
                )}
                <SheetsWidget
                  sheetUrl={widgetConfig.sheetUrl || ''}
                  sheetName={widgetConfig.sheetName || 'Sheet1'}
                  title={widgetConfig.title || ''}
                  showHeader={widgetConfig.showHeader !== false}
                  stripedRows={widgetConfig.stripedRows !== false}
                  fontSize={(widgetConfig.fontSize as 'small' | 'medium' | 'large') || 'medium'}
                  theme={(widgetConfig.theme as 'dark' | 'light' | 'auto') || 'dark'}
                  refreshInterval={0}
                  compact
                />
              </div>
            ) : selectedType.type === 'social-feed' ? (
              <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] overflow-hidden p-4">
                <h4 className="font-semibold text-[var(--foreground)] mb-1">{widgetName || 'Untitled Widget'}</h4>
                <p className="text-xs text-[var(--foreground-tertiary)] uppercase mb-3">{selectedType.name}</p>
                {widgetDescription && (
                  <p className="text-sm text-[var(--foreground-secondary)] mb-3">{widgetDescription}</p>
                )}
                <SocialFeedWidget
                  posts={parsePostUrls(widgetConfig.postUrls || '')}
                  rotateInterval={parseInt(widgetConfig.rotateInterval) || 10}
                  showPlatformIcon={widgetConfig.showPlatformIcon !== false}
                  theme={(widgetConfig.theme as 'dark' | 'light' | 'auto') || 'dark'}
                  compact
                />
              </div>
            ) : selectedType.type === 'rss' ? (
              <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] overflow-hidden p-4">
                <h4 className="font-semibold text-[var(--foreground)] mb-1">{widgetName || 'Untitled Widget'}</h4>
                <p className="text-xs text-[var(--foreground-tertiary)] uppercase mb-3">{selectedType.name}</p>
                {widgetDescription && (
                  <p className="text-sm text-[var(--foreground-secondary)] mb-3">{widgetDescription}</p>
                )}
                <RssWidget
                  feedUrl={widgetConfig.feedUrl || ''}
                  maxItems={parseInt(widgetConfig.maxItems) || 10}
                  showImages={widgetConfig.showImages !== false}
                  showSummary={widgetConfig.showSummary !== false}
                  scrollSpeed={(widgetConfig.scrollSpeed as 'slow' | 'medium' | 'fast' | 'none') || 'none'}
                  refreshInterval={0}
                  theme={(widgetConfig.theme as 'dark' | 'light' | 'auto') || 'dark'}
                  compact
                />
              </div>
            ) : selectedType.type === 'clock' ? (
              <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] overflow-hidden p-4">
                <h4 className="font-semibold text-[var(--foreground)] mb-1">{widgetName || 'Untitled Widget'}</h4>
                <p className="text-xs text-[var(--foreground-tertiary)] uppercase mb-3">{selectedType.name}</p>
                {widgetDescription && (
                  <p className="text-sm text-[var(--foreground-secondary)] mb-3">{widgetDescription}</p>
                )}
                <ClockWidget
                  mode={(widgetConfig.mode as 'clock' | 'countdown') || 'clock'}
                  format={(widgetConfig.format as '12h' | '24h') || '12h'}
                  showDate={widgetConfig.showDate !== false}
                  showSeconds={widgetConfig.showSeconds !== false}
                  timezone={widgetConfig.timezone || 'local'}
                  targetDate={widgetConfig.targetDate || ''}
                  eventName={widgetConfig.eventName || ''}
                  theme={(widgetConfig.theme as 'dark' | 'light' | 'auto') || 'dark'}
                  compact
                />
              </div>
            ) : (
            /* Generic Preview Card */
            <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] overflow-hidden">
              <div className={`h-20 ${getColorForType(selectedType.type)} flex items-center justify-center`}>
                <Icon name={getIconForType(selectedType.type)} size="3xl" className={getGlyphInkForType(selectedType.type)} />
              </div>
              <div className="p-4">
                <h4 className="font-semibold text-[var(--foreground)] mb-1">{widgetName || 'Untitled Widget'}</h4>
                <p className="text-xs text-[var(--foreground-tertiary)] uppercase mb-2">{selectedType.name}</p>
                {widgetDescription && (
                  <p className="text-sm text-[var(--foreground-secondary)] mb-3">{widgetDescription}</p>
                )}
                <div className="bg-[var(--surface)] rounded p-3 border border-[var(--border)]">
                  <p className="text-xs font-medium text-[var(--foreground-secondary)] mb-2">Configuration:</p>
                  <div className="space-y-1">
                    {Object.entries(widgetConfig).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-[var(--foreground-tertiary)]">{key}:</span>
                        <span className="text-[var(--foreground)] font-medium">
                          {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || '-')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            )}

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setWizardStep('configure')}
                className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition"
              >
                Back to Configure
              </button>
              <button
                onClick={handleCreateWidget}
                disabled={actionLoading || !widgetName.trim() || createMissingFields.length > 0}
                className="eh-btn-neon rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading && <LoadingSpinner size="sm" />}
                Create Widget
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Widget Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingWidget(null);
        }}
        title={`Edit Widget: ${editingWidget?.name || ''}`}
      >
        {editingWidget && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-[var(--background)] rounded-lg">
              <div className={`w-10 h-10 rounded-lg ${getColorForType(editingWidget.widgetType)} flex items-center justify-center`}>
                <Icon name={getIconForType(editingWidget.widgetType)} size="md" className={getGlyphInkForType(editingWidget.widgetType)} />
              </div>
              <div>
                <div className="font-medium text-[var(--foreground)]">{editingWidget.name}</div>
                <div className="text-xs text-[var(--foreground-tertiary)] uppercase">{editingWidget.widgetType}</div>
              </div>
            </div>

            {/* Config Fields based on widget type */}
            {(() => {
              const typeInfo = editTypeInfo;
              if (!typeInfo?.configSchema) return <p className="text-[var(--foreground-secondary)]">No configurable settings for this widget type.</p>;

              return (
                <div className="space-y-4">
                  {Object.entries(typeInfo.configSchema).map(([key, schema]) =>
                    renderConfigField(key, schema, editConfig[key], (k, v) =>
                      setEditConfig((prev) => ({ ...prev, [k]: v }))
                    )
                  )}
                </div>
              );
            })()}

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingWidget(null);
                }}
                className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateWidget}
                disabled={actionLoading || editMissingFields.length > 0}
                className="eh-btn-neon rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading && <LoadingSpinner size="sm" />}
                Save Changes
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
