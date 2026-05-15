#!/usr/bin/env python3
"""
DigestIQ Capsule Simulator — Entry Point
==========================================
Usage:
  # Point at local dev server:
  python main.py

  # Point at production:
  DIGESTIQ_API_URL=https://digestiq.pages.dev python main.py

  # Custom device + fast GI journey (10 min instead of 1h):
  DEVICE_ID=test_device_42 GI_DURATION_SEC=600 python main.py

  # Run for exactly 5 minutes:
  SIMULATION_DURATION_SEC=300 python main.py

Environment variables:
  DIGESTIQ_API_URL       API base URL (default: http://localhost:3000)
  DEVICE_ID              Device identifier (default: digestiq_pi_001)
  DEVICE_NAME            Device display name
  GI_DURATION_SEC        Simulated GI journey seconds (default: 3600)
  SIMULATION_DURATION_SEC  Max real-world runtime in seconds (default: unlimited)

Requirements: Python 3.9+ — stdlib only (no pip install needed)
"""

import sys

# Require Python 3.9+
if sys.version_info < (3, 9):
    print(f"Error: Python 3.9+ required (you have {sys.version})")
    sys.exit(1)

from simulator import run

if __name__ == "__main__":
    run()
