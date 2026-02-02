# Vizora Production Deployment Guide

## Overview

This guide provides a cost-effective deployment strategy for Vizora, starting with 100 users and designed to scale as your business grows.

### Vizora Components

| Component | Description | Port | Resource Needs |
|-----------|-------------|------|----------------|
| **Web Dashboard** | Next.js frontend | 3001 | Low CPU, Low RAM |
| **API Server** | NestJS middleware | 3000 | Medium CPU, Medium RAM |
| **Realtime Server** | WebSocket gateway | 3002 | Low CPU, Medium RAM |
| **PostgreSQL** | Primary database | 5432 | Medium CPU, High RAM |
| **Redis** | Cache & pub/sub | 6379 | Low CPU, Medium RAM |
| **File Storage** | Content uploads | - | High Storage |

---

## Recommended Architecture by Scale

### Phase 1: Startup (1-100 Users) - **$20-50/month**

```
┌─────────────────────────────────────────────────────────┐
│                    Single VPS Server                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │   Web App   │ │   API       │ │  Realtime   │        │
│  │   (Next.js) │ │   (NestJS)  │ │  (Socket.io)│        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │  PostgreSQL │ │    Redis    │ │   Nginx     │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
                          │
                    Cloudflare CDN
                    (Free tier)
```

### Phase 2: Growth (100-1,000 Users) - **$100-200/month**

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  App Server  │    │  App Server  │    │   Database   │
│  (Web+API+RT)│    │  (Web+API+RT)│    │  (Managed)   │
└──────────────┘    └──────────────┘    └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    Load Balancer
                            │
                    Cloudflare CDN
```

### Phase 3: Scale (1,000+ Users) - **$300-500/month**

```
┌─────────┐ ┌─────────┐ ┌─────────┐    ┌─────────────┐
│   Web   │ │   Web   │ │   Web   │    │   Managed   │
│ Server  │ │ Server  │ │ Server  │    │  PostgreSQL │
└─────────┘ └─────────┘ └─────────┘    └─────────────┘
     │           │           │                │
     └───────────┼───────────┘                │
                 │                            │
┌─────────┐ ┌─────────┐ ┌─────────┐    ┌─────────────┐
│   API   │ │   API   │ │   API   │    │   Managed   │
│ Server  │ │ Server  │ │ Server  │    │    Redis    │
└─────────┘ └─────────┘ └─────────┘    └─────────────┘
     │           │           │                │
     └───────────┴───────────┴────────────────┘
                        │
              Kubernetes / Docker Swarm
                        │
                Load Balancer + CDN
```

---

## Cloud Provider Comparison

### For Startups (Best Value)

| Provider | Smallest Plan | Specs | Monthly Cost | Best For |
|----------|--------------|-------|--------------|----------|
| **Hetzner** | CX22 | 2 vCPU, 4GB RAM, 40GB | **€4.50 (~$5)** | Best price/performance |
| **DigitalOcean** | Basic | 2 vCPU, 4GB RAM, 80GB | $24 | Easy to use |
| **Vultr** | Cloud Compute | 2 vCPU, 4GB RAM, 80GB | $24 | Global locations |
| **Linode** | Shared | 2 vCPU, 4GB RAM, 80GB | $24 | Good support |
| **Railway** | Pro | Usage-based | ~$20-50 | Zero DevOps |
| **Render** | Starter | Per service | ~$25-50 | Easy deployment |
| **AWS Lightsail** | Small | 2 vCPU, 4GB RAM, 80GB | $36 | AWS ecosystem |

### My Recommendation: **Hetzner + Cloudflare**

**Why Hetzner?**
- 3-4x cheaper than AWS/GCP/Azure for equivalent specs
- Excellent performance (German engineering!)
- Great for EU GDPR compliance
- Reliable uptime (99.9%+ SLA)

**Why Cloudflare?**
- Free CDN and DDoS protection
- Free SSL certificates
- Caches static assets globally
- Reduces server load significantly

---

## Phase 1: Startup Deployment ($20-50/month)

### Option A: Single VPS with Docker (Recommended)

**Cost Breakdown:**
| Item | Provider | Cost/Month |
|------|----------|------------|
| VPS (4GB RAM) | Hetzner CX22 | €4.50 (~$5) |
| VPS (8GB RAM) | Hetzner CX32 | €8.50 (~$9) |
| Domain | Cloudflare | ~$10/year |
| CDN + SSL | Cloudflare | Free |
| Backups | Hetzner | €0.90 (~$1) |
| **Total** | | **~$15-20/month** |

### Step-by-Step Setup

#### 1. Create Hetzner Account & Server

1. Go to https://www.hetzner.com/cloud
2. Create account and verify
3. Create new project "Vizora"
4. Add server:
   - Location: Choose closest to your users
   - Image: Ubuntu 24.04
   - Type: CX22 (to start) or CX32 (recommended)
   - Networking: Public IPv4 + IPv6
   - SSH Key: Add your SSH key

#### 2. Initial Server Setup

```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Create app directory
mkdir -p /opt/vizora
cd /opt/vizora
```

#### 3. Create Docker Compose Configuration

Create `/opt/vizora/docker-compose.yml`:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: vizora-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: vizora
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: vizora
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vizora"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: vizora-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # API Server (Middleware)
  api:
    image: vizora/api:latest
    container_name: vizora-api
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://vizora:${DB_PASSWORD}@postgres:5432/vizora
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      DEVICE_JWT_SECRET: ${DEVICE_JWT_SECRET}
      API_BASE_URL: https://api.${DOMAIN}
      CORS_ORIGIN: https://${DOMAIN},https://www.${DOMAIN}
    volumes:
      - uploads:/app/uploads
    ports:
      - "127.0.0.1:3000:3000"

  # Realtime Server (WebSocket)
  realtime:
    image: vizora/realtime:latest
    container_name: vizora-realtime
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://vizora:${DB_PASSWORD}@postgres:5432/vizora
      REDIS_URL: redis://redis:6379
      DEVICE_JWT_SECRET: ${DEVICE_JWT_SECRET}
      CORS_ORIGIN: https://${DOMAIN},https://www.${DOMAIN}
    ports:
      - "127.0.0.1:3002:3002"

  # Web Dashboard (Next.js)
  web:
    image: vizora/web:latest
    container_name: vizora-web
    restart: unless-stopped
    depends_on:
      - api
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: https://api.${DOMAIN}
      NEXT_PUBLIC_REALTIME_URL: wss://realtime.${DOMAIN}
    ports:
      - "127.0.0.1:3001:3001"

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: vizora-nginx
    restart: unless-stopped
    depends_on:
      - web
      - api
      - realtime
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - uploads:/var/www/uploads:ro
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
  redis_data:
  uploads:
```

#### 4. Create Nginx Configuration

Create `/opt/vizora/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_conn_zone $binary_remote_addr zone=conn:10m;

    # Upstream servers
    upstream web {
        server web:3001;
    }

    upstream api {
        server api:3000;
    }

    upstream realtime {
        server realtime:3002;
    }

    # HTTP -> HTTPS redirect
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    # Main dashboard
    server {
        listen 443 ssl http2;
        server_name YOUR_DOMAIN www.YOUR_DOMAIN;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
        ssl_prefer_server_ciphers off;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        location / {
            proxy_pass http://web;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    # API server
    server {
        listen 443 ssl http2;
        server_name api.YOUR_DOMAIN;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;

        # Rate limiting for API
        limit_req zone=api burst=20 nodelay;
        limit_conn conn 10;

        # File uploads
        client_max_body_size 100M;

        location / {
            proxy_pass http://api;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Serve uploaded files
        location /uploads {
            alias /var/www/uploads;
            expires 7d;
            add_header Cache-Control "public, immutable";
        }
    }

    # Realtime WebSocket server
    server {
        listen 443 ssl http2;
        server_name realtime.YOUR_DOMAIN;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;

        location / {
            proxy_pass http://realtime;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # WebSocket specific
            proxy_read_timeout 86400;
            proxy_send_timeout 86400;
        }
    }

    # Display client (for web-based displays)
    server {
        listen 443 ssl http2;
        server_name display.YOUR_DOMAIN;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;

        root /var/www/display;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }
    }
}
```

#### 5. Create Environment File

Create `/opt/vizora/.env`:

```bash
# Generate secure passwords
DB_PASSWORD=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
DEVICE_JWT_SECRET=$(openssl rand -hex 32)

# Domain
DOMAIN=yourdomain.com
```

Run:
```bash
# Generate .env file with secure secrets
cat > /opt/vizora/.env << EOF
DB_PASSWORD=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
DEVICE_JWT_SECRET=$(openssl rand -hex 32)
DOMAIN=yourdomain.com
EOF

# Secure the file
chmod 600 /opt/vizora/.env
```

#### 6. Setup SSL with Certbot

```bash
# Install Certbot
apt install certbot -y

# Get certificates (stop nginx first if running)
certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com -d realtime.yourdomain.com -d display.yourdomain.com

# Copy certificates
mkdir -p /opt/vizora/ssl
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /opt/vizora/ssl/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /opt/vizora/ssl/

# Setup auto-renewal
echo "0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/yourdomain.com/*.pem /opt/vizora/ssl/ && docker restart vizora-nginx" | crontab -
```

#### 7. Build and Push Docker Images

On your development machine:

```bash
# Login to Docker Hub (or your registry)
docker login

# Build and push images
cd /path/to/vizora

# Build API
cd middleware
docker build -t yourusername/vizora-api:latest .
docker push yourusername/vizora-api:latest

# Build Realtime
cd ../realtime
docker build -t yourusername/vizora-realtime:latest .
docker push yourusername/vizora-realtime:latest

# Build Web
cd ../web
docker build -t yourusername/vizora-web:latest .
docker push yourusername/vizora-web:latest
```

#### 8. Deploy

On the server:

```bash
cd /opt/vizora

# Pull images and start
docker compose pull
docker compose up -d

# Check status
docker compose ps
docker compose logs -f
```

---

### Option B: Railway (Zero DevOps)

**Cost: ~$20-50/month** (usage-based)

Railway is perfect if you want zero server management.

#### Setup:

1. Go to https://railway.app
2. Create account
3. Create new project
4. Add services:

**PostgreSQL:**
- Click "New" → "Database" → "PostgreSQL"

**Redis:**
- Click "New" → "Database" → "Redis"

**API Service:**
```bash
# In your middleware folder
railway init
railway link
railway up
```

**Realtime Service:**
```bash
# In your realtime folder
railway init
railway link
railway up
```

**Web Service:**
```bash
# In your web folder
railway init
railway link
railway up
```

5. Add environment variables in Railway dashboard
6. Setup custom domain

---

### Option C: Render

**Cost: ~$25-50/month**

Similar to Railway but with free tier for some services.

1. Go to https://render.com
2. Connect GitHub repository
3. Create services:
   - Web Service (web dashboard)
   - Web Service (API)
   - Web Service (Realtime)
   - PostgreSQL (managed)
   - Redis (managed)

---

## Phase 2: Growth Deployment ($100-200/month)

When you reach 500+ users or need higher availability:

### Upgrade Path

1. **Separate Database Server**
   - Use managed PostgreSQL (Hetzner Managed DB, DigitalOcean, or Supabase)
   - Cost: ~$15-30/month

2. **Add Second App Server**
   - Deploy identical app server
   - Add load balancer (Hetzner LB: €5/month)

3. **Use Managed Redis**
   - Upstash (serverless): Free tier available
   - Or Redis Cloud: ~$7/month

### Updated Architecture

```yaml
# docker-compose.prod.yml for multiple servers
version: '3.8'

services:
  api:
    image: vizora/api:latest
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1'
          memory: 1G
    environment:
      DATABASE_URL: ${MANAGED_DB_URL}
      REDIS_URL: ${MANAGED_REDIS_URL}
```

---

## Phase 3: Scale Deployment ($300-500/month)

For 1000+ users, consider:

### Option A: Kubernetes (DigitalOcean/Linode)

```yaml
# Basic Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vizora-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vizora-api
  template:
    spec:
      containers:
      - name: api
        image: vizora/api:latest
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

**Managed Kubernetes Costs:**
- DigitalOcean: $12/month base + nodes
- Linode: $12/month base + nodes
- Vultr: $10/month base + nodes

### Option B: AWS (If you need AWS specifically)

For AWS with cost optimization:

```
┌─────────────────────────────────────────────────────────┐
│                    AWS Architecture                      │
├─────────────────────────────────────────────────────────┤
│  CloudFront (CDN)           - Free tier: 1TB/month      │
│  ↓                                                       │
│  ALB (Load Balancer)        - ~$16/month                │
│  ↓                                                       │
│  ECS Fargate                - ~$30-50/month             │
│  (API + Web + Realtime)                                 │
│  ↓                                                       │
│  RDS PostgreSQL             - ~$15/month (t4g.micro)    │
│  ElastiCache Redis          - ~$12/month (t4g.micro)    │
│  S3 (file storage)          - ~$5/month                 │
├─────────────────────────────────────────────────────────┤
│  Total: ~$80-100/month                                  │
└─────────────────────────────────────────────────────────┘
```

---

## File Storage Options

### For Content/Media Files

| Option | Free Tier | Paid | Best For |
|--------|-----------|------|----------|
| **Cloudflare R2** | 10GB + 10M requests | $0.015/GB | Best value |
| **Backblaze B2** | 10GB | $0.005/GB | Cheapest storage |
| **AWS S3** | 5GB (12 months) | $0.023/GB | AWS ecosystem |
| **DigitalOcean Spaces** | - | $5/250GB | Simple setup |
| **Hetzner Storage Box** | - | €3.50/100GB | EU hosting |

**Recommendation:** Cloudflare R2 (no egress fees!)

### Setup Cloudflare R2

1. Go to Cloudflare Dashboard → R2
2. Create bucket "vizora-content"
3. Generate API token
4. Update API to use R2:

```typescript
// middleware/src/config/storage.ts
import { S3Client } from '@aws-sdk/client-s3';

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
```

---

## Domain & DNS Setup

### Using Cloudflare (Recommended)

1. **Register domain** at Cloudflare Registrar (cheapest .com at ~$10/year)

2. **DNS Records:**
```
Type    Name        Content              Proxy
A       @           YOUR_SERVER_IP       Yes
A       www         YOUR_SERVER_IP       Yes
A       api         YOUR_SERVER_IP       Yes
A       realtime    YOUR_SERVER_IP       No (WebSocket)
A       display     YOUR_SERVER_IP       Yes
```

3. **Enable:**
   - SSL/TLS: Full (strict)
   - Always Use HTTPS: On
   - Auto Minify: JS, CSS, HTML
   - Brotli: On

---

## Monitoring & Alerts

### Free Options

1. **Uptime Monitoring:**
   - UptimeRobot (free: 50 monitors)
   - Freshping (free: 50 monitors)

2. **Error Tracking:**
   - Sentry (free: 5K errors/month)
   - Already integrated in Vizora!

3. **Logs:**
   - Docker logs + logrotate
   - Or Logtail free tier

### Setup UptimeRobot

1. Create account at https://uptimerobot.com
2. Add monitors:
   - https://yourdomain.com (HTTP)
   - https://api.yourdomain.com/health (HTTP)
   - https://realtime.yourdomain.com (Port 443)

---

## Backup Strategy

### Database Backups

```bash
# Create backup script
cat > /opt/vizora/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/vizora/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker exec vizora-db pg_dump -U vizora vizora | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

# Optional: Upload to R2/S3
# aws s3 cp $BACKUP_DIR/db_$DATE.sql.gz s3://vizora-backups/
EOF

chmod +x /opt/vizora/backup.sh

# Schedule daily backups at 3 AM
echo "0 3 * * * /opt/vizora/backup.sh" | crontab -
```

---

## Security Checklist

### Server Security

```bash
# Disable root SSH login
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config

# Create deploy user
adduser deploy
usermod -aG docker deploy
usermod -aG sudo deploy

# Setup firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Install fail2ban
apt install fail2ban -y
systemctl enable fail2ban
```

### Application Security

- [x] HTTPS everywhere (via Cloudflare/Let's Encrypt)
- [x] Secure JWT secrets (randomly generated)
- [x] Rate limiting (nginx config)
- [x] CORS properly configured
- [x] SQL injection prevention (Prisma ORM)
- [x] XSS prevention (React escaping)
- [x] CSRF protection (token validation)

---

## Cost Summary

### Startup Phase (100 Users)

| Item | Monthly Cost |
|------|-------------|
| Hetzner CX32 (8GB RAM) | €8.50 (~$9) |
| Hetzner Backup | €1.00 (~$1) |
| Cloudflare (CDN, DNS) | Free |
| Domain (.com) | ~$0.80 |
| **Total** | **~$11/month** |

### Growth Phase (500 Users)

| Item | Monthly Cost |
|------|-------------|
| 2x Hetzner CX32 | €17 (~$18) |
| Hetzner Load Balancer | €5.40 (~$6) |
| Supabase (managed PostgreSQL) | Free tier |
| Upstash Redis | Free tier |
| Cloudflare R2 (50GB) | ~$0.75 |
| **Total** | **~$25-30/month** |

### Scale Phase (1000+ Users)

| Item | Monthly Cost |
|------|-------------|
| 3x Hetzner CX42 | €45 (~$49) |
| Hetzner Load Balancer | €5.40 (~$6) |
| Managed PostgreSQL | ~$30 |
| Managed Redis | ~$15 |
| Cloudflare R2 (200GB) | ~$3 |
| **Total** | **~$100-120/month** |

---

## Quick Start Commands

### Development → Production Checklist

```bash
# 1. Build production images
docker build -t vizora/api:v1.0.0 ./middleware
docker build -t vizora/realtime:v1.0.0 ./realtime
docker build -t vizora/web:v1.0.0 ./web

# 2. Push to registry
docker push vizora/api:v1.0.0
docker push vizora/realtime:v1.0.0
docker push vizora/web:v1.0.0

# 3. On production server
cd /opt/vizora
docker compose pull
docker compose up -d

# 4. Run database migrations
docker exec vizora-api npx prisma migrate deploy

# 5. Verify
curl https://api.yourdomain.com/health
curl https://yourdomain.com
```

---

## Support & Maintenance

### Regular Tasks

| Task | Frequency |
|------|-----------|
| Check logs for errors | Daily |
| Review backups | Weekly |
| Update dependencies | Monthly |
| Security patches | As released |
| SSL renewal | Auto (certbot) |
| Database optimization | Monthly |

### Useful Commands

```bash
# View logs
docker compose logs -f api

# Restart service
docker compose restart api

# Scale service
docker compose up -d --scale api=2

# Database shell
docker exec -it vizora-db psql -U vizora

# Redis CLI
docker exec -it vizora-redis redis-cli
```

---

## Next Steps

1. **Choose your hosting** (Hetzner recommended for startups)
2. **Setup domain** with Cloudflare
3. **Deploy using Docker Compose**
4. **Configure monitoring** (UptimeRobot + Sentry)
5. **Test thoroughly** before going live
6. **Launch!** 🚀

For questions or issues, check:
- Vizora Documentation
- GitHub Issues
- Community Discord
