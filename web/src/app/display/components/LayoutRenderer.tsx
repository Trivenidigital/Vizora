'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { LayoutMetadata, LayoutZone, PlaylistItem } from '../lib/types';
import { ContentRenderer } from './ContentRenderer';

interface LayoutRendererProps {
  metadata: LayoutMetadata;
  onError?: (errorType: string, errorMessage: string) => void;
}

export function LayoutRenderer({ metadata, onError }: LayoutRendererProps) {
  const gridStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'grid',
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
    gridTemplateColumns: metadata.gridTemplate?.columns || '1fr',
    gridTemplateRows: metadata.gridTemplate?.rows || '1fr',
    gap: metadata.gap ? `${metadata.gap}px` : undefined,
    backgroundColor: metadata.backgroundColor,
  };

  return (
    <div style={gridStyle}>
      {metadata.zones.map((zone) => (
        <ZonePlayer key={zone.id} zone={zone} onError={onError} />
      ))}
    </div>
  );
}

function ZonePlayer({ zone, onError }: { zone: LayoutZone; onError?: (t: string, m: string) => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const items = zone.resolvedPlaylist?.items;

  const advance = useCallback(() => {
    if (!items?.length) return;
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items]);

  useEffect(() => {
    if (!items?.length) return;
    const item = items[currentIndex % items.length];
    if (!item?.content || item.content.type === 'video') return;

    const duration = (item.duration || item.content.duration || 10) * 1000;
    timerRef.current = setTimeout(advance, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, items, advance]);

  const zoneStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    gridArea: zone.gridArea,
  };

  // Static content (no playlist)
  if (zone.resolvedContent && !items?.length) {
    return (
      <div style={zoneStyle}>
        <ContentRenderer
          type={zone.resolvedContent.type}
          url={zone.resolvedContent.url}
          name={zone.resolvedContent.name}
          onError={onError}
        />
      </div>
    );
  }

  // Playlist zone
  if (!items?.length) return <div style={zoneStyle} />;

  const item = items[currentIndex % items.length];
  if (!item?.content) return <div style={zoneStyle} />;

  return (
    <div style={zoneStyle}>
      <ContentRenderer
        type={item.content.type}
        url={item.content.url}
        name={item.content.name}
        onEnded={advance}
        onError={onError}
      />
    </div>
  );
}
