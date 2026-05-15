"""
DigestIQ — Sensor Physics Engine
==================================
Generates physiologically-realistic GI telemetry using:
- GI segment pH profiles (literature-based)
- Gaussian noise + slow drift
- Peristaltic wave motion model
- Battery drain model
- RF signal fading model
- Anomaly injection
"""

import math
import random
import time
from datetime import datetime, timezone
from typing import Optional
from config import (
    GI_JOURNEY_DURATION_SEC, GI_SEGMENTS, NOISE, DRIFT,
    PERISTALSIS, BATTERY, SIGNAL, INJECT_ANOMALIES, ANOMALY_SCHEDULE
)


class GIPhysicsEngine:
    """
    Simulates the physical environment of an ingestible capsule
    travelling through the gastrointestinal tract.
    
    State advances by calling .step(dt) where dt is elapsed real-time seconds.
    The simulator maps real elapsed time → simulated GI journey time using
    a speed multiplier so a 1-hour sim represents a configurable GI duration.
    """

    def __init__(self, device_id: str, session_id: str, journey_duration_sec: int = None):
        self.device_id   = device_id
        self.session_id  = session_id
        self.journey_duration_sec = journey_duration_sec or GI_JOURNEY_DURATION_SEC

        # Time tracking
        self.start_real_time  = time.time()
        self.packet_count     = 0
        self.sim_elapsed_sec  = 0.0   # simulated GI time (may run faster/slower than real)

        # Segment state
        self.current_segment_idx = 0
        self._precompute_segment_boundaries()

        # Sensor state (with history for smoothing)
        self.ph_smooth   = GI_SEGMENTS[0][1]   # start at esophagus pH
        self.temp_base   = 37.0
        self.battery_pct = BATTERY["initial_percent"]

        # Drift accumulators
        self.ph_drift    = 0.0
        self.temp_drift  = 0.0

        # Peristalsis phase
        self.peristalsis_phase   = random.uniform(0, 2 * math.pi)
        self.peristalsis_freq    = PERISTALSIS["base_frequency_hz"]
        self.in_stasis           = False
        self.stasis_remaining    = 0.0

        # Anomaly tracking
        self.injected_anomalies = set()

    def _precompute_segment_boundaries(self):
        """Build cumulative time boundaries for GI segments."""
        self.segment_boundaries = []
        cumulative = 0.0
        for seg in GI_SEGMENTS:
            _, _, _, dur_frac, _ = seg
            cumulative += dur_frac * self.journey_duration_sec
            self.segment_boundaries.append(cumulative)

    def _current_segment(self) -> tuple:
        """Return the GI segment for current simulated time."""
        t = self.sim_elapsed_sec
        for i, boundary in enumerate(self.segment_boundaries):
            if t <= boundary:
                return i, GI_SEGMENTS[i]
        # Past all segments = colon
        return len(GI_SEGMENTS) - 1, GI_SEGMENTS[-1]

    def _generate_ph(self, seg_idx: int, seg: tuple, anomaly: Optional[str]) -> float:
        name, ph_mean, ph_std, _, _ = seg

        # Smooth transition between segments (avoid sharp jumps)
        alpha = 0.15   # EMA smoothing factor
        target = random.gauss(ph_mean, ph_std)

        # Apply noise
        noisy = target + random.gauss(0, NOISE["ph"])

        # Smooth
        self.ph_smooth = self.ph_smooth * (1 - alpha) + noisy * alpha

        # Drift
        self.ph_smooth += self.ph_drift

        # Anomaly overrides
        if anomaly == "ph_spike":
            return 1.2 + random.gauss(0, 0.05)
        if anomaly == "rapid_shift":
            # Rapidly rises toward 5.5
            self.ph_smooth = min(self.ph_smooth + 0.4 + random.gauss(0, 0.1), 5.5)

        return round(max(1.0, min(9.0, self.ph_smooth)), 3)

    def _generate_temperature(self, seg: tuple, anomaly: Optional[str]) -> float:
        _, _, _, _, temp_offset = seg
        base = self.temp_base + temp_offset + self.temp_drift

        # Circadian variation: slight rise in afternoon (simulate over GI journey)
        circadian_offset = math.sin(self.sim_elapsed_sec / 43200 * math.pi) * 0.3

        temp = base + circadian_offset + random.gauss(0, NOISE["temperature"])

        # Anomaly override
        if anomaly == "temp_spike":
            temp = 39.8 + random.gauss(0, 0.1)

        return round(max(35.0, min(42.0, temp)), 3)

    def _generate_motion(self, dt: float, anomaly: Optional[str]) -> tuple:
        """
        Returns (motion_x, motion_y, motion_z) in g.
        Models peristaltic waves + random body movement.
        """
        # Stasis check
        if self.in_stasis:
            self.stasis_remaining -= dt
            if self.stasis_remaining <= 0:
                self.in_stasis = False
            # Very low motion during stasis
            mx = random.gauss(0, 0.01)
            my = random.gauss(0, 0.01)
            mz = random.gauss(0, 0.005)
            return mx, my, mz

        # Stasis transition
        if not self.in_stasis and random.random() < PERISTALSIS["stasis_probability"] * dt:
            self.in_stasis = True
            self.stasis_remaining = PERISTALSIS["stasis_duration_sec"]

        # Advance peristalsis phase
        freq = self.peristalsis_freq + random.gauss(0, PERISTALSIS["frequency_jitter"])
        self.peristalsis_phase += 2 * math.pi * freq * dt

        # Peristaltic wave amplitude
        amp = max(0, random.gauss(
            PERISTALSIS["amplitude_mean"],
            PERISTALSIS["amplitude_std"]
        ))

        # Decompose into x/y/z (primary axis = x for longitudinal transit)
        wave = math.sin(self.peristalsis_phase) * amp
        mx = wave * 0.7 + random.gauss(0, NOISE["motion"] * 0.3)
        my = wave * 0.3 * math.cos(self.peristalsis_phase * 1.3) + random.gauss(0, NOISE["motion"] * 0.2)
        mz = random.gauss(0, NOISE["motion"] * 0.15)

        # Anomaly: stasis injection
        if anomaly == "stasis":
            mx, my, mz = random.gauss(0, 0.01), random.gauss(0, 0.01), random.gauss(0, 0.005)

        return (
            round(max(-16, min(16, mx)), 4),
            round(max(-16, min(16, my)), 4),
            round(max(-16, min(16, mz)), 4),
        )

    def _check_anomaly(self) -> Optional[str]:
        """Return anomaly type if scheduled anomaly is due, else None."""
        if not INJECT_ANOMALIES:
            return None
        for elapsed, atype, desc in ANOMALY_SCHEDULE:
            if atype not in self.injected_anomalies and self.sim_elapsed_sec >= elapsed:
                self.injected_anomalies.add(atype)
                print(f"  ⚠ ANOMALY INJECTED: {atype} — {desc}")
                return atype
        return None

    def step(self, dt: float) -> dict:
        """
        Advance simulator by dt real-time seconds.
        Returns a single telemetry packet dict.
        
        dt: real seconds elapsed since last step
        sim_scale: how many simulated GI seconds pass per real second
        """
        real_elapsed = time.time() - self.start_real_time

        # Map real elapsed time → simulated GI journey time
        # (allows simulator to run at any speed relative to real GI duration)
        sim_scale = self.journey_duration_sec / max(1, self.journey_duration_sec)
        self.sim_elapsed_sec = real_elapsed * sim_scale

        # Get current GI segment
        seg_idx, seg = self._current_segment()
        if seg_idx != self.current_segment_idx:
            print(f"  → Entering segment: {seg[0]} (pH target: {seg[1]:.1f})")
            self.current_segment_idx = seg_idx

        # Check for scheduled anomaly
        anomaly = self._check_anomaly()

        # Update drift (very slow, over simulated hours)
        sim_hours = self.sim_elapsed_sec / 3600.0
        self.ph_drift   = random.gauss(0, DRIFT["ph_drift_per_hour"]) * sim_hours * 0.001
        self.temp_drift = random.gauss(0, DRIFT["temp_drift_per_hour"]) * sim_hours * 0.001

        # Generate sensor readings
        ph   = self._generate_ph(seg_idx, seg, anomaly)
        temp = self._generate_temperature(seg, anomaly)
        mx, my, mz = self._generate_motion(dt, anomaly)

        # Battery drain (based on real elapsed time)
        self.battery_pct = max(0, BATTERY["initial_percent"] - real_elapsed / 3600 * BATTERY["drain_per_hour"])

        # Signal strength
        signal = round(max(SIGNAL["min_dbm"], min(SIGNAL["max_dbm"],
            random.gauss(SIGNAL["mean_dbm"], SIGNAL["std_dbm"])
        )), 1)

        self.packet_count += 1

        return {
            "device_id":       self.device_id,
            "session_id":      self.session_id,
            "ts":              datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            "temperature":     temp,
            "ph":              ph,
            "motion_x":        mx,
            "motion_y":        my,
            "motion_z":        mz,
            "battery":         round(self.battery_pct, 2),
            "signal_strength": signal,
            # Metadata for local logging only (not part of API schema)
            "_segment":        seg[0],
            "_sim_elapsed_sec": round(self.sim_elapsed_sec, 1),
            "_packet_num":     self.packet_count,
            "_anomaly":        anomaly,
        }

    @property
    def journey_complete(self) -> bool:
        """Returns True when the simulated GI journey is finished."""
        return self.sim_elapsed_sec >= self.journey_duration_sec

    @property
    def journey_progress_pct(self) -> float:
        return min(100.0, self.sim_elapsed_sec / self.journey_duration_sec * 100)
