# VIZORA - DEVOPS & DEPLOYMENT
## Infrastructure, CI/CD, and Monitoring

**Version:** 2.0  
**Last Updated:** January 26, 2026  
**Document:** 5 of 5  
**Status:** Ready for Implementation

---

## TABLE OF CONTENTS

1. [Infrastructure Overview](#1-infrastructure-overview)
2. [Docker Configuration](#2-docker-configuration)
3. [Kubernetes Setup](#3-kubernetes-setup)
4. [CI/CD Pipeline](#4-cicd-pipeline)
5. [Monitoring & Logging](#5-monitoring--logging)
6. [Security & Secrets](#6-security--secrets)
7. [Backup & Recovery](#7-backup--recovery)

---

## 1. INFRASTRUCTURE OVERVIEW

### 1.1 Environments

| Environment | Purpose | Infrastructure |
|-------------|---------|----------------|
| Development | Local development | Docker Compose |
| Staging | Pre-production testing | Kubernetes (1 node) |
| Production | Live system | Kubernetes (3+ nodes) |

### 1.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    PRODUCTION                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────┐        │
│  │         Load Balancer (Ingress)             │        │
│  │     api.vizora.com | app.vizora.com        │        │
│  └────────┬───────────────────────┬────────────┘        │
│           │                       │                      │
│           ▼                       ▼                      │
│  ┌─────────────────┐    ┌─────────────────┐           │
│  │  API Gateway    │    │  Next.js Web    │           │
│  │  (3 replicas)   │    │  (3 replicas)   │           │
│  └────────┬────────┘    └─────────────────┘           │
│           │                                              │
│           ▼                                              │
│  ┌─────────────────┐    ┌─────────────────┐           │
│  │  Realtime GW    │    │   Workers       │           │
│  │  (2 replicas)   │    │  (BullMQ)       │           │
│  └─────────────────┘    └─────────────────┘           │
│                                                          │
│  ┌──────────────────────────────────────────────────┐ │
│  │            Databases (Managed Services)           │ │
│  │  PostgreSQL | MongoDB | Redis | ClickHouse       │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 2. DOCKER CONFIGURATION

### 2.1 Development (Docker Compose)

**docker/docker-compose.yml:**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: vizora-postgres
    environment:
      POSTGRES_USER: vizora_user
      POSTGRES_PASSWORD: vizora_pass
      POSTGRES_DB: vizora
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vizora_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  mongodb:
    image: mongo:7
    container_name: vizora-mongodb
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: vizora-redis
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    container_name: vizora-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  clickhouse:
    image: clickhouse/clickhouse-server:24
    container_name: vizora-clickhouse
    ports:
      - "8123:8123"
      - "9002:9000"
    volumes:
      - clickhouse_data:/var/lib/clickhouse
      - ./clickhouse/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD", "clickhouse-client", "--query", "SELECT 1"]
      interval: 10s
      timeout: 5s
      retries: 5

  grafana:
    image: grafana/grafana:latest
    container_name: vizora-grafana
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: admin
      GF_INSTALL_PLUGINS: grafana-clickhouse-datasource
    ports:
      - "3003:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    depends_on:
      - clickhouse

volumes:
  postgres_data:
  mongodb_data:
  redis_data:
  minio_data:
  clickhouse_data:
  grafana_data:

networks:
  default:
    name: vizora-network
```

### 2.2 Production Dockerfiles

**docker/Dockerfile.middleware:**
```dockerfile
# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/middleware/package.json ./apps/middleware/
COPY libs/*/package.json ./libs/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Generate Prisma client
RUN cd apps/middleware && pnpm prisma generate

# Build
RUN pnpm nx build middleware --prod

# Production stage
FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm@9

# Copy built files
COPY --from=builder /app/dist/apps/middleware ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/middleware/prisma ./prisma

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start
CMD ["node", "main.js"]
```

**docker/Dockerfile.web:**
```dockerfile
# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm nx build web --prod

# Production stage
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/dist/apps/web/.next/standalone ./
COPY --from=builder /app/dist/apps/web/.next/static ./.next/static
COPY --from=builder /app/dist/apps/web/public ./public

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]
```

---

## 3. KUBERNETES SETUP

### 3.1 Namespace

**k8s/namespace.yaml:**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: vizora-prod
```

### 3.2 Middleware Deployment

**k8s/middleware-deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vizora-middleware
  namespace: vizora-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vizora-middleware
  template:
    metadata:
      labels:
        app: vizora-middleware
    spec:
      containers:
      - name: middleware
        image: ghcr.io/your-org/vizora-middleware:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: POSTGRES_URL
          valueFrom:
            secretKeyRef:
              name: vizora-secrets
              key: postgres-url
        - name: MONGODB_URL
          valueFrom:
            secretKeyRef:
              name: vizora-secrets
              key: mongodb-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: vizora-secrets
              key: redis-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: vizora-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: vizora-middleware-service
  namespace: vizora-prod
spec:
  selector:
    app: vizora-middleware
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: vizora-middleware-hpa
  namespace: vizora-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vizora-middleware
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 3.3 Ingress Configuration

**k8s/ingress.yaml:**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vizora-ingress
  namespace: vizora-prod
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.vizora.com
    - app.vizora.com
    - realtime.vizora.com
    secretName: vizora-tls
  rules:
  - host: api.vizora.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: vizora-middleware-service
            port:
              number: 80
  - host: app.vizora.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: vizora-web-service
            port:
              number: 80
  - host: realtime.vizora.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: vizora-realtime-service
            port:
              number: 80
```

---

## 4. CI/CD PIPELINE

### 4.1 GitHub Actions Workflow

**.github/workflows/deploy-production.yaml:**
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
      
      - name: Install pnpm
        run: npm install -g pnpm@9
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run linter
        run: pnpm nx run-many --target=lint --all
      
      - name: Run tests
        run: pnpm nx run-many --target=test --all --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    strategy:
      matrix:
        app: [middleware, realtime, web]
    steps:
      - uses: actions/checkout@v4
      
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-${{ matrix.app }}
          tags: |
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile.${{ matrix.app }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up kubectl
        uses: azure/setup-kubectl@v3
      
      - name: Configure kubectl
        run: |
          echo "${{ secrets.KUBE_CONFIG }}" | base64 -d > kubeconfig
          export KUBECONFIG=./kubeconfig
      
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/vizora-middleware \
            middleware=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-middleware:latest \
            -n vizora-prod
          
          kubectl set image deployment/vizora-realtime \
            realtime=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-realtime:latest \
            -n vizora-prod
          
          kubectl set image deployment/vizora-web \
            web=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-web:latest \
            -n vizora-prod
      
      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/vizora-middleware -n vizora-prod --timeout=5m
          kubectl rollout status deployment/vizora-realtime -n vizora-prod --timeout=5m
          kubectl rollout status deployment/vizora-web -n vizora-prod --timeout=5m
      
      - name: Run smoke tests
        run: |
          curl -f https://api.vizora.com/health || exit 1
          curl -f https://app.vizora.com || exit 1
      
      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment ${{ job.status }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 5. MONITORING & LOGGING

### 5.1 Prometheus Configuration

**k8s/prometheus-config.yaml:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: vizora-prod
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    
    scrape_configs:
      - job_name: 'vizora-middleware'
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names:
                - vizora-prod
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_label_app]
            action: keep
            regex: vizora-middleware
          - source_labels: [__meta_kubernetes_pod_ip]
            target_label: __address__
            replacement: ${1}:3000
```

### 5.2 Grafana Dashboards

**grafana/dashboards/overview.json:**
```json
{
  "dashboard": {
    "title": "Vizora - System Overview",
    "panels": [
      {
        "title": "Active Devices",
        "targets": [
          {
            "expr": "count(device_online{status=\"online\"})"
          }
        ]
      },
      {
        "title": "API Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])"
          }
        ]
      }
    ]
  }
}
```

### 5.3 Alert Rules

**k8s/alerts.yaml:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-alerts
  namespace: vizora-prod
data:
  alerts.yml: |
    groups:
      - name: vizora_alerts
        interval: 1m
        rules:
          - alert: HighErrorRate
            expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
            for: 5m
            labels:
              severity: critical
            annotations:
              summary: "High error rate detected"
              description: "Error rate is {{ $value }} requests/sec"
          
          - alert: DeviceOffline
            expr: time() - device_last_heartbeat > 600
            for: 5m
            labels:
              severity: warning
            annotations:
              summary: "Device {{ $labels.device_id }} is offline"
          
          - alert: HighMemoryUsage
            expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.9
            for: 5m
            labels:
              severity: warning
            annotations:
              summary: "High memory usage in {{ $labels.pod }}"
```

---

## 6. SECURITY & SECRETS

### 6.1 Kubernetes Secrets

**Create secrets:**
```bash
# Create secret from env file
kubectl create secret generic vizora-secrets \
  --from-literal=postgres-url="postgresql://..." \
  --from-literal=mongodb-url="mongodb://..." \
  --from-literal=redis-url="redis://..." \
  --from-literal=jwt-secret="..." \
  --from-literal=device-jwt-secret="..." \
  --from-literal=stripe-secret-key="..." \
  -n vizora-prod
```

### 6.2 Network Policies

**k8s/network-policy.yaml:**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: vizora-network-policy
  namespace: vizora-prod
spec:
  podSelector:
    matchLabels:
      app: vizora-middleware
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
      - podSelector:
          matchLabels:
            app: nginx-ingress
      ports:
      - protocol: TCP
        port: 3000
  egress:
    - to:
      - podSelector:
          matchLabels:
            app: postgres
      ports:
      - protocol: TCP
        port: 5432
```

---

## 7. BACKUP & RECOVERY

### 7.1 Database Backup Strategy

**PostgreSQL Backup (CronJob):**
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: vizora-prod
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:16-alpine
            command:
            - /bin/sh
            - -c
            - |
              pg_dump $POSTGRES_URL | gzip > /backups/vizora-$(date +%Y%m%d).sql.gz
              # Upload to S3
              aws s3 cp /backups/vizora-$(date +%Y%m%d).sql.gz s3://vizora-backups/postgres/
            env:
            - name: POSTGRES_URL
              valueFrom:
                secretKeyRef:
                  name: vizora-secrets
                  key: postgres-url
            volumeMounts:
            - name: backup-storage
              mountPath: /backups
          volumes:
          - name: backup-storage
            emptyDir: {}
          restartPolicy: OnFailure
```

### 7.2 Disaster Recovery Plan

**RTO (Recovery Time Objective):** 1 hour  
**RPO (Recovery Point Objective):** 24 hours

**Recovery Steps:**
1. Restore database from latest backup
2. Deploy applications from last known good images
3. Verify data integrity
4. Update DNS if needed
5. Monitor for issues

---

## DEPLOYMENT CHECKLIST

**Pre-Deployment:**
- [ ] All tests passing
- [ ] Code review approved
- [ ] Database migrations ready
- [ ] Secrets configured
- [ ] SSL certificates valid
- [ ] Backup verified

**Deployment:**
- [ ] Build Docker images
- [ ] Push to registry
- [ ] Run database migrations
- [ ] Deploy to Kubernetes
- [ ] Wait for rollout completion
- [ ] Run smoke tests

**Post-Deployment:**
- [ ] Check application logs
- [ ] Verify metrics in Grafana
- [ ] Test critical user flows
- [ ] Monitor error rates
- [ ] Update documentation

---

**Document End**

*All 5 PRD documents are now complete and ready for implementation!*
