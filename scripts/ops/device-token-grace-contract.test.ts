/**
 * The device-token rotation grace model exists in TWO implementations:
 *
 *   realtime/src/gateways/device-token-hash.ts        — writes the record, accepts the
 *                                                       old token at the socket handshake
 *   middleware/src/modules/common/device-token-auth.util.ts
 *                                                     — reads the same record, decides
 *                                                       whether GET /devices/auth/check
 *                                                       answers 200 or a destructive 410
 *
 * A disagreement between them IS vizora-tv#20: realtime said "this socket is fine" while
 * auth/check said 410, and 410 is the one response that makes the player purge its
 * pairing state. So the two must reach identical verdicts, and asserting that in a
 * comment is not enough — a hand-maintained mirror is exactly what let the heartbeat DTO
 * and the content:impression timestamp drift for four releases.
 *
 * This test imports BOTH implementations and runs them over one table.
 *
 * Why it lives here rather than in middleware's jest suite: importing realtime source
 * from inside `middleware/src` makes nx add a project reference from middleware to
 * realtime, which couples middleware's BUILD to realtime and breaks the middleware-only
 * deployment unit this fix depends on (verified: `nx sync:check` demands the reference
 * and the build fails without it). `pnpm test:ops` runs at the repo root, outside both
 * app graphs, and runs in CI — so the pinning is enforced without reshaping either app.
 *
 * The right long-term home is one implementation in @vizora/database. That forces
 * realtime to rebuild and redeploy, which this P0 deliberately avoids; this test is what
 * makes the duplication safe until then.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  deviceTokenGraceKey as middlewareGraceKey,
  isGraceAcceptedDeviceToken as middlewareGraceAccepts,
  hashDeviceToken,
} from '../../middleware/src/modules/common/device-token-auth.util';
import {
  deviceTokenGraceKey as realtimeGraceKey,
  isGraceAcceptedDeviceToken as realtimeGraceAccepts,
} from '../../realtime/src/gateways/device-token-hash';

const prev = hashDeviceToken('old.token');
const next = hashDeviceToken('new.token');
const other = hashDeviceToken('other.token');
const rec = (p: string, n: string) => JSON.stringify({ prev: p, next: n });

const cases: Array<{ name: string; raw: string | null; presented: string; stored: string | null }> = [
  { name: 'valid rotation, next still stored', raw: rec(prev, next), presented: prev, stored: next },
  { name: 'stored moved on (re-pair)', raw: rec(prev, next), presented: prev, stored: other },
  { name: 'presented is not prev', raw: rec(prev, next), presented: other, stored: next },
  { name: 'no record', raw: null, presented: prev, stored: next },
  { name: 'empty string record', raw: '', presented: prev, stored: next },
  { name: 'malformed json', raw: 'not json', presented: prev, stored: next },
  { name: 'empty object', raw: '{}', presented: prev, stored: next },
  { name: 'missing next', raw: `{"prev":"${prev}"}`, presented: prev, stored: next },
  { name: 'non-string fields', raw: '{"prev":1,"next":2}', presented: prev, stored: next },
  { name: 'array not object', raw: '[]', presented: prev, stored: next },
  { name: 'stored null', raw: rec(prev, next), presented: prev, stored: null },
  { name: 'non-hex prev', raw: rec('zzzz', next), presented: prev, stored: next },
  { name: 'truncated hash', raw: rec(prev.slice(0, 32), next), presented: prev, stored: next },
  { name: 'uppercase hex', raw: rec(prev.toUpperCase(), next), presented: prev, stored: next },
];

describe('device-token grace: middleware and realtime must agree', () => {
  for (const c of cases) {
    test(`agrees on: ${c.name}`, () => {
      assert.equal(
        middlewareGraceAccepts(c.raw, c.presented, c.stored),
        realtimeGraceAccepts(c.raw, c.presented, c.stored),
        `divergence on "${c.name}" — a grace disagreement is the vizora-tv#20 unpair bug`,
      );
    });
  }

  test('the valid-rotation case is genuinely ACCEPTED by both (the table is not all-false)', () => {
    // Without this, a table where every case returned false would still "agree" and the
    // suite would be vacuous — the defect shape recorded in the 1.3.14 release lane.
    assert.equal(middlewareGraceAccepts(rec(prev, next), prev, next), true);
    assert.equal(realtimeGraceAccepts(rec(prev, next), prev, next), true);
  });

  test('at least one case is genuinely REJECTED by both', () => {
    assert.equal(middlewareGraceAccepts(rec(prev, next), prev, other), false);
    assert.equal(realtimeGraceAccepts(rec(prev, next), prev, other), false);
  });

  test('both compute the same Redis key, so they read and write the same record', () => {
    for (const id of ['display-1', 'abc-123', '']) {
      assert.equal(middlewareGraceKey(id), realtimeGraceKey(id));
    }
    assert.equal(middlewareGraceKey('display-1'), 'device:token:grace:display-1');
  });
});
