import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSuccessResponse } from './dto';

/**
 * Server half of the heartbeat-ack wire contract (vizora-tv#8 / F40).
 *
 * The ack crosses a process boundary neither side can see: this repo builds the
 * envelope with createSuccessResponse(); the TV hand-unwraps `.data` and reads
 * commands / revoked / reconcileContent. Nothing imports across the boundary, so
 * either side could change shape and the other would silently stop working.
 *
 * That is this subsystem's whole history. reconcileContent was wired on both
 * sides, green on both sides, and ALWAYS undefined at runtime until the .data
 * unwrap landed. contentVersion went unwhitelisted and every heartbeat was
 * rejected for four releases. content:impression.timestamp was typed string
 * while both clients send a number, and that table held zero rows for the
 * repo's lifetime. Every one passed its own side's tests.
 *
 * The fixture is byte-identical to vizora-tv/src/ack-envelope.fixture.json.
 * A wire change must break BOTH repos' tests — that is the whole point.
 */
const wire = JSON.parse(
  readFileSync(join(__dirname, 'ack-envelope.fixture.json'), 'utf8'),
) as { envelope: { data: Record<string, unknown> }; legacyUnwrapped: Record<string, unknown> };

describe('heartbeat ack — wire contract with the TV client', () => {
  it('produces the exact envelope shape the client unwraps', () => {
    const built = createSuccessResponse(wire.envelope.data);
    // Key SET, not merely presence: an added or renamed key is a wire change.
    expect(Object.keys(built).sort()).toEqual(['data', 'success', 'timestamp']);
    expect(built.success).toBe(true);
    expect(built.data).toEqual(wire.envelope.data);
  });

  it('carries all three fields the client acts on, intact', () => {
    const d = createSuccessResponse(wire.envelope.data).data as Record<string, unknown>;
    // Named individually so a partial regression says WHICH field went missing.
    expect(d.commands).toEqual(wire.envelope.data.commands);
    expect(d.revoked).toBe(wire.envelope.data.revoked);
    expect(d.reconcileContent).toBe(wire.envelope.data.reconcileContent);
  });

  it('keeps both accepted shapes carrying the same fields', () => {
    // The client accepts the wrapped envelope OR a legacy unwrapped payload.
    // If these diverge, the two repos have drifted.
    expect(Object.keys(wire.legacyUnwrapped).sort()).toEqual(
      Object.keys(wire.envelope.data).sort(),
    );
  });
});
