'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import Modal from '@/components/Modal';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/lib/hooks/useToast';
import { Icon } from '@/theme/icons';
import WeatherWidget from '@/components/widgets/WeatherWidget';
import SheetsWidget from '@/components/widgets/SheetsWidget';
import SocialFeedWidget, { parsePostUrls } from '@/components/widgets/SocialFeedWidget';

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
    name: 'RSS Feed',
    description: 'Show live news or blog updates from any RSS feed source.',
    icon: 'list',
    configSchema: {
      feedUrl: { type: 'string', label: 'Feed URL', placeholder: 'https://example.com/rss', required: true },
      maxItems: { type: 'number', label: 'Max Items', default: 5, min: 1, max: 20 },
      showImages: { type: 'boolean', label: 'Show Images', default: true },
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
    name: 'Clock',
    description: 'Display a clock with customizable timezone and format options.',
    icon: 'clock',
    configSchema: {
      timezone: { type: 'string', label: 'Timezone', placeholder: 'America/New_York', default: 'local' },
      format: { type: 'select', label: 'Format', options: ['12h', '24h'], default: '12h' },
      showDate: { type: 'boolean', label: 'Show Date', default: true },
      showSeconds: { type: 'boolean', label: 'Show Seconds', default: false },
    },
  },
  {
    type: 'countdown',
    name: 'Countdown',
    description: 'Count down to a specific date and time for events or promotions.',
    icon: 'clock',
    configSchema: {
      targetDate: { type: 'string', label: 'Target Date', placeholder: '2026-12-31T23:59:59', required: true },
      title: { type: 'string', label: 'Event Title', placeholder: 'Grand Opening' },
      showDays: { type: 'boolean', label: 'Show Days', default: true },
      showHours: { type: 'boolean', label: 'Show Hours', default: true },
      showMinutes: { type: 'boolean', label: 'Show Minutes', default: true },
      showSeconds: { type: 'boolean', label: 'Show Seconds', default: true },
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
}

interface Widget {
  id: string;
  name: string;
  widgetType: string;
  widgetConfig: Record<string, any>;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function WidgetsPage() {
  const toast = useToast();
  const [widgetTypes, setWidgetTypes] = useState<WidgetType[]>(DEFAULT_WIDGET_TYPES);
  const [myWidgets, setMyWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const types = await apiClient.getWidgetTypes();
      if (types && types.length > 0) {
        setWidgetTypes(types);
      }
    } catch {
      // Use default widget types as fallback
    }

    try {
      const response = await apiClient.get<any>('/content/widgets');
      const widgets = response?.data || response || [];
      setMyWidgets(Array.isArray(widgets) ? widgets : []);
    } catch {
      // Widgets may not exist yet
      setMyWidgets([]);
    }
    setLoading(false);
  };

  const getIconForType = (type: string) => {
    const mapping: Record<string, string> = {
      weather: 'sun',
      rss: 'list',
      'social-media': 'link',
      'social-feed': 'link',
      clock: 'clock',
      countdown: 'clock',
      sheets: 'content',
    };
    return (mapping[type] || 'content') as any;
  };

  const getColorForType = (type: string) => {
    const mapping: Record<string, string> = {
      weather: 'from-blue-400 to-blue-600',
      rss: 'from-orange-400 to-orange-600',
      'social-media': 'from-pink-400 to-pink-600',
      'social-feed': 'from-pink-500 via-purple-500 to-orange-400',
      clock: 'from-purple-400 to-purple-600',
      countdown: 'from-red-400 to-red-600',
      sheets: 'from-green-400 to-emerald-600',
    };
    return mapping[type] || 'from-[#00E5A0] to-[#00B4D8]';
  };

  const openWizard = (type: WidgetType) => {
    setSelectedType(type);
    setWidgetName('');
    setWidgetDescription('');
    // Initialize config with defaults from schema
    const defaults: Record<string, any> = {};
    if (type.configSchema) {
      Object.entries(type.configSchema).forEach(([key, schema]: [string, any]) => {
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

    setActionLoading(true);
    try {
      await apiClient.createWidget({
        name: widgetName.trim(),
        widgetType: selectedType.type,
        widgetConfig: widgetConfig,
        description: widgetDescription.trim() || undefined,
      });
      toast.success('Widget created successfully');
      setIsWizardOpen(false);
      setSelectedType(null);
      setWizardStep('select');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create widget');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefreshWidget = async (id: string) => {
    try {
      await apiClient.refreshWidget(id);
      toast.success('Widget data refreshed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh widget');
    }
  };

  const openEditModal = (widget: Widget) => {
    setEditingWidget(widget);
    setEditConfig(widget.widgetConfig || {});
    setIsEditModalOpen(true);
  };

  const handleUpdateWidget = async () => {
    if (!editingWidget) return;

    setActionLoading(true);
    try {
      await apiClient.updateWidget(editingWidget.id, {
        widgetConfig: editConfig,
      });
      toast.success('Widget updated successfully');
      setIsEditModalOpen(false);
      setEditingWidget(null);
      loadData();
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

    if (fieldType === 'textarea') {
      return (
        <div key={key} className="space-y-1">
          <label className="block text-sm font-medium text-[var(--foreground-secondary)]">
            {schema.label || key}
            {schema.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <textarea
            value={value || ''}
            placeholder={schema.placeholder || ''}
            rows={4}
            onChange={(e) => onChange(key, e.target.value)}
            className="eh-input w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-[var(--foreground)] bg-[var(--surface)] resize-y"
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
            className="w-4 h-4 rounded border-[var(--border)] text-[#00E5A0] focus:ring-[#00E5A0]"
          />
          <span className="text-sm font-medium text-[var(--foreground)]">{schema.label || key}</span>
        </label>
      );
    }

    if (fieldType === 'select') {
      return (
        <div key={key} className="space-y-1">
          <label className="block text-sm font-medium text-[var(--foreground-secondary)]">
            {schema.label || key}
            {schema.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            value={value || ''}
            onChange={(e) => onChange(key, e.target.value)}
            className="eh-select w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-[var(--foreground)] bg-[var(--surface)]"
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
            {schema.label || key}
          </label>
          <input
            type="number"
            value={value ?? ''}
            min={schema.min}
            max={schema.max}
            onChange={(e) => onChange(key, parseInt(e.target.value) || 0)}
            className="eh-input w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-[var(--foreground)] bg-[var(--surface)]"
          />
        </div>
      );
    }

    // Default: string
    return (
      <div key={key} className="space-y-1">
        <label className="block text-sm font-medium text-[var(--foreground-secondary)]">
          {schema.label || key}
          {schema.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
          type="text"
          value={value || ''}
          placeholder={schema.placeholder || ''}
          onChange={(e) => onChange(key, e.target.value)}
          className="eh-input w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-[var(--foreground)] bg-[var(--surface)]"
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
          <h2 className="eh-dash-title font-[var(--font-sora)] text-2xl text-[var(--foreground)]">Widgets</h2>
          <p className="mt-2 text-[var(--foreground-secondary)]">
            Add dynamic data widgets like weather, RSS feeds, clocks, and more to your displays.
          </p>
        </div>
        <button
          onClick={() => {
            setWizardStep('select');
            setSelectedType(null);
            setIsWizardOpen(true);
          }}
          className="eh-btn-neon rounded-xl px-6 py-3 transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
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
              <h3 className="eh-dash-subtitle text-xl font-semibold text-[var(--foreground)] mb-4">My Widgets</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {myWidgets.map((widget) => (
                  <div
                    key={widget.id}
                    className="eh-dash-card rounded-lg shadow border border-[var(--border)] overflow-hidden hover:-translate-y-[2px] hover:border-[rgba(0,229,160,0.2)] hover:shadow-md transition-all duration-300"
                  >
                    <div className={`h-2 bg-gradient-to-r ${getColorForType(widget.widgetType)}`} />
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getColorForType(widget.widgetType)} flex items-center justify-center`}>
                            <Icon name={getIconForType(widget.widgetType)} size="md" className="text-white" />
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
                          className="flex-1 text-sm py-2 rounded-lg bg-[#00E5A0]/10 text-[#00E5A0] hover:bg-[#00E5A0]/20 transition font-medium flex items-center justify-center gap-1"
                        >
                          <Icon name="edit" size="sm" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleRefreshWidget(widget.id)}
                          className="flex-1 text-sm py-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition font-medium flex items-center justify-center gap-1"
                        >
                          <Icon name="refresh" size="sm" />
                          Refresh
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
            <h3 className="eh-dash-subtitle text-xl font-semibold text-[var(--foreground)] mb-4">
              {myWidgets.length > 0 ? 'Available Widget Types' : 'Widget Gallery'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {widgetTypes.map((wType) => (
                <div
                  key={wType.type}
                  className="eh-dash-card rounded-lg shadow overflow-hidden hover:-translate-y-[2px] hover:border-[rgba(0,229,160,0.2)] hover:shadow-md transition-all duration-300 border border-[var(--border)] cursor-pointer group"
                  onClick={() => openWizard(wType)}
                >
                  <div className={`h-32 bg-gradient-to-br ${getColorForType(wType.type)} flex items-center justify-center relative`}>
                    <Icon name={getIconForType(wType.type)} size="4xl" className="text-white/80 group-hover:text-white transition" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
                  </div>
                  <div className="p-5">
                    <h4 className="text-lg font-semibold text-[var(--foreground)] mb-1">{wType.name}</h4>
                    <p className="text-sm text-[var(--foreground-secondary)] mb-4">{wType.description}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openWizard(wType);
                      }}
                      className="w-full py-2 text-sm font-medium rounded-lg border border-[#00E5A0] text-[#00E5A0] hover:bg-[#00E5A0] hover:text-[#061A21] transition flex items-center justify-center gap-2"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {widgetTypes.map((wType) => (
                <button
                  key={wType.type}
                  onClick={() => openWizard(wType)}
                  className="flex items-center gap-3 p-4 rounded-lg border border-[var(--border)] hover:border-[#00E5A0] hover:bg-[#00E5A0]/5 transition text-left"
                >
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getColorForType(wType.type)} flex items-center justify-center flex-shrink-0`}>
                    <Icon name={getIconForType(wType.type)} size="lg" className="text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-[var(--foreground)]">{wType.name}</div>
                    <div className="text-xs text-[var(--foreground-tertiary)] line-clamp-1">{wType.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {wizardStep === 'configure' && selectedType && (
          <div className="space-y-4">
            {/* Widget Name */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Widget Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={widgetName}
                onChange={(e) => setWidgetName(e.target.value)}
                placeholder={`My ${selectedType.name} Widget`}
                className="eh-input w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-[var(--foreground)] bg-[var(--surface)]"
              />
            </div>

            {/* Widget Description */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={widgetDescription}
                onChange={(e) => setWidgetDescription(e.target.value)}
                placeholder="A brief description..."
                className="eh-input w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-[var(--foreground)] bg-[var(--surface)]"
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
                  disabled={!widgetName.trim()}
                  className="px-4 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition disabled:opacity-50"
                >
                  Preview
                </button>
                <button
                  onClick={handleCreateWidget}
                  disabled={actionLoading || !widgetName.trim()}
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
            ) : (
            /* Generic Preview Card */
            <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] overflow-hidden">
              <div className={`h-20 bg-gradient-to-br ${getColorForType(selectedType.type)} flex items-center justify-center`}>
                <Icon name={getIconForType(selectedType.type)} size="3xl" className="text-white" />
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
                disabled={actionLoading || !widgetName.trim()}
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
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getColorForType(editingWidget.widgetType)} flex items-center justify-center`}>
                <Icon name={getIconForType(editingWidget.widgetType)} size="md" className="text-white" />
              </div>
              <div>
                <div className="font-medium text-[var(--foreground)]">{editingWidget.name}</div>
                <div className="text-xs text-[var(--foreground-tertiary)] uppercase">{editingWidget.widgetType}</div>
              </div>
            </div>

            {/* Config Fields based on widget type */}
            {(() => {
              const typeInfo = widgetTypes.find((t) => t.type === editingWidget.widgetType);
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
                disabled={actionLoading}
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
