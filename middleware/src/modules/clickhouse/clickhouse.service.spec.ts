jest.mock('@clickhouse/client', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@clickhouse/client';
import { ClickHouseService } from './clickhouse.service';
import { DEVICE_HEALTH_SAMPLES_TABLE } from './clickhouse.constants';

const resultSet = (rows: unknown[]) => ({ json: jest.fn().mockResolvedValue(rows) });

describe('ClickHouseService (middleware reader)', () => {
  let mockClient: {
    query: jest.Mock;
    command: jest.Mock;
    ping: jest.Mock;
    close: jest.Mock;
  };
  const originalEnabled = process.env.CLICKHOUSE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CLICKHOUSE_ENABLED; // default: enabled
    mockClient = {
      query: jest.fn(),
      command: jest.fn().mockResolvedValue({}),
      ping: jest.fn().mockResolvedValue({ success: true }),
      close: jest.fn().mockResolvedValue(undefined),
    };
    (createClient as jest.Mock).mockReturnValue(mockClient);
  });

  afterAll(() => {
    if (originalEnabled === undefined) delete process.env.CLICKHOUSE_ENABLED;
    else process.env.CLICKHOUSE_ENABLED = originalEnabled;
  });

  describe('getDeviceUptimeAggregate', () => {
    it('parses a real uptime aggregate from ClickHouse rows', async () => {
      mockClient.query.mockResolvedValue(
        resultSet([
          {
            up_buckets: '288',
            sample_count: '1152',
            first_sample: '2026-07-01 00:00:00',
            last_sample: '2026-07-01 23:59:00',
          },
        ]),
      );
      const service = new ClickHouseService();

      const agg = await service.getDeviceUptimeAggregate('o1', 'd1', new Date('2026-07-01T00:00:00Z'));

      expect(agg).not.toBeNull();
      expect(agg!.deviceId).toBe('d1');
      expect(agg!.upBuckets).toBe(288);
      expect(agg!.sampleCount).toBe(1152);
      expect(agg!.firstSample.toISOString()).toBe('2026-07-01T00:00:00.000Z');
      expect(agg!.lastSample.toISOString()).toBe('2026-07-01T23:59:00.000Z');
      // Parameterized query — org + device + since are bound, not interpolated.
      const call = mockClient.query.mock.calls[0][0];
      expect(call.query_params).toMatchObject({ organizationId: 'o1', deviceId: 'd1' });
      expect(call.query).toContain(DEVICE_HEALTH_SAMPLES_TABLE);
    });

    it('returns null (→ insufficient data) when the query throws (fail-open)', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('ClickHouse unreachable'));
      const service = new ClickHouseService();

      await expect(
        service.getDeviceUptimeAggregate('o1', 'd1', new Date()),
      ).resolves.toBeNull();
    });

    it('returns null when ClickHouse is disabled', async () => {
      process.env.CLICKHOUSE_ENABLED = 'false';
      const service = new ClickHouseService();

      await expect(service.getDeviceUptimeAggregate('o1', 'd1', new Date())).resolves.toBeNull();
      expect(createClient).not.toHaveBeenCalled();
      delete process.env.CLICKHOUSE_ENABLED;
    });
  });

  describe('getOrgUptimeAggregates', () => {
    it('maps each grouped row to an aggregate', async () => {
      mockClient.query.mockResolvedValue(
        resultSet([
          { deviceId: 'd1', up_buckets: '10', sample_count: '40', first_sample: '2026-07-01 00:00:00', last_sample: '2026-07-01 01:00:00' },
          { deviceId: 'd2', up_buckets: '5', sample_count: '20', first_sample: '2026-07-01 00:00:00', last_sample: '2026-07-01 00:30:00' },
        ]),
      );
      const service = new ClickHouseService();

      const aggs = await service.getOrgUptimeAggregates('o1', new Date());
      expect(aggs).toHaveLength(2);
      expect(aggs![0]).toMatchObject({ deviceId: 'd1', upBuckets: 10, sampleCount: 40 });
    });

    it('returns null when the query throws (fail-open)', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('down'));
      const service = new ClickHouseService();
      await expect(service.getOrgUptimeAggregates('o1', new Date())).resolves.toBeNull();
    });
  });

  describe('getLatestSampleTime', () => {
    it('reports available + lastSample when samples exist', async () => {
      mockClient.query.mockResolvedValue(
        resultSet([{ last_sample: '2026-07-11 10:00:00', sample_count: '5' }]),
      );
      const service = new ClickHouseService();

      const res = await service.getLatestSampleTime();
      expect(res.available).toBe(true);
      expect(res.lastSample?.toISOString()).toBe('2026-07-11T10:00:00.000Z');
    });

    it('reports available + null lastSample when the table is empty', async () => {
      mockClient.query.mockResolvedValue(
        resultSet([{ last_sample: '1970-01-01 00:00:00', sample_count: '0' }]),
      );
      const service = new ClickHouseService();

      const res = await service.getLatestSampleTime();
      expect(res.available).toBe(true);
      expect(res.lastSample).toBeNull();
    });

    it('reports unavailable when the query throws (fail-open — do not alert)', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('unreachable'));
      const service = new ClickHouseService();

      const res = await service.getLatestSampleTime();
      expect(res.available).toBe(false);
      expect(res.lastSample).toBeNull();
    });
  });

  describe('ensureSchema / isHealthy', () => {
    it('ensureSchema issues the idempotent CREATE TABLE and swallows errors', async () => {
      const service = new ClickHouseService();
      await service.ensureSchema();
      expect(mockClient.command).toHaveBeenCalledTimes(1);
      expect(mockClient.command.mock.calls[0][0].query).toContain(
        `CREATE TABLE IF NOT EXISTS ${DEVICE_HEALTH_SAMPLES_TABLE}`,
      );

      mockClient.command.mockRejectedValueOnce(new Error('DDL failed'));
      await expect(service.ensureSchema()).resolves.not.toThrow();
    });

    it('isHealthy reflects ping and swallows errors', async () => {
      const service = new ClickHouseService();
      await expect(service.isHealthy()).resolves.toBe(true);
      mockClient.ping.mockRejectedValueOnce(new Error('down'));
      await expect(service.isHealthy()).resolves.toBe(false);
    });
  });
});
