import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

/**
 * Restricts access to /internal/metrics to localhost or requests with
 * a valid METRICS_TOKEN bearer token. In production, Prometheus/Grafana
 * should scrape from localhost or a private network.
 */
@Injectable()
export class MetricsAuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Allow localhost access (Prometheus scraping from same host)
    const remoteIp = req.ip || req.socket.remoteAddress || '';
    const isLocalhost =
      remoteIp === '127.0.0.1' ||
      remoteIp === '::1' ||
      remoteIp === '::ffff:127.0.0.1';

    if (isLocalhost) {
      return next();
    }

    // Allow access with bearer token if METRICS_TOKEN is configured
    const metricsToken = process.env.METRICS_TOKEN;
    if (metricsToken) {
      const authHeader = req.headers.authorization;
      const expected = `Bearer ${metricsToken}`;
      if (
        authHeader &&
        authHeader.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
      ) {
        return next();
      }
    }

    // In development, allow all access for convenience
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }

    res.status(403).json({
      statusCode: 403,
      message: 'Metrics access denied',
      error: 'Forbidden',
    });
  }
}
