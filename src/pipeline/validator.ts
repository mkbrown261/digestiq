// ═══════════════════════════════════════════════════════════════
// DigestIQ — Telemetry Validator
// Validates and normalizes raw sensor packets from ingestible devices
// ═══════════════════════════════════════════════════════════════

export interface RawTelemetryPacket {
  device_id: string
  session_id: string
  ts: string
  temperature?: number
  ph?: number
  motion_x?: number
  motion_y?: number
  motion_z?: number
  battery?: number
  signal_strength?: number
  [key: string]: unknown
}

export interface ValidatedPacket extends RawTelemetryPacket {
  is_valid: boolean
  validation_msg: string
  temp_normalized: number
  ph_normalized: number
  motion_magnitude: number
  received_at: string
}

// ── Physiological ranges ──────────────────────────────────────
// Based on published GI literature for ingestible capsule sensors
const RANGES = {
  temperature: { min: 32.0, max: 42.0, warn_low: 35.5, warn_high: 38.5 },
  ph:          { min: 1.0,  max: 9.0,  warn_low: 1.5,  warn_high: 8.5  },
  motion_x:   { min: -16.0, max: 16.0 },
  motion_y:   { min: -16.0, max: 16.0 },
  motion_z:   { min: -16.0, max: 16.0 },
  battery:    { min: 0.0, max: 100.0 },
  signal_strength: { min: -120, max: 0 },
}

// ── Normalization helpers ─────────────────────────────────────
// Maps physiological values to 0–1 range for ML model inputs

function normalizeTemp(t: number): number {
  // 32°C → 0.0, 42°C → 1.0 (optimal zone 36–38 maps to 0.4–0.6)
  return Math.min(1, Math.max(0, (t - 32) / 10))
}

function normalizePH(ph: number): number {
  // 1.0 → 0.0 (stomach acid), 9.0 → 1.0 (alkaline intestine)
  return Math.min(1, Math.max(0, (ph - 1) / 8))
}

function motionMagnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z)
}

// ── Core validator ────────────────────────────────────────────

export function validatePacket(raw: RawTelemetryPacket): ValidatedPacket {
  const issues: string[] = []
  const now = new Date().toISOString()

  // Required fields
  if (!raw.device_id || typeof raw.device_id !== 'string') {
    issues.push('missing device_id')
  }
  if (!raw.session_id || typeof raw.session_id !== 'string') {
    issues.push('missing session_id')
  }
  if (!raw.ts || typeof raw.ts !== 'string') {
    issues.push('missing ts')
  } else {
    // Validate ISO 8601 timestamp
    const d = new Date(raw.ts)
    if (isNaN(d.getTime())) {
      issues.push('invalid ts format (expected ISO 8601)')
    } else {
      // Reject timestamps more than 10 min in the future (clock drift guard)
      const driftMs = d.getTime() - Date.now()
      if (driftMs > 600_000) {
        issues.push(`ts too far in future: ${Math.round(driftMs / 1000)}s drift`)
      }
    }
  }

  // Temperature
  const temp = typeof raw.temperature === 'number' ? raw.temperature : NaN
  if (!isNaN(temp)) {
    if (temp < RANGES.temperature.min || temp > RANGES.temperature.max) {
      issues.push(`temperature ${temp}°C out of physiological range [${RANGES.temperature.min}–${RANGES.temperature.max}]`)
    }
  }

  // pH
  const ph = typeof raw.ph === 'number' ? raw.ph : NaN
  if (!isNaN(ph)) {
    if (ph < RANGES.ph.min || ph > RANGES.ph.max) {
      issues.push(`pH ${ph} out of physiological range [${RANGES.ph.min}–${RANGES.ph.max}]`)
    }
  }

  // Motion
  const mx = typeof raw.motion_x === 'number' ? raw.motion_x : 0
  const my = typeof raw.motion_y === 'number' ? raw.motion_y : 0
  const mz = typeof raw.motion_z === 'number' ? raw.motion_z : 0

  for (const [axis, val] of [['x', mx], ['y', my], ['z', mz]] as const) {
    if (val < RANGES.motion_x.min || val > RANGES.motion_x.max) {
      issues.push(`motion_${axis} ${val}g out of range`)
    }
  }

  // Battery
  const battery = typeof raw.battery === 'number' ? raw.battery : 100
  if (battery < 0 || battery > 100) {
    issues.push(`battery ${battery}% invalid`)
  }

  const is_valid = issues.length === 0
  const validation_msg = is_valid ? 'ok' : issues.join('; ')

  // Compute normalized values (use safe defaults for NaN)
  const safeTemp = isNaN(temp) ? 37.0 : Math.min(RANGES.temperature.max, Math.max(RANGES.temperature.min, temp))
  const safePH   = isNaN(ph)   ? 7.0  : Math.min(RANGES.ph.max, Math.max(RANGES.ph.min, ph))
  const mag = motionMagnitude(mx, my, mz)

  return {
    ...raw,
    temperature: isNaN(temp) ? undefined : temp,
    ph: isNaN(ph) ? undefined : ph,
    motion_x: mx,
    motion_y: my,
    motion_z: mz,
    battery,
    signal_strength: typeof raw.signal_strength === 'number' ? raw.signal_strength : undefined,
    is_valid,
    validation_msg,
    temp_normalized: normalizeTemp(safeTemp),
    ph_normalized:   normalizePH(safePH),
    motion_magnitude: Math.round(mag * 10000) / 10000,
    received_at: now,
  }
}

// ── Batch validator ───────────────────────────────────────────

export function validateBatch(packets: RawTelemetryPacket[]): {
  valid: ValidatedPacket[]
  invalid: ValidatedPacket[]
  total: number
} {
  const results = packets.map(validatePacket)
  return {
    valid: results.filter(p => p.is_valid),
    invalid: results.filter(p => !p.is_valid),
    total: results.length,
  }
}
