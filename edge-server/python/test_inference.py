import torch
import numpy as np
from train_physics_pinn import PhysicsPINN
checkpoint = torch.load("physics_pinn.pt", map_location="cpu", weights_only=False)
model = PhysicsPINN(n_features=13)
model.load_state_dict(checkpoint["model_state"])
model.eval()
mean = checkpoint["feature_mean"]
std = checkpoint["feature_std"]

features = ["altitude_ft", "air_density_kgm3", "rpm", "throttle_pct", "cht_C", "egt_C", "oil_press_kPa", "oil_temp_C", "fuel_flow_kgph", "bsfc_g_per_kWh", "vibration_rms_g", "ae_energy_20k_1M_band", "alternator_ripple_mV"]

def infer(oil, egt, vib):
    x = mean.copy()
    x[features.index("oil_press_kPa")] = oil
    x[features.index("egt_C")] = egt
    x[features.index("vibration_rms_g")] = vib
    x_norm = (np.array(x, dtype=np.float32) - mean) / std
    D, a = model(torch.tensor(x_norm).unsqueeze(0))
    return D.item()

print("Nominal D:", infer(400, 500, 1.0))
print("Oil Starve D:", infer(100, 500, 1.0))
print("Overtemp D:", infer(400, 850, 1.0))
print("High Vib D:", infer(400, 500, 6.0))

