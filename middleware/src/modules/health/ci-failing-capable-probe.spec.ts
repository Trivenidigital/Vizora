// TEMPORARY — CI failing-capable probe. DO NOT MERGE.
//
// This spec deliberately fails to prove that the CI `test` job actually turns
// RED on a real test failure (and, with branch protection, blocks the merge) —
// i.e. the gate is failing-capable, not green-because-it-cannot-fail (the
// S1-3 continue-on-error pattern). The branch test/ci-failing-capable-probe
// and its PR are deleted once the red check + blocked-merge state are observed.
describe('CI failing-capable probe (temporary — do not merge)', () => {
  it('deliberately fails so we can confirm the CI test gate can turn red', () => {
    expect(1 + 1).toBe(3);
  });
});
