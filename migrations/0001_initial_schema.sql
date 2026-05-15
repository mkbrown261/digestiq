-- ═══════════════════════════════════════════════════════════════
-- DigestIQ — D1 Database Schema
-- Version: 0001 — Initial
-- ═══════════════════════════════════════════════════════════════

-- ── Devices ─────────────────────────────────────────────────────
-- Registered ingestible devices (Pi simulators + future real capsules)
CREATE TABLE IF NOT EXISTS devices (
  id            TEXT PRIMARY KEY,              -- device_id e.g. "digestiq_pi_001"
  name          TEXT NOT NULL DEFAULT 'DigestIQ Device',
  user_id       TEXT,                          -- future: link to user account
  registered_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen     TEXT,
  firmware_ver  TEXT DEFAULT '1.0.0',
  device_type   TEXT DEFAULT 'simulator',      -- simulator | pi | capsule
  is_active     INTEGER DEFAULT 1
);

-- ── Sessions ─────────────────────────────────────────────────────
-- One session = one capsule journey (6–24 hours)
CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY,            -- session_id (UUID)
  device_id       TEXT NOT NULL,
  user_id         TEXT,
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at        TEXT,
  status          TEXT DEFAULT 'active',       -- active | completed | error
  packet_count    INTEGER DEFAULT 0,
  duration_mins   REAL DEFAULT 0,
  notes           TEXT,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

-- ── Telemetry ─────────────────────────────────────────────────────
-- Raw sensor packets — the core time-series table
-- One row per sensor reading from device
CREATE TABLE IF NOT EXISTS telemetry (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT NOT NULL,
  device_id       TEXT NOT NULL,
  ts              TEXT NOT NULL,               -- ISO-8601 timestamp from device
  received_at     TEXT NOT NULL DEFAULT (datetime('now')),
  temperature     REAL NOT NULL,               -- °C  range: 35.0–40.0
  ph              REAL NOT NULL,               -- pH  range: 1.0–9.0
  motion_x        REAL NOT NULL DEFAULT 0,     -- g-force x
  motion_y        REAL NOT NULL DEFAULT 0,     -- g-force y
  motion_z        REAL NOT NULL DEFAULT 0,     -- g-force z
  battery         REAL NOT NULL DEFAULT 100,   -- % remaining
  signal_strength REAL NOT NULL DEFAULT -50,   -- dBm
  -- Normalized values (computed on ingestion)
  temp_normalized REAL,                        -- 0–1 scale
  ph_normalized   REAL,                        -- 0–1 scale
  motion_magnitude REAL,                       -- sqrt(x²+y²+z²)
  -- Validation flags
  is_valid        INTEGER DEFAULT 1,
  validation_msg  TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- ── Scores ────────────────────────────────────────────────────────
-- Computed digestive scores — one row per scoring event
-- Scores computed after each telemetry packet (or batch)
CREATE TABLE IF NOT EXISTS scores (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id                  TEXT NOT NULL,
  scored_at                   TEXT NOT NULL DEFAULT (datetime('now')),
  packet_index                INTEGER DEFAULT 0,  -- which packet triggered this
  -- Six core DigestIQ scores (0–100)
  digestive_intelligence      REAL NOT NULL DEFAULT 0,
  transit_efficiency          REAL NOT NULL DEFAULT 0,
  digestive_stability         REAL NOT NULL DEFAULT 0,
  digestive_rhythm            REAL NOT NULL DEFAULT 0,
  food_response               REAL NOT NULL DEFAULT 0,
  recovery_score              REAL NOT NULL DEFAULT 0,
  -- Derived analytics
  environmental_variability   REAL NOT NULL DEFAULT 0,
  data_confidence             REAL NOT NULL DEFAULT 0, -- 0–1
  trend                       TEXT DEFAULT 'stable',   -- improving|stable|declining
  anomaly_detected            INTEGER DEFAULT 0,
  anomaly_type                TEXT,
  -- Rolling stats (computed over last N packets)
  ph_rolling_avg              REAL,
  temp_rolling_avg            REAL,
  motion_rolling_avg          REAL,
  ph_variance                 REAL,
  temp_variance               REAL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- ── Anomalies ─────────────────────────────────────────────────────
-- Detected deviations from expected biological ranges
CREATE TABLE IF NOT EXISTS anomalies (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT NOT NULL,
  telemetry_id    INTEGER,
  detected_at     TEXT NOT NULL DEFAULT (datetime('now')),
  anomaly_type    TEXT NOT NULL,   -- ph_spike|temp_deviation|motion_surge|signal_loss
  severity        TEXT DEFAULT 'low',  -- low|medium|high
  metric          TEXT NOT NULL,   -- which sensor triggered it
  observed_value  REAL NOT NULL,
  expected_range  TEXT NOT NULL,   -- e.g. "6.0–7.5"
  description     TEXT,
  resolved        INTEGER DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- ── Session Summaries ─────────────────────────────────────────────
-- Aggregated per-session analytics (computed at session end or on-demand)
CREATE TABLE IF NOT EXISTS session_summaries (
  session_id        TEXT PRIMARY KEY,
  computed_at       TEXT NOT NULL DEFAULT (datetime('now')),
  duration_hrs      REAL,
  total_packets     INTEGER DEFAULT 0,
  avg_ph            REAL,
  min_ph            REAL,
  max_ph            REAL,
  ph_variance       REAL,
  avg_temp          REAL,
  temp_variance     REAL,
  avg_motion        REAL,
  peak_motion       REAL,
  final_dis         REAL,    -- final Digestive Intelligence Score
  final_transit     REAL,
  final_stability   REAL,
  final_rhythm      REAL,
  final_food        REAL,
  final_recovery    REAL,
  anomaly_count     INTEGER DEFAULT 0,
  overall_trend     TEXT DEFAULT 'stable',
  ai_narrative      TEXT,    -- cached LLM narrative
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- ── Indexes ───────────────────────────────────────────────────────
-- Critical for query performance on the telemetry time-series
CREATE INDEX IF NOT EXISTS idx_telemetry_session    ON telemetry(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_telemetry_device     ON telemetry(device_id, ts);
CREATE INDEX IF NOT EXISTS idx_telemetry_received   ON telemetry(received_at);
CREATE INDEX IF NOT EXISTS idx_scores_session       ON scores(session_id, scored_at);
CREATE INDEX IF NOT EXISTS idx_sessions_device      ON sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status      ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_anomalies_session    ON anomalies(session_id);
