// `mkt` puts the whole auth surface on the light public palette. The ValuePanel
// keeps its own hardcoded dark brand panel deliberately — a dark brand panel
// beside a light form is the intended split.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt min-h-screen bg-[var(--background)]">
      {children}
      {/* Shared footer for all auth pages */}
      {/*
       * Deliberately has NO background, and that is not an oversight.
       *
       * This bar used to carry an arbitrary-var background at 80% opacity —
       * a background utility whose value was a bare CSS variable, with an
       * opacity suffix after it — plus `backdrop-blur-sm`. The class is NOT
       * written out anywhere in this file, in any form, for the reason in the
       * last paragraph: an earlier draft of this very comment spelled it out
       * with an ellipsis inside the brackets, Tailwind scanned the comment,
       * generated `background-color: var(...)`, and that invalid declaration
       * failed the whole stylesheet to parse — a 500 on every route in the
       * app, from a comment explaining how not to break things.
       * Tailwind silently discarded it: a var holding a whole colour cannot go
       * in `rgb(<channels> / <alpha>)`. So the bar has always been
       * transparent, and the two-column auth layout came to depend on that:
       * the dark value panel shows through on the left, the ivory form on the
       * right, with no seam.
       *
       * Converting it to the working `bg-background/80` during B0 restored the
       * author's original intent and introduced a visible regression — an
       * ivory band painted straight across the dark panel, 57,489 px at a
       * channel delta of 516. The screenshot caught it; the no-var-opacity
       * gate could not, because a dead declaration and a correctly-working one
       * are indistinguishable to a lint rule. Only a render knows which of the
       * two the design is relying on.
       *
       * `backdrop-blur-sm` STAYS. Only the background was dead — a backdrop
       * filter needs no background to work, and this one has been blurring
       * what sits behind the bar all along. Dropping it as "decorative along
       * with the translucency" cost 18,853 px at a channel delta of 158 on
       * the register page, which is how I learned the two were independent.
       *
       * The BORDER was dead for the same reason, but it was not INVISIBLE, and
       * I described it wrongly at first. A dead `border-*` colour does not
       * remove the border — the bare `border-t` utility still applies and
       * Tailwind's default border colour takes over: `gray.200`, #e5e7eb, a
       * COOL grey. So this bar has been drawing a cool-grey rule across a warm
       * ivory page all along, which looked deliberate and therefore went
       * untraced. `border-border/30` now paints it warm. That is the only
       * remaining pixel difference against the Phase 2 baseline, and it is a
       * correction, not merely a restoration.
       *
       * Finally: the dead form is described above rather than quoted, because
       * the gate test scans raw file text and correctly flagged my first draft
       * of this comment as an offence. Tailwind scans comments the same way —
       * a class literal written in prose is still a class literal to both.
       */}
      <footer className="fixed bottom-0 left-0 right-0 py-3 text-center text-[10px] text-[var(--foreground-tertiary)] backdrop-blur-sm border-t border-border/30">
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
