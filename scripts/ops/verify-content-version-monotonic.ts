/**
 * Vizora#325 — post-deploy runtime verification of content-version monotonicity.
 *
 * WHAT THIS IS FOR. The unit tests prove the resolver's logic against mocks. This
 * proves the DEPLOYED COMPILED artifact against the REAL PostgreSQL engine, on the
 * production host, without leaving a single durable row behind.
 *
 * It deliberately does NOT prove that the long-running middleware/realtime processes
 * loaded that artifact — a fresh Node process importing the new `dist` says nothing
 * about what an already-running process has cached. That is a separate check; see
 * "PROCESS PROOF" at the bottom of this comment. Run BOTH or the evidence chain has a
 * hole in exactly the place this codebase has been bitten before.
 *
 * SAFETY MODEL — read before running against production.
 *   - Everything happens inside ONE interactive transaction that is ALWAYS aborted.
 *   - The abort is unconditional: the callback throws a sentinel after asserting, so
 *     there is no success path that commits.
 *   - Only direct Prisma model calls are used. No application service methods, so
 *     nothing emits realtime pushes, notifications or events to devices/operators.
 *   - Every synthetic row carries a unique run id, and after rollback a SECOND
 *     connection proves none of them exist. "The callback threw" is not by itself
 *     proof that nothing survived — an outer commit, a nested transaction or an
 *     autocommitting side call could all leave rows behind. So it is checked, not
 *     assumed.
 *
 * USAGE (on the production host, after deploy):
 *   cd /opt/vizora/app && node --import tsx scripts/ops/verify-content-version-monotonic.ts
 *
 * Exit 0 = all checks passed AND rollback verified. Exit 1 = something failed.
 *
 * PROCESS PROOF (run alongside, not replaced by this):
 *   - compiled discriminator: `activeContentItemsInclude` absent and
 *     `allContentItemsInclude` present in packages/database/dist/lib/effective-content.js
 *   - pm2 process start time for vizora-middleware and vizora-realtime is LATER than
 *     the mtime of that compiled file
 */
import { PrismaClient } from '@vizora/database';
import { resolveEffectiveContent, serializeDeviceContent } from '@vizora/database';

const RUN = `v325verify-${Date.now()}`;
const ROLLBACK_SENTINEL = `__${RUN}__rollback__`;

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];
const check = (name: string, ok: boolean, detail: string) => {
  checks.push({ name, ok, detail });
};

const iso = (d: Date) => d.toISOString();

async function main() {
  const prisma = new PrismaClient();

  // Distinct ids so the post-rollback absence check can be exact.
  const orgId = `${RUN}-org`;
  const displayId = `${RUN}-display`;
  const playlistId = `${RUN}-playlist`;
  const liveId = `${RUN}-live`;
  const archivedId = `${RUN}-archived`;
  const expiringId = `${RUN}-expiring`;

  // Stamp ordering is load-bearing and was got WRONG first time round: an archived row
  // stamped LATER than the expiry boundary dominates the max on both sides of it, so
  // the boundary advance is masked and the check silently measures nothing. Keep the
  // archived stamp BELOW the boundary so the two properties stay independently visible:
  //   before boundary -> version == T_ARCHIVE  (archived row counts though undelivered)
  //   after  boundary -> version == T_EXPIRY   (the write-free transition advances it)
  const T_OLD = new Date('2026-02-01T00:00:00Z');
  const T_EXPIRING_EDIT = new Date('2026-02-10T00:00:00Z');
  const T_ARCHIVE = new Date('2026-02-12T00:00:00Z');
  const T_EXPIRY = new Date('2026-02-15T00:00:00Z');
  const BEFORE_BOUNDARY = new Date('2026-02-14T00:00:00Z');
  const AFTER_BOUNDARY = new Date('2026-02-16T00:00:00Z');

  try {
    await prisma.$transaction(
      async (tx) => {
        // ---- fixture ------------------------------------------------------
        await tx.organization.create({
          data: { id: orgId, name: `${RUN} (synthetic, rolled back)`, slug: RUN },
        });
        await tx.playlist.create({
          data: { id: playlistId, name: `${RUN} playlist`, organizationId: orgId, updatedAt: T_OLD },
        });
        await tx.display.create({
          data: {
            id: displayId,
            nickname: `${RUN} display`,
            organizationId: orgId,
            deviceIdentifier: `${RUN}-dev`,
            currentPlaylistId: playlistId,
            timezone: 'UTC',
          },
        });

        const mkContent = (id: string, updatedAt: Date, extra: Record<string, unknown> = {}) =>
          tx.content.create({
            data: {
              id,
              name: id,
              type: 'image',
              url: `https://example.invalid/${id}.png`,
              organizationId: orgId,
              status: 'active',
              updatedAt,
              ...extra,
            },
          });

        await mkContent(liveId, T_OLD);
        await mkContent(archivedId, T_ARCHIVE, { status: 'archived' });
        await mkContent(expiringId, T_EXPIRING_EDIT, { expiresAt: T_EXPIRY });

        await tx.playlistItem.createMany({
          data: [
            { playlistId, contentId: liveId, order: 0, duration: 10 },
            { playlistId, contentId: archivedId, order: 1, duration: 10 },
            { playlistId, contentId: expiringId, order: 2, duration: 10 },
          ],
        });

        const db = tx as unknown as Parameters<typeof resolveEffectiveContent>[0];

        // ---- 1/2. archived + expired absent from the delivered payload -----
        const after = await resolveEffectiveContent(db, displayId, orgId, AFTER_BOUNDARY);
        const served = (after.playlist?.items ?? []).map((i) => i.contentId);
        check(
          'archived top-level content is NOT delivered',
          !served.includes(archivedId),
          `served=[${served.join(', ')}]`,
        );
        check(
          'expired top-level content is NOT delivered',
          !served.includes(expiringId),
          `served=[${served.join(', ')}]`,
        );
        check('valid content IS still delivered', served.includes(liveId), `served=[${served.join(', ')}]`);

        // ---- 3. version advances across the WRITE-FREE expiry boundary -----
        const beforeB = await resolveEffectiveContent(db, displayId, orgId, BEFORE_BOUNDARY);
        const servedBefore = (beforeB.playlist?.items ?? []).map((i) => i.contentId);
        check(
          'expiring content IS delivered before its boundary',
          servedBefore.includes(expiringId),
          `served=[${servedBefore.join(', ')}]`,
        );
        check(
          'version ADVANCES across the write-free expiry boundary',
          after.version > beforeB.version,
          `${beforeB.version} -> ${after.version}`,
        );

        // ---- 4. archive raises the version (vs a playlist without it) ------
        // Compare against the same graph resolved as if the archived row were the only
        // change: its updatedAt is the newest stamp, so the version must reflect it.
        // Strong form: BEFORE the boundary the max must be exactly the archived row's
        // stamp. It is not delivered, yet it is the newest thing in the playlist — so
        // this fails outright if a filtered-out row stops contributing to the version.
        check(
          'archived content still RAISES the version (not lost with the row)',
          beforeB.version === iso(T_ARCHIVE),
          `beforeBoundary=${beforeB.version} expected=${iso(T_ARCHIVE)}`,
        );
        // And AFTER, the max must be exactly the expiry boundary itself.
        check(
          'the post-boundary version IS the expiry instant (not a stale row stamp)',
          after.version === iso(T_EXPIRY),
          `afterBoundary=${after.version} expected=${iso(T_EXPIRY)}`,
        );

        // ---- 5. the wire carries no internals and no filtered content -----
        const payload = serializeDeviceContent(after, {
          contentBaseUrl: 'https://example.invalid',
        });
        const wire = JSON.stringify(payload);
        check('wire does NOT contain the archived content id', !wire.includes(archivedId), '');
        check('wire does NOT contain the expired content id', !wire.includes(expiringId), '');
        for (const internal of ['versionItems', 'extraStamps', 'allItems']) {
          check(`wire does NOT leak internal field "${internal}"`, !wire.includes(internal), '');
        }

        // ---- 6. cross-org isolation unchanged -----------------------------
        const crossOrg = await resolveEffectiveContent(db, displayId, `${RUN}-other-org`, AFTER_BOUNDARY);
        check(
          'cross-org resolve returns nothing (tenant isolation intact)',
          crossOrg.playlist === null,
          `source=${crossOrg.source}`,
        );

        // Abort. Unconditional — there is no committing path.
        throw new Error(ROLLBACK_SENTINEL);
      },
      { timeout: 60_000 },
    );

    check('transaction aborted', false, 'transaction COMMITTED — it must not have');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes(ROLLBACK_SENTINEL)) {
      check('transaction aborted via sentinel', true, 'rolled back as designed');
    } else {
      check('transaction aborted via sentinel', false, `unexpected error: ${message}`);
    }
  }

  // ---- 7. prove rollback from a SECOND connection ----------------------
  // A fresh client, so this cannot observe the aborted transaction's snapshot.
  const verifier = new PrismaClient();
  try {
    const [orgs, displays, playlists, contents, items] = await Promise.all([
      verifier.organization.count({ where: { id: orgId } }),
      verifier.display.count({ where: { id: displayId } }),
      verifier.playlist.count({ where: { id: playlistId } }),
      verifier.content.count({ where: { organizationId: orgId } }),
      verifier.playlistItem.count({ where: { playlistId } }),
    ]);
    const total = orgs + displays + playlists + contents + items;
    check(
      'ROLLBACK VERIFIED: zero synthetic rows survive',
      total === 0,
      `org=${orgs} display=${displays} playlist=${playlists} content=${contents} items=${items}`,
    );
  } finally {
    await verifier.$disconnect();
    await prisma.$disconnect();
  }

  // ---- report ----------------------------------------------------------
  let failed = 0;
  console.log(`\nVizora#325 runtime verification — run id ${RUN}\n`);
  for (const c of checks) {
    if (!c.ok) failed++;
    console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `\n        ${c.detail}` : ''}`);
  }
  console.log(`\n  ${failed === 0 ? 'VERDICT: PASS' : `VERDICT: FAIL (${failed} failed)`}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('harness error:', err);
  process.exit(1);
});
