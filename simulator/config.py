"""
DigestIQ — Simulator Configuration
===================================
All tuneable parameters for the GI physics simulator.
Edit this file to change simulator behaviour.
"""

import os

# ── Target API ────────────────────────────────────────────────────────────────
# URL of the DigestIQ Hono API (local dev or production)
API_BASE_URL = os.environ.get(
    "DIGESTIQ_API_URL",
    "http://localhost:3000"
)

# ── Device identity ───────────────────────────────────────────────────────────
DEVICE_ID        = os.environ.get("DEVICE_ID", "digestiq_pi_001")
DEVICE_NAME      = os.environ.get("DEVICE_NAME", "DigestIQ Pi Simulator v1.2")
FIRMWARE_VERSION = "1.2.0"
DEVICE_TYPE      = "simulator"
USER_ID          = None   # Optional user UUID

# ── Transmission ──────────────────────────────────────────────────────────────
PACKET_INTERVAL_SEC  = 2.0    # How often to emit a sensor packet (seconds)
BATCH_SIZE           = 1      # Packets per HTTP POST (1 = real-time, >1 = batch)
MAX_RETRY_ATTEMPTS   = 10     # Retries before declaring connection lost
RETRY_BACKOFF_SEC    = 5.0    # Initial backoff (doubles each retry, max 60s)
QUEUE_MAX_SIZE       = 500    # Max queued packets during disconnect

# ── Simulator duration ────────────────────────────────────────────────────────
# Set to None for indefinite run; set to seconds for fixed-duration simulation
SIMULATION_DURATION_SEC = None   # None = run until Ctrl-C

# ── GI Transit physics ────────────────────────────────────────────────────────
# Full GI journey duration (seconds of simulated time).
# Real capsule: 6–24 hours. Set shorter for testing.
GI_JOURNEY_DURATION_SEC  = int(os.environ.get("GI_DURATION_SEC", 3600))  # 1 hour default

# GI segments: (name, pH_mean, pH_std, duration_fraction, temp_offset)
# duration_fraction: what fraction of the journey is spent in this segment
GI_SEGMENTS = [
    # name         pH_mean  pH_std  dur_frac  temp_offset
    ("Esophagus",  6.8,     0.3,    0.01,     -0.1),
    ("Stomach",    2.5,     0.6,    0.18,     +0.2),
    ("Duodenum",   5.8,     0.5,    0.08,     +0.1),
    ("Jejunum",    6.4,     0.4,    0.22,      0.0),
    ("Ileum",      7.2,     0.3,    0.25,     -0.1),
    ("Cecum",      7.6,     0.3,    0.06,     -0.1),
    ("Colon",      7.8,     0.4,    0.20,     -0.2),
]

# ── Sensor noise model ────────────────────────────────────────────────────────
# Gaussian noise standard deviations for each sensor
NOISE = {
    "ph":          0.08,   # pH unit noise (sensor accuracy ±0.1 pH typical)
    "temperature": 0.05,   # °C noise
    "motion":      0.15,   # g noise per axis
}

# Slow drift: sensors drift slightly over time (simulates sensor aging in body)
DRIFT = {
    "ph_drift_per_hour":    0.05,   # pH units of slow drift per simulated hour
    "temp_drift_per_hour":  0.02,   # °C drift per simulated hour
}

# ── Motion model ──────────────────────────────────────────────────────────────
# Peristaltic wave parameters
PERISTALSIS = {
    "base_frequency_hz":   0.12,    # Waves per second (~1 wave per 8s)
    "frequency_jitter":    0.03,    # Random variation in frequency
    "amplitude_mean":      0.8,     # g peak acceleration
    "amplitude_std":       0.3,     # Variation in wave amplitude
    "stasis_probability":  0.05,    # Probability of entering stasis (low motion) per step
    "stasis_duration_sec": 15.0,    # How long stasis periods last
}

# ── Battery model ─────────────────────────────────────────────────────────────
BATTERY = {
    "initial_percent":    100.0,
    "drain_per_hour":      4.0,     # % per real hour (capsule battery lasts ~24h)
}

# ── RF Signal model ───────────────────────────────────────────────────────────
# Signal strength (dBm) — varies with body position / peristalsis
SIGNAL = {
    "mean_dbm":    -70.0,
    "std_dbm":       8.0,
    "min_dbm":    -100.0,
    "max_dbm":     -40.0,
}

# ── Anomaly injection ─────────────────────────────────────────────────────────
# Intentional anomalies for testing anomaly detection
INJECT_ANOMALIES = True
ANOMALY_SCHEDULE = [
    # (elapsed_seconds, type, description)
    (300,  "ph_spike",     "Inject brief pH spike to 1.2 (extreme acid)"),
    (900,  "temp_spike",   "Inject temperature spike to 39.8°C"),
    (1800, "stasis",       "Inject 30s stasis (very low motion)"),
    (2700, "rapid_shift",  "Inject rapid pH shift across 4 units in 10 packets"),
]

# ── Logging ───────────────────────────────────────────────────────────────────
LOG_LEVEL = "INFO"   # DEBUG | INFO | WARNING | ERROR
LOG_FILE  = None     # None = stdout only; set to "simulator.log" for file logging
SHOW_SCORES = True   # Print scoring results from API responses
