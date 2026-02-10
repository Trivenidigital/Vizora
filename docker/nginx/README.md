# Vizora Nginx Reverse Proxy — HA Deployment Guide

## Overview

Nginx acts as the TLS-terminating reverse proxy for all Vizora services.
It routes external HTTPS traffic to three backend upstreams:

| Upstream | Service | Default Port |
|----------|---------|-------------|
| `web_dashboard` | Next.js Web Dashboard | 3001 |
| `middleware_api` | NestJS Middleware API | 3000 |
| `realtime_gateway` | Socket.IO Realtime Gateway | 3002 |

## High Availability Configuration

### Health Checks

Each upstream server is configured with passive health checking:

```
server host.docker.internal:3000 max_fails=3 fail_timeout=30s;
```

- **max_fails=3** — Mark server as unavailable after 3 consecutive failures.
- **fail_timeout=30s** — Wait 30 seconds before retrying a failed server.

### Backup Servers

Middleware and Web upstreams include backup server entries. In a
multi-instance deployment, replace the backup line with additional
primary server entries:

```nginx
upstream middleware_api {
    server middleware-1:3000 max_fails=3 fail_timeout=30s;
    server middleware-2:3000 max_fails=3 fail_timeout=30s;
    keepalive 16;
}
```

### Sticky Sessions (Realtime Gateway)

The `realtime_gateway` upstream uses `ip_hash` to ensure that WebSocket
connections from the same client IP are routed to the same backend instance.
This is critical for Socket.IO, which requires connection affinity.

```nginx
upstream realtime_gateway {
    ip_hash;
    server host.docker.internal:3002 max_fails=3 fail_timeout=30s;
    keepalive 16;
}
```

## Scaling Guide

### Services That Can Scale Horizontally

| Service | Scalable | Reason |
|---------|----------|--------|
| Middleware API | Yes | Stateless REST API, session state in Redis |
| Web Dashboard | Yes | Stateless Next.js rendering |
| Realtime Gateway | **No** | Maintains in-memory WebSocket state and room membership |

### Scaling with Docker Compose

When the application services are containerized (instead of running on the
host via PM2), use `deploy.replicas` in `docker-compose.yml`:

```yaml
services:
  middleware:
    image: vizora/middleware
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 512M

  web:
    image: vizora/web
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 512M

  realtime:
    image: vizora/realtime
    deploy:
      replicas: 1   # Must stay at 1 for state consistency
      resources:
        limits:
          memory: 512M
```

Update the upstream blocks in `nginx.conf` to reference the Docker service
names instead of `host.docker.internal`:

```nginx
upstream middleware_api {
    server middleware:3000 max_fails=3 fail_timeout=30s;
    keepalive 16;
}
```

Docker's built-in DNS will round-robin across replicas automatically.

### Scaling with PM2 (Host Mode)

When running on the host via PM2, scale middleware by adjusting
`ecosystem.config.js`:

```js
{
  name: 'middleware',
  instances: 2,         // or 'max' for all CPU cores
  exec_mode: 'cluster',
}
```

Then add the additional instance ports to the upstream block:

```nginx
upstream middleware_api {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3010 max_fails=3 fail_timeout=30s;
    keepalive 16;
}
```

### Linux Host Setup

On Linux hosts, add `extra_hosts` to the nginx service in
`docker-compose.yml` so `host.docker.internal` resolves:

```yaml
nginx:
  extra_hosts:
    - "host.docker.internal:host-gateway"
```

## SSL Certificate Setup

Generate certificates before starting Nginx:

```bash
./scripts/setup-ssl.sh your-domain.com
```

Certificates are mounted read-only from `/etc/letsencrypt`.
