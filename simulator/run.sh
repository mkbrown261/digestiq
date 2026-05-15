#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# DigestIQ Capsule Simulator — Quick-Start Script
# Works on macOS, Linux, Raspberry Pi
#
# Usage:
#   ./run.sh                          → local dev (localhost:3000)
#   ./run.sh prod                     → production (digestiq.pages.dev)
#   ./run.sh prod fast                → production, 10-min GI journey
#   ./run.sh prod fast test_device_1  → production, fast, custom device ID
# ═══════════════════════════════════════════════════════════════

set -e

# ── Find Python 3.9+ ──────────────────────────────────────────
PYTHON=""
for cmd in python3 python python3.12 python3.11 python3.10 python3.9; do
  if command -v "$cmd" &>/dev/null; then
    VER=$("$cmd" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null)
    MAJOR=$(echo "$VER" | cut -d. -f1)
    MINOR=$(echo "$VER" | cut -d. -f2)
    if [ "$MAJOR" -ge 3 ] && [ "$MINOR" -ge 9 ]; then
      PYTHON="$cmd"
      break
    fi
  fi
done

if [ -z "$PYTHON" ]; then
  echo "❌ Python 3.9+ not found."
  echo "   Install with: brew install python3   (macOS)"
  echo "   Or:           sudo apt install python3   (Linux)"
  exit 1
fi

echo "✓ Using: $($PYTHON --version)"

# ── Parse arguments ───────────────────────────────────────────
MODE=${1:-local}       # local | prod | <custom-url>
SPEED=${2:-normal}     # normal | fast (10-min journey)
DEVICE=${3:-digestiq_pi_001}

case "$MODE" in
  prod|production)
    export DIGESTIQ_API_URL="https://digestiq.pages.dev"
    ;;
  local|localhost|"")
    export DIGESTIQ_API_URL="http://localhost:3000"
    ;;
  http*|https*)
    export DIGESTIQ_API_URL="$MODE"
    ;;
  *)
    echo "Usage: $0 [local|prod|<url>] [normal|fast] [device_id]"
    exit 1
    ;;
esac

case "$SPEED" in
  fast|quick|test)
    export GI_DURATION_SEC=600      # 10-minute simulated journey
    ;;
  demo)
    export GI_DURATION_SEC=120      # 2-minute demo
    ;;
  *)
    export GI_DURATION_SEC=${GI_DURATION_SEC:-3600}   # 1-hour default
    ;;
esac

export DEVICE_ID="$DEVICE"

# ── Banner ────────────────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║       DigestIQ Capsule Simulator — run.sh             ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo "  API URL:    $DIGESTIQ_API_URL"
echo "  Device:     $DEVICE_ID"
echo "  GI journey: ${GI_DURATION_SEC}s simulated"
echo "  Press Ctrl-C to stop gracefully"
echo ""

# ── Run ───────────────────────────────────────────────────────
# Must run from the simulator/ directory so imports work
cd "$(dirname "$0")"
exec "$PYTHON" main.py
