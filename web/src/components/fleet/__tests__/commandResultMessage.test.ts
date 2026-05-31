import { formatFleetCommandResult } from '../commandResultMessage';

describe('formatFleetCommandResult', () => {
  it('treats zero-target commands as errors instead of successful no-ops', () => {
    expect(formatFleetCommandResult('Emergency content', {
      devicesTargeted: 0,
      devicesDelivered: 0,
      devicesQueued: 0,
      devicesFailed: 0,
    })).toEqual({
      kind: 'error',
      message: 'Emergency content did not match any devices',
    });
  });
});
