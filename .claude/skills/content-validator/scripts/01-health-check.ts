#!/usr/bin/env npx tsx
/**
 * 01 — Infrastructure Health Check
 *
 * Validates that the Vizora API and its dependencies are operational.
 * No auth required — uses public health endpoints.
 *
 * Usage: npx tsx 01-health-check.ts --base-url http://localhost:3000
 * Exit: 0 = healthy, 1 = degraded, 2 = unhealthy/unreachable
 */

import { parseArgs, outputJson, fail, type HealthStatus } from './lib.js';

async function main() {
  const args = parseArgs();
  const start = Date.now();
  const services: HealthStatus['services'] = {};

  // 1. Basic reachability (liveness)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const livenessStart = Date.now();

    const res = await fetch(`${args.baseUrl}/api/v1/health`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);

    if (res.ok) {
      services['api'] = { status: 'healthy', responseTimeMs: Date.now() - livenessStart };
    } else {
      services['api'] = { status: 'unhealthy', error: `HTTP ${res.status}` };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    services['api'] = { status: 'unhealthy', error: message };

    // If the API itself is unreachable, stop here
    const result: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
      services,
    };
    outputJson(result);
    process.exitCode = 2;
    return;
  }

  // 2. Readiness probe (checks DB, Redis, etc.)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const readyStart = Date.now();

    const res = await fetch(`${args.baseUrl}/api/v1/health/ready`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);

    const body = await res.json() as Record<string, unknown>;
    const readyMs = Date.now() - readyStart;

    // The readiness endpoint returns service-level details
    if (res.ok) {
      // Parse individual service statuses from the response
      const details = (body.data ?? body) as Record<string, unknown>;
      for (const [key, value] of Object.entries(details)) {
        if (key === 'status' || key === 'timestamp') continue;
        if (typeof value === 'object' && value !== null) {
          const svc = value as Record<string, unknown>;
          services[key] = {
            status: svc.status === 'up' || svc.status === 'healthy' ? 'healthy' : 'degraded',
            responseTimeMs: typeof svc.responseTime === 'number' ? svc.responseTime : undefined,
          };
        }
      }
      services['readiness'] = { status: 'healthy', responseTimeMs: readyMs };
    } else {
      services['readiness'] = {
        status: 'unhealthy',
        responseTimeMs: readyMs,
        error: `HTTP ${res.status}`,
      };

      // Try to extract individual service failures
      const details = (body.data ?? body) as Record<string, unknown>;
      for (const [key, value] of Object.entries(details)) {
        if (key === 'status' || key === 'timestamp') continue;
        if (typeof value === 'object' && value !== null) {
          const svc = value as Record<string, unknown>;
          services[key] = {
            status: svc.status === 'up' || svc.status === 'healthy' ? 'healthy' : 'unhealthy',
            error: typeof svc.error === 'string' ? svc.error : undefined,
          };
        }
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    services['readiness'] = { status: 'unhealthy', error: message };
  }

  // 3. Response time assessment
  const apiMs = services['api']?.responseTimeMs ?? 0;
  if (apiMs > 5000) {
    services['api-latency'] = {
      status: 'degraded',
      responseTimeMs: apiMs,
      error: 'API response time >5s — may indicate resource pressure',
    };
  }

  // 4. Determine overall status
  const statuses = Object.values(services).map((s) => s.status);
  let overall: HealthStatus['status'] = 'healthy';
  if (statuses.includes('unhealthy')) {
    overall = 'unhealthy';
  } else if (statuses.includes('degraded')) {
    overall = 'degraded';
  }

  const result: HealthStatus = {
    status: overall,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
    services,
  };

  outputJson(result);
  process.exitCode = overall === 'healthy' ? 0 : overall === 'degraded' ? 1 : 2;
}

main().catch((err) => fail(err.message));
