# Vizora Display — customer APK distribution (`/tv`)

**Status:** implemented, **NOT deployed**. Publishing is blocked (§6). Nothing in
this change touches a running production service.

> **Gate B FAILED 2026-08-10 — do not publish the existing 1.3.10 APK.** The key
> that signed it is not on the build machine. Establish a canonical signing
> identity and build a fresh release first. Detail in §6.

> **1.3.11 is now BUILT and fully verified (2026-08-10 evening).** The fresh
> release §6 called for exists, signed by the on-machine key. Everything that
> does not require a human is done — see §6.1. **Gate B is the only remaining
> blocker, and it is two acts of custody, not two signatures.**

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

**Gate B — signing-key durability. STATUS: FAILED 2026-08-10.**

> **The 1.3.10 APK must not be published.** The key that signed it
> (`AA07524A…A5137982`, cert created 2026-03-31) is **not on the Windows build
> machine**. The only Android keystore there — `vizora-tv`
> `android/vizora-release.jks`, a single entry, alias `vizora-display`, created
> 2026-03-26 — carries a different certificate, `BE2320A5…3A9187A5`. Ruled out:
> not signed in CI (`vizora-tv` has one workflow, no signing secrets), not the
> debug key (`androiddebugkey` is `59D27DA1…`), and no other `.jks`/`.keystore`
> exists under the user profile or OneDrive.

Nothing has been distributed, so there is **no installed base** and no signature
compatibility to preserve. Choosing a controlled signing key costs nothing today
and becomes impossible once TVs are in the field — publishing an APK whose key
cannot be reproduced means every future version is rejected with
`INSTALL_FAILED_UPDATE_INCOMPATIBLE`, forcing uninstall + re-pair on every screen.

To close Gate B, establish the canonical customer-signing identity. Prefer the
existing `vizora-release.jks` **only if** it passes all of: private-key entry
exists, certificate SHA-256 known, keystore has a secure off-machine backup,
keystore and alias credentials recoverable by an authorized operator, and
restoration tested well enough to prove the key still signs. If any fail, select
or create a properly controlled release key *before* building the first customer
artifact. Record **location class**, backup status, certificate SHA-256 and
recovery ownership only — never a password or private-key material.

Then pin the fingerprint in `release.json` `signing.canonicalCertSha256` and
build a **fresh release** rather than re-signing the old binary under the same
version:

```
package       com.vizora.display
versionName   1.3.11
versionCode   10141
signing cert  <canonical pinned fingerprint>
```

### Gate B rehearsal — 2026-08-10

Recorded so nobody repeats this investigation. **Key mechanics: proven good.
Custody durability: still failed.** The rehearsal changed no gate outcome —
`canonicalCertSha256` is still null, 1.3.10 is still rejected for customer
publication, and nothing was deployed, built, or re-signed.

Candidate signing key:

```
BE2320A5728CFCF1CF9436C04C377BE9BF347807B23183F8C88BE3583A9187A5
```

**Verified:**

- original keystore opens with recorded credentials
- `vizora-display` is a `PrivateKeyEntry`
- local-copy restore succeeds (byte-identical)
- restored copy signs a disposable APK
- `apksigner verify --verbose --print-certs` verifies v1 / v2 / v3
- resulting signer fingerprint matches the candidate key
- original keystore remained byte-identical (SHA-256 checked before and after)
- scratch artifacts deleted

**Not verified:**

- secure off-machine backup
- independent credential recovery
- assigned recovery owner

**Gate B remains FAIL.**

Do not pin `canonicalCertSha256`, build 1.3.11, approve Gate A, or publish until
the two custody requirements above are explicitly completed.

> **The blocker in one sentence:** the keystore and the only known source of its
> password currently live in the same directory on the same machine, so backing
> up the `.jks` alone achieves nothing — the password has to land in a
> *separate* authorized store or the backup is decorative.

The candidate's certificate subject is
`CN=Vizora Display, OU=Mobile, O=Triveni Digital, L=Unknown, ST=Unknown, C=US`,
whereas the 1.3.10 APK's is bare `CN=Vizora Display` — an independent
corroboration that these are two genuinely distinct keys, not a fingerprint
parsing artifact.

## 6.1 Where this actually stands — 2026-08-10 evening

1.3.11 was built, signed and verified. **Nothing was published.** The dry run
exits 1, as designed.

```
package       com.vizora.display
versionName   1.3.11
versionCode   10141          (> 10140, the never-published 1.3.10)
apk sha256    D95FA359D194704C8ACB6144B37FB054DB1FCF5789B7D0BE370CDE886F9DB02E
apk bytes     1250202
cert sha256   BE2320A5728CFCF1CF9436C04C377BE9BF347807B23183F8C88BE3583A9187A5
cert owner    CN=Vizora Display, OU=Mobile, O=Triveni Digital, L=Unknown, ST=Unknown, C=US
cert valid to 2053-08-11
apksigner     VERIFIES — v1 true, v2 true; 1 signer, matches the certificate
source        vizora-tv c126ee1 (branch release/1.3.11, parent bff3ee0 = tag v1.3.10)
```

The signing certificate came out **identical to the rehearsal candidate**, which
independently confirms which key actually signs on this machine.

**Three findings surfaced during the build, all worth keeping:**

**1. 1.3.10 was never reproducible from its own tag.** `build.gradle` at tag
`v1.3.10` declares `versionCode 10135` / `versionName "1.0.1"`, but the shipped
APK is `10140` / `1.3.10`. That version was injected out-of-tree and never
committed — the same class of problem as the missing signing key, and more
corroboration that 1.3.10 was produced somewhere this machine cannot reproduce.
1.3.11 bumps the version *in tracked source* precisely so this stops being true.

**2. `package.json` version reaches production telemetry.** Vite injects it as
`__APP_VERSION__`, which feeds the device heartbeat's `appVersion` and the Sentry
release tag. It had been left at `1.0.1` while the APK moved to `1.3.x`, so every
TV would report a version that does not exist. Bumped with the same commit —
check these together on every future release.

**3. `vizora-tv` has 5 failing unit tests, and they are pre-existing.** 5 of 296
fail on `bff3ee0` — the v1.3.10 tag — *before* any change here; the version bump
introduced no regression (verified by stashing it and re-running). Four are
`update_config` command handling (`apiUrl` / `realtimeUrl` / `dashboardUrl`
resolving to `undefined` instead of the allowed value) and one is the F41
auth-probe suspend latch. `lintVitalRelease` passes, so nothing blocks the build,
but `update_config` is the remote-reconfiguration path for a fleet of TVs and it
is either genuinely broken or covered by stale tests.

**Explicitly OUT of scope for this workstream (decided 2026-08-10).** These
predate 1.3.11 and must not extend this release. Tracked as **TV1** in
`backlog.md`. Escalate only on runtime evidence that the pilot depends on remote
reconfiguration, or a pilot failure in playback/pairing — do not investigate here.

**Preserve the binary.** Android release builds are not byte-reproducible (zip
timestamps, R8), so the SHA-256 above belongs to *that specific file*, not to the
commit. Rebuilding stales `release.json` and the installer page. The verified APK
is kept with its provenance at
`C:\projects\vizora-artifact-backups\tv-apk-1.3.11\`. If it is ever lost, rebuild
**and** re-run steps 3-4 of §8 to re-record the new hash.

### Gate A — decided 2026-08-10

`D95FA359…DB02E` **is the approved Gate A candidate.** Package and version are
correct, the signer is the intended BE23… key, `apksigner` verifies it, and the
exact hash is recorded. 1.3.10's provenance failure is independent grounds not to
use that build.

**There is no further design review before deployment.** The only thing still
owed is Gate B custody.

### ⚠ `vizora-tv` is a PUBLIC repository

Verified 2026-08-10: `Trivenidigital/vizora-tv` is **public**. So attaching the
APK to a GitHub Release is not archival — it is publication, on a URL customers
can install from, with none of `/tv`'s gates in front of it.

**Do not create the v1.3.11 Release or attach the APK until Gate B is PASS.**
Pushing the *source commit* carries no such risk and is already done (branch
`release/1.3.11`, commit `c126ee1`) — it is two version-string lines and no
signing material is tracked in either repo (checked before pushing).

Until then the durable copy of the exact approved binary lives at
`C:\projects\vizora-artifact-backups\tv-apk-1.3.11\` with its provenance.

### What remains — and who can do it

Everything not requiring a human is done. Ordered exactly as it should run:

| # | Step | Blocked on | Who |
|---|---|---|---|
| 1 | Place a secure **off-machine** backup of the keystore | nothing — just needs doing | operator |
| 2 | Put the keystore/alias password in a **separate** authorized store | nothing | operator |
| 3 | Name a recovery owner who is not the key's author | nothing | operator |
| 4 | Verify restore → open → sign from that backup alone | 1-3 | operator |
| 5 | Fill `signing.*` + `approval.*` (both gates) in `release.json` | 4 | operator |
| 6 | Pin `signing.canonicalCertSha256` = `BE2320A5…3A9187A5` | 5 | either |
| 7 | Confirm 1.3.10 is now **rejected** by the pinned verifier | 6 | either |
| 8 | Tag `v1.3.11` from `c126ee1`; create the Release + attach the exact APK | 5 | either |
| 9 | Final `--dry-run` (expect exit 0) | 6 | either |
| 10 | Merge PR #271 | 9 | either |
| 11 | `publish-display-apk.sh --install-nginx` | 10 | either |
| 12 | `TV_DOWNLOAD_MONITOR_ENABLED=true` — **same change as 11**, never before | 11 | either |
| 13 | Verify public URLs + downloaded hash == `D95FA359…DB02E` | 11 | either |
| 14 | Move `candidate` → `published` in `release.json`, commit | 13 | either |

**Never rebuild the APK to satisfy any of these.** Android release builds are not
byte-reproducible, so a rebuild invalidates the approved hash, the installer page
and Gate A all at once.

Steps 1-4 are why an agent cannot finish this. They are not approvals to be
recorded — they are physical acts of custody. Writing
`signingKeyBackupConfirmedBy` without them would not close the risk, it would
only delete the warning about it.

### Gate B — off-machine encrypted backup DONE, custody NOT (2026-08-10)

The backup half of Gate B is built and proven. The credential half is not, and
**Gate B stays FAIL until it is**.

| Check | Result |
|---|---|
| Off-machine encrypted backup exists | **PASS** |
| Retrieved from VPS | **PASS** |
| Decryption | **PASS** |
| Restored keystore opens | **PASS** |
| Restored key signs | **PASS** |
| Cert matches `BE2320A5…3A9187A5` | **PASS** |
| Credentials in an independent store | **NOT VERIFIED** |
| Recovery owner | Srini (designated) |
| **GATE B** | **FAIL** |

Arrangement:

```
Windows build machine ── original vizora-release.jks (unchanged, verified byte-identical after)
        │
        └── openssl enc -aes-256-cbc -salt -pbkdf2
                    │
                    ▼
        VPS  /opt/secure-backups/vizora/android-signing/vizora-release.jks.enc
             dir 700, file 600, root-owned
             NOT reachable: no nginx root/alias into /opt, no container mount,
             4/4 HTTP probes 404, sibling of /opt/vizora/app — never inside it
```

Restore was proven end-to-end **from the VPS copy**, not from the local
ciphertext: downloaded → decrypted → SHA-256 byte-identical to the original
(`DB5C23DD…654BC3`) → opened as `PrivateKeyEntry` alias `vizora-display` →
signed a disposable APK → `apksigner verify --verbose --print-certs` returned v1
+ v2 + v3, 1 signer, `be2320a5…3a9187a5`. Every temporary copy was then shredded;
the original keystore and the approved 1.3.11 APK both re-hashed unchanged.

**Why this is still FAIL.** Both secrets required to use that backup — the
backup encryption passphrase and the keystore's own store/key password — are
currently on the same Windows machine as the original. A machine loss today
destroys the ability to decrypt *and* the ability to open. That is precisely the
condition Gate B exists to remove, so the ciphertext on the VPS is not yet a
recovery path.

Closing it is two human acts, ~5 minutes, laid out in
`C:\Users\srini\VIZORA-GATE-B-SECRET\README-FIRST.md`: put both secrets in an
owner-controlled password manager, verify they can be read back, then delete that
folder. Deleting the folder *is* the fix — it is what ends the
both-secrets-on-one-machine state.

> Second layer deferred on purpose: the VPS is the same host as the application,
> so a full host compromise reaches both. Add an independent encrypted copy after
> launch — do not hold the pilot for it.

### Gate B closure — the exact procedure

Nothing below prints a password or copies a private key into this repo.

```bash
# 1. Confirm the key still opens and is a private-key entry (prompts for the password)
keytool -list -v -keystore /c/projects/vizora-tv/android/vizora-release.jks \
        -alias vizora-display | grep -E "Entry type|SHA256"
#    expect: PrivateKeyEntry, and SHA256: BE:23:20:A5:...:87:A5

# 2. Copy the .jks to an off-machine store (password manager attachment,
#    hardware token, or a different physical machine you control).
#    Do NOT put it in any Vizora git repo, and not on the prod VPS —
#    an internet-facing web server is not a key-custody location.

# 3. Store the store/key password in that SAME manager but as a SEPARATE item.
#    The current blocker is that the .jks and the only known copy of its password
#    live in one directory: backing up the .jks alone changes nothing.

# 4. Prove recovery: from the backup alone, restore to a scratch dir and re-run
#    step 1. If it opens with a credential fetched from the store, Gate B is real.
```

Then record in `deploy/tv/release.json` — **class and ownership only, never a
password, a path to the secret, or key material**:

```json
"signing": {
  "canonicalCertSha256": "BE2320A5728CFCF1CF9436C04C377BE9BF347807B23183F8C88BE3583A9187A5",
  "canonicalCertPinnedBy": "<name>",
  "canonicalCertPinnedAt": "<YYYY-MM-DD>",
  "backupClass": "<e.g. password-manager vault, org-owned>",
  "recoveryOwner": "<name>"
},
"approval": {
  "artifactApprovedBy": "<name>",
  "artifactApprovedAt": "<YYYY-MM-DD>",
  "signingKeyBackupConfirmedBy": "<name>",
  "signingKeyBackupConfirmedAt": "<YYYY-MM-DD>",
  "signingKeyLocationClass": "<class, not a path>",
  "signingKeyRecoveryOwner": "<name>"
}
```

Then publish (the APK is already built and verified):

```bash
ANDROID_HOME=~/Android/Sdk \
  bash scripts/release/publish-display-apk.sh \
  --apk .tmp-apk/vizora-display-1.3.11-release.apk --dry-run   # expect exit 0
# then drop --dry-run, adding --install-nginx on the first publish only
```

### Build-machine note: TLS interception breaks Gradle

Norton Web/Mail Shield MITMs HTTPS on this machine. `curl` works (its root is in
the Windows store) but the JDK's `cacerts` does not carry it, so Gradle dies with
`PKIX path building failed` on `dl.google.com`. Fixed without touching the system
JDK by copying `cacerts`, importing the Norton root into the copy, and pointing
one build at it:

```bash
keytool -importcert -noprompt -trustcacerts -alias norton-tls-scanning-root \
  -file norton-root.pem -keystore ./cacerts-with-norton.jks -storepass changeit

./gradlew assembleRelease --no-daemon \
  -Djavax.net.ssl.trustStore=<abs path>\cacerts-with-norton.jks \
  -Djavax.net.ssl.trustStorePassword=changeit
```

Export the root with PowerShell:
`Get-ChildItem Cert:\LocalMachine\Root | ? {$_.Subject -like '*Norton*'}`.

### Pinned canonical certificate — what protects the first publish

`published` only becomes a baseline from release 2 onward, so release 1 had no
certificate check at all — which is exactly where the mismatch above was found.
`signing.canonicalCertSha256` closes that hole: `publish-display-apk.sh` passes
`--require-pinned-cert`, so publication fails closed when no identity is pinned,
and fails when the APK's certificate does not match the pin. Verified in all
three states (unpinned → exit 1; pinned-and-mismatched → exit 1, which is what
now automatically refuses the 1.3.10 binary; pinned-and-matching → exit 0), with
regression tests in `scripts/release/verify-display-apk.test.ts`.

### Before customer rollout: compare against Google Play App Signing

If the canonical sideload certificate differs from the Play App Signing
certificate, pilot customers migrating from the sideloaded APK to the Play Store
build will need **one uninstall + reinstall**, and will re-pair. Confirm this and
document it before the migration, not after.

> Never commit the keystore, `.jks`, signing password, or any private key.

Why B is the only unrecoverable dependency: if the key is lost, no future build
can update an installed app. Every TV in the field must be manually uninstalled
and re-paired. There is no recovery path.

**Where to start for Gate B.** `vizora-tv` `android/app/build.gradle` reads its
release signing config from `android/keystore.properties`, which exists only in
the local checkout on the Windows dev machine. Signing material is correctly
excluded from git — only `keystore.properties.example` is tracked, and no
`.jks`/`.keystore` is tracked in either repo.

The open question is **not** where the files are — that was answered by the
rehearsal below. It is whether the key exists anywhere other than one Windows
laptop, and whether its password is recoverable by someone other than its
author. Record only location class, backup status, recovery ownership, and the
certificate SHA-256 — never a password, a private key, or a secret-store path.

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
apksigner       VERIFIES — v1 true, v2 true, v3/v3.1/v4 false
signers         1, digest identical to the v1 certificate
```

### Full signature verification is mandatory for publication

`keytool -printcert -jarfile` validates the **v1** signature only. An APK whose
v2/v3 blocks were signed with a *different* key would pass a keytool-only check.

`publish-display-apk.sh` therefore always passes `--require-apksigner`, which
**fails closed**: if `apksigner` cannot be found, publication aborts rather than
proceeding half-verified. Verified both ways — present → PASS, hidden → exit 1.

The verifier finds `apksigner` on `PATH`, then under `ANDROID_HOME`,
`ANDROID_SDK_ROOT`, `%LOCALAPPDATA%\Android\Sdk`, `~/Android/Sdk`, and
`~/Library/Android/sdk`, newest build-tools first. If it is missing on the
release machine:

```bash
sdkmanager "build-tools;34.0.0"     # or set ANDROID_HOME to an existing SDK
```

Two implementation notes worth keeping:

- Node refuses to `execFile` a `.bat`/`.cmd` directly (`EINVAL`, the
  CVE-2024-27980 hardening). Windows invocations are routed through `cmd.exe`
  with an **argument array**, never a concatenated shell string.
- The scheme regex captures `v[\d.]+` so `v3.1` is its own key instead of
  silently colliding with `v3`.

Without `--require-apksigner` the check reports **SKIP** with an explicit
reason, so a keytool-only run can never be mistaken for full verification.

## 8. Release procedure

Every future version repeats exactly this. The URLs never change.

```bash
# 1. Fetch the signed release APK
gh release download vX.Y.Z --repo Trivenidigital/vizora-tv \
   --pattern '*.apk' --dir .tmp-apk

# 2. Verify identity, signing key and integrity against the published baseline.
#    --require-apksigner is mandatory on the release machine; it fails closed
#    if full cross-scheme signature verification cannot run.
node scripts/release/verify-display-apk.mjs \
     --apk .tmp-apk/vizora-display-X.Y.Z-release.apk \
     --against deploy/tv/release.json \
     --require-apksigner

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
