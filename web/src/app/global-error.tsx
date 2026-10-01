'use client';

/*
 * LITTLE WORLDS, AS LITERALS — and that is forced, not lazy.
 *
 * `global-error.tsx` replaces the ROOT layout when it fires, so it renders its
 * own `<html>` and `<body>` and NO stylesheet is loaded. `globals.css` never
 * reaches this tree, so every `var(--token)` here would resolve to nothing and
 * the page would fall back to the browser's own black-on-white. The values are
 * therefore hand-copied out of `globals.css` `:root`, and each one names the
 * token it was copied from so a palette change can find it with a grep.
 *
 * The design-debt ratchet still counts these five as hex literals. That is
 * correct and no exclusion is added for this file: they ARE duplicated colour
 * values, and the honest record is a counted debt with a reason beside it rather
 * than a metric taught to look away.
 *
 * Computed with `scripts/design/contrast.mjs`:
 *   body text    --foreground on --background            13.61:1
 *   lede         --foreground-secondary on --background   7.36:1
 *   button label --lw-on-forest on --primary              9.70:1
 *   button fill  --primary on --background                9.91:1
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: '#f5f1e8' /* = --background */,
          color: '#23261f' /* = --foreground */,
        }}
      >
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              maxWidth: '28rem',
              width: '100%',
              padding: '2rem',
              textAlign: 'center',
              border: '1px solid rgba(35, 38, 31, 0.14)' /* = --hairline */,
              borderRadius: '0.75rem',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#x26A0;</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>
              Something went wrong!
            </h2>
            <p style={{ color: '#4b5045' /* = --foreground-secondary */, marginBottom: '1.5rem' }}>
              We apologize for the inconvenience. An unexpected error occurred.
            </p>
            <button
              onClick={reset}
              style={{
                backgroundColor: '#1f4230' /* = --primary */,
                color: '#f2efe4' /* = --lw-on-forest */,
                padding: '0.5rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
