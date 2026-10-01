'use client';

import { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

/*
 * The QR quiet zone. Machine-readable, so it is deliberately NOT a Little
 * Worlds surface: a QR reader wants maximum luminance separation, and the plate
 * behind the code must be the SAME colour as the code's own background or the
 * quiet zone develops a visible seam that some readers treat as a module. The
 * two values are therefore one decision expressed once and consumed three times
 * — the plate fill, `bgColor` and `fgColor` — rather than three literals that
 * can drift apart.
 *
 * They stay hex because `QRCodeSVG` renders them as SVG presentation
 * attributes, where `var()` does not resolve at all (the same reason
 * `theme/chartConfig.ts` is frozen). 21.00:1.
 */
const QR_LIGHT = '#ffffff';
const QR_DARK = '#000000';

interface PairingScreenProps {
  code: string | null;
  qrCode: string | null;
  error: string | null;
  isPairing: boolean;
  onRequestCode: () => void;
}

export function PairingScreen({ code, qrCode, error, isPairing, onRequestCode }: PairingScreenProps) {
  // Request code on mount
  useEffect(() => {
    if (!code && !isPairing && !error) {
      onRequestCode();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dashboardUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/dashboard/devices/pair`
    : '';

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          {/*
            * The mark is IVORY, not forest. globals.css records that the brand
            * does not work inside a letterbox — `--primary` on `--viewport-bg`
            * is 1.62:1 — and refuses to invent a second brand green for dark
            * grounds. `--accent-brass` would have cleared (5.64:1 here), but it
            * is declared as a light-substrate FILL, so reaching for it on a dark
            * ground is inventing the dark accent globals.css declined to add.
            * Ivory on the ground is 15.71:1.
            *
            * `fill`/`stroke` live in `style` rather than as attributes because
            * `var()` resolves in CSS and not in a presentation attribute.
            */}
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" style={{ fill: 'var(--viewport-ink)' }} />
            <path
              d="M14 24L22 32L34 16"
              style={{ stroke: 'var(--viewport-bg)' }}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h1 style={styles.title}>Vizora Display</h1>
        </div>

        {error && (
          <div style={styles.error}>
            <p>{error}</p>
            <button onClick={onRequestCode} style={styles.retryBtn}>
              Retry
            </button>
          </div>
        )}

        {!code && !error && (
          <div style={styles.loading}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Requesting pairing code...</p>
          </div>
        )}

        {code && (
          <>
            <p style={styles.instruction}>
              Enter this code in the Vizora dashboard to pair this display
            </p>

            <div style={styles.codeContainer}>
              {code.split('').map((char, i) => (
                <span key={i} style={styles.codeChar}>{char}</span>
              ))}
            </div>

            <div style={styles.qrSection}>
              {qrCode ? (
                <img src={qrCode} alt="QR Code" style={styles.qrImg} />
              ) : dashboardUrl ? (
                <QRCodeSVG
                  value={`${dashboardUrl}?code=${code}`}
                  size={180}
                  bgColor={QR_LIGHT}
                  fgColor={QR_DARK}
                  level="M"
                />
              ) : null}
              <p style={styles.qrHint}>
                Or scan QR code to pair from your phone
              </p>
            </div>

            <p style={styles.footer}>
              Go to <strong>Dashboard → Devices → Pair</strong> and enter the code above
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/*
 * A VIEWPORT, not dashboard chrome — so it stays dark while the product goes
 * light, and takes the `--viewport-*` tokens so the darkness is a recorded
 * decision rather than debt a later pass tries to "fix". This screen idles
 * overnight on a TV in a venue; a full-screen ivory rectangle at 3am in a dark
 * room is a customer-visible problem, not a style choice.
 *
 * THREE PLANES, and the code is punched back down to the deepest one. The page
 * is `--viewport-bg`, the card lifts to `--viewport-surface`, and each code tile
 * recesses to `--viewport-bg` again — a well in the card, which is both the
 * strongest ground available for the one element that has to be read from
 * across a room and the reason the tiles need no fill of their own.
 *
 * Computed with `scripts/design/contrast.mjs`, against the real ground in each
 * case:
 *   pairing CODE   --viewport-ink on --viewport-bg (the tile)    15.71:1
 *   title          --viewport-ink on --viewport-surface          13.33:1
 *   instruction    --viewport-ink-muted on --viewport-surface     6.58:1
 *   footer         same pair                                     6.58:1
 *   retry label    --viewport-bg on --viewport-ink               15.71:1
 *   error text     --error-lighter on --viewport-surface         10.61:1
 *   QR hint        --foreground-secondary on the white plate      8.29:1
 *
 * The card plane itself is 1.18:1 on the page and its hairline 1.46:1. Both are
 * correct and deliberate: the card is a GROUPING device, not a control
 * boundary, which is the same reading globals.css already records for
 * `--viewport-border` on the letterbox.
 */
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    /*
     * FLAT, where this was a three-stop gradient. Its mid stop sat at the
     * centre of the screen, which is exactly where the card sits, so carrying
     * the gradient over to the tokens would have painted the card's own fill
     * directly behind the card and erased it. The plane stack above carries the
     * depth the gradient was there for.
     */
    background: 'var(--viewport-bg)',
    padding: '2rem',
  },
  card: {
    background: 'var(--viewport-surface)',
    borderRadius: '24px',
    padding: '3rem',
    maxWidth: '480px',
    width: '100%',
    textAlign: 'center' as const,
    border: '1px solid var(--viewport-border)',
  },
  logo: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '2rem',
  },
  title: {
    color: 'var(--viewport-ink)',
    fontSize: '1.5rem',
    fontWeight: 600,
    margin: 0,
  },
  instruction: {
    color: 'var(--viewport-ink-muted)',
    fontSize: '1rem',
    lineHeight: 1.5,
    marginBottom: '2rem',
  },
  codeContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.5rem',
    marginBottom: '2rem',
  },
  codeChar: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '56px',
    height: '68px',
    background: 'var(--viewport-bg)',
    border: '2px solid var(--viewport-border)',
    borderRadius: '12px',
    color: 'var(--viewport-ink)',
    fontSize: '2rem',
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  qrSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '2rem',
    padding: '1.5rem',
    background: QR_LIGHT,
    borderRadius: '16px',
    width: 'fit-content',
    margin: '0 auto 2rem auto',
  },
  qrImg: {
    width: '180px',
    height: '180px',
  },
  qrHint: {
    /* On the white QR plate, not on the card — so this takes the LIGHT-ground ink. */
    color: 'var(--foreground-secondary)',
    fontSize: '0.8rem',
    margin: 0,
  },
  footer: {
    color: 'var(--viewport-ink-muted)',
    fontSize: '0.85rem',
    lineHeight: 1.5,
  },
  error: {
    /*
     * `--error-lighter`, not `--error-ink` and not `--error-light`. The
     * light-ground ink is 2.37:1 on this card, and `--error-light` is 4.08:1 —
     * past the 3:1 a graphic needs but short of the 4.5:1 this paragraph needs.
     * The family is preserved; only the step moves.
     */
    color: 'var(--error-lighter)',
    marginBottom: '1rem',
  },
  retryBtn: {
    marginTop: '0.5rem',
    padding: '0.5rem 1.5rem',
    /*
     * The one primary action on a dark ground, so it is an IVORY fill with the
     * page ink on it. There is no brand fill available here — see the logo note
     * above — and a bordered ghost button is the wrong weight for the only
     * control on an error state.
     */
    background: 'var(--viewport-ink)',
    color: 'var(--viewport-bg)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '1rem',
    padding: '2rem 0',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid var(--viewport-border)',
    borderTopColor: 'var(--viewport-ink)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: 'var(--viewport-ink-muted)',
    fontSize: '0.95rem',
  },
};
