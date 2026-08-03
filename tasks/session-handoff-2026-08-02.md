# Session handoff — 2026-08-02

> **STATUS 2026-08-03: every open item below is CLOSED.** Production moved
> `56a48e5d` → `0aaba06c` (PRs #257–#267). Items 3, 4 and 5 in §4 shipped; item 2
> is accepted permission-blocked residue; items 1 and 6 remain owner decisions.
> §8's security note is superseded — the credential was rotated 2026-08-02.
> See `backlog.md` (2026-08-03 completed section) and `tasks/lessons.md`.

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
3. ~~**Cookie banner**~~ — **DONE (#257).** Context-aware via `body:has(.mkt) .consent-bar`: light on marketing/auth, unchanged dark in the app. Consent behaviour byte-identical.
4. ~~**`DemoVideoSection` / `TestimonialsSection`** still dark~~ — **DONE (#257).** Both converted to `--mkt-*` tokens. `TestimonialsSection` **remains unmounted** with a DO-NOT-MOUNT banner; its three named quotes and "4.9/5 from 200+ reviews" are still unverified and must not be published.
5. ~~**Product screenshot**~~ — **DONE (#257).** Real capture of the running app against a synthetic demo tenant, reproducible via `scripts/marketing/`. The red "1 Issue" badge that made earlier captures unusable was the **Next.js dev-tools overlay**, never product state — it does not exist in a production build.
6. **Branch sprawl** — 216 local branches, mostly stale "readiness pass N" work. Not pruned; see §5 for why naive pruning is unsafe here.

## 5. Traps that cost real rework — read before touching this area

1. ~~**Tailwind arbitrary values need a type hint.** `text-[var(--mkt-ink)]` compiles to **nothing** on this Tailwind version.~~ **RETRACTED 2026-08-02 — this was false.** Disproved twice on the pinned **tailwindcss 3.4.19**: an isolated probe, and the real production bundle, which contains `.text-\[var\(--foreground-tertiary\)\]{color:var(--foreground-tertiary)}`. A bare `var()` resolves to the colour type for `text-` / `bg-` / `border-` / `ring-` / `ring-offset-` / `decoration-` alike. The `text-[color:var(--x)]` form is still fine as *explicit typing*, but it is not a bug fix — and the app already has ~40 bare call sites (`FormField.tsx`, `MfaChallengeForm.tsx`, …) that render correctly. **Do not "fix" them.** If a token-coloured element really does render unstyled, the cause is trap 12 below.

   **But do not over-correct either — the inference is namespace-specific.** Tailwind's `dataTypes.color` returns true for anything starting with `var(`, while `dataTypes.length` accepts only unit-numbers and `calc/min/max/clamp`, so inside *colour* namespaces (`text-` `bg-` `border-` `ring-` `ring-offset-` `decoration-`) a bare `var()` can only land on colour. **Outside them it can silently pick the wrong property.** Live example on `main` right now: `font-[var(--font-sora)]` compiles to `font-weight: var(--font-sora)`, which is invalid and dropped — the Sora face never applies at 35 call sites (`font-[family-name:var(--font-sora)]` is the correct form). Same shape for `border-[var(--w)]` meant as a width, and `shadow-[var(--x)]`.

   *(Cost of the original claim: it was propagated into code comments and a commit message before being checked. See PR #257 / `636ec38c`.)*
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
12. **A hand-written class defined AFTER `@tailwind utilities` beats a utility setting the SAME property.** This is the real silent-styling trap — the one trap 1 was mistaken for. `globals.css` puts `@tailwind utilities` at line 3 and hand-written classes hundreds of lines later; both are single-class selectors, so **source order decides**. `.eh-input`'s `padding: 10px 16px` therefore beat `pl-10`, and the search glyph rendered on top of the placeholder in *every* dashboard `SearchFilter`. (Only same-property collisions are affected — `mt-4` on an `.eh-input` is fine.) Fix with `!pl-10`. Moving the rule into `@layer components` also works but has a cost worth knowing: layered classes become purgeable, so a class absent from scanned content emits nothing, and companions like `.eh-input:focus` / `::placeholder` must move with it. Suspect this whenever a utility "does nothing" on an element that also carries an `.eh-*` class. (Fixed for `SearchFilter` in PR #257.)

## 6. Preservation — do not delete

`C:/projects/vizora-preservation-2026-08-02/` and `C:/vizora-backups/vizora-preservation-2026-08-02/` (12 artifacts each, checksums clean): 74-ref bundle, full `.git` archive, orphan tree archive, 3 raw dirty-file archives, ignored-files archive, `SHA256SUMS.txt`.

In-repo refs: `refs/preserve/stash/00..06` (7 pre-existing stashes) and `refs/preserve/worktree/agent-*` ×3 — restore with `git stash apply --index <sha>`.

`feat/design-explorations` — **NEVER merge or deploy** (standing rule; parked deliberately).

Unauthorized: branch pruning, stash deletion, preservation-ref deletion, reflog expiration, object pruning, `gc`, archive removal.

## 7. Invariants at handoff

registered worktrees **7** · `refs/preserve/*` **10** · local branches **216** · stashes **10** (7 original + 3 captures) · HEAD `1299676d` · tracked tree clean · prod `56a48e5d` live and verified.

## 8. Security note — SUPERSEDED 2026-08-02

~~A production admin password was pasted into the session transcript and has not been rotated.~~
**Rotated 2026-08-02** through the app's own change-password path (the new secret never entered a
transcript). 8,354 refresh tokens revoked; no evidence of misuse — zero non-loopback logins after the
exposure. Note `VALIDATOR_EMAIL` **is** the platform's only super-admin, so the ops agents run with
full super-admin rights; rotating it requires `pm2 restart --update-env` or four agents 401 silently.
TOTP enrollment remains deliberately deferred by the owner while this is a test bed.
