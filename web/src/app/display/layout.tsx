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

/*
 * THE LETTERBOX, and it stays black — the one colour on the display route that
 * is NOT converted to a token, deliberately.
 *
 * This fill is what shows around customer media that does not fill the screen:
 * a portrait image on a landscape TV, a 4:3 video, a layout zone with no
 * content. That is the same job a video player's bars do, and pure black is
 * what the job wants — any tint, warm ink included, reads as a colour cast on
 * the customer's own artwork. `tasks/redesign-colour-map.json` freezes it along
 * with `ContentRenderer`, `ContentScreen` and `LayoutRenderer`.
 *
 * `--viewport-bg` is the right ground for Vizora's own chrome on this route
 * (pairing, loading, reconnecting, the status pill) and those have all taken
 * it. It is NOT the right ground here, and the two must not be unified.
 */
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
