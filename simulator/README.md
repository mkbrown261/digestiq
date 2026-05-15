# DigestIQ Capsule Simulator

Software simulator for the DigestIQ ingestible sensor capsule.
Generates physiologically-realistic GI telemetry and streams it to the DigestIQ API in real-time.

## Architecture

```
main.py
  └─ simulator.py      ← Orchestrator (startup, run loop, shutdown)
       ├─ sensors.py   ← GI physics engine (pH, temp, motion models)
       ├─ client.py    ← HTTP client (retry, queue, session management)
       └─ config.py    ← All tuneable parameters
```

## Quick Start

```bash
# Prerequisites: Python 3.9+ (stdlib only, no pip install needed)

# 1. Start the DigestIQ API locally
cd /home/user/webapp && pm2 start ecosystem.config.cjs

# 2. Run the simulator (points to localhost:3000 by default)
cd /home/user/webapp/simulator
python main.py
```

## Environment Variables

| Variable              | Default                  | Description                              |
|-----------------------|--------------------------|------------------------------------------|
| `DIGESTIQ_API_URL`    | `http://localhost:3000`  | API base URL                             |
| `DEVICE_ID`           | `digestiq_pi_001`        | Device identifier                        |
| `DEVICE_NAME`         | `DigestIQ Pi Simulator`  | Display name                             |
| `GI_DURATION_SEC`     | `3600`                   | Simulated GI journey duration (seconds)  |

## Usage Examples

```bash
# Local development (default)
python main.py

# Production
DIGESTIQ_API_URL=https://digestiq.pages.dev python main.py

# Fast test (10-minute simulated journey)
GI_DURATION_SEC=600 python main.py

# Different device
DEVICE_ID=test_capsule_42 python main.py
```

## Output

```
  #0001 │ Stomach      │ pH= 2.45 │ T=37.1°C │ M=0.823g │ bat=100.0% │ journey= 0.1% ✓
    DIS= 64.1  TE= 94.5  DS= 96.2  [  stable]  conf= 75%
  #0002 │ Stomach      │ pH= 2.61 │ T=37.2°C │ M=1.102g │ bat= 99.9% │ journey= 0.2% ✓
```

## GI Segments & pH Profile

| Segment    | pH Mean | Duration |
|------------|---------|----------|
| Esophagus  | 6.8     | 1%       |
| Stomach    | 2.5     | 18%      |
| Duodenum   | 5.8     | 8%       |
| Jejunum    | 6.4     | 22%      |
| Ileum      | 7.2     | 25%      |
| Cecum      | 7.6     | 6%       |
| Colon      | 7.8     | 20%      |

## Anomaly Injection

The simulator can inject physiological anomalies at preset times:
- **pH spike** (t=5min): brief extreme acidity (pH 1.2)
- **Temperature spike** (t=15min): core temp to 39.8°C  
- **Stasis** (t=30min): 30s of very low motion
- **Rapid pH shift** (t=45min): 4-unit pH change

Enable/disable via `INJECT_ANOMALIES` in `config.py`.

## Offline Resilience

If the API disconnects:
1. Packets are queued locally (up to 500 by default)
2. Exponential backoff reconnection (5s → 60s)
3. Queue drains automatically on reconnect
