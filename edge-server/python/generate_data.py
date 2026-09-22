import pandas as pd
import numpy as np

N = 500
unit_ids = np.repeat(np.arange(1, 11), 50)
cycles = np.tile(np.arange(50), 10)

oil_p = np.random.uniform(50, 500, N)
egt = np.random.uniform(400, 900, N)
fuel = np.random.uniform(2, 20, N)
vib = np.random.uniform(0.1, 8.0, N)
rip = np.random.uniform(10, 800, N)

deg = np.linspace(0.0, 1.0, N)
deg += np.where(oil_p < 200, 5.0, 0)
deg += np.where(egt > 800, 3.0, 0)
deg += np.where(fuel < 5.0, 2.0, 0)
deg += np.where(vib > 4.0, 4.0, 0)
deg += np.where(rip > 400, 1.0, 0)

df = pd.DataFrame({
    "unit_id": unit_ids,
    "cycle": cycles,
    "altitude_ft": np.random.uniform(0, 5000, N),
    "air_density_kgm3": np.random.uniform(1.0, 1.225, N),
    "rpm": np.random.uniform(2000, 7000, N),
    "throttle_pct": np.random.uniform(20, 100, N),
    "cht_C": np.random.uniform(100, 200, N),
    "egt_C": egt,
    "oil_press_kPa": oil_p,
    "oil_temp_C": np.random.uniform(70, 120, N),
    "fuel_flow_kgph": fuel,
    "bsfc_g_per_kWh": np.random.uniform(250, 350, N),
    "vibration_rms_g": vib,
    "ae_energy_20k_1M_band": np.random.uniform(100, 5000, N),
    "alternator_ripple_mV": rip,
    "degradation_index_groundtruth": deg + np.random.normal(0, 0.05, N)
})
df.to_csv("synthetic_male_uav_engine_RTF.csv", index=False)
print("Generated synthetic_male_uav_engine_RTF.csv")

