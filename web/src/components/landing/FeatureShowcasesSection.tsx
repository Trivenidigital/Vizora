'use client';

import {
  Radio,
  FolderOpen,
  CalendarClock,
  Check,
  FileCheck,
} from 'lucide-react';
import { Reveal, scrollTo } from './shared';

interface FeatureShowcasesSectionProps {
  activeFeatureTab: string;
}

export default function FeatureShowcasesSection({ activeFeatureTab }: FeatureShowcasesSectionProps) {
  return (
    <section id="features" className="py-16 sm:py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.15em] mb-4 px-3 py-1 rounded-full"
              style={{ color: '#00E5A0', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.15)' }}>
              Platform
            </span>
            <h2 className="eh-heading text-3xl sm:text-4xl font-bold mb-4">
              Complete control over
              <br />
              <span className="eh-gradient">every screen</span>
            </h2>
            <p style={{ color: '#9A958E' }} className="max-w-lg mx-auto">
              From content creation to fleet monitoring, Vizora gives you full
              command of every display in your organization.
            </p>
          </div>
        </Reveal>

        {/* Feature Tab Navigation */}
        <div className="sticky top-16 z-20 -mx-6 px-6 py-3 mb-8" style={{
          background: 'rgba(6, 26, 33, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(27,61,71,0.5)',
        }}>
          <div className="flex items-center justify-center gap-2">
            {[
              { id: 'realtime', label: 'Real-time Control', icon: Radio },
              { id: 'content', label: 'Content Management', icon: FolderOpen },
              { id: 'scheduling', label: 'Scheduling & Analytics', icon: CalendarClock },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => scrollTo(`feature-${tab.id}`)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200"
                style={activeFeatureTab === tab.id ? {
                  background: 'rgba(0,229,160,0.12)',
                  color: '#00E5A0',
                  border: '1px solid rgba(0,229,160,0.25)',
                  boxShadow: '0 0 12px rgba(0,229,160,0.06)',
                } : {
                  background: 'transparent',
                  color: '#9A958E',
                  border: '1px solid transparent',
                }}
              >
                <tab.icon size={14} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Showcase 1: Real-time Fleet Command */}
        <div id="feature-realtime" className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-28 scroll-mt-32">
          <Reveal>
            <div>
              <div className="inline-flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,229,160,0.1)' }}>
                  <Radio size={16} style={{ color: '#00E5A0' }} />
                </div>
                <span className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: '#00E5A0' }}>Real-time Control</span>
              </div>
              <h3 className="eh-heading text-2xl sm:text-3xl font-bold mb-4">
                Live fleet command center
              </h3>
              <p className="text-[0.95rem] leading-relaxed mb-6" style={{ color: '#9A958E' }}>
                See every screen&apos;s status the instant it changes. Push content, reboot
                devices, and respond to issues in real-time through persistent WebSocket
                connections &mdash; not polling.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  'Instant status updates via WebSocket',
                  'Remote device control and diagnostics',
                  'Automatic offline alerts and recovery',
                  'Live content preview across all screens',
                  'Predictive fleet monitoring — AI detects issues early',
                  'AI-powered auto-recovery for self-healing networks',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: '#9A958E' }}>
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#00E5A0' }} />
                    {item}
                  </li>
                ))}
              </ul>
              {/* Integrated capability tags */}
              <div className="flex flex-wrap gap-2">
                {['Display Groups', 'Device Preview', 'Multi-Platform'].map((tag) => (
                  <span key={tag} className="text-[0.7rem] font-medium px-2.5 py-1 rounded-full"
                    style={{ color: '#9A958E', background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.1)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div className="eh-card rounded-xl p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-sora), sans-serif' }}>Fleet Status</span>
                <span className="text-[0.65rem] px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,229,160,0.1)', color: '#00E5A0' }}>
                  Live
                </span>
              </div>
              <div className="space-y-2.5">
                {[
                  { name: 'NYC — Times Square', status: 'online', latency: '12ms', content: 'Brand Campaign' },
                  { name: 'LA — Beverly Hills', status: 'online', latency: '18ms', content: 'Product Launch' },
                  { name: 'CHI — Michigan Ave', status: 'online', latency: '22ms', content: 'Holiday Promo' },
                  { name: 'MIA — Ocean Drive', status: 'updating', latency: '45ms', content: 'Deploying...' },
                  { name: 'SEA — Pike Place', status: 'offline', latency: '—', content: 'Maintenance' },
                ].map((device) => (
                  <div
                    key={device.name}
                    className="flex items-center gap-3 p-2.5 rounded-lg"
                    style={{
                      background: '#061A21',
                      border: '1px solid #1B3D47',
                      animation: device.status === 'updating' ? 'eh-status-cycle 4s ease-in-out infinite' : undefined,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={device.status === 'online' ? {
                        background: '#00E5A0',
                        boxShadow: '0 0 6px rgba(0,229,160,0.3)',
                        animation: 'eh-neon-pulse 2s ease-in-out infinite',
                      } : device.status === 'updating' ? {
                        background: '#00B4D8',
                        boxShadow: '0 0 6px rgba(0,180,216,0.3)',
                        animation: 'eh-neon-pulse 1s ease-in-out infinite',
                      } : { background: '#FF4D6A' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.75rem] font-medium truncate">{device.name}</div>
                      <div className="text-[0.6rem]" style={{ color: '#6B655D', fontFamily: 'var(--font-mono), monospace' }}>
                        {device.content}
                      </div>
                    </div>
                    <div className="text-[0.6rem] font-medium" style={{
                      color: device.status === 'online' ? '#00E5A0' : device.status === 'updating' ? '#00B4D8' : '#FF4D6A',
                      fontFamily: 'var(--font-mono), monospace',
                    }}>
                      {device.latency}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {/* Showcase 2: Content Management (reversed) */}
        <div id="feature-content" className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-28 scroll-mt-32">
          <Reveal delay={150} className="order-2 lg:order-1">
            <div className="eh-card rounded-xl p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-sora), sans-serif' }}>Content Library</span>
                <span className="text-[0.65rem]" style={{ color: '#6B655D', fontFamily: 'var(--font-mono), monospace' }}>
                  324 items &bull; 12.4 GB
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: 'Images', count: '186', color: '#00E5A0' },
                  { label: 'Videos', count: '89', color: '#00B4D8' },
                  { label: 'HTML', count: '49', color: '#8B5CF6' },
                ].map((type) => (
                  <div key={type.label} className="rounded-lg p-2.5 text-center" style={{ background: '#061A21', border: '1px solid #1B3D47' }}>
                    <div className="text-lg font-bold" style={{ color: type.color, fontFamily: 'var(--font-mono), monospace' }}>{type.count}</div>
                    <div className="text-[0.6rem]" style={{ color: '#6B655D' }}>{type.label}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                {[
                  { name: 'holiday-campaign-v3.mp4', size: '48.2 MB', type: 'video', verified: true },
                  { name: 'store-promo-banner.png', size: '2.1 MB', type: 'image', verified: true },
                  { name: 'live-dashboard.html', size: '12 KB', type: 'html', verified: true },
                  { name: 'menu-board-template.html', size: '8.4 KB', type: 'html', verified: true },
                ].map((file) => (
                  <div key={file.name} className="flex items-center gap-2.5 p-2 rounded" style={{ background: '#061A21' }}>
                    <div className="w-7 h-7 rounded flex items-center justify-center text-[0.55rem] font-bold"
                      style={{
                        background: file.type === 'video' ? 'rgba(0,180,216,0.12)' : file.type === 'html' ? 'rgba(139,92,246,0.12)' : 'rgba(0,229,160,0.12)',
                        color: file.type === 'video' ? '#00B4D8' : file.type === 'html' ? '#8B5CF6' : '#00E5A0',
                      }}
                    >
                      {file.type === 'video' ? 'MP4' : file.type === 'html' ? 'HTM' : 'PNG'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.72rem] font-medium truncate">{file.name}</div>
                      <div className="text-[0.55rem]" style={{ color: '#6B655D' }}>{file.size}</div>
                    </div>
                    {file.verified && (
                      <FileCheck size={13} style={{ color: '#00E5A0', opacity: 0.6 }} />
                    )}
                  </div>
                ))}
              </div>
              {/* Upload progress bar animation */}
              <div className="mt-3 p-2 rounded" style={{ background: '#061A21', border: '1px solid #1B3D47' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[0.6rem] font-medium" style={{ color: '#9A958E' }}>Uploading promo-reel-q4.mp4</span>
                  <span className="text-[0.55rem]" style={{ color: '#00B4D8', fontFamily: 'var(--font-mono), monospace' }}>67%</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: '#1B3D47' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: '67%',
                      background: 'linear-gradient(90deg, #00B4D8, #00E5A0)',
                      animation: 'eh-subtle-pulse 2s ease-in-out infinite',
                    }}
                  />
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal className="order-1 lg:order-2">
            <div>
              <div className="inline-flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,180,216,0.1)' }}>
                  <FolderOpen size={16} style={{ color: '#00B4D8' }} />
                </div>
                <span className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: '#00B4D8' }}>Content</span>
              </div>
              <h3 className="eh-heading text-2xl sm:text-3xl font-bold mb-4">
                Smart content management
              </h3>
              <p className="text-[0.95rem] leading-relaxed mb-6" style={{ color: '#9A958E' }}>
                Upload any media type &mdash; images, videos, URLs, or interactive HTML.
                Vizora validates every file at the binary level to prevent
                MIME spoofing and ensure only safe content reaches your screens.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  'Drag-and-drop upload with folder organization',
                  'Magic number validation blocks spoofed files',
                  'Handlebars template engine for dynamic content',
                  'Automatic expiration with replacement content',
                  'AI content generation from text prompts',
                  'Intelligent format optimization for any screen',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: '#9A958E' }}>
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#00B4D8' }} />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {['Playlist Builder', 'API & Webhooks'].map((tag) => (
                  <span key={tag} className="text-[0.7rem] font-medium px-2.5 py-1 rounded-full"
                    style={{ color: '#9A958E', background: 'rgba(0,180,216,0.06)', border: '1px solid rgba(0,180,216,0.1)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {/* Showcase 3: Scheduling & Analytics */}
        <div id="feature-scheduling" className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center scroll-mt-32">
          <Reveal>
            <div>
              <div className="inline-flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.1)' }}>
                  <CalendarClock size={16} style={{ color: '#8B5CF6' }} />
                </div>
                <span className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: '#8B5CF6' }}>Scheduling</span>
              </div>
              <h3 className="eh-heading text-2xl sm:text-3xl font-bold mb-4">
                Schedule with precision
              </h3>
              <p className="text-[0.95rem] leading-relaxed mb-6" style={{ color: '#9A958E' }}>
                Build playlists, set timezone-aware schedules, and target specific
                devices or groups. Preview the next 10 occurrences before
                committing. Content always plays where and when it should.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  'Timezone-aware scheduling across regions',
                  'Drag-and-drop playlist builder with undo/redo',
                  'Device groups and location-based targeting',
                  'Analytics dashboard with CSV export',
                  'AI-optimized time slot suggestions',
                  'Performance-driven auto-scheduling',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: '#9A958E' }}>
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#8B5CF6' }} />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {['Analytics', 'CSV Export'].map((tag) => (
                  <span key={tag} className="text-[0.7rem] font-medium px-2.5 py-1 rounded-full"
                    style={{ color: '#9A958E', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.1)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div className="eh-card rounded-xl p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-sora), sans-serif' }}>Weekly Schedule</span>
                <span className="text-[0.65rem]" style={{ color: '#6B655D', fontFamily: 'var(--font-mono), monospace' }}>
                  3 playlists active
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-3">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                  <div key={day} className="text-center">
                    <div className="text-[0.55rem] font-medium mb-1.5" style={{ color: '#6B655D' }}>{day}</div>
                    <div className="space-y-1">
                      <div className="h-3 rounded-sm" style={{ background: 'rgba(0,229,160,0.2)', border: '1px solid rgba(0,229,160,0.15)' }} />
                      {i < 5 && <div className="h-3 rounded-sm" style={{ background: 'rgba(0,180,216,0.2)', border: '1px solid rgba(0,180,216,0.15)' }} />}
                      {(i === 5 || i === 6) && <div className="h-3 rounded-sm" style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.15)' }} />}
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {[
                  { name: 'Morning Greetings', time: '06:00 – 10:00', color: '#00E5A0', devices: '12 screens' },
                  { name: 'Product Showcase', time: '10:00 – 18:00', color: '#00B4D8', devices: '24 screens' },
                  { name: 'Weekend Special', time: 'Sat–Sun all day', color: '#8B5CF6', devices: '8 screens' },
                ].map((playlist) => (
                  <div key={playlist.name} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: '#061A21', border: '1px solid #1B3D47' }}>
                    <div className="w-1 h-8 rounded-full" style={{ background: playlist.color }} />
                    <div className="flex-1">
                      <div className="text-[0.75rem] font-medium">{playlist.name}</div>
                      <div className="text-[0.6rem]" style={{ color: '#6B655D', fontFamily: 'var(--font-mono), monospace' }}>
                        {playlist.time}
                      </div>
                    </div>
                    <span className="text-[0.6rem]" style={{ color: '#6B655D' }}>{playlist.devices}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
