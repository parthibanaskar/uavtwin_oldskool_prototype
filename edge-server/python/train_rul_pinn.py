"""
Minimal PyTorch training script for a physics-informed RUL estimator,
built to run directly against synthetic_male_uav_engine_RTF.csv.
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
TARGET = "degradation_index_groundtruth"  # swap for RUL_cycles if predicting RUL directly


class EngineDataset(Dataset):
    def __init__(self, df, feature_cols, target_col, scaler=None):
        self.df = df.reset_index(drop=True)
        self.feature_cols = feature_cols
        self.target_col = target_col
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

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        return (
            torch.tensor(self.X[idx]),
            torch.tensor(self.y[idx]),
            torch.tensor(self.unit_id[idx]),
            torch.tensor(self.cycle[idx]),
        )


class RULPinn(nn.Module):
    def __init__(self, n_features, hidden=64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_features, hidden), nn.Tanh(),
            nn.Linear(hidden, hidden), nn.Tanh(),
            nn.Linear(hidden, hidden), nn.Tanh(),
            nn.Linear(hidden, 1), nn.Softplus(),  # degradation >= 0
        )

    def forward(self, x):
        return self.net(x).squeeze(-1)


def monotonicity_penalty(pred, unit_id, cycle):
    order = np.lexsort((cycle.numpy(), unit_id.numpy()))
    pred_o = pred[order]
    unit_o = unit_id[order]
    same_unit = unit_o[1:] == unit_o[:-1]
    diffs = pred_o[1:] - pred_o[:-1]
    violation = torch.clamp(-diffs, min=0) * same_unit.float()
    return (violation ** 2).mean()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default="synthetic_male_uav_engine_RTF.csv")
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--phys_weight", type=float, default=0.5)
    ap.add_argument("--out", default="rul_pinn.pt")
    args = ap.parse_args()

    df = pd.read_csv(args.csv)
    units = df.unit_id.unique()
    rng = np.random.default_rng(0)
    rng.shuffle(units)
    split = int(0.8 * len(units))
    train_units, val_units = units[:split], units[split:]

    train_df = df[df.unit_id.isin(train_units)]
    val_df = df[df.unit_id.isin(val_units)]

    train_ds = EngineDataset(train_df, FEATURES, TARGET)
    val_ds = EngineDataset(val_df, FEATURES, TARGET, scaler=(train_ds.mean, train_ds.std))

    train_loader = DataLoader(train_ds, batch_size=256, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=512, shuffle=False)

    model = RULPinn(n_features=len(FEATURES))
    opt = torch.optim.Adam(model.parameters(), lr=args.lr)
    mse = nn.MSELoss()

    for epoch in range(args.epochs):
        model.train()
        total_loss = 0.0
        for X, y, uid, cyc in train_loader:
            opt.zero_grad()
            pred = model(X)
            data_loss = mse(pred, y)
            phys_loss = monotonicity_penalty(pred, uid, cyc)
            loss = data_loss + args.phys_weight * phys_loss
            loss.backward()
            opt.step()
            total_loss += loss.item() * len(X)
        train_loss = total_loss / len(train_ds)

        model.eval()
        with torch.no_grad():
            val_losses = []
            for X, y, uid, cyc in val_loader:
                pred = model(X)
                val_losses.append(mse(pred, y).item())
        print(f"epoch {epoch+1:3d}/{args.epochs}  train_loss={train_loss:.5f}  val_mse={np.mean(val_losses):.5f}")

    torch.save({
        "model_state": model.state_dict(),
        "feature_mean": train_ds.mean,
        "feature_std": train_ds.std,
        "features": FEATURES,
        "target": TARGET,
    }, args.out)
    print(f"Saved trained weights to {args.out}")


if __name__ == "__main__":
    main()
