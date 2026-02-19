import type { Viewport } from 'next';

export const metadata = {
  title: 'Vizora Display',
  description: 'Web-based Vizora display client',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="display-root"
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#000',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        zIndex: 9999,
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        #display-root * { margin: 0; padding: 0; box-sizing: border-box; }
        body { overflow: hidden !important; }
      `}</style>
      {children}
    </div>
  );
}
