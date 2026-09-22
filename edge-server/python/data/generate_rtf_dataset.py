"""
Synthetic Run-to-Failure (RTF) dataset generator for a MALE UAV aero
piston engine digital twin.

IMPORTANT: This produces PHYSICS-GROUNDED SYNTHETIC data, not real
sensor logs. It follows the same philosophy as NASA's C-MAPSS
benchmark (itself a synthetic dataset, widely used to pretrain RUL
models before fine-tuning on real telemetry). Use this to:
  1. Get your PyTorch/PINN training pipeline working end-to-end now.
  2. Pretrain the network so it converges fast once you have real or
     bench-test data.
  3. Sanity-check your feature engineering and RUL labeling code.

Engine baseline: Rotax 914-class turbocharged 4-cyl piston engine
(bore 79.5mm, stroke 61mm, CR 9.0:1, rated 115hp @ 5800 RPM) -- real,
public specs -- with degradation trends synthesized from standard
engine-health-monitoring literature (rising EGT/CHT and falling oil
pressure as bearing/ring wear progresses; BSFC drift from injector/
valve degradation).

Author: generated for SIH26054 prototype work.
"""

import numpy as np
import pandas as pd

RNG = np.random.default_rng(42)

# ---- Real engine constants (Rotax 914-class) ----
BORE_M = 0.0795
STROKE_M = 0.061
CR = 9.0
RATED_RPM = 5800
RATED_POWER_KW = 84.5
N_CYL = 4

def generate_engine_unit(unit_id, n_cycles, fault_mode="bearing_wear", rng=RNG):
    """
    Generate one synthetic run-to-failure trajectory (one 'flight/engine
    unit') at 1 row per operating cycle (e.g. 1 row per minute of flight).

    fault_mode: "bearing_wear" | "injector_drift" | "cooling_degradation"
    """
    t = np.arange(n_cycles)
    frac = t / n_cycles  # 0 = healthy start, 1 = failure point

    # --- operating conditions (mission profile: climb, cruise, descend) ---
    altitude_ft = np.clip(28000 * np.sin(np.pi * frac) + rng.normal(0, 150, n_cycles), 0, None)
    rho_sl = 1.225
    rho = rho_sl * (1 - 2.2558e-5 * (altitude_ft * 0.3048)) ** 4.2559  # ISA density
    rpm = RATED_RPM * 0.75 + rng.normal(0, 60, n_cycles)
    throttle_pct = np.clip(60 + 15 * np.sin(np.pi * frac) + rng.normal(0, 3, n_cycles), 20, 100)

    # --- degradation index: 0 (healthy) -> 1 (failure threshold) ---
    # exponential degradation growth, standard RUL literature form
    theta1, theta2 = 0.02, 4.0
    degradation = theta1 * np.exp(theta2 * frac) + rng.normal(0, 0.003, n_cycles)
    degradation = np.clip(np.maximum.accumulate(degradation), 0, 1.2)

    # --- fault-mode-specific sensor trends ---
    cht_c = 95 + 25 * degradation + 0.002 * throttle_pct + rng.normal(0, 1.5, n_cycles)
    egt_c = 780 + 220 * degradation + 0.5 * throttle_pct + rng.normal(0, 8, n_cycles)
    oil_press_kpa = 420 - 180 * degradation - 0.05 * (rpm - RATED_RPM * 0.75) + rng.normal(0, 6, n_cycles)
    oil_temp_c = 90 + 20 * degradation + rng.normal(0, 2, n_cycles)

    fuel_flow_kgph = 22 + 6 * (throttle_pct / 100) + 3.5 * degradation + rng.normal(0, 0.4, n_cycles)
    bsfc = (fuel_flow_kgph * 1000) / (RATED_POWER_KW * (throttle_pct / 100) + 1e-6)  # g/kWh, rises with degradation

    vib_rms_g = 0.8 + 3.2 * degradation**1.5 + rng.normal(0, 0.08, n_cycles)

    # acoustic-emission proxy: AE energy in 20kHz-1MHz band grows with
    # crack propagation (bearing_wear / crankshaft fault modes only)
    if fault_mode == "bearing_wear":
        ae_energy = 0.05 + 1.8 * degradation**2.2 + rng.normal(0, 0.02, n_cycles)
        crack_length_mm = 0.0 + 4.5 * degradation**1.8  # ground truth, Paris-law-shaped growth
    else:
        ae_energy = 0.05 + 0.3 * degradation + rng.normal(0, 0.02, n_cycles)
        crack_length_mm = np.zeros(n_cycles)

    alternator_ripple_mv = 40 + 90 * degradation + rng.normal(0, 5, n_cycles)

    rul = (n_cycles - t)  # cycles remaining until failure threshold

    df = pd.DataFrame({
        "unit_id": unit_id,
        "cycle": t,
        "fault_mode": fault_mode,
        "altitude_ft": altitude_ft.round(1),
        "air_density_kgm3": rho.round(4),
        "rpm": rpm.round(0),
        "throttle_pct": throttle_pct.round(1),
        "cht_C": cht_c.round(2),
        "egt_C": egt_c.round(2),
        "oil_press_kPa": oil_press_kpa.round(2),
        "oil_temp_C": oil_temp_c.round(2),
        "fuel_flow_kgph": fuel_flow_kgph.round(3),
        "bsfc_g_per_kWh": bsfc.round(2),
        "vibration_rms_g": vib_rms_g.round(4),
        "ae_energy_20k_1M_band": ae_energy.round(4),
        "crack_length_mm_groundtruth": crack_length_mm.round(4),
        "alternator_ripple_mV": alternator_ripple_mv.round(2),
        "degradation_index_groundtruth": degradation.round(4),
        "RUL_cycles": rul,
    })
    return df

def build_dataset(n_units=20, min_cycles=180, max_cycles=420, seed=42):
    rng = np.random.default_rng(seed)
    fault_modes = ["bearing_wear", "injector_drift", "cooling_degradation"]
    frames = []
    for uid in range(1, n_units + 1):
        n_cycles = int(rng.integers(min_cycles, max_cycles))
        fm = fault_modes[uid % len(fault_modes)]
        frames.append(generate_engine_unit(uid, n_cycles, fault_mode=fm, rng=rng))
    return pd.concat(frames, ignore_index=True)

if __name__ == "__main__":
    df = build_dataset(n_units=20)
    df.to_csv("synthetic_male_uav_engine_RTF.csv", index=False)
    print(df.shape)
    print(df.head(10))
    print("\nUnits:", df.unit_id.nunique(), "| Total rows:", len(df))
