-- ClickHouse initialization script for Vizora Analytics

-- Heartbeats table - Device health metrics
CREATE TABLE IF NOT EXISTS heartbeats (
  timestamp DateTime64(3),
  device_id String,
  organization_id String,
  status String,
  cpu_usage Float32,
  memory_usage Float32,
  storage_used UInt64,
  socket_latency_ms UInt32,
  metadata String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (organization_id, device_id, timestamp)
TTL toDateTime(timestamp) + INTERVAL 90 DAY DELETE;

-- Impressions table - Content display events
CREATE TABLE IF NOT EXISTS impressions (
  timestamp DateTime64(3),
  device_id String,
  organization_id String,
  content_id String,
  playlist_id String,
  duration_ms UInt32,
  completed Boolean,
  metadata String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (organization_id, device_id, timestamp)
TTL toDateTime(timestamp) + INTERVAL 90 DAY DELETE;

-- Playback errors table - Error tracking
CREATE TABLE IF NOT EXISTS playback_errors (
  timestamp DateTime64(3),
  device_id String,
  organization_id String,
  content_id String,
  error_type String,
  error_message String,
  metadata String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (organization_id, timestamp)
TTL toDateTime(timestamp) + INTERVAL 90 DAY DELETE;

-- API logs table - Request/response logs
CREATE TABLE IF NOT EXISTS api_logs (
  timestamp DateTime64(3),
  organization_id String,
  user_id String,
  method String,
  endpoint String,
  status_code UInt16,
  response_time_ms UInt32,
  ip_address String,
  user_agent String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (organization_id, timestamp)
TTL toDateTime(timestamp) + INTERVAL 90 DAY DELETE;
