"""
DigestIQ — HTTP Client
========================
Handles all HTTP communication with the DigestIQ API.
Features:
- Exponential backoff retry
- Packet queue for offline resilience
- Auto device registration
- Auto session creation
- Connection state tracking
"""

import json
import logging
import time
import urllib.request
import urllib.error
from collections import deque
from typing import Optional

from config import (
    API_BASE_URL, DEVICE_ID, DEVICE_NAME, FIRMWARE_VERSION, DEVICE_TYPE, USER_ID,
    MAX_RETRY_ATTEMPTS, RETRY_BACKOFF_SEC, QUEUE_MAX_SIZE, SHOW_SCORES, BATCH_SIZE
)

log = logging.getLogger("digestiq.client")


class APIError(Exception):
    def __init__(self, status: int, body: str):
        self.status = status
        self.body   = body
        super().__init__(f"HTTP {status}: {body[:200]}")


class DigestIQClient:
    """
    Manages HTTP connection to DigestIQ API with:
    - Auto registration and session management
    - Exponential backoff on failure
    - Offline packet queue (drains when reconnected)
    - Clean status reporting
    """

    def __init__(self):
        self.base_url   = API_BASE_URL.rstrip('/')
        self.device_id  = DEVICE_ID
        self.session_id: Optional[str] = None

        # Connection state
        self.connected         = False
        self.retry_count       = 0
        self.backoff_sec       = RETRY_BACKOFF_SEC
        self.last_error: Optional[str] = None
        self.packets_sent      = 0
        self.packets_failed    = 0
        self.packets_queued    = 0

        # Offline queue — stores packets when disconnected
        self._queue: deque = deque(maxlen=QUEUE_MAX_SIZE)

    # ── HTTP primitives ───────────────────────────────────────────────────────

    def _post(self, path: str, data: dict | list, timeout: float = 8.0) -> dict:
        """
        POST JSON to API. Returns parsed response dict.
        Raises APIError on HTTP error, urllib.error.URLError on network error.
        """
        url  = f"{self.base_url}{path}"
        body = json.dumps(data).encode("utf-8")
        req  = urllib.request.Request(
            url, data=body,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw)

    def _get(self, path: str, timeout: float = 5.0) -> dict:
        url = f"{self.base_url}{path}"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw)

    # ── Connection management ─────────────────────────────────────────────────

    def check_health(self) -> bool:
        """Check if API is reachable."""
        try:
            data = self._get("/api/health", timeout=4.0)
            return data.get("status") == "ok"
        except Exception:
            return False

    def register_device(self) -> bool:
        """Register this device with the API. Returns True on success."""
        try:
            data = self._post("/api/device/register", {
                "device_id":    self.device_id,
                "name":         DEVICE_NAME,
                "firmware_ver": FIRMWARE_VERSION,
                "device_type":  DEVICE_TYPE,
                "user_id":      USER_ID,
            })
            if data.get("success"):
                log.info(f"✓ Device registered: {self.device_id}")
                return True
            log.warning(f"Device registration returned: {data}")
            return False
        except Exception as e:
            log.error(f"Device registration failed: {e}")
            return False

    def start_session(self, notes: str = None) -> Optional[str]:
        """Start a new session. Returns session_id or None."""
        try:
            data = self._post("/api/session/start", {
                "device_id": self.device_id,
                "user_id":   USER_ID,
                "notes":     notes or f"Simulator session — {self.device_id}",
            })
            if data.get("success") and data.get("session_id"):
                session_id = data["session_id"]
                log.info(f"✓ Session started: {session_id}")
                return session_id
            log.warning(f"Session start returned: {data}")
            return None
        except Exception as e:
            log.error(f"Session start failed: {e}")
            return None

    def end_session(self) -> bool:
        """End the current session. Returns True on success."""
        if not self.session_id:
            return False
        try:
            data = self._post(f"/api/session/{self.session_id}/end", {})
            if data.get("success"):
                log.info(f"✓ Session ended: {self.session_id}")
                log.info(f"  Duration: {data.get('duration_mins', 0):.1f} min")
                log.info(f"  Packets:  {data.get('packet_count', 0)}")
                if data.get("final_scores"):
                    s = data["final_scores"]
                    log.info(f"  Final DIS: {s.get('digestive_intelligence', '—'):.1f}/100")
                return True
        except Exception as e:
            log.error(f"Session end failed: {e}")
        return False

    def connect(self) -> bool:
        """
        Full connection sequence: health check → register → start session.
        Returns True if connected and ready to send packets.
        """
        log.info(f"Connecting to {self.base_url}…")

        if not self.check_health():
            log.error(f"API not reachable at {self.base_url}")
            self.connected = False
            return False

        if not self.register_device():
            self.connected = False
            return False

        session_id = self.start_session()
        if not session_id:
            self.connected = False
            return False

        self.session_id   = session_id
        self.connected    = True
        self.retry_count  = 0
        self.backoff_sec  = RETRY_BACKOFF_SEC
        self.last_error   = None
        return True

    # ── Packet sending ────────────────────────────────────────────────────────

    def _clean_packet(self, pkt: dict) -> dict:
        """Remove internal _metadata fields before sending to API."""
        return {k: v for k, v in pkt.items() if not k.startswith('_')}

    def _send_packets(self, packets: list[dict]) -> bool:
        """Send one or more packets to /api/ingest. Returns True on success."""
        clean = [self._clean_packet(p) for p in packets]
        payload = clean[0] if len(clean) == 1 else clean

        try:
            data = self._post("/api/ingest", payload, timeout=8.0)

            if data.get("success"):
                ingested = data.get("ingested", len(packets))
                self.packets_sent += ingested

                if SHOW_SCORES and data.get("scores"):
                    for sid, scores in data["scores"].items():
                        dis  = scores.get("digestive_intelligence", "—")
                        te   = scores.get("transit_efficiency", "—")
                        ds   = scores.get("digestive_stability", "—")
                        trend = scores.get("trend", "stable")
                        conf  = scores.get("data_confidence", 0)
                        anomaly = "⚠" if scores.get("anomaly_detected") else " "
                        print(f"  {anomaly} DIS={dis:5.1f}  TE={te:5.1f}  DS={ds:5.1f}  [{trend:8s}]  conf={conf:.0f}%")

                if data.get("rejected", 0) > 0:
                    log.warning(f"  {data['rejected']} packets rejected by validator")

                return True

            else:
                log.warning(f"Ingest returned non-success: {data}")
                return False

        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:300]
            log.error(f"HTTP {e.code} on ingest: {body}")
            return False

        except (urllib.error.URLError, TimeoutError, ConnectionRefusedError) as e:
            log.warning(f"Network error on ingest: {e}")
            return False

        except Exception as e:
            log.error(f"Unexpected error on ingest: {e}")
            return False

    def send(self, packet: dict) -> bool:
        """
        Send a single packet.
        If disconnected: queue the packet and attempt reconnect.
        If queue is drainable: drain queue first.
        """
        # Add to queue
        self._queue.append(packet)
        self.packets_queued = len(self._queue)

        if not self.connected:
            # Try to reconnect (non-blocking — will retry on next send)
            self._attempt_reconnect()
            return False

        # Drain queue + current packet
        return self._drain_queue()

    def _drain_queue(self) -> bool:
        """Send all queued packets. Returns True if all sent successfully."""
        success = True
        batch = []

        while self._queue:
            batch.append(self._queue.popleft())
            if len(batch) >= BATCH_SIZE:
                if not self._send_packets(batch):
                    # Put failed packets back at front of queue
                    for p in reversed(batch):
                        self._queue.appendleft(p)
                    self.connected = False
                    success = False
                    break
                batch = []

        # Send remaining partial batch
        if batch and success:
            if not self._send_packets(batch):
                for p in reversed(batch):
                    self._queue.appendleft(p)
                self.connected = False
                success = False

        self.packets_queued = len(self._queue)
        return success

    def _attempt_reconnect(self):
        """Try to reconnect with exponential backoff."""
        self.retry_count += 1
        if self.retry_count > MAX_RETRY_ATTEMPTS:
            log.error(f"Max retries ({MAX_RETRY_ATTEMPTS}) exceeded. Packets queued: {len(self._queue)}")
            # Reset counter to keep trying indefinitely
            self.retry_count = 1

        log.info(f"Reconnect attempt {self.retry_count}/{MAX_RETRY_ATTEMPTS} in {self.backoff_sec:.1f}s…")
        time.sleep(self.backoff_sec)

        if self.check_health():
            if not self.session_id:
                session_id = self.start_session()
                if session_id:
                    self.session_id = session_id

            if self.session_id:
                self.connected   = True
                self.retry_count = 0
                self.backoff_sec = RETRY_BACKOFF_SEC
                log.info(f"✓ Reconnected. Draining {len(self._queue)} queued packets…")
                self._drain_queue()
        else:
            # Exponential backoff (cap at 60s)
            self.backoff_sec = min(60.0, self.backoff_sec * 2)

    # ── Status ────────────────────────────────────────────────────────────────

    def status_line(self) -> str:
        conn = "🟢 CONNECTED" if self.connected else "🔴 OFFLINE"
        queue = f" [queue:{len(self._queue)}]" if self._queue else ""
        return (
            f"{conn}{queue} | "
            f"sent:{self.packets_sent} | "
            f"failed:{self.packets_failed} | "
            f"session:{self.session_id or 'none'}"
        )
