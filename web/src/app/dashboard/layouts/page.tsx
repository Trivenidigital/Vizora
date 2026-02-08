'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import Modal from '@/components/Modal';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useToast } from '@/lib/hooks/useToast';
import { Icon } from '@/theme/icons';

// Visual preview components for layout presets
function LayoutPreviewGrid({ type }: { type: string }) {
  const previewStyles: Record<string, React.CSSProperties> = {
    'split-horizontal': {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '3px',
    },
    'split-vertical': {
      display: 'grid',
      gridTemplateRows: '1fr 1fr',
      gap: '3px',
    },
    'grid-2x2': {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr 1fr',
      gap: '3px',
    },
    'main-sidebar': {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr',
      gap: '3px',
    },
    'l-shape': {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr',
      gridTemplateRows: '1fr 1fr',
      gap: '3px',
    },
  };

  const zoneColors = [
    'bg-[#00E5A0]/40',
    'bg-[#00B4D8]/40',
    'bg-purple-400/40',
    'bg-orange-400/40',
  ];

  const getZones = (layoutType: string) => {
    switch (layoutType) {
      case 'split-horizontal':
        return [
          { style: {}, label: 'A' },
          { style: {}, label: 'B' },
        ];
      case 'split-vertical':
        return [
          { style: {}, label: 'A' },
          { style: {}, label: 'B' },
        ];
      case 'grid-2x2':
        return [
          { style: {}, label: 'A' },
          { style: {}, label: 'B' },
          { style: {}, label: 'C' },
          { style: {}, label: 'D' },
        ];
      case 'main-sidebar':
        return [
          { style: { gridRow: '1' }, label: 'Main' },
          { style: { gridRow: '1' }, label: 'Side' },
        ];
      case 'l-shape':
        return [
          { style: { gridRow: '1 / 3' }, label: 'Main' },
          { style: {}, label: 'B' },
          { style: {}, label: 'C' },
        ];
      default:
        return [{ style: {}, label: 'A' }];
    }
  };

  const zones = getZones(type);

  return (
    <div
      className="w-full h-24 rounded-lg overflow-hidden border border-[var(--border)]"
      style={previewStyles[type] || { display: 'flex' }}
    >
      {zones.map((zone, idx) => (
        <div
          key={idx}
          className={`${zoneColors[idx % zoneColors.length]} flex items-center justify-center text-xs font-semibold text-[var(--foreground-secondary)] rounded-sm`}
          style={zone.style}
        >
          {zone.label}
        </div>
      ))}
    </div>
  );
}

// Default preset definitions used as fallback
const DEFAULT_PRESETS = [
  {
    type: 'split-horizontal',
    name: 'Split Horizontal',
    description: 'Two equal zones side by side, perfect for dual content displays.',
    zones: 2,
  },
  {
    type: 'split-vertical',
    name: 'Split Vertical',
    description: 'Two equal zones stacked vertically, great for top/bottom layouts.',
    zones: 2,
  },
  {
    type: 'grid-2x2',
    name: 'Grid 2x2',
    description: 'Four equal zones in a 2x2 grid for multi-content displays.',
    zones: 4,
  },
  {
    type: 'main-sidebar',
    name: 'Main + Sidebar',
    description: 'Large main area with a narrower sidebar for supplementary content.',
    zones: 2,
  },
  {
    type: 'l-shape',
    name: 'L-Shape',
    description: 'Large main zone spanning full height with two smaller zones on the right.',
    zones: 3,
  },
];

interface LayoutPreset {
  type: string;
  name: string;
  description: string;
  zones: number;
}

interface Layout {
  id: string;
  name: string;
  layoutType: string;
  zones?: any[];
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function LayoutsPage() {
  const toast = useToast();
  const router = useRouter();
  const [presets, setPresets] = useState<LayoutPreset[]>(DEFAULT_PRESETS);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Create layout state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<LayoutPreset | null>(null);
  const [layoutName, setLayoutName] = useState('');
  const [layoutDescription, setLayoutDescription] = useState('');

  // Delete state
  const [deletingLayout, setDeletingLayout] = useState<Layout | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Load presets
    try {
      const presetData = await apiClient.getLayoutPresets();
      if (presetData && presetData.length > 0) {
        setPresets(presetData);
      }
    } catch {
      // Use default presets as fallback
    }

    // Load existing layouts
    try {
      const response = await apiClient.get<any>('/content/layouts');
      const layoutList = response?.data || response || [];
      setLayouts(Array.isArray(layoutList) ? layoutList : []);
    } catch {
      setLayouts([]);
    }

    setLoading(false);
  };

  const handleCreateLayout = async () => {
    if (!selectedPreset || !layoutName.trim()) {
      toast.error('Layout name is required');
      return;
    }

    setActionLoading(true);
    try {
      const newLayout = await apiClient.createLayout({
        name: layoutName.trim(),
        layoutType: selectedPreset.type,
        description: layoutDescription.trim() || undefined,
      });
      toast.success('Layout created successfully');
      setIsCreateModalOpen(false);
      setSelectedPreset(null);
      setLayoutName('');
      setLayoutDescription('');
      loadData();

      // Navigate to the editor for the new layout
      if (newLayout?.id) {
        router.push(`/dashboard/layouts/${newLayout.id}`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create layout');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteLayout = async () => {
    if (!deletingLayout) return;

    setActionLoading(true);
    try {
      await apiClient.delete(`/content/layouts/${deletingLayout.id}`);
      toast.success('Layout deleted');
      setIsDeleteDialogOpen(false);
      setDeletingLayout(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete layout');
    } finally {
      setActionLoading(false);
    }
  };

  const getPresetName = (type: string) => {
    const preset = presets.find((p) => p.type === type);
    return preset?.name || type;
  };

  return (
    <div className="space-y-8">
      <toast.ToastContainer />

      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-[var(--foreground)]">Layouts</h2>
          <p className="mt-2 text-[var(--foreground-secondary)]">
            Create multi-zone display layouts to show multiple content items simultaneously.
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedPreset(null);
            setLayoutName('');
            setLayoutDescription('');
            setIsCreateModalOpen(true);
          }}
          className="bg-[#00E5A0] text-[#061A21] px-6 py-3 rounded-lg hover:bg-[#00CC8E] transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
        >
          <Icon name="add" size="lg" />
          <span>Create Layout</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-[var(--surface)] rounded-lg shadow p-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {/* Existing Layouts */}
          {layouts.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">My Layouts</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {layouts.map((layout) => (
                  <div
                    key={layout.id}
                    className="bg-[var(--surface)] rounded-lg shadow border border-[var(--border)] overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    <div className="p-4">
                      <LayoutPreviewGrid type={layout.layoutType} />
                      <div className="mt-3">
                        <h4 className="font-semibold text-[var(--foreground)] mb-1">{layout.name}</h4>
                        <p className="text-xs text-[var(--foreground-tertiary)] uppercase mb-1">
                          {getPresetName(layout.layoutType)}
                        </p>
                        {layout.description && (
                          <p className="text-sm text-[var(--foreground-secondary)] line-clamp-2 mb-2">{layout.description}</p>
                        )}
                        {layout.createdAt && (
                          <p className="text-xs text-[var(--foreground-tertiary)] mb-3">
                            Created {new Date(layout.createdAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/dashboard/layouts/${layout.id}`)}
                          className="flex-1 text-sm py-2 rounded-lg bg-[#00E5A0]/10 text-[#00E5A0] hover:bg-[#00E5A0]/20 transition font-medium flex items-center justify-center gap-1"
                        >
                          <Icon name="edit" size="sm" />
                          Edit Zones
                        </button>
                        <button
                          onClick={() => {
                            setDeletingLayout(layout);
                            setIsDeleteDialogOpen(true);
                          }}
                          className="text-sm py-2 px-3 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition font-medium flex items-center justify-center"
                        >
                          <Icon name="delete" size="sm" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preset Picker */}
          <div>
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">Layout Presets</h3>
            <p className="text-[var(--foreground-secondary)] mb-4">
              Choose a preset to create a new layout. Each preset defines the zone structure for your display.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {presets.map((preset) => (
                <div
                  key={preset.type}
                  className="bg-[var(--surface)] rounded-lg border border-[var(--border)] p-4 hover:border-[#00E5A0] hover:shadow-md transition cursor-pointer group"
                  onClick={() => {
                    setSelectedPreset(preset);
                    setLayoutName('');
                    setLayoutDescription('');
                    setIsCreateModalOpen(true);
                  }}
                >
                  <LayoutPreviewGrid type={preset.type} />
                  <div className="mt-3">
                    <h4 className="font-semibold text-[var(--foreground)] text-sm">{preset.name}</h4>
                    <p className="text-xs text-[var(--foreground-tertiary)] mt-1">{preset.zones} zone{preset.zones > 1 ? 's' : ''}</p>
                    <p className="text-xs text-[var(--foreground-secondary)] mt-1 line-clamp-2">{preset.description}</p>
                  </div>
                  <button className="mt-3 w-full py-1.5 text-xs font-medium rounded border border-[#00E5A0] text-[#00E5A0] group-hover:bg-[#00E5A0] group-hover:text-[#061A21] transition">
                    Use Preset
                  </button>
                </div>
              ))}
            </div>
          </div>

          {layouts.length === 0 && presets.length === 0 && (
            <EmptyState
              icon="grid"
              title="No layouts available"
              description="Layout presets will appear here once the backend is configured."
            />
          )}
        </>
      )}

      {/* Create Layout Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setSelectedPreset(null);
        }}
        title="Create Layout"
      >
        <div className="space-y-4">
          {/* Preset Selection (if not already selected) */}
          {!selectedPreset ? (
            <div className="space-y-3">
              <p className="text-[var(--foreground-secondary)]">Select a layout preset:</p>
              {presets.map((preset) => (
                <button
                  key={preset.type}
                  onClick={() => setSelectedPreset(preset)}
                  className="w-full flex items-center gap-4 p-3 rounded-lg border border-[var(--border)] hover:border-[#00E5A0] hover:bg-[#00E5A0]/5 transition text-left"
                >
                  <div className="w-24 flex-shrink-0">
                    <LayoutPreviewGrid type={preset.type} />
                  </div>
                  <div>
                    <div className="font-medium text-[var(--foreground)]">{preset.name}</div>
                    <div className="text-xs text-[var(--foreground-tertiary)]">
                      {preset.zones} zone{preset.zones > 1 ? 's' : ''} -- {preset.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <>
              {/* Selected Preset Preview */}
              <div className="flex items-center gap-4 p-3 bg-[var(--background)] rounded-lg border border-[var(--border)]">
                <div className="w-20 flex-shrink-0">
                  <LayoutPreviewGrid type={selectedPreset.type} />
                </div>
                <div>
                  <div className="font-medium text-[var(--foreground)]">{selectedPreset.name}</div>
                  <div className="text-xs text-[var(--foreground-tertiary)]">{selectedPreset.zones} zones</div>
                </div>
                <button
                  onClick={() => setSelectedPreset(null)}
                  className="ml-auto text-xs text-[#00E5A0] hover:underline"
                >
                  Change
                </button>
              </div>

              {/* Layout Name */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                  Layout Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={layoutName}
                  onChange={(e) => setLayoutName(e.target.value)}
                  placeholder="e.g., Lobby Main Display"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-[var(--foreground)] bg-[var(--surface)]"
                  autoFocus
                />
              </div>

              {/* Layout Description */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={layoutDescription}
                  onChange={(e) => setLayoutDescription(e.target.value)}
                  placeholder="A brief description of this layout..."
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-[var(--foreground)] bg-[var(--surface)]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setSelectedPreset(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateLayout}
                  disabled={actionLoading || !layoutName.trim()}
                  className="px-4 py-2 text-sm font-medium bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading && <LoadingSpinner size="sm" />}
                  Create Layout
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setDeletingLayout(null);
        }}
        onConfirm={handleDeleteLayout}
        title="Delete Layout"
        message={`Are you sure you want to delete "${deletingLayout?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
}
