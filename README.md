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
