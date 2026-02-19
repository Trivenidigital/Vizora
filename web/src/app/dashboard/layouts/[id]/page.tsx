'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useToast } from '@/lib/hooks/useToast';
import { Icon } from '@/theme/icons';

interface Zone {
  id: string;
  name: string;
  gridArea?: string;
  contentId?: string | null;
  playlistId?: string | null;
  contentName?: string;
  playlistName?: string;
}

interface LayoutData {
  id: string;
  name: string;
  layoutType: string;
  zones: Zone[];
  description?: string;
  createdAt?: string;
}

interface ContentItem {
  id: string;
  title: string;
  type: string;
}

interface PlaylistItem {
  id: string;
  name: string;
  items?: any[];
}

// Build default zones based on layout type
function getDefaultZones(layoutType: string): Zone[] {
  switch (layoutType) {
    case 'split-horizontal':
      return [
        { id: 'zone-a', name: 'Left', gridArea: '1 / 1 / 2 / 2' },
        { id: 'zone-b', name: 'Right', gridArea: '1 / 2 / 2 / 3' },
      ];
    case 'split-vertical':
      return [
        { id: 'zone-a', name: 'Top', gridArea: '1 / 1 / 2 / 2' },
        { id: 'zone-b', name: 'Bottom', gridArea: '2 / 1 / 3 / 2' },
      ];
    case 'grid-2x2':
      return [
        { id: 'zone-a', name: 'Top Left', gridArea: '1 / 1 / 2 / 2' },
        { id: 'zone-b', name: 'Top Right', gridArea: '1 / 2 / 2 / 3' },
        { id: 'zone-c', name: 'Bottom Left', gridArea: '2 / 1 / 3 / 2' },
        { id: 'zone-d', name: 'Bottom Right', gridArea: '2 / 2 / 3 / 3' },
      ];
    case 'main-sidebar':
      return [
        { id: 'zone-main', name: 'Main', gridArea: '1 / 1 / 2 / 2' },
        { id: 'zone-sidebar', name: 'Sidebar', gridArea: '1 / 2 / 2 / 3' },
      ];
    case 'l-shape':
      return [
        { id: 'zone-main', name: 'Main', gridArea: '1 / 1 / 3 / 2' },
        { id: 'zone-b', name: 'Top Right', gridArea: '1 / 2 / 2 / 3' },
        { id: 'zone-c', name: 'Bottom Right', gridArea: '2 / 2 / 3 / 3' },
      ];
    default:
      return [{ id: 'zone-a', name: 'Full', gridArea: '1 / 1 / 2 / 2' }];
  }
}

// Get CSS grid template based on layout type
function getGridStyle(layoutType: string): React.CSSProperties {
  switch (layoutType) {
    case 'split-horizontal':
      return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr', gap: '8px' };
    case 'split-vertical':
      return { display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr', gap: '8px' };
    case 'grid-2x2':
      return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '8px' };
    case 'main-sidebar':
      return { display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: '1fr', gap: '8px' };
    case 'l-shape':
      return { display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: '1fr 1fr', gap: '8px' };
    default:
      return { display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr', gap: '8px' };
  }
}

const zoneColors = [
  'border-[#00E5A0] bg-[#00E5A0]/5',
  'border-[#00B4D8] bg-[#00B4D8]/5',
  'border-purple-400 bg-purple-400/5',
  'border-orange-400 bg-orange-400/5',
];

const zoneHeaderColors = [
  'bg-[#00E5A0]/20 text-[#00E5A0]',
  'bg-[#00B4D8]/20 text-[#00B4D8]',
  'bg-purple-400/20 text-purple-400',
  'bg-orange-400/20 text-orange-400',
];

export default function LayoutEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const router = useRouter();
  const [layout, setLayout] = useState<LayoutData | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  useEffect(() => {
    loadLayout();
    loadContentAndPlaylists();
  }, [id]);

  const loadLayout = async () => {
    setLoading(true);
    try {
      // Try to get resolved layout first
      let data: any;
      try {
        data = await apiClient.getResolvedLayout(id);
      } catch {
        // Fallback: get basic layout info
        data = await apiClient.get<any>(`/content/layouts/${id}`);
      }

      if (data) {
        setLayout(data);
        // Use the layout zones if present, otherwise build defaults from type
        const layoutZones = data.zones && data.zones.length > 0
          ? data.zones
          : getDefaultZones(data.layoutType);
        setZones(layoutZones);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load layout');
    } finally {
      setLoading(false);
    }
  };

  const loadContentAndPlaylists = async () => {
    try {
      const [contentRes, playlistRes] = await Promise.all([
        apiClient.getContent({ limit: 100 }),
        apiClient.getPlaylists({ limit: 100 }),
      ]);
      setContentItems(contentRes?.data || []);
      setPlaylists(playlistRes?.data || []);
    } catch {
      // Non-critical failure
    }
  };

  const handleZoneAssignment = (zoneId: string, field: 'contentId' | 'playlistId', value: string | null) => {
    setZones((prev) =>
      prev.map((zone) => {
        if (zone.id !== zoneId) return zone;
        // If assigning content, clear playlist and vice versa
        if (field === 'contentId') {
          return { ...zone, contentId: value, playlistId: null };
        } else {
          return { ...zone, playlistId: value, contentId: null };
        }
      })
    );
  };

  const handleSave = async () => {
    if (!layout) return;

    setSaving(true);
    try {
      await apiClient.updateLayout(layout.id, {
        zones: zones.map((z) => ({
          id: z.id,
          name: z.name,
          gridArea: z.gridArea,
          contentId: z.contentId || null,
          playlistId: z.playlistId || null,
        })) as any,
      });
      toast.success('Layout saved successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  const getContentName = (contentId: string) => {
    return contentItems.find((c) => c.id === contentId)?.title || 'Unknown Content';
  };

  const getPlaylistName = (playlistId: string) => {
    return playlists.find((p) => p.id === playlistId)?.name || 'Unknown Playlist';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!layout) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--foreground-secondary)]">Layout not found.</p>
        <button
          onClick={() => router.push('/dashboard/layouts')}
          className="mt-4 px-4 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition"
        >
          Back to Layouts
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/layouts')}
            className="p-2 rounded-lg text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] transition"
          >
            <Icon name="chevronLeft" size="lg" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-[var(--foreground)]">{layout.name}</h2>
            <p className="text-sm text-[var(--foreground-tertiary)]">
              {layout.layoutType.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())} Layout
              {layout.description ? ` -- ${layout.description}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition flex items-center gap-2 ${
              isPreviewMode
                ? 'bg-[#00E5A0]/10 border-[#00E5A0] text-[#00E5A0]'
                : 'border-[var(--border)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Icon name="preview" size="sm" />
            {isPreviewMode ? 'Exit Preview' : 'Preview'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 text-sm font-semibold bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <LoadingSpinner size="sm" />}
            Save Layout
          </button>
        </div>
      </div>

      {/* Layout Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual Grid Editor */}
        <div className="lg:col-span-2">
          <div className="bg-[var(--surface)] rounded-lg shadow border border-[var(--border)] p-6">
            <h3 className="text-sm font-semibold text-[var(--foreground-secondary)] uppercase tracking-wide mb-4">
              Zone Layout
            </h3>
            <div
              className="rounded-lg overflow-hidden bg-[var(--background)] border border-[var(--border)]"
              style={{ ...getGridStyle(layout.layoutType), minHeight: '400px', padding: '8px' }}
            >
              {zones.map((zone, idx) => {
                const isSelected = selectedZone === zone.id;
                const hasContent = !!(zone.contentId || zone.playlistId);

                return (
                  <div
                    key={zone.id}
                    className={`rounded-lg border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#00E5A0] bg-[#00E5A0]/10 ring-2 ring-[#00E5A0]/30'
                        : hasContent
                        ? zoneColors[idx % zoneColors.length]
                        : 'border-dashed border-[var(--border)] bg-[var(--surface)] hover:border-[#00E5A0]/50'
                    }`}
                    style={{ gridArea: zone.gridArea }}
                    onClick={() => setSelectedZone(isSelected ? null : zone.id)}
                  >
                    {isPreviewMode ? (
                      <div className="flex flex-col items-center justify-center h-full p-4">
                        {zone.contentId ? (
                          <>
                            <Icon name="content" size="xl" className="text-[var(--foreground-tertiary)] mb-2" />
                            <p className="text-sm font-medium text-[var(--foreground)] text-center">
                              {getContentName(zone.contentId)}
                            </p>
                          </>
                        ) : zone.playlistId ? (
                          <>
                            <Icon name="playlists" size="xl" className="text-[var(--foreground-tertiary)] mb-2" />
                            <p className="text-sm font-medium text-[var(--foreground)] text-center">
                              {getPlaylistName(zone.playlistId)}
                            </p>
                          </>
                        ) : (
                          <>
                            <Icon name="add" size="xl" className="text-[var(--foreground-tertiary)] mb-2" />
                            <p className="text-sm text-[var(--foreground-tertiary)]">Empty Zone</p>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col h-full">
                        <div className={`px-3 py-2 rounded-t-md text-xs font-semibold uppercase tracking-wide ${zoneHeaderColors[idx % zoneHeaderColors.length]}`}>
                          {zone.name}
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center p-4">
                          {zone.contentId ? (
                            <div className="text-center">
                              <Icon name="content" size="lg" className="text-[var(--foreground-secondary)] mb-1 mx-auto" />
                              <p className="text-sm font-medium text-[var(--foreground)]">
                                {getContentName(zone.contentId)}
                              </p>
                              <p className="text-xs text-[var(--foreground-tertiary)]">Content</p>
                            </div>
                          ) : zone.playlistId ? (
                            <div className="text-center">
                              <Icon name="playlists" size="lg" className="text-[var(--foreground-secondary)] mb-1 mx-auto" />
                              <p className="text-sm font-medium text-[var(--foreground)]">
                                {getPlaylistName(zone.playlistId)}
                              </p>
                              <p className="text-xs text-[var(--foreground-tertiary)]">Playlist</p>
                            </div>
                          ) : (
                            <div className="text-center">
                              <div className="w-10 h-10 rounded-full border-2 border-dashed border-[var(--border)] flex items-center justify-center mb-2 mx-auto">
                                <Icon name="add" size="md" className="text-[var(--foreground-tertiary)]" />
                              </div>
                              <p className="text-sm text-[var(--foreground-tertiary)]">
                                Click to assign content
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Zone Configuration Panel */}
        <div className="lg:col-span-1">
          <div className="bg-[var(--surface)] rounded-lg shadow border border-[var(--border)] p-6 sticky top-20">
            <h3 className="text-sm font-semibold text-[var(--foreground-secondary)] uppercase tracking-wide mb-4">
              Zone Configuration
            </h3>

            {selectedZone ? (
              (() => {
                const zone = zones.find((z) => z.id === selectedZone);
                if (!zone) return null;
                const zoneIdx = zones.indexOf(zone);

                return (
                  <div className="space-y-4">
                    <div className={`px-3 py-2 rounded-lg ${zoneHeaderColors[zoneIdx % zoneHeaderColors.length]}`}>
                      <p className="font-semibold text-sm">{zone.name}</p>
                      <p className="text-xs opacity-70">{zone.id}</p>
                    </div>

                    {/* Content Assignment */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                        Assign Content
                      </label>
                      <select
                        value={zone.contentId || ''}
                        onChange={(e) =>
                          handleZoneAssignment(zone.id, 'contentId', e.target.value || null)
                        }
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-sm text-[var(--foreground)] bg-[var(--surface)]"
                      >
                        <option value="">-- No content --</option>
                        {contentItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title} ({item.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-[var(--border)]" />
                      <span className="text-xs text-[var(--foreground-tertiary)]">OR</span>
                      <div className="flex-1 h-px bg-[var(--border)]" />
                    </div>

                    {/* Playlist Assignment */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                        Assign Playlist
                      </label>
                      <select
                        value={zone.playlistId || ''}
                        onChange={(e) =>
                          handleZoneAssignment(zone.id, 'playlistId', e.target.value || null)
                        }
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-sm text-[var(--foreground)] bg-[var(--surface)]"
                      >
                        <option value="">-- No playlist --</option>
                        {playlists.map((pl) => (
                          <option key={pl.id} value={pl.id}>
                            {pl.name} ({pl.items?.length || 0} items)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Clear Assignment */}
                    {(zone.contentId || zone.playlistId) && (
                      <button
                        onClick={() => {
                          handleZoneAssignment(zone.id, 'contentId', null);
                          handleZoneAssignment(zone.id, 'playlistId', null);
                        }}
                        className="w-full py-2 text-sm text-red-500 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition flex items-center justify-center gap-2"
                      >
                        <Icon name="close" size="sm" />
                        Clear Assignment
                      </button>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-8">
                <Icon name="content" size="2xl" className="text-[var(--foreground-tertiary)] mx-auto mb-3" />
                <p className="text-sm text-[var(--foreground-secondary)]">
                  Click a zone in the layout to configure it.
                </p>
                <p className="text-xs text-[var(--foreground-tertiary)] mt-1">
                  You can assign content items or playlists to each zone.
                </p>
              </div>
            )}

            {/* Zone Summary */}
            <div className="mt-6 pt-4 border-t border-[var(--border)]">
              <h4 className="text-xs font-semibold text-[var(--foreground-tertiary)] uppercase tracking-wide mb-3">
                All Zones
              </h4>
              <div className="space-y-2">
                {zones.map((zone, idx) => (
                  <button
                    key={zone.id}
                    onClick={() => setSelectedZone(zone.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition text-sm ${
                      selectedZone === zone.id
                        ? 'bg-[#00E5A0]/10 border border-[#00E5A0]/30'
                        : 'hover:bg-[var(--surface-hover)] border border-transparent'
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full ${
                        zone.contentId || zone.playlistId ? 'bg-[#00E5A0]' : 'bg-[var(--border)]'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--foreground)] truncate">{zone.name}</p>
                      <p className="text-xs text-[var(--foreground-tertiary)] truncate">
                        {zone.contentId
                          ? getContentName(zone.contentId)
                          : zone.playlistId
                          ? getPlaylistName(zone.playlistId)
                          : 'Empty'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
