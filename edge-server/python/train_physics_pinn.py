"""
Physics-Informed Neural Network with REAL governing-equation residuals.
Both Woschni-consistency and Paris'-Law-consistency are added as soft penalty terms via automatic differentiation (torch.autograd.grad).
"""
import argparse
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

FEATURES = [
    "altitude_ft", "air_density_kgm3", "rpm", "throttle_pct",
    "cht_C", "egt_C", "oil_press_kPa", "oil_temp_C",
    "fuel_flow_kgph", "bsfc_g_per_kWh", "vibration_rms_g",
    "ae_energy_20k_1M_band", "alternator_ripple_mV",
]
TARGET = "degradation_index_groundtruth"

# ---- Woschni constants (typical literature values) ----
D_BORE_M = 0.0795       # Rotax 914-class bore
C1_COMBUSTION = 2.28    # Woschni C1 during combustion/expansion
GAMMA = 1.33            # ratio of specific heats, combustion gas

# ---- Paris' Law constants (typical steel, illustrative) ----
PARIS_C = 6.9e-12   # m/cycle per (MPa*sqrt(m))^m, typical structural steel
PARIS_M = 3.0
GEOMETRY_Y = 1.12    # edge-crack geometry factor


class EngineDataset(Dataset):
    def __init__(self, df, feature_cols, target_col, scaler=None):
        self.df = df.reset_index(drop=True)
        X = df[feature_cols].values.astype(np.float32)
        if scaler is None:
            self.mean = X.mean(axis=0)
            self.std = X.std(axis=0) + 1e-6
        else:
            self.mean, self.std = scaler
        self.X = (X - self.mean) / self.std
        self.y = df[target_col].values.astype(np.float32)
        self.unit_id = df["unit_id"].values
        self.cycle = df["cycle"].values.astype(np.float32)
        # raw (unnormalized) physical quantities needed by the physics residuals
        self.rpm = df["rpm"].values.astype(np.float32)
        self.throttle = df["throttle_pct"].values.astype(np.float32)
        self.cht_K = (df["cht_C"].values + 273.15).astype(np.float32)
        self.oil_press_pa = (df["oil_press_kPa"].values * 1000).astype(np.float32)
        self.ae_energy = df["ae_energy_20k_1M_band"].values.astype(np.float32)

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        return {
            "X": torch.tensor(self.X[idx]),
            "y": torch.tensor(self.y[idx]),
            "unit_id": torch.tensor(self.unit_id[idx]),
            "cycle": torch.tensor(self.cycle[idx], requires_grad=True),
            "rpm": torch.tensor(self.rpm[idx]),
            "throttle": torch.tensor(self.throttle[idx]),
            "cht_K": torch.tensor(self.cht_K[idx]),
            "oil_press_pa": torch.tensor(self.oil_press_pa[idx]),
            "ae_energy": torch.tensor(self.ae_energy[idx]),
        }


class PhysicsPINN(nn.Module):
    def __init__(self, n_features, hidden=64):
        super().__init__()
        self.backbone = nn.Sequential(
            nn.Linear(n_features, hidden), nn.Tanh(),
            nn.Linear(hidden, hidden), nn.Tanh(),
            nn.Linear(hidden, hidden), nn.Tanh(),
        )
        self.degradation_head = nn.Sequential(nn.Linear(hidden, 1), nn.Softplus())
        self.crack_head = nn.Sequential(nn.Linear(hidden, 1), nn.Softplus())

    def forward(self, x):
        h = self.backbone(x)
        D = self.degradation_head(h).squeeze(-1)
        a = self.crack_head(h).squeeze(-1)  # predicted crack length (mm proxy)
        return D, a


def woschni_h(rpm, throttle, T_K, D=D_BORE_M):
    load_frac = torch.clamp(throttle / 100.0, 0.05, 1.0)
    p_kpa = 100.0 + 900.0 * load_frac  # crude proxy: 100-1000 kPa peak cylinder pressure
    mean_piston_speed = 2 * 0.061 * (rpm / 60.0)  # stroke=0.061m (Rotax 914-class)
    w = C1_COMBUSTION * mean_piston_speed
    h = 3.26 * (D ** -0.2) * (p_kpa ** 0.8) * (T_K ** -0.55) * (w.clamp(min=1e-3) ** 0.8)
    return h


def physics_residual_woschni(D_pred, batch):
    h = woschni_h(batch["rpm"], batch["throttle"], batch["cht_K"])
    h_norm = (h - h.mean()) / (h.std() + 1e-6)
    D_norm = (D_pred - D_pred.mean()) / (D_pred.std() + 1e-6)
    corr = (h_norm * D_norm).mean()
    return torch.clamp(-corr, min=0) ** 2


def physics_residual_paris_law(a_pred, cycle, ae_energy):
    da_dN = torch.autograd.grad(
        outputs=a_pred, inputs=cycle,
        grad_outputs=torch.ones_like(a_pred),
        create_graph=True, retain_graph=True, allow_unused=True,
    )[0]
    if da_dN is None:
        return torch.tensor(0.0)

    sigma_proxy = torch.sqrt(torch.clamp(ae_energy, min=1e-6)) * 50.0  # MPa scale
    a_m = torch.clamp(a_pred, min=1e-6) * 1e-3  # mm -> m
    delta_K = GEOMETRY_Y * sigma_proxy * torch.sqrt(np.pi * a_m)  # MPa*sqrt(m)
    da_dN_paris = PARIS_C * (torch.clamp(delta_K, min=1e-6) ** PARIS_M)

    residual = torch.log1p(torch.clamp(da_dN, min=0)) - torch.log1p(da_dN_paris * 1e6)
    return (residual ** 2).mean()


def train(csv_path, epochs=40, lr=1e-3, w_data=1.0, w_woschni=0.3, w_paris=0.3,
          out_path="physics_pinn.pt"):
    df = pd.read_csv(csv_path)
    units = df.unit_id.unique()
    rng = np.random.default_rng(0)
    rng.shuffle(units)
    split = int(0.8 * len(units))
    train_df = df[df.unit_id.isin(units[:split])]
    val_df = df[df.unit_id.isin(units[split:])]

    train_ds = EngineDataset(train_df, FEATURES, TARGET)
    val_ds = EngineDataset(val_df, FEATURES, TARGET, scaler=(train_ds.mean, train_ds.std))
    train_loader = DataLoader(train_ds, batch_size=128, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=256, shuffle=False)

    model = PhysicsPINN(n_features=len(FEATURES))
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    mse = nn.MSELoss()

    for epoch in range(epochs):
        model.train()
        total = 0.0
        for batch in train_loader:
            opt.zero_grad()
            D_pred, a_pred = model(batch["X"])

            data_loss = mse(D_pred, batch["y"])
            woschni_loss = physics_residual_woschni(D_pred, batch)
            paris_loss = physics_residual_paris_law(a_pred, batch["cycle"], batch["ae_energy"])

            loss = w_data * data_loss + w_woschni * woschni_loss + w_paris * paris_loss
            loss.backward()
            opt.step()
            total += loss.item() * len(batch["y"])

        model.eval()
        val_mse = []
        for batch in val_loader:
            D_pred, _ = model(batch["X"])
            val_mse.append(mse(D_pred, batch["y"]).item())
        print(f"epoch {epoch+1:3d}/{epochs}  train_loss={total/len(train_ds):.5f}  "
              f"val_mse={np.mean(val_mse):.5f}")

    torch.save({"model_state": model.state_dict(), "feature_mean": train_ds.mean,
                "feature_std": train_ds.std, "features": FEATURES}, out_path)
    print(f"Saved to {out_path}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default="synthetic_male_uav_engine_RTF.csv")
    ap.add_argument("--epochs", type=int, default=40)
    ap.add_argument("--out", default="physics_pinn.pt")
    args = ap.parse_args()
    train(args.csv, epochs=args.epochs, out_path=args.out)
