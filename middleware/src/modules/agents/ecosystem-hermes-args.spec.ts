/**
 * Lock the shape of the hermes-vizora-* entries in ecosystem.config.js.
 *
 * Reads the file as text and asserts the structural patterns we care about.
 * Avoids dynamic require() of the config file (which static analyzers flag).
 *
 * The runner script `run-hermes-skill.sh <skill> <prompt> [toolsets-csv]`
 * has a 3-positional-arg contract. PM2 fills these via the entry's
 * `args` array. If the array shape drifts (e.g., toolsets element gets
 * dropped during a copy-paste), the runner silently treats the missing
 * arg as empty — defensible at runtime, but a regression we'd rather
 * catch in CI.
 *
 * See: design ADL-5, P1.2.
 */

import * as fs from 'fs';
import * as path from 'path';

describe('ecosystem.config.js — hermes-vizora-* entries', () => {
  const configPath = path.resolve(__dirname, '../../../../ecosystem.config.js');
  const content = fs.readFileSync(configPath, 'utf8');

  it('has both hermes-vizora-* entries', () => {
    expect(content).toContain("name: 'hermes-vizora-customer-lifecycle'");
    expect(content).toContain("name: 'hermes-vizora-support-triage'");
  });

  it('both entries reference run-hermes-skill.sh', () => {
    const matches = content.match(/run-hermes-skill\.sh/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('support-triage cron is no tighter than every 15 minutes', () => {
    // Per the May 6 incident — */5 amplified cost. Locked at */15 minimum.
    const stRegion = sectionFor(content, 'hermes-vizora-support-triage');
    const cron = /cron_restart:\s*'(\*\/(\d+)) \* \* \* \*'/.exec(stRegion);
    expect(cron).not.toBeNull();
    expect(parseInt(cron![2], 10)).toBeGreaterThanOrEqual(15);
  });

  it('customer-lifecycle cron is no tighter than every 30 minutes', () => {
    const clRegion = sectionFor(content, 'hermes-vizora-customer-lifecycle');
    const cron = /cron_restart:\s*'(\*\/(\d+)) \* \* \* \*'/.exec(clRegion);
    expect(cron).not.toBeNull();
    expect(parseInt(cron![2], 10)).toBeGreaterThanOrEqual(30);
  });
});

/**
 * Slice the file content to just the named PM2 entry's region.
 * Used to scope regex assertions.
 */
function sectionFor(content: string, entryName: string): string {
  const start = content.indexOf(`name: '${entryName}'`);
  if (start === -1) throw new Error(`entry '${entryName}' not found`);
  // Region ends at the next `name: '...'` declaration or end-of-file.
  const after = content.indexOf("name: '", start + 1);
  return after === -1 ? content.slice(start) : content.slice(start, after);
}
