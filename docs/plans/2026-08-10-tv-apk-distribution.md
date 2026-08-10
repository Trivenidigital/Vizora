# Vizora Display — customer APK distribution (`/tv`)

**Status:** implemented, **NOT deployed**. Publishing is blocked on two open
release gates (§6). Nothing in this change touches a running production service.

**Scope:** a bounded customer-pilot distribution surface. Two permanent URLs:

| URL | Serves |
|---|---|
| `https://vizora.cloud/tv` | Static installer page (version + SHA-256 + instructions) |
| `https://vizora.cloud/downloads/vizora-display.apk` | The current approved APK |

Both stay unchanged for every future version. GitHub remains the release
archive; `vizora.cloud/tv` is the customer-facing installer.

---

## 1. Why direct hosting, not a GitHub redirect

GitHub release asset URLs 302 to `objects.githubusercontent.com` with signed,
expiring query strings. Android TV browsers and the Downloader app handle that
badly. Serving the bytes from our own origin removes the redirect entirely.

## 2. Why `/tv` is a static file and not a Next.js route

A Next.js route would force a full `web` rebuild to change one line of version
text. That build has OOM'd the 3.7GB production VPS before, and the documented
safe procedure (stop ClickHouse → build detached at `--max-old-space-size=2048`
→ restart) is an absurd cost for editing a version string.

A static file is a copy with no rebuild. It also genuinely delivers the
"no framework JavaScript" property the installer page needs — an App Router page
ships a JS bundle even for static content, and these pages run on 2018-era TV
WebViews.

The source of truth stays in git; the server holds a copy.

## 3. Files

| Path | Role |
|---|---|
| `deploy/tv/index.html.template` | Installer page source. **Edit this**, never the rendered file. |
| `deploy/tv/index.html` | Generated. Committed because it is what gets uploaded. |
| `deploy/tv/release.json` | Verified artifact facts + the two approval gates. |
| `deploy/nginx/vizora-tv-downloads.conf` | The `/tv` + `/downloads/` location blocks. |
| `scripts/release/verify-display-apk.mjs` | Deterministic release gate (steps 1-5, 7). |
| `scripts/release/render-tv-page.mjs` | Renders the page from `release.json`. |
| `scripts/release/publish-display-apk.sh` | The single atomic publish operation. |
| `scripts/ops/health-guardian.ts` | Install-surface watchdog (opt-in). |

## 4. Server layout

```
/var/www/vizora/
├── tv/index.html                        -> https://vizora.cloud/tv
├── downloads/vizora-display.apk         -> https://vizora.cloud/downloads/...
└── archive/                             NOT web-served (sibling, not child)
    └── vizora-display-1.3.10-release.apk
```

The archive is a **sibling** of `downloads/`. Putting it underneath would make
every superseded build publicly fetchable by direct URL — `autoindex off` hides
the listing, it does not restrict access.

## 5. Two things that will silently break this

**nginx `add_header` inheritance.** A location declaring *any* `add_header`
discards *every* server-level `add_header`. The live server block sets
Strict-Transport-Security and Permissions-Policy; both would vanish from the APK
URL the moment `Content-Disposition` is added. Already visible in production:
`location /uploads/` declares `add_header Cache-Control "public"` and therefore
returns no Permissions-Policy at all, plus an HSTS header that is actually
NestJS Helmet's `max-age=31536000` leaking through the proxy rather than nginx's
own `max-age=63072000` preload value. Every header is re-declared in our blocks
for this reason — do not "clean it up".

**Positive caching on a mutable filename.** `vizora-display.apk` changes bytes
under a fixed URL. A `max-age` lets TVs and intermediaries serve the previous
build with no way to force a refresh. We use `no-cache`, which means
"revalidate", not "do not store" — nginx still answers 304 when unchanged, and
revalidating a 1.2MB file is free.

## 6. Open gates — publishing is blocked until both are closed

`publish-display-apk.sh` refuses to run while either is null in
`deploy/tv/release.json`. Verified: the script exits 1 with both listed.

**Gate A — artifact approval.** Confirm `vizora-display-1.3.10-release.apk` is
the exact client-pilot build intended for customers, not merely the newest
GitHub prerelease. It *is* tagged `Pre-release` on GitHub, and `vizora-tv`
`master` sits at `bff3ee0` with no later commits — so nothing obviously
supersedes it, but that is not the same as approval.

**Gate B — signing-key durability.** Identify the release keystore that signed
this APK and prove it has a secure off-machine backup with a password
recoverable by an authorized operator. Record **location class**, backup status,
certificate SHA-256 and recovery ownership only.

> Never commit the keystore, `.jks`, signing password, or any private key.

Why B is the only unrecoverable dependency: if the key is lost, no future build
can update an installed app. Every TV in the field must be manually uninstalled
and re-paired. There is no recovery path.

## 7. Verified artifact facts (2026-08-10)

```
package         com.vizora.display
version         1.3.10 (versionCode 10140)
size            1247598 bytes (1.19 MB)
apk sha256      80DD8AAAAD8A32957CDDF6AD6097954E77D859B792534F746D896DD015DEBFB6
cert sha256     AA07524A453375DE143CA4A506C44657E509CCC0F79981821693903DA5137982
cert owner      CN=Vizora Display (self-signed)
cert valid to   2051-03-25
key / sig alg   2048-bit RSA / SHA256withRSA
schemes         v1 (JAR) present; v2/v3 signing block present
```

**Known limit of the check:** `keytool -printcert -jarfile` validates the **v1**
signature only. If an APK were v2/v3-signed with a *different* key than its v1
block, keytool would not notice. Full cross-scheme validation needs
`apksigner verify --print-certs`, which requires the Android SDK (not installed
on the dev machine). The verifier reports which schemes are present so this
limit is visible rather than assumed.

## 8. Release procedure

Every future version repeats exactly this. The URLs never change.

```bash
# 1. Fetch the signed release APK
gh release download vX.Y.Z --repo Trivenidigital/vizora-tv \
   --pattern '*.apk' --dir .tmp-apk

# 2. Verify identity, signing key and integrity against the published baseline
node scripts/release/verify-display-apk.mjs \
     --apk .tmp-apk/vizora-display-X.Y.Z-release.apk \
     --against deploy/tv/release.json

# 3. Copy the verified values into release.json `candidate`
#    (use --json output; never transcribe a hash by hand)
node scripts/release/verify-display-apk.mjs --apk <apk> --json

# 4. Re-render the installer page so version + hash match the APK
node scripts/release/render-tv-page.mjs

# 5. Dry run — verifies everything, uploads nothing
scripts/release/publish-display-apk.sh --apk <apk> --dry-run

# 6. Publish (APK + page as one atomic operation)
scripts/release/publish-display-apk.sh --apk <apk>

# 7. Move `candidate` to `published` in release.json, commit, open a PR.
#    `published` is the baseline the NEXT release is compared against.
```

Step 4 is what makes the APK, the displayed version and the displayed hash a
single release operation. The page is generated, never hand-edited, so the three
cannot drift apart.

## 9. Android update rules (why the gate checks what it checks)

For a new APK to **update** an installed app rather than appear as a separate
application, all three must hold:

1. `applicationId` identical — `com.vizora.display`
2. signed with the **same** release key (certificate SHA-256 must match)
3. `versionCode` strictly greater than the installed one

The verifier asserts all three against the published baseline. A certificate
mismatch is reported as a hard failure with an explicit note that every
installed TV would need uninstall + re-pair.

## 10. Pairing continuity — the likeliest support ticket

Installing **over** an existing install preserves app data, so the screen stays
paired. **Uninstalling first wipes it** and forces re-pairing.

A customer whose install looks stuck will instinctively uninstall. The installer
page therefore carries a bordered warning above the steps:

> Already have Vizora on this TV? Do **not** uninstall it. Install this version
> straight over the old one so the screen stays paired.

## 11. Monitoring

`health-guardian` (every 5 min) checks the surface and asserts HTTP 200 + the
Android package MIME type + non-zero content length on the APK, plus HTTP 200 on
`/tv`. A failure raises a **critical, non-auto-remediable** incident.

Gated behind `TV_DOWNLOAD_MONITOR_ENABLED` (default `false`). **Enable it in the
same change that publishes the first APK** — the URLs 404 until then, and an
agent that is red on day one gets ignored. Test coverage pins this default.

## 12. Deliberately out of scope

- No auto-update feed. The Electron display client's `DISPLAY_UPDATE_FEED_ALLOWLIST`
  path is separate and untouched.
- No download analytics.
- No listing/index of the archive.
- No change to any application service, PM2 process, database, or the Next.js app.
