"""
DigestIQ — Main Simulator Orchestrator
========================================
Ties together: GIPhysicsEngine + DigestIQClient + timing loop.
Handles: startup, packet generation, transmission, status display, shutdown.
"""

import logging
import signal
import sys
import time
from datetime import datetime, timezone

from config import (
    DEVICE_ID, PACKET_INTERVAL_SEC, SIMULATION_DURATION_SEC,
    GI_JOURNEY_DURATION_SEC, LOG_LEVEL, LOG_FILE, SHOW_SCORES
)
from sensors import GIPhysicsEngine
from client import DigestIQClient


# ── Logging setup ─────────────────────────────────────────────────────────────

def setup_logging():
    level = getattr(logging, LOG_LEVEL.upper(), logging.INFO)
    handlers = [logging.StreamHandler(sys.stdout)]
    if LOG_FILE:
        handlers.append(logging.FileHandler(LOG_FILE))
    logging.basicConfig(
        level=level,
        format="%(asctime)s │ %(name)-20s │ %(levelname)-7s │ %(message)s",
        datefmt="%H:%M:%S",
        handlers=handlers,
    )
    # Silence noisy urllib logging
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("urllib.request").setLevel(logging.WARNING)


log = logging.getLogger("digestiq.simulator")


# ── ASCII banner ──────────────────────────────────────────────────────────────

BANNER = """
╔═══════════════════════════════════════════════════════════════╗
║         DigestIQ — Ingestible Capsule Simulator v1.2          ║
║      Real-Time GI Telemetry → Hono API → D1 → Scoring         ║
╚═══════════════════════════════════════════════════════════════╝
"""


# ── Main simulator class ──────────────────────────────────────────────────────

class DigestIQSimulator:

    def __init__(self):
        self.client  : DigestIQClient    = None
        self.engine  : GIPhysicsEngine   = None
        self.running  = False
        self.start_ts = None

        # Stats
        self.packets_generated = 0
        self.loop_errors       = 0

    def startup(self) -> bool:
        """
        1. Connect to API (register device + start session)
        2. Initialise physics engine with session_id
        3. Ready to run
        """
        print(BANNER)
        log.info(f"Device:    {DEVICE_ID}")
        log.info(f"Interval:  {PACKET_INTERVAL_SEC}s per packet")
        log.info(f"GI journey: {GI_JOURNEY_DURATION_SEC}s simulated")
        log.info("")

        self.client = DigestIQClient()

        if not self.client.connect():
            log.error("Failed to connect to DigestIQ API. Check API_BASE_URL and that the server is running.")
            return False

        self.engine = GIPhysicsEngine(
            device_id=DEVICE_ID,
            session_id=self.client.session_id,
            journey_duration_sec=GI_JOURNEY_DURATION_SEC,
        )

        log.info(f"Session:   {self.client.session_id}")
        log.info(f"Starting simulation. Press Ctrl-C to stop gracefully.")
        log.info("")

        if SHOW_SCORES:
            print(f"  {'DIS':>6} {'TE':>6} {'DS':>6} {'TREND':>10} {'CONF':>6}")
            print(f"  {'─'*45}")

        self.start_ts = time.time()
        self.running  = True
        return True

    def run(self):
        """Main simulation loop. Runs until stopped or journey complete."""
        last_step_time = time.time()
        last_status_time = time.time()

        while self.running:
            now = time.time()
            dt  = now - last_step_time
            last_step_time = now

            # Check simulation duration limit
            if SIMULATION_DURATION_SEC and (now - self.start_ts) >= SIMULATION_DURATION_SEC:
                log.info(f"Simulation duration limit ({SIMULATION_DURATION_SEC}s) reached. Stopping.")
                break

            # Check GI journey completion
            if self.engine.journey_complete:
                log.info(f"GI journey complete ({GI_JOURNEY_DURATION_SEC}s simulated).")
                break

            try:
                # Generate packet
                packet = self.engine.step(dt)
                self.packets_generated += 1

                # Display packet info
                seg     = packet.get("_segment", "—")
                ph      = packet.get("ph", 0)
                temp    = packet.get("temperature", 0)
                motion  = (packet.get("motion_x",0)**2 + packet.get("motion_y",0)**2 + packet.get("motion_z",0)**2)**0.5
                battery = packet.get("battery", 100)
                pct     = self.engine.journey_progress_pct

                print(
                    f"  #{self.packets_generated:04d} │ "
                    f"{seg:<12} │ "
                    f"pH={ph:5.2f} │ "
                    f"T={temp:5.1f}°C │ "
                    f"M={motion:5.3f}g │ "
                    f"bat={battery:5.1f}% │ "
                    f"journey={pct:5.1f}%",
                    end=""
                )

                # Send
                sent = self.client.send(packet)
                print(" ✓" if sent else " ✗")

                # Periodic status
                if now - last_status_time >= 30:
                    log.info(self.client.status_line())
                    last_status_time = now

            except KeyboardInterrupt:
                break
            except Exception as e:
                self.loop_errors += 1
                log.error(f"Loop error: {e}")
                if self.loop_errors > 10:
                    log.error("Too many loop errors. Stopping.")
                    break

            # Sleep until next packet
            elapsed = time.time() - last_step_time
            sleep_time = max(0, PACKET_INTERVAL_SEC - elapsed)
            time.sleep(sleep_time)

    def shutdown(self):
        """Graceful shutdown: end session, print summary."""
        self.running = False
        log.info("")
        log.info("═══ Shutdown ═══")

        if self.client and self.client.session_id:
            self.client.end_session()

        elapsed_min = (time.time() - self.start_ts) / 60 if self.start_ts else 0

        log.info(f"Run time:           {elapsed_min:.1f} min")
        log.info(f"Packets generated:  {self.packets_generated}")
        log.info(f"Packets sent:       {self.client.packets_sent if self.client else 0}")
        log.info(f"Packets queued:     {len(self.client._queue) if self.client else 0}")
        log.info(f"Loop errors:        {self.loop_errors}")
        log.info("═══════════════")


# ── Signal handlers ───────────────────────────────────────────────────────────

_simulator_instance: DigestIQSimulator = None

def _handle_sigint(sig, frame):
    log.info("\nSIGINT received — stopping gracefully…")
    if _simulator_instance:
        _simulator_instance.running = False

def _handle_sigterm(sig, frame):
    log.info("SIGTERM received — stopping…")
    if _simulator_instance:
        _simulator_instance.running = False


def run():
    """Entry point — called from main.py."""
    global _simulator_instance

    setup_logging()
    signal.signal(signal.SIGINT,  _handle_sigint)
    signal.signal(signal.SIGTERM, _handle_sigterm)

    sim = DigestIQSimulator()
    _simulator_instance = sim

    try:
        if not sim.startup():
            sys.exit(1)
        sim.run()
    except KeyboardInterrupt:
        pass
    finally:
        sim.shutdown()
