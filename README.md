# DigestIQ — Personal Digestive Intelligence Platform

> **"The Fitbit for the Digestive System"**

## Project Overview
- **Name**: DigestIQ
- **Category**: Consumer Wellness Observability Platform
- **Vision**: The world's first personal digestive intelligence platform combining an ingestible smart capsule, AI pattern analysis, and longitudinal gut observability.
- **Positioning**: Wellness intelligence — NOT medical diagnosis. FDA-aware, consumer-safe, liability-conscious.

## Live URLs
- **Production**: https://digestiq.pages.dev
- **GitHub**: https://github.com/mkbrown261/digestiq
- **Preview**: https://16edfcfd.digestiq.pages.dev

## Pages
| Route | Description |
|-------|-------------|
| `/` | Home — hero, features, how-it-works, CTA |
| `/platform` | Platform deep-dive — capsule specs, AI engine, consumer app |
| `/science` | Scientific foundation — GI physiology, biosensor tech, future research |
| `/architecture` | System architecture — 7-layer stack, System Laws, regulatory roadmap |
| `/dashboard` | Live demo dashboard — metrics, GI journey map, charts, insights |
| `/insights` | AI Insights — sample reports, ethics framework, tone guidelines |
| `/api/health` | Health check endpoint |
| `/api/insights/demo` | Demo session data API |

## System Architecture (3 Core Layers)

### Layer 1 — Smart Capsule (Hardware)
- CMOS micro-camera (2–4 fps)
- ISFET pH biosensor (1.0–9.0 range)
- NTC thermistor (±0.1°C)
- MEMS accelerometer + gyroscope
- BLE 5.3 wireless radio
- Silver oxide battery (10–12hr)
- Biocompatible PGLA polymer shell
- Dimensions: 11 × 26 mm

### Layer 2 — AI Intelligence Engine
- Multi-model orchestration (vision + time-series + NLG)
- Sensor fusion pipeline
- Longitudinal gut profiling
- Food-response correlation engine
- Anomaly scoring (personal baseline deviation)
- Intelligence Quality Control scorecard
- Provider abstraction (no vendor lock-in)

### Layer 3 — Consumer Platform
- Mobile + web experience
- Live session monitoring
- GI journey visualization
- AI wellness narratives
- Food journaling
- Historical trend analysis

## Tech Stack
- **Framework**: Hono on Cloudflare Workers/Pages
- **Build**: Vite + TypeScript
- **Frontend**: Tailwind CSS (CDN), Chart.js, FontAwesome
- **Deployment**: Cloudflare Pages (edge-deployed globally)
- **Version Control**: Git / GitHub

## Security Architecture
- Zero-trust between all services
- HIPAA-aware data handling
- End-to-end encryption (AES-256 at rest, TLS 1.3 in transit)
- Immutable audit logs
- Rotating credentials
- Consent management system
- 16 constitutional System Laws enforced

## Regulatory Positioning
- **Phase 1 (2026–2027)**: Consumer wellness platform — no medical claims
- **Phase 2 (2027–2028)**: IRB-approved research partnerships
- **Phase 3 (2028–2030)**: FDA 510(k) pathway
- **Phase 4 (2030+)**: Full regulated diagnostics

## AI Ethics Framework
- Always observational — never diagnostic
- Calibrated confidence language
- Non-alarming, calm communication
- Privacy by default
- No disease-detection language
- Zero tolerance for medical conclusions

## Deployment
- **Platform**: Cloudflare Pages
- **Status**: ✅ Live
- **Build**: `npm run build` → `dist/`
- **Deploy**: `wrangler pages deploy dist --project-name digestiq`
- **Last Updated**: May 2026

## Compliance Statement
DigestIQ is a consumer wellness observability platform. It does not diagnose, treat, cure, or prevent any disease or condition. All AI insights are observational wellness patterns. Always consult a qualified healthcare professional for medical evaluation.

---

## Phase 3 — Real-Time Data Pipeline (COMPLETE)

### Architecture
```
Python Simulator → POST /api/ingest → Validator → D1 telemetry table
                                                 → Scoring Engine → D1 scores table
                                                 → Anomaly Detection → D1 anomalies table

Frontend /live → GET /api/session/:id/latest (2s poll) → Three.js orb + Charts
```

### Pipeline API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/device/register` | Register ingestible device |
| POST | `/api/session/start` | Start new capsule session |
| POST | `/api/session/:id/end` | End session + compute summary |
| POST | `/api/ingest` | Ingest 1–100 telemetry packets |
| GET | `/api/sessions` | List sessions |
| GET | `/api/session/:id` | Session detail + scores |
| GET | `/api/session/:id/latest` | Smart polling (2s frontend) |
| GET | `/api/session/:id/scores` | Full score history |
| GET | `/api/pipeline/status` | Pipeline health |

### Scoring Engine — 6 Models
All scores 0–100, computed deterministically per packet using rolling 30-packet window:
- **DIS** — Digestive Intelligence Score (composite master)
- **TE** — Transit Efficiency (peristaltic motion quality)
- **DS** — Digestive Stability (pH + temp variance)
- **DR** — Digestive Rhythm (inter-peak interval regularity)
- **FR** — Food Response (zone-appropriate pH profiles)
- **RS** — Recovery Score (post-perturbation return to baseline)

### Python Simulator
```bash
cd simulator/
python main.py  # → localhost:3000 by default

# Production
DIGESTIQ_API_URL=https://digestiq.pages.dev python main.py

# Fast test (10 min simulated journey)
GI_DURATION_SEC=600 python main.py
```

### D1 Database Schema
6 tables: `devices`, `sessions`, `telemetry`, `scores`, `anomalies`, `session_summaries`
- Database: `digestiq-production` (ID: `184172af-29e5-4a75-b2d8-31ce59b5f31c`)
- Binding: `DB`
- Migrations applied: local ✅ + remote ✅

### Live Dashboard
- URL: `https://digestiq.pages.dev/live`
- Three.js animated DIS orb (color-maps 0–100)
- 6 SVG score rings (animated `stroke-dashoffset`)
- Chart.js rolling sensor chart (60-point pH/temp/motion)
- Chart.js DIS history sparkline (80-point)
- GI Zone tracker (Stomach → Duodenum → Jejunum → Ileum → Colon)
- Packet feed (real-time, 50 rows)
- Battery + signal strength indicators
- 2s smart polling (`?since=<ts>` for incremental updates)

