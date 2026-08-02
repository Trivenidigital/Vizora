# Session handoff — 2026-08-02

**Headline: the marketing site was rebranded dark → light and is LIVE on https://vizora.cloud.**
Prod HEAD moved `a0fe01f2` → `56a48e5d`. Local `main` is `1299676d`, pushed.

---

## 1. What shipped to production

The public marketing surface is now light ("Electric Horizon on a light substrate"). The **dashboard and auth-app remain dark** — that was protected by construction, not by testing (see §3).

| Area | State |
|---|---|
| `/` homepage | Rebranded: new hero, "How it resolves" section, platform/AI/solutions/security/pricing/FAQ |
| `/privacy` `/terms` `/refund` `/sla` `/backlog` | Light |
| `/login` `/register` `/forgot-password` `/reset-password` | Light form beside a deliberately dark `ValuePanel` |
| Dashboard + admin | **Unchanged, still dark** |

Deployed via the OOM-safe sequence (prod is a 3.8G box; a `web` build there previously OOM'd it):
1. `docker stop vizora-clickhouse` (freed ~400MB)
2. `git pull --ff-only origin main`
3. `pnpm install --frozen-lockfile`
4. build **detached**, `NODE_OPTIONS=--max-old-space-size=2048` (**not** 4096), log to `/tmp/webbuild.log`, poll
5. `docker start vizora-clickhouse`
6. `NODE_ENV=production pm2 reload ecosystem.config.js --only vizora-web --env production`

Verify from the box's own self-curl, not from the dev machine.

## 2. Commits

| Commit | What |
|---|---|
| `4ed79d69` | Design studies A/B/C + chooser |
| `73156988` | Sample D (hybrid) |
| `62020fa1` | Full static homepage mockup + `design-samples/HANDOFF.md` |
| `81eba613` | **Homepage rebrand in the React app** |
| `11ead5f6` | **Legal + auth light scope; `.nxignore`** |
| `56a48e5d` | Merge to main (deployed) |
| `1299676d` | Prod screenshot |

Design artifacts live in `design-samples/` — four studies, the full mockup, `HANDOFF.md` (section→component map, token map), and `previews/live/` screenshots of the deployed result.

## 3. The one architectural thing to understand

`.eh-btn-neon`, `.eh-card`, `.eh-gradient`, `.eh-heading`, `.eh-reveal` are **shared between the marketing page and the dashboard/auth app** (`.eh-gradient` alone has 10 consumers, including `app/dashboard/layout.tsx`). Recolouring them in place silently breaks the logged-in app.

Instead `globals.css` defines a **`.mkt` scope** that (a) declares `--mkt-*` tokens, (b) re-tunes those shared utilities *only under `.mkt`*, and (c) resets the base token family (`--background`/`--surface`/`--foreground*`/`--border`/`--primary`). `page.tsx`, the 5 legal wrappers and `(auth)/layout.tsx` carry `className="mkt"`.

Consequences:
- Components shared with the dark app (`MfaEnrollFlow`, `admin/backlog/page-client`) needed **no edit** — they read those tokens, so they render light inside `.mkt` and dark elsewhere.
- `ValuePanel` is deliberately dark *inside* the light scope, so it carries `.mkt-dark-panel`, an escape hatch restoring the dark tokens locally.
- **Never recolour the unscoped `.eh-*` rules to change marketing appearance.**

Colour rule: neon `#00E5A0` is 1.8:1 on `#E9EEEF`. **Fills and glows only — never text, never borders.** Text uses `--mkt-mint-ink` / `--mkt-cyan-ink` / `--mkt-violet-ink` / `--mkt-amber-ink`. Body prose `--mkt-ink-2`; `--mkt-muted` for micro labels only; interactive links `--mkt-ink-2`.

## 4. Open items

1. **Off-machine disaster recovery.** Both preservation sets are on C:. Covers accidental deletion, not drive loss. The only external drive (D:) is 94% full and holds personal data — Sri declined it. Needs a destination.
2. **`.claude/worktrees/agent-ad415ba83a2bfef40`** — 1.4G, deregistered, content fully preserved. `rm -rf` was **denied by the permission layer**. That denial stands; do **not** work around it or ask a human to run it to bypass. Deferred disk cleanup only, not a blocker.
3. **Cookie banner** renders from `layout.tsx` on every page incl. the dark dashboard, so it stays dark by design. Change needs a decision about how it should look over the dark app.
4. **`DemoVideoSection` / `TestimonialsSection`** still dark, currently unmounted. They'd surface as a bug the moment anyone renders them. `TestimonialsSection` also contains three named customer quotes — **verify they're real and attributable before publishing**.
5. **Product screenshot.** The homepage still uses a CSS-built dashboard mock. The repo's real captures are an empty demo tenant (0 devices/content/playlists, red "1 Issue" badge) and are unusable. Capturing a populated dashboard is the highest-value remaining improvement — for signage, the product shot *is* the proof.
6. **Branch sprawl** — 216 local branches, mostly stale "readiness pass N" work. Not pruned; see §5 for why naive pruning is unsafe here.

## 5. Traps that cost real rework — read before touching this area

1. **Tailwind arbitrary values need a type hint.** `text-[var(--mkt-ink)]` compiles to **nothing** on this Tailwind version — colour vs length is ambiguous, the class silently vanishes, the element renders unstyled. It passes typecheck *and* a colour-literal grep. Use `text-[color:var(--mkt-ink)]`.
2. **Inline `style` beats scoped classes.** Several components carried dark-mode `boxShadow`/`border`/`background` inline that overrode the corrected `.mkt .eh-*` rules — e.g. a neon halo still glowing on the light CTA button.
3. **CRLF makes `diff` lie.** `git show <rev>:<f>` emits LF; the working file has CRLF. Use `git hash-object --path="<repo-relative-path>" <file>` — the `--path` matters, it selects the attributes/clean filters.
4. **MSYS mangles `[` `]` paths.** `git hash-object` reports "No such file" on existing `[id]` route files. Use a `C:/`-style path or `--stdin`.
5. **`git bundle --not --remotes=origin` silently drops refs** already reachable from origin (dropped 11 of 64). Bundle explicit refs and reconcile `list-heads` against a manifest.
6. **On a squash-merging repo, `git rev-list --count main..branch` and `git diff main...branch` are both wrong** for "is this merged". Use `merge-base --is-ancestor`.
7. **`du` overstates reclaim under pnpm hardlinks** — three dirs reporting 1.4G each freed ~1.3G total. Report `df` before/after.
8. **`git worktree remove` deregisters even when the directory delete fails** ("Directory not empty" on Windows). Check registry *and* filesystem.
9. **`overflow-x: hidden` hides clipping.** `scrollWidth - clientWidth === 0` cannot detect an element sliced off at the viewport edge. Measure the element's own spill against its content column.
10. **3D projections run ~1.37× wider than their layout box** (`rotateX`+`rotateZ`+`translateZ`). Size for the projection: `min(58vw, 380px, 72%)`.
11. **`npx nx <target>` was failing repo-wide** because agent worktrees duplicated project names. Fixed non-destructively via `.nxignore`.

## 6. Preservation — do not delete

`C:/projects/vizora-preservation-2026-08-02/` and `C:/vizora-backups/vizora-preservation-2026-08-02/` (12 artifacts each, checksums clean): 74-ref bundle, full `.git` archive, orphan tree archive, 3 raw dirty-file archives, ignored-files archive, `SHA256SUMS.txt`.

In-repo refs: `refs/preserve/stash/00..06` (7 pre-existing stashes) and `refs/preserve/worktree/agent-*` ×3 — restore with `git stash apply --index <sha>`.

`feat/design-explorations` — **NEVER merge or deploy** (standing rule; parked deliberately).

Unauthorized: branch pruning, stash deletion, preservation-ref deletion, reflog expiration, object pruning, `gc`, archive removal.

## 7. Invariants at handoff

registered worktrees **7** · `refs/preserve/*` **10** · local branches **216** · stashes **10** (7 original + 3 captures) · HEAD `1299676d` · tracked tree clean · prod `56a48e5d` live and verified.

## 8. Security note

A production admin password was pasted into the session transcript on 2026-08-02 and **has not been rotated**. It should be, along with enabling the TOTP MFA shipped in #254.
