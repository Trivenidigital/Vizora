// `mkt` puts the whole auth surface on the light public palette. As of B2 the
// ValuePanel is light too: it is Vizora's own chrome, not a viewport onto
// customer media, so it follows the settled chrome-goes-light rule. The
// "dark brand panel beside a light form is the intended split" note that used
// to sit here described the Electric Horizon layout and no longer holds.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt min-h-screen bg-[var(--background)]">
      {children}
      {/* Shared footer for all auth pages */}
      {/*
       * The background is BACK, and that is only correct because the panel
       * beside it is now light.
       *
       * History, because all three lessons in it are still live:
       *
       * 1. This bar carried a background utility whose value was a bare CSS
       *    variable with an opacity suffix. Tailwind discards that form
       *    outright — a var holding a whole colour cannot go inside
       *    `rgb(<channels> / <alpha>)` — so the bar was transparent for its
       *    whole life, and the two-column layout came to depend on it: the
       *    dark value panel showed through on the left with no seam.
       *    Restoring it in B0 therefore looked like a fix and rendered as a
       *    regression: an ivory band straight across the dark panel, 57,489 px
       *    at a channel delta of 516. It was reverted.
       *    B2 removes the cause rather than the symptom. With the panel on
       *    `--background-secondary`, an 80% `--background` bar composites to
       *    #f3efe6 over the panel and #f5f1e8 over the form — a difference of
       *    two points, so there is no seam left to avoid.
       *
       * 2. `backdrop-blur-sm` is INDEPENDENT of the background and was never
       *    dead. Dropping it as "decorative along with the translucency" cost
       *    18,853 px at a channel delta of 158 on the register page.
       *
       * 3. A dead `border-*` COLOUR does not remove the border. The bare
       *    `border-t` still applies and Tailwind's default takes over:
       *    `gray.200`, #e5e7eb, a cool grey. This bar drew a cool-grey rule
       *    across a warm ivory page for as long as the bug existed, and it
       *    looked deliberate, so nobody traced it.
       *
       * Footer ink is `--foreground-tertiary`: 5.31:1 on the composite over
       * the panel, 5.41:1 over the form. Both computed.
       *
       * The dead class form is described here, never quoted. Tailwind scans
       * comments as raw text, and an earlier draft of this very comment
       * spelled it out with an ellipsis inside the brackets — Tailwind
       * generated `background-color: var(...)`, one invalid declaration failed
       * the entire stylesheet, and every route in the app returned 500.
       */}
      <footer className="fixed bottom-0 left-0 right-0 py-3 text-center text-[10px] text-[var(--foreground-tertiary)] bg-background/80 backdrop-blur-sm border-t border-border/30">
        <div className="flex items-center justify-center gap-3">
          <a href="/terms" className="hover:text-[var(--foreground-secondary)] transition-colors">Terms of Service</a>
          <span className="text-[var(--border)]">|</span>
          <a href="/privacy" className="hover:text-[var(--foreground-secondary)] transition-colors">Privacy Policy</a>
          <span className="text-[var(--border)]">|</span>
          <a href="mailto:support@vizora.cloud" className="hover:text-[var(--foreground-secondary)] transition-colors">Help</a>
        </div>
      </footer>
    </div>
  );
}
