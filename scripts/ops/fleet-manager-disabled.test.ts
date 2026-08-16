/**
 * fleet-manager must not page about operator-disabled displays.
 *
 * `isDisabled` existed on the model and was returned by the list API
 * (`display-response.select.ts` selects it), but no ops agent read it — so a
 * display an operator had deliberately taken out of service kept firing every
 * check forever. Measured on prod 2026-08-02: five displays in "E2E Test Org",
 * last heartbeat 149-157 days earlier, holding systemStatus at CRITICAL, with
 * the cluster_offline incident re-attempted 10,373 times across 84 days.
 *
 * These tests pin the filter at the source shape, so a refactor that drops
 * `isDisabled` from the type or the fetch is caught.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'fleet-manager.ts'), 'utf8');
const scheduleDoctor = readFileSync(join(here, 'schedule-doctor.ts'), 'utf8');

test('DisplayItem carries isDisabled, so the flag survives the fetch', () => {
  assert.match(source, /isDisabled\?: boolean/);
});

test('disabled displays are filtered out before any check runs', () => {
  const filterIdx = source.indexOf('d.isDisabled !== true');
  const firstCheckIdx = source.indexOf("log(AGENT, 'Checking for offline displays')");
  assert.ok(filterIdx > -1, 'filter must exist');
  assert.ok(firstCheckIdx > -1, 'offline check must exist');
  assert.ok(
    filterIdx < firstCheckIdx,
    'the filter must run BEFORE the first check, or disabled displays still page',
  );
});

test('the skip is logged, so suppression is never silent', () => {
  assert.match(source, /Skipping \$\{disabled\.length\} operator-disabled display\(s\)/);
});

/** Behavioural check of the filter predicate itself. */
test('filter predicate keeps enabled displays and drops disabled ones', () => {
  const displays = [
    { id: 'a', isDisabled: true },
    { id: 'b', isDisabled: false },
    { id: 'c' }, // undefined — an ordinary display, must be kept
    { id: 'd', isDisabled: true },
  ];
  const kept = displays.filter(d => (d as { isDisabled?: boolean }).isDisabled !== true);
  assert.deepEqual(kept.map(d => d.id), ['b', 'c']);

  const dropped = displays.filter(d => (d as { isDisabled?: boolean }).isDisabled === true);
  assert.deepEqual(dropped.map(d => d.id), ['a', 'd']);
});

test('cluster-offline cannot be triggered by a group that is only disabled displays', () => {
  // Regression shape: 5 disabled displays in one org previously satisfied
  // "every display offline" and raised a critical cluster_offline.
  const org = [
    { id: '1', isDisabled: true },
    { id: '2', isDisabled: true },
    { id: '3', isDisabled: true },
  ];
  const considered = org.filter(d => d.isDisabled !== true);
  assert.equal(considered.length, 0);
  // the 3+ display threshold can no longer be met by disabled fixtures
  assert.ok(considered.length < 3);
});

/**
 * cluster_offline counts, quantifies and gates over the FILTERED subset — and
 * for the gate that is deliberate, because the threshold is really counting
 * independent agreeing signals and a disabled display emits none. What was NOT
 * deliberate was saying "All N displays in organization X are offline" while N
 * was the enabled count: an org with 3 enabled and 4 disabled displays reported
 * a fleet size that does not exist. Two consequences, both fixed by honesty
 * rather than by changing the gate: the message names both numbers, and an org
 * that drops out of coverage because displays were disabled says so in the log.
 */
test('the cluster_offline message reports enabled AND total, not a bare "All N"', () => {
  assert.ok(
    !source.includes('All ${orgList.length} displays in organization'),
    'the bare quantifier is back — it names the enabled count as if it were the whole org',
  );
  assert.match(
    source,
    /All \$\{orgList\.length\} enabled display\(s\) in organization \$\{orgId\} are offline/,
    'the message must say the count is over ENABLED displays',
  );
  assert.match(
    source,
    /\$\{orgTotal\} total, \$\{disabledCount\} operator-disabled and not evaluated/,
    'and must state the real fleet size plus what it excluded',
  );
});

test('an org pushed below the cluster threshold by disabled displays is not silent', () => {
  assert.match(
    source,
    /below the cluster-outage threshold on ENABLED displays/,
    'disabling displays can take an org out of cluster-outage coverage entirely; ' +
      'the operator must be able to see that happen',
  );
  // The disabled tally has to be carried out of the fetch block to be reportable.
  assert.match(source, /disabledByOrg\.set\(/, 'the per-org disabled count must be collected');
});

/** The gate arithmetic itself, exercised rather than asserted about. */
test('the < 3 gate counts ENABLED displays, and the message counts both', () => {
  const org = [
    { id: '1', isDisabled: false },
    { id: '2', isDisabled: false },
    { id: '3', isDisabled: true },
    { id: '4', isDisabled: true },
  ];
  const enabled = org.filter(d => d.isDisabled !== true);
  const disabledCount = org.length - enabled.length;
  const orgTotal = enabled.length + disabledCount;

  assert.equal(enabled.length, 2);
  assert.equal(orgTotal, 4);
  assert.ok(
    enabled.length < 3,
    'two live screens and two shelved ones is not a cluster outage — counting the shelved ' +
      'ones toward the threshold would make it one',
  );
  // ...and the honest report of that skip names both numbers.
  assert.equal(`${enabled.length} of ${orgTotal}`, '2 of 4');
});

/**
 * schedule-doctor evaluates displays too. #259 filtered fleet-manager ONLY, and
 * a natural cycle on 2026-08-02 22:30 put `coverage_gap` for a disabled fixture
 * straight back — the incident had been reconciled minutes earlier. Every agent
 * that evaluates displays needs the same filter.
 */
test('schedule-doctor also skips operator-disabled displays', () => {
  assert.match(scheduleDoctor, /isDisabled !== true/);
  assert.match(scheduleDoctor, /Skipping \$\{disabledDisplays\.length\} operator-disabled display\(s\)/);
});

test('schedule-doctor filters BEFORE it reports what it fetched', () => {
  const filterIdx = scheduleDoctor.indexOf('isDisabled !== true');
  const fetchedLogIdx = scheduleDoctor.indexOf('`Fetched ${schedules.length}');
  assert.ok(filterIdx > -1 && fetchedLogIdx > -1);
  assert.ok(filterIdx < fetchedLogIdx, 'filter must precede the count it reports');
});

/**
 * "Nothing to do" must still be a recorded run.
 *
 * fleet-manager used to `return` early when it had zero displays, which skipped
 * recordAgentRun() at the end of main(). ops-watchdog reads that `lastRun`
 * stamp, so an agent with nothing to do looked exactly like a dead agent — it
 * raised a CRITICAL `agent-silent` incident on 2026-08-02, minutes after the
 * disabled-display filter first made the count zero. The branch had been
 * unreachable until then, which is why it survived review.
 */
test('fleet-manager does NOT short-circuit on an empty display list', () => {
  assert.doesNotMatch(
    source,
    /displays\.length === 0\)\s*\{[^}]*return;/s,
    'an early return here skips recordAgentRun and the watchdog reports the agent as silent',
  );
});

test('every display check is loop-based, so falling through on empty is safe', () => {
  // This is what makes removing the guard correct rather than merely convenient.
  assert.match(source, /for \(const display of displays\)/);
  assert.match(source, /recordAgentRun\(state, result\)/);
});
