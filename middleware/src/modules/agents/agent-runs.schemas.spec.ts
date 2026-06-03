import { RecordRunInput } from './agent-runs.schemas';

describe('RecordRunInput', () => {
  const basePayload = {
    skillName: 'vizora-customer-lifecycle',
    startedAt: '2026-06-03T12:00:00.000Z',
    finishedAt: '2026-06-03T12:00:30.000Z',
    exitCode: 0,
    outcome: 'success',
  };

  it('accepts runner-measured costMicrodollars as a nonnegative integer', () => {
    const parsed = RecordRunInput.safeParse({
      ...basePayload,
      costMicrodollars: 2400,
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual(expect.objectContaining({ costMicrodollars: 2400 }));
  });

  it('rejects negative or fractional runner-measured costMicrodollars', () => {
    expect(RecordRunInput.safeParse({
      ...basePayload,
      costMicrodollars: -1,
    }).success).toBe(false);

    expect(RecordRunInput.safeParse({
      ...basePayload,
      costMicrodollars: 12.5,
    }).success).toBe(false);
  });
});
