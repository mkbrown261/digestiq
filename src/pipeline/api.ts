// ═══════════════════════════════════════════════════════════════
// DigestIQ — Pipeline API Routes
// Mounted into main Hono app as: app.route('/api', pipelineApi)
//
// Endpoints:
//   POST /api/device/register          — register a device
//   POST /api/session/start            — create a new session
//   POST /api/session/:id/end          — end a session
//   POST /api/ingest                   — ingest telemetry packet(s)
//   GET  /api/sessions                 — list all sessions
//   GET  /api/session/:id              — get session details + scores
//   GET  /api/session/:id/latest       — last N packets (polling)
//   GET  /api/session/:id/scores       — score history
//   GET  /api/devices                  — list all devices
// ═══════════════════════════════════════════════════════════════

import { Hono } from 'hono'
import { validatePacket, validateBatch, type RawTelemetryPacket } from './validator'
import { computeScores, buildWindow, detectAnomalies, type ScoringResult } from './scoring'

type Bindings = { DB: D1Database }

export const pipelineApi = new Hono<{ Bindings: Bindings }>()

// ── Helper ────────────────────────────────────────────────────
function nowISO() { return new Date().toISOString() }
function uuid() {
  // Web Crypto UUID (available in CF Workers)
  return crypto.randomUUID()
}

// ── Device Registration ───────────────────────────────────────

pipelineApi.post('/device/register', async (c) => {
  try {
    const db = c.env.DB
    const body = await c.req.json() as {
      device_id?: string
      name?: string
      user_id?: string
      firmware_ver?: string
      device_type?: string
    }

    if (!body.device_id) {
      return c.json({ error: 'device_id is required' }, 400)
    }

    const device_id = body.device_id.trim()
    const now = nowISO()

    // Upsert device
    await db.prepare(`
      INSERT INTO devices (id, name, user_id, registered_at, last_seen, firmware_ver, device_type, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        last_seen = excluded.last_seen,
        firmware_ver = COALESCE(excluded.firmware_ver, firmware_ver),
        is_active = 1
    `).bind(
      device_id,
      body.name || 'DigestIQ Device',
      body.user_id || null,
      now, now,
      body.firmware_ver || '1.0.0',
      body.device_type || 'simulator'
    ).run()

    return c.json({
      success: true,
      device_id,
      registered_at: now,
      message: `Device ${device_id} registered`
    })
  } catch (err: any) {
    console.error('Device register error:', err)
    return c.json({ error: 'Failed to register device', detail: err.message }, 500)
  }
})

// ── List Devices ──────────────────────────────────────────────

pipelineApi.get('/devices', async (c) => {
  try {
    const db = c.env.DB
    const { results } = await db.prepare(`
      SELECT id, name, user_id, registered_at, last_seen,
             firmware_ver, device_type, is_active
      FROM devices ORDER BY last_seen DESC LIMIT 50
    `).all()
    return c.json({ devices: results, count: results.length })
  } catch (err: any) {
    return c.json({ error: 'Failed to list devices', detail: err.message }, 500)
  }
})

// ── Session Start ─────────────────────────────────────────────

pipelineApi.post('/session/start', async (c) => {
  try {
    const db = c.env.DB
    const body = await c.req.json() as {
      device_id: string
      user_id?: string
      notes?: string
    }

    if (!body.device_id) {
      return c.json({ error: 'device_id is required' }, 400)
    }

    const session_id = `sess_${uuid().replace(/-/g, '').substring(0, 16)}`
    const now = nowISO()

    // Auto-register device if it doesn't exist
    await db.prepare(`
      INSERT OR IGNORE INTO devices (id, name, registered_at, last_seen, device_type, is_active)
      VALUES (?, 'DigestIQ Device', ?, ?, 'simulator', 1)
    `).bind(body.device_id, now, now).run()

    // Create session
    await db.prepare(`
      INSERT INTO sessions (id, device_id, user_id, started_at, status, packet_count, notes)
      VALUES (?, ?, ?, ?, 'active', 0, ?)
    `).bind(session_id, body.device_id, body.user_id || null, now, body.notes || null).run()

    // Update device last_seen
    await db.prepare(`UPDATE devices SET last_seen = ? WHERE id = ?`)
      .bind(now, body.device_id).run()

    return c.json({
      success: true,
      session_id,
      device_id: body.device_id,
      started_at: now,
      status: 'active',
    })
  } catch (err: any) {
    console.error('Session start error:', err)
    return c.json({ error: 'Failed to start session', detail: err.message }, 500)
  }
})

// ── Session End ───────────────────────────────────────────────

pipelineApi.post('/session/:id/end', async (c) => {
  try {
    const db = c.env.DB
    const session_id = c.req.param('id')
    const now = nowISO()

    // Get session
    const session = await db.prepare(`SELECT * FROM sessions WHERE id = ?`)
      .bind(session_id).first() as any
    if (!session) return c.json({ error: 'Session not found' }, 404)

    // Compute duration
    const startMs = new Date(session.started_at).getTime()
    const durationMins = Math.round((Date.now() - startMs) / 60000 * 10) / 10

    // Get packet count
    const countRow = await db.prepare(`SELECT COUNT(*) as cnt FROM telemetry WHERE session_id = ?`)
      .bind(session_id).first() as any
    const packet_count = countRow?.cnt || 0

    // Get aggregate stats
    const stats = await db.prepare(`
      SELECT AVG(ph) as avg_ph, MIN(ph) as min_ph, MAX(ph) as max_ph,
             AVG(temperature) as avg_temp, AVG(motion_magnitude) as avg_motion
      FROM telemetry WHERE session_id = ? AND is_valid = 1
    `).bind(session_id).first() as any

    // Get final scores
    const lastScore = await db.prepare(`
      SELECT * FROM scores WHERE session_id = ? ORDER BY scored_at DESC LIMIT 1
    `).bind(session_id).first() as any

    // End session
    await db.prepare(`
      UPDATE sessions SET status = 'completed', ended_at = ?, packet_count = ?, duration_mins = ?
      WHERE id = ?
    `).bind(now, packet_count, durationMins, session_id).run()

    // Upsert session summary
    await db.prepare(`
      INSERT OR REPLACE INTO session_summaries (
        session_id, computed_at, duration_hrs, total_packets,
        avg_ph, min_ph, max_ph, avg_temp, avg_motion,
        final_dis, final_transit, final_stability, final_rhythm, final_food, final_recovery,
        overall_trend
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      session_id, now,
      Math.round(durationMins / 60 * 100) / 100,
      packet_count,
      stats?.avg_ph || null, stats?.min_ph || null, stats?.max_ph || null,
      stats?.avg_temp || null, stats?.avg_motion || null,
      lastScore?.digestive_intelligence || null,
      lastScore?.transit_efficiency || null,
      lastScore?.digestive_stability || null,
      lastScore?.digestive_rhythm || null,
      lastScore?.food_response || null,
      lastScore?.recovery_score || null,
      lastScore?.trend || 'stable'
    ).run()

    return c.json({
      success: true,
      session_id,
      status: 'completed',
      ended_at: now,
      duration_mins: durationMins,
      packet_count,
      final_scores: lastScore || null,
    })
  } catch (err: any) {
    console.error('Session end error:', err)
    return c.json({ error: 'Failed to end session', detail: err.message }, 500)
  }
})

// ── Telemetry Ingestion ───────────────────────────────────────
// POST /api/ingest
// Accepts single packet or array of packets
// Validates → Normalizes → Stores → Scores → Returns result

pipelineApi.post('/ingest', async (c) => {
  try {
    const db = c.env.DB
    const body = await c.req.json()

    // Accept single or batch
    const rawPackets: RawTelemetryPacket[] = Array.isArray(body) ? body : [body]

    if (rawPackets.length === 0) {
      return c.json({ error: 'No packets in request body' }, 400)
    }
    if (rawPackets.length > 100) {
      return c.json({ error: 'Max 100 packets per batch request' }, 400)
    }

    // Validate all packets
    const { valid, invalid, total } = validateBatch(rawPackets)

    if (valid.length === 0) {
      return c.json({
        success: false,
        error: 'All packets failed validation',
        invalid_count: invalid.length,
        validation_errors: invalid.map(p => ({ device_id: p.device_id, msg: p.validation_msg }))
      }, 422)
    }

    // Insert valid telemetry packets
    const insertedIds: number[] = []
    const sessionIds = new Set<string>()

    for (const pkt of valid) {
      sessionIds.add(pkt.session_id)

      const result = await db.prepare(`
        INSERT INTO telemetry (
          session_id, device_id, ts, received_at,
          temperature, ph, motion_x, motion_y, motion_z,
          battery, signal_strength,
          temp_normalized, ph_normalized, motion_magnitude,
          is_valid, validation_msg
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        pkt.session_id, pkt.device_id, pkt.ts, pkt.received_at,
        pkt.temperature ?? null, pkt.ph ?? null,
        pkt.motion_x ?? null, pkt.motion_y ?? null, pkt.motion_z ?? null,
        pkt.battery ?? null, pkt.signal_strength ?? null,
        pkt.temp_normalized, pkt.ph_normalized, pkt.motion_magnitude,
        1, 'ok'
      ).run()

      if (result.meta?.last_row_id) {
        insertedIds.push(result.meta.last_row_id as number)
      }
    }

    // Update session packet counts and device last_seen
    for (const session_id of sessionIds) {
      const countDelta = valid.filter(p => p.session_id === session_id).length
      const deviceId = valid.find(p => p.session_id === session_id)?.device_id

      await db.prepare(`
        UPDATE sessions SET packet_count = packet_count + ? WHERE id = ?
      `).bind(countDelta, session_id).run()

      if (deviceId) {
        await db.prepare(`UPDATE devices SET last_seen = ? WHERE id = ?`)
          .bind(nowISO(), deviceId).run()
      }
    }

    // ── Score each affected session ─────────────────────────────
    const scoringResults: Record<string, ScoringResult> = {}
    const anomaliesInserted: string[] = []

    for (const session_id of sessionIds) {
      // Fetch rolling window of last 30 packets from D1
      const { results: rows } = await db.prepare(`
        SELECT ts, temperature, ph, motion_x, motion_y, motion_z,
               motion_magnitude, temp_normalized, ph_normalized, battery
        FROM telemetry
        WHERE session_id = ? AND is_valid = 1
        ORDER BY ts DESC LIMIT 30
      `).bind(session_id).all()

      // Reverse so oldest first (chronological for scoring)
      const chronRows = (rows as any[]).reverse()

      // Get packet count for index
      const countRow = await db.prepare(`SELECT packet_count FROM sessions WHERE id = ?`)
        .bind(session_id).first() as any
      const packetIndex = countRow?.packet_count || 0

      // Get recent DIS history for trend detection
      const { results: histRows } = await db.prepare(`
        SELECT digestive_intelligence FROM scores
        WHERE session_id = ? ORDER BY scored_at DESC LIMIT 10
      `).bind(session_id).all()
      const historicalDIS = (histRows as any[]).reverse().map(r => r.digestive_intelligence as number)

      // Build window and compute scores
      const window = buildWindow(session_id, chronRows as any)
      const scoring = computeScores(window, packetIndex, historicalDIS)
      scoringResults[session_id] = scoring

      // Insert score record
      await db.prepare(`
        INSERT INTO scores (
          session_id, scored_at, packet_index,
          digestive_intelligence, transit_efficiency, digestive_stability,
          digestive_rhythm, food_response, recovery_score,
          environmental_variability, data_confidence,
          trend, anomaly_detected,
          ph_rolling_avg, temp_rolling_avg, motion_rolling_avg,
          ph_variance, temp_variance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        scoring.session_id, scoring.scored_at, scoring.packet_index,
        scoring.digestive_intelligence, scoring.transit_efficiency, scoring.digestive_stability,
        scoring.digestive_rhythm, scoring.food_response, scoring.recovery_score,
        scoring.environmental_variability, scoring.data_confidence,
        scoring.trend, scoring.anomaly_detected ? 1 : 0,
        scoring.ph_rolling_avg, scoring.temp_rolling_avg, scoring.motion_rolling_avg,
        scoring.ph_variance, scoring.temp_variance
      ).run()

      // Insert anomaly if detected
      if (scoring.anomaly_detected) {
        const anomaly = detectAnomalies(window.packets, [])
        if (anomaly.detected) {
          await db.prepare(`
            INSERT INTO anomalies (
              session_id, detected_at, anomaly_type, severity,
              metric, observed_value, expected_range, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            session_id, nowISO(),
            anomaly.type || 'unknown',
            anomaly.severity || 'low',
            anomaly.metric || null,
            anomaly.observed_value ?? null,
            anomaly.expected_range || null,
            anomaly.description || null
          ).run()
          anomaliesInserted.push(session_id)
        }
      }
    }

    // Response
    return c.json({
      success: true,
      ingested: valid.length,
      rejected: invalid.length,
      total_received: total,
      telemetry_ids: insertedIds,
      scores: scoringResults,
      anomalies_flagged: anomaliesInserted.length,
      invalid_packets: invalid.length > 0
        ? invalid.map(p => ({ session_id: p.session_id, device_id: p.device_id, error: p.validation_msg }))
        : undefined,
    })

  } catch (err: any) {
    console.error('Ingest error:', err)
    return c.json({ error: 'Ingestion failed', detail: err.message }, 500)
  }
})

// ── List Sessions ─────────────────────────────────────────────

pipelineApi.get('/sessions', async (c) => {
  try {
    const db = c.env.DB
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)
    const device_id = c.req.query('device_id')

    let query = `
      SELECT s.id, s.device_id, s.user_id, s.started_at, s.ended_at,
             s.status, s.packet_count, s.duration_mins, s.notes,
             ss.final_dis, ss.avg_ph, ss.avg_temp, ss.overall_trend
      FROM sessions s
      LEFT JOIN session_summaries ss ON s.id = ss.session_id
    `
    const bindings: any[] = []
    if (device_id) {
      query += ` WHERE s.device_id = ?`
      bindings.push(device_id)
    }
    query += ` ORDER BY s.started_at DESC LIMIT ?`
    bindings.push(limit)

    const stmt = db.prepare(query)
    const { results } = await (bindings.length > 0 ? stmt.bind(...bindings) : stmt).all()

    return c.json({ sessions: results, count: results.length })
  } catch (err: any) {
    return c.json({ error: 'Failed to list sessions', detail: err.message }, 500)
  }
})

// ── Session Detail ────────────────────────────────────────────

pipelineApi.get('/session/:id', async (c) => {
  try {
    const db = c.env.DB
    const session_id = c.req.param('id')

    const session = await db.prepare(`SELECT * FROM sessions WHERE id = ?`)
      .bind(session_id).first()
    if (!session) return c.json({ error: 'Session not found' }, 404)

    const summary = await db.prepare(`SELECT * FROM session_summaries WHERE session_id = ?`)
      .bind(session_id).first()

    const { results: anomalies } = await db.prepare(`
      SELECT * FROM anomalies WHERE session_id = ? ORDER BY detected_at DESC LIMIT 20
    `).bind(session_id).all()

    // Latest score
    const latestScore = await db.prepare(`
      SELECT * FROM scores WHERE session_id = ? ORDER BY scored_at DESC LIMIT 1
    `).bind(session_id).first()

    return c.json({
      session,
      summary: summary || null,
      latest_scores: latestScore || null,
      anomaly_count: anomalies.length,
      anomalies,
    })
  } catch (err: any) {
    return c.json({ error: 'Failed to get session', detail: err.message }, 500)
  }
})

// ── Latest Packets (Smart Polling Endpoint) ───────────────────
// GET /api/session/:id/latest?n=20&since=<iso_ts>
// Frontend polls every 2s — returns only new packets

pipelineApi.get('/session/:id/latest', async (c) => {
  try {
    const db = c.env.DB
    const session_id = c.req.param('id')
    const n = Math.min(parseInt(c.req.query('n') || '20'), 200)
    const since = c.req.query('since')  // ISO timestamp — return only packets after this

    let query: string
    let bindings: any[]

    if (since) {
      query = `
        SELECT id, ts, received_at, temperature, ph,
               motion_x, motion_y, motion_z, motion_magnitude,
               battery, signal_strength, temp_normalized, ph_normalized,
               is_valid, validation_msg
        FROM telemetry
        WHERE session_id = ? AND ts > ? AND is_valid = 1
        ORDER BY ts ASC LIMIT ?
      `
      bindings = [session_id, since, n]
    } else {
      query = `
        SELECT id, ts, received_at, temperature, ph,
               motion_x, motion_y, motion_z, motion_magnitude,
               battery, signal_strength, temp_normalized, ph_normalized,
               is_valid, validation_msg
        FROM telemetry
        WHERE session_id = ? AND is_valid = 1
        ORDER BY ts DESC LIMIT ?
      `
      bindings = [session_id, n]
    }

    const { results: packets } = await db.prepare(query).bind(...bindings).all()

    // If no since, reverse to chronological order
    const orderedPackets = since ? packets : [...packets].reverse()

    // Latest score
    const latestScore = await db.prepare(`
      SELECT * FROM scores WHERE session_id = ? ORDER BY scored_at DESC LIMIT 1
    `).bind(session_id).first()

    // Session status
    const session = await db.prepare(`
      SELECT id, status, packet_count, started_at FROM sessions WHERE id = ?
    `).bind(session_id).first() as any

    return c.json({
      session_id,
      session_status: session?.status || 'unknown',
      total_packets: session?.packet_count || 0,
      returned: orderedPackets.length,
      packets: orderedPackets,
      latest_scores: latestScore || null,
      server_ts: nowISO(),
    })
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch latest packets', detail: err.message }, 500)
  }
})

// ── Score History ─────────────────────────────────────────────

pipelineApi.get('/session/:id/scores', async (c) => {
  try {
    const db = c.env.DB
    const session_id = c.req.param('id')
    const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500)

    const { results } = await db.prepare(`
      SELECT scored_at, packet_index,
             digestive_intelligence, transit_efficiency, digestive_stability,
             digestive_rhythm, food_response, recovery_score,
             trend, anomaly_detected, data_confidence,
             ph_rolling_avg, temp_rolling_avg, motion_rolling_avg
      FROM scores
      WHERE session_id = ?
      ORDER BY scored_at ASC
      LIMIT ?
    `).bind(session_id, limit).all()

    return c.json({ session_id, scores: results, count: results.length })
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch scores', detail: err.message }, 500)
  }
})

// ── Stream Alias (kept for compatibility) ─────────────────────
// GET /api/stream/:session_id/latest — same as session/:id/latest

pipelineApi.get('/stream/:session_id/latest', async (c) => {
  const session_id = c.req.param('session_id')
  const n = c.req.query('n') || '20'
  const since = c.req.query('since') || ''
  // Redirect to canonical endpoint
  const url = `/api/session/${session_id}/latest?n=${n}${since ? `&since=${since}` : ''}`
  return c.redirect(url)
})

// ── Pipeline Status ───────────────────────────────────────────

pipelineApi.get('/pipeline/status', async (c) => {
  try {
    const db = c.env.DB

    const deviceCount = await db.prepare(`SELECT COUNT(*) as cnt FROM devices WHERE is_active = 1`).first() as any
    const sessionCount = await db.prepare(`SELECT COUNT(*) as cnt FROM sessions WHERE status = 'active'`).first() as any
    const telemetryCount = await db.prepare(`SELECT COUNT(*) as cnt FROM telemetry`).first() as any
    const lastPacket = await db.prepare(`SELECT ts FROM telemetry ORDER BY received_at DESC LIMIT 1`).first() as any

    return c.json({
      status: 'operational',
      pipeline: 'DigestIQ Real-Time Pipeline v1.0',
      active_devices: deviceCount?.cnt || 0,
      active_sessions: sessionCount?.cnt || 0,
      total_packets: telemetryCount?.cnt || 0,
      last_packet_ts: lastPacket?.ts || null,
      server_ts: nowISO(),
      db_binding: 'D1 digestiq-production',
    })
  } catch (err: any) {
    return c.json({ status: 'degraded', error: err.message }, 500)
  }
})
