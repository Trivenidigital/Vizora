---
description: Performance analysis and optimization. Use when improving page load times, reducing bundle sizes, optimizing API response times, fixing slow uploads, optimizing React rendering, implementing code splitting, configuring caching strategies, lazy loading, profiling performance bottlenecks, implementing virtual scrolling, or improving Lighthouse scores.
---

# Performance Optimization Skill

## Core Principles

1. **Measure First, Optimize Second** — Never guess at bottlenecks. Profile before changing anything.
2. **80/20 Rule** — 20% of code causes 80% of performance issues. Find the hot paths.
3. **Set Performance Budgets** — Define acceptable limits before optimizing.
4. **Before/After Everything** — Log metrics before and after every change. Revert if no improvement.

## Performance Budgets (Targets)

```
Frontend:
  - Largest Contentful Paint (LCP): < 2.5s
  - First Input Delay (FID): < 100ms
  - Cumulative Layout Shift (CLS): < 0.1
  - Time to Interactive (TTI): < 3.5s
  - Total JS bundle (gzipped): < 200KB
  - Total CSS (gzipped): < 50KB
  - Images: WebP/AVIF, lazy loaded below fold
  - Lighthouse Performance: > 90

Backend:
  - API read responses: < 200ms
  - API write responses: < 500ms
  - File uploads (10MB): < 5 seconds
  - Database queries: < 50ms
  - WebSocket latency: < 100ms

Infrastructure:
  - TTFB: < 200ms
  - Gzip/Brotli compression: enabled
  - Static assets: CDN with cache headers
  - Database: connection pooling configured
```

## Profiling Checklist

### Frontend Profiling
```bash
# Bundle analysis
npx webpack-bundle-analyzer stats.json     # Webpack
npx vite-bundle-visualizer                  # Vite

# Lighthouse CLI
npx lighthouse <URL> --output html --output-path ./report.html

# Check bundle sizes
du -sh dist/assets/*.js | sort -rh
```

### Backend Profiling
```bash
# API response times — test every endpoint
curl -w "DNS: %{time_namelookup}s | Connect: %{time_connect}s | TTFB: %{time_starttransfer}s | Total: %{time_total}s\n" -o /dev/null -s <URL>

# Database slow queries
# PostgreSQL: SET log_min_duration_statement = 100;
# MongoDB: db.setProfilingLevel(1, { slowms: 100 })

# Node.js profiling
node --prof app.js
node --prof-process isolate-*.log > profile.txt
```

### Database Profiling
```sql
-- PostgreSQL: Find missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats WHERE schemaname = 'public' ORDER BY n_distinct DESC;

-- Find slow queries
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 20;

-- Analyze specific query
EXPLAIN ANALYZE <your_query>;
```

## Frontend Optimization Patterns

### Bundle Size Reduction
```javascript
// BAD: Importing entire library
import _ from 'lodash';           // 70KB
import moment from 'moment';      // 230KB

// GOOD: Tree-shakeable imports
import debounce from 'lodash/debounce';  // 2KB
import { format } from 'date-fns';       // 13KB
```

### Code Splitting
```javascript
// Route-based splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Settings = lazy(() => import('./pages/Settings'));

// Component-based splitting for heavy components
const RichTextEditor = lazy(() => import('./components/RichTextEditor'));
const ChartComponent = lazy(() => import('./components/ChartComponent'));
```

### Render Optimization
```javascript
// Memoize expensive components
const DeviceCard = React.memo(({ device }) => { ... });

// Memoize expensive computations
const filteredDevices = useMemo(() =>
  devices.filter(d => d.status === filter),
  [devices, filter]
);

// Stable callback references
const handleClick = useCallback((id) => {
  setSelected(id);
}, []);
```

### Virtual Scrolling for Large Lists
```javascript
// Use react-window or react-virtuoso for lists > 100 items
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={items.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>{items[index].name}</div>
  )}
</FixedSizeList>
```

### Image Optimization
```html
<!-- Responsive, modern formats, lazy loaded -->
<picture>
  <source srcset="image.avif" type="image/avif">
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="" loading="lazy" decoding="async"
       width="800" height="600">
</picture>
```

## Backend Optimization Patterns

### Database: Fix N+1 Queries
```javascript
// BAD: N+1 — one query per device
const devices = await Device.findAll();
for (const device of devices) {
  device.content = await Content.findByDeviceId(device.id); // N queries!
}

// GOOD: Eager loading — one query with JOIN
const devices = await Device.findAll({
  include: [{ model: Content }]
});
```

### Database: Add Missing Indexes
```sql
-- Index frequently filtered/sorted columns
CREATE INDEX idx_devices_organization_id ON devices(organization_id);
CREATE INDEX idx_content_created_at ON content(created_at DESC);
CREATE INDEX idx_playlists_device_id ON playlists(device_id);

-- Composite index for common query patterns
CREATE INDEX idx_content_org_type ON content(organization_id, content_type);
```

### API Response Caching
```javascript
// In-memory cache for frequently accessed, rarely changed data
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 1 minute

async function getDevices(orgId) {
  const key = `devices:${orgId}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }
  const data = await db.query('SELECT * FROM devices WHERE org_id = $1', [orgId]);
  cache.set(key, { data, time: Date.now() });
  return data;
}
```

### File Upload Optimization
```javascript
// Chunked upload with progress
async function uploadFile(file, onProgress) {
  const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await uploadChunk(chunk, i, totalChunks);
    onProgress(((i + 1) / totalChunks) * 100);
  }
}

// Backend: Process thumbnails in background, not during upload
app.post('/api/content/upload', async (req, res) => {
  const file = await saveFile(req.file);       // Save immediately
  res.json({ id: file.id, status: 'processing' }); // Return fast
  queue.add('process-content', { fileId: file.id }); // Background job
});
```

### Middleware Optimization
```javascript
// BAD: Heavy middleware on every route
app.use(analyticsMiddleware);    // Runs on EVERY request
app.use(fullAuthMiddleware);     // Runs on EVERY request

// GOOD: Apply selectively
app.use('/api', authMiddleware);
app.use('/api/admin', adminMiddleware);
// Skip auth for public routes, health checks
```

## Optimization Workflow

1. **Profile** — Measure current state, document baseline metrics
2. **Identify** — Find the top 3-5 bottlenecks (biggest impact)
3. **Fix** — Apply targeted optimizations (one at a time)
4. **Measure** — Compare before/after for each change
5. **Verify** — Ensure no functionality broke
6. **Revert if no improvement** — Don't keep changes that don't help
7. **Document** — Log what changed and the measured improvement