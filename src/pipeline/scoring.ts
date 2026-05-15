// ═══════════════════════════════════════════════════════════════
// DigestIQ — Scoring Engine
// Computes 6 proprietary DigestIQ scores from rolling telemetry windows
//
// Scores (all 0–100):
//   DIS  — Digestive Intelligence Score (composite)
//   TE   — Transit Efficiency
//   DS   — Digestive Stability
//   DR   — Digestive Rhythm
//   FR   — Food Response
//   RS   — Recovery Score
//
// Algorithm: rolling-window statistics → weighted sigmoid → 0–100 output
// No ML model needed server-side; TF.js handles in-browser deep scoring.
// This engine is the deterministic scoring layer for real-time pipeline.
// ═══════════════════════════════════════════════════════════════

export interface TelemetryWindow {
  session_id: string
  packets: ScoringPacket[]
}

export interface ScoringPacket {
  ts: string
  temperature: number
  ph: number
  motion_x: number
  motion_y: number
  motion_z: number
  motion_magnitude: number
  temp_normalized: number
  ph_normalized: number
  battery?: number
}

export interface ScoringResult {
  session_id: string
  scored_at: string
  packet_index: number

  // Six core scores
  digestive_intelligence: number   // DIS — composite master score
  transit_efficiency: number       // TE  — how well capsule is moving
  digestive_stability: number      // DS  — consistency of environment
  digestive_rhythm: number         // DR  — peristaltic rhythm regularity
  food_response: number            // FR  — pH response to food/transit zone
  recovery_score: number           // RS  — system recovery & adaptation

  // Meta
  environmental_variability: number
  data_confidence: number
  trend: 'rising' | 'falling' | 'stable' | 'volatile'
  anomaly_detected: boolean

  // Rolling stats (stored for analytics)
  ph_rolling_avg: number
  temp_rolling_avg: number
  motion_rolling_avg: number
  ph_variance: number
  temp_variance: number
}

// ── Math helpers ──────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.min(hi, Math.max(lo, v))
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((s, x) => s + x, 0) / arr.length
}

function variance(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return mean(arr.map(x => (x - m) ** 2))
}

function stddev(arr: number[]): number {
  return Math.sqrt(variance(arr))
}

// Sigmoid centred at 0.5 with tunable steepness
function sigmoid(x: number, k = 10, x0 = 0.5): number {
  return 1 / (1 + Math.exp(-k * (x - x0)))
}

// Gaussian peak — highest score at optimal value
function gaussian(x: number, optimal: number, sigma: number): number {
  return Math.exp(-((x - optimal) ** 2) / (2 * sigma ** 2))
}

// ── Zone classification helpers ───────────────────────────────
// GI transit zones identified by pH signature

type GIZone = 'stomach' | 'duodenum' | 'jejunum' | 'ileum' | 'colon' | 'unknown'

function classifyZone(ph: number): GIZone {
  if (ph < 3.0) return 'stomach'
  if (ph < 5.5) return 'duodenum'
  if (ph < 6.5) return 'jejunum'
  if (ph < 7.5) return 'ileum'
  if (ph <= 9.0) return 'colon'
  return 'unknown'
}

// ── Individual scoring models ─────────────────────────────────

/**
 * TE — Transit Efficiency (0–100)
 * Measures how well the capsule moves through the GI tract.
 * High motion_magnitude + appropriate velocity → high TE.
 * Stasis (very low motion for extended periods) → TE penalty.
 */
function scoreTransitEfficiency(packets: ScoringPacket[]): number {
  if (packets.length < 2) return 50

  const mags = packets.map(p => p.motion_magnitude)
  const avgMag = mean(mags)
  const magVariability = stddev(mags)

  // Optimal motion: 0.5–3.0 g (peristaltic contractions)
  // Too still → constipation signal; too violent → spasm signal
  const motionScore = gaussian(avgMag, 1.5, 1.2) * 100

  // Variability bonus: rhythmic variation is healthy (peristalsis)
  const variabilityBonus = clamp(magVariability * 15, 0, 20)

  // Stasis penalty: if max motion < 0.05g for >60% of window
  const stasisFraction = mags.filter(m => m < 0.05).length / mags.length
  const stasisPenalty = stasisFraction > 0.6 ? (stasisFraction - 0.6) * 50 : 0

  return clamp(motionScore + variabilityBonus - stasisPenalty)
}

/**
 * DS — Digestive Stability (0–100)
 * Measures consistency of the digestive environment.
 * Low pH variance + low temp variance + stable motion → high DS.
 */
function scoreDigestiveStability(packets: ScoringPacket[]): number {
  if (packets.length < 3) return 50

  const phs = packets.map(p => p.ph)
  const temps = packets.map(p => p.temperature)

  const phVar = variance(phs)
  const tempVar = variance(temps)

  // Low variance = high stability
  // pH variance: optimal < 0.3, poor > 2.0
  const phStab = clamp(100 - (phVar / 0.3) * 30)
  // Temp variance: optimal < 0.1°C², poor > 0.5°C²
  const tempStab = clamp(100 - (tempVar / 0.1) * 25)

  // Weighted average
  return clamp(phStab * 0.6 + tempStab * 0.4)
}

/**
 * DR — Digestive Rhythm (0–100)
 * Measures peristaltic rhythm regularity.
 * Evenly-spaced motion peaks (every 3–10s at 2s sampling) → high DR.
 * Irregular bursting or silence → low DR.
 */
function scoreDigestiveRhythm(packets: ScoringPacket[]): number {
  if (packets.length < 5) return 50

  const mags = packets.map(p => p.motion_magnitude)

  // Find local peaks (peristaltic waves)
  const peaks: number[] = []
  for (let i = 1; i < mags.length - 1; i++) {
    if (mags[i] > mags[i - 1] && mags[i] > mags[i + 1] && mags[i] > 0.2) {
      peaks.push(i)
    }
  }

  if (peaks.length < 2) {
    // No clear rhythm detected
    return 35
  }

  // Inter-peak intervals (in packet counts, at 2s = seconds)
  const intervals = peaks.slice(1).map((p, i) => p - peaks[i])
  const intervalMean = mean(intervals)
  const intervalVariance = variance(intervals)

  // Optimal interval: 3–8 packets (6–16s) matching peristaltic frequency
  const freqScore = gaussian(intervalMean, 5.5, 2.5) * 100
  // Regularity: low variance in intervals = rhythmic
  const regularityScore = clamp(100 - intervalVariance * 5)

  return clamp(freqScore * 0.5 + regularityScore * 0.5)
}

/**
 * FR — Food Response (0–100)
 * Measures appropriate pH transitions through GI zones.
 * Expected: stomach (low pH) → small intestine (rising) → colon (neutral/alkaline).
 * Appropriate zone sequence + duration → high FR.
 */
function scoreFoodResponse(packets: ScoringPacket[]): number {
  if (packets.length < 5) return 50

  const phs = packets.map(p => p.ph)
  const avgPH = mean(phs)
  const phTrend = phs[phs.length - 1] - phs[0]  // positive = rising pH (forward transit)

  // Zone distribution analysis
  const zones = phs.map(classifyZone)
  const zoneCounts = zones.reduce((acc, z) => {
    acc[z] = (acc[z] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const total = packets.length

  // Expected zone sequence through a 24h journey:
  // Stomach ~10%, Duodenum ~8%, Jejunum ~20%, Ileum ~25%, Colon ~37%
  const expectedFractions: Record<string, number> = {
    stomach: 0.10, duodenum: 0.08, jejunum: 0.20, ileum: 0.25, colon: 0.37
  }

  // Score based on pH being in appropriate range for current GI zone
  // Use chi-square-like zone fitness
  let zoneFitness = 0
  for (const [zone, expected] of Object.entries(expectedFractions)) {
    const observed = (zoneCounts[zone] || 0) / total
    // Penalise large deviation from expected distribution
    zoneFitness += Math.max(0, 1 - Math.abs(observed - expected) / expected)
  }
  const zoneScore = (zoneFitness / Object.keys(expectedFractions).length) * 100

  // Transit direction bonus: rising pH = forward movement (good)
  const directionBonus = phTrend > 0 ? Math.min(15, phTrend * 5) : 0
  const directionPenalty = phTrend < -2 ? Math.abs(phTrend) * 3 : 0

  return clamp(zoneScore * 0.7 + directionBonus - directionPenalty + 20)
}

/**
 * RS — Recovery Score (0–100)
 * Measures system's ability to recover from perturbations.
 * After motion/pH spikes, how quickly does the system return to baseline?
 */
function scoreRecovery(packets: ScoringPacket[]): number {
  if (packets.length < 6) return 50

  const phs = packets.map(p => p.ph)
  const mags = packets.map(p => p.motion_magnitude)

  // Find spikes and measure recovery
  const phMean = mean(phs)
  const phStd = stddev(phs)

  let recoverySum = 0
  let recoveryCount = 0

  for (let i = 2; i < packets.length - 2; i++) {
    const isSpike = Math.abs(phs[i] - phMean) > 1.5 * phStd
    if (isSpike) {
      // Measure recovery in next 2 packets
      const postSpike = phs.slice(i + 1, i + 3)
      const recovery = 1 - Math.min(1, Math.abs(mean(postSpike) - phMean) / (phStd + 0.1))
      recoverySum += recovery
      recoveryCount++
    }
  }

  // Motion recovery
  const magMean = mean(mags)
  const magStd = stddev(mags)
  for (let i = 2; i < packets.length - 2; i++) {
    const isSpike = mags[i] > magMean + 2 * magStd
    if (isSpike) {
      const postMag = mean(mags.slice(i + 1, i + 3))
      const recovery = 1 - Math.min(1, (postMag - magMean) / (magStd + 0.01))
      recoverySum += recovery * 0.5
      recoveryCount += 0.5
    }
  }

  if (recoveryCount === 0) {
    // No perturbations detected = stable system = good recovery baseline
    return 72
  }

  return clamp((recoverySum / recoveryCount) * 100)
}

/**
 * DIS — Digestive Intelligence Score (0–100)
 * Master composite score. Weighted average of all 5 sub-scores.
 * Weights reflect clinical significance for wellness tracking.
 */
function scoreDigestiveIntelligence(scores: {
  transit_efficiency: number
  digestive_stability: number
  digestive_rhythm: number
  food_response: number
  recovery_score: number
}): number {
  const weights = {
    transit_efficiency: 0.25,
    digestive_stability: 0.25,
    digestive_rhythm: 0.20,
    food_response: 0.20,
    recovery_score: 0.10,
  }

  const raw =
    scores.transit_efficiency * weights.transit_efficiency +
    scores.digestive_stability * weights.digestive_stability +
    scores.digestive_rhythm * weights.digestive_rhythm +
    scores.food_response * weights.food_response +
    scores.recovery_score * weights.recovery_score

  return clamp(raw)
}

// ── Anomaly detection ─────────────────────────────────────────

export interface AnomalyResult {
  detected: boolean
  type?: string
  severity?: 'low' | 'medium' | 'high'
  metric?: string
  observed_value?: number
  expected_range?: string
  description?: string
}

export function detectAnomalies(packets: ScoringPacket[], history: ScoringPacket[]): AnomalyResult {
  if (packets.length < 3) return { detected: false }

  const recent = packets.slice(-5)
  const phs = recent.map(p => p.ph)
  const temps = recent.map(p => p.temperature)
  const mags = recent.map(p => p.motion_magnitude)

  // Extreme pH (outside 1.5–9.0)
  for (const ph of phs) {
    if (ph < 1.2) return {
      detected: true, type: 'extreme_acidity', severity: 'high',
      metric: 'ph', observed_value: ph, expected_range: '1.5–9.0',
      description: `Extreme acidity detected (pH ${ph.toFixed(2)})`
    }
    if (ph > 8.8) return {
      detected: true, type: 'extreme_alkalinity', severity: 'medium',
      metric: 'ph', observed_value: ph, expected_range: '1.5–8.8',
      description: `Unusual alkalinity (pH ${ph.toFixed(2)})`
    }
  }

  // Fever-range temperature
  const avgTemp = mean(temps)
  if (avgTemp > 39.5) return {
    detected: true, type: 'elevated_temperature', severity: 'high',
    metric: 'temperature', observed_value: avgTemp, expected_range: '35.5–38.5',
    description: `Elevated core temperature: ${avgTemp.toFixed(1)}°C`
  }
  if (avgTemp < 35.0) return {
    detected: true, type: 'low_temperature', severity: 'medium',
    metric: 'temperature', observed_value: avgTemp, expected_range: '35.5–38.5',
    description: `Low core temperature: ${avgTemp.toFixed(1)}°C`
  }

  // Prolonged stasis
  const avgMag = mean(mags)
  if (avgMag < 0.05 && history.length > 10) {
    const histMag = mean(history.slice(-10).map(p => p.motion_magnitude))
    if (histMag > 0.2) return {
      detected: true, type: 'stasis', severity: 'medium',
      metric: 'motion_magnitude', observed_value: avgMag, expected_range: '0.1–5.0',
      description: `Possible transit stasis: motion dropped from ${histMag.toFixed(2)}g to ${avgMag.toFixed(2)}g`
    }
  }

  // Rapid pH reversal
  const phDelta = Math.abs(phs[phs.length - 1] - phs[0])
  if (phDelta > 3.5) return {
    detected: true, type: 'rapid_ph_shift', severity: 'medium',
    metric: 'ph', observed_value: phDelta, expected_range: '<2.0 per window',
    description: `Rapid pH shift: ${phDelta.toFixed(2)} units in ${recent.length} packets`
  }

  return { detected: false }
}

// ── Trend detection ───────────────────────────────────────────

function detectTrend(scores: number[]): 'rising' | 'falling' | 'stable' | 'volatile' {
  if (scores.length < 3) return 'stable'

  const recent = scores.slice(-5)
  const first = mean(recent.slice(0, Math.ceil(recent.length / 2)))
  const last = mean(recent.slice(Math.ceil(recent.length / 2)))
  const delta = last - first
  const vol = stddev(recent)

  if (vol > 15) return 'volatile'
  if (delta > 5) return 'rising'
  if (delta < -5) return 'falling'
  return 'stable'
}

// ── Confidence scoring ────────────────────────────────────────

function computeConfidence(packets: ScoringPacket[]): number {
  if (packets.length === 0) return 0

  const validCount = packets.filter(p =>
    p.temperature > 0 && p.ph > 0 && p.motion_magnitude >= 0
  ).length

  const dataCompleteness = validCount / packets.length
  // More packets = higher confidence (saturates at 30+)
  const sampleSufficiency = Math.min(1, packets.length / 30)

  return clamp(dataCompleteness * 0.7 * 100 + sampleSufficiency * 30)
}

// ── Main scoring function ─────────────────────────────────────

export function computeScores(
  window: TelemetryWindow,
  packetIndex: number,
  historicalScores: number[] = []
): ScoringResult {
  const { session_id, packets } = window

  if (packets.length === 0) {
    return {
      session_id,
      scored_at: new Date().toISOString(),
      packet_index: packetIndex,
      digestive_intelligence: 0,
      transit_efficiency: 0,
      digestive_stability: 0,
      digestive_rhythm: 0,
      food_response: 0,
      recovery_score: 0,
      environmental_variability: 0,
      data_confidence: 0,
      trend: 'stable',
      anomaly_detected: false,
      ph_rolling_avg: 0,
      temp_rolling_avg: 0,
      motion_rolling_avg: 0,
      ph_variance: 0,
      temp_variance: 0,
    }
  }

  // Individual scores
  const transit_efficiency   = Math.round(scoreTransitEfficiency(packets) * 10) / 10
  const digestive_stability  = Math.round(scoreDigestiveStability(packets) * 10) / 10
  const digestive_rhythm     = Math.round(scoreDigestiveRhythm(packets) * 10) / 10
  const food_response        = Math.round(scoreFoodResponse(packets) * 10) / 10
  const recovery_score       = Math.round(scoreRecovery(packets) * 10) / 10

  const digestive_intelligence = Math.round(scoreDigestiveIntelligence({
    transit_efficiency,
    digestive_stability,
    digestive_rhythm,
    food_response,
    recovery_score,
  }) * 10) / 10

  // Rolling statistics
  const phs   = packets.map(p => p.ph)
  const temps = packets.map(p => p.temperature)
  const mags  = packets.map(p => p.motion_magnitude)

  const ph_rolling_avg    = Math.round(mean(phs) * 1000) / 1000
  const temp_rolling_avg  = Math.round(mean(temps) * 1000) / 1000
  const motion_rolling_avg = Math.round(mean(mags) * 10000) / 10000
  const ph_variance       = Math.round(variance(phs) * 10000) / 10000
  const temp_variance     = Math.round(variance(temps) * 10000) / 10000

  // Environmental variability (combined sensor instability)
  const environmental_variability = clamp(
    (stddev(phs) / 2 + stddev(temps) / 1 + stddev(mags) / 3) * 33.3
  )

  // Anomaly detection
  const anomaly = detectAnomalies(packets, [])
  const anomaly_detected = anomaly.detected

  // Trend from historical DIS scores
  const trend = detectTrend([...historicalScores, digestive_intelligence])

  // Data confidence
  const data_confidence = Math.round(computeConfidence(packets) * 10) / 10

  return {
    session_id,
    scored_at: new Date().toISOString(),
    packet_index: packetIndex,
    digestive_intelligence,
    transit_efficiency,
    digestive_stability,
    digestive_rhythm,
    food_response,
    recovery_score,
    environmental_variability,
    data_confidence,
    trend,
    anomaly_detected,
    ph_rolling_avg,
    temp_rolling_avg,
    motion_rolling_avg,
    ph_variance,
    temp_variance,
  }
}

// ── Scoring window builder ────────────────────────────────────
// Fetches last N packets from D1 results and builds scoring window

export function buildWindow(
  sessionId: string,
  rows: Array<{
    temperature: number | null
    ph: number | null
    motion_x: number | null
    motion_y: number | null
    motion_z: number | null
    motion_magnitude: number | null
    temp_normalized: number | null
    ph_normalized: number | null
    battery: number | null
    ts: string
  }>,
  windowSize = 30
): TelemetryWindow {
  const recent = rows.slice(-windowSize)
  return {
    session_id: sessionId,
    packets: recent.map(r => ({
      ts: r.ts,
      temperature: r.temperature ?? 37.0,
      ph: r.ph ?? 7.0,
      motion_x: r.motion_x ?? 0,
      motion_y: r.motion_y ?? 0,
      motion_z: r.motion_z ?? 0,
      motion_magnitude: r.motion_magnitude ?? 0,
      temp_normalized: r.temp_normalized ?? 0.5,
      ph_normalized: r.ph_normalized ?? 0.5,
      battery: r.battery ?? undefined,
    })),
  }
}
