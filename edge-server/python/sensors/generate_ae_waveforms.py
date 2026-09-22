"""
Synthetic raw Acoustic Emission (AE) waveform generator.

Produces raw time-series waveforms (not pre-computed FFT features) for:
  - "healthy"       : background mechanical/acoustic noise only
  - "crack_initiation": occasional low-amplitude burst events (early fatigue)
  - "crack_growth"  : frequent, higher-amplitude burst events (propagating crack)

Physical basis: AE crack events are short (microsecond-scale), broadband
bursts riding on top of continuous background noise -- standard AE
literature models a burst as an exponentially-decaying sinusoid at the
sensor's resonant frequency (here 150 kHz, matching the real PK15I
datasheet: 100-450 kHz operating range, 150 kHz resonance).

Sample rate: 1 MHz (Nyquist-safe for a 450 kHz sensor band).

Output: one .npy waveform array + one CSV of burst-event ground truth
(arrival time, amplitude, ringdown) per class, per file.

NOTE: This is SYNTHETIC data for pipeline development / pretraining.
Real crack-vs-healthy waveform pairs must come from a bench test with
the actual sensor once available.
"""
import numpy as np
import pandas as pd
import os

FS = 1_000_000          # 1 MHz sample rate
RESONANT_HZ = 150_000    # PK15I resonant frequency
DURATION_S = 0.05        # 50 ms snippet per sample (50,000 points)
RNG = np.random.default_rng(7)


def background_noise(n_samples, rms=0.02, rng=RNG):
    """Continuous background noise floor (electrical + mechanical)."""
    return rng.normal(0, rms, n_samples)


def ae_burst(n_samples, fs, t_start, amplitude, resonant_hz=RESONANT_HZ,
             decay_us=20.0):
    """
    One AE burst event: exponentially-decaying sinusoid at the sensor's
    resonant frequency -- the standard textbook AE burst model.
    """
    t = np.arange(n_samples) / fs
    dt = np.clip(t - t_start, 0, None)  # avoid exp overflow for t < t_start
    envelope = amplitude * np.exp(-dt / (decay_us * 1e-6))
    envelope[t < t_start] = 0.0
    signal = envelope * np.sin(2 * np.pi * resonant_hz * dt)
    signal[t < t_start] = 0.0
    return signal


def generate_waveform(condition="healthy", duration_s=DURATION_S, fs=FS, rng=RNG):
    """
    condition: "healthy" | "crack_initiation" | "crack_growth"
    Returns (waveform, events_df)
    """
    n_samples = int(duration_s * fs)
    wave = background_noise(n_samples, rms=0.02, rng=rng)

    if condition == "healthy":
        rate_hz = 2       # rare spurious low-amplitude events (mechanical knock)
        amp_range = (0.02, 0.05)
    elif condition == "crack_initiation":
        rate_hz = 15       # occasional genuine AE hits
        amp_range = (0.08, 0.25)
    elif condition == "crack_growth":
        rate_hz = 60       # frequent, larger AE hits as crack propagates
        amp_range = (0.25, 0.9)
    else:
        raise ValueError(condition)

    n_events = rng.poisson(rate_hz * duration_s)
    events = []
    for _ in range(n_events):
        t_start = rng.uniform(0, duration_s - 0.0005)
        amp = rng.uniform(*amp_range)
        decay_us = rng.uniform(10, 40)
        wave += ae_burst(n_samples, fs, t_start, amp, decay_us=decay_us, resonant_hz=RESONANT_HZ)
        events.append({"t_start_s": t_start, "amplitude": amp, "decay_us": decay_us})

    if events:
        events_df = pd.DataFrame(events).sort_values("t_start_s").reset_index(drop=True)
    else:
        events_df = pd.DataFrame(columns=["t_start_s", "amplitude", "decay_us"])
    return wave.astype(np.float32), events_df


def fft_features(wave, fs=FS, band=(20_000, 1_000_000), n_bins=32):
    """Compute log-magnitude FFT features in a frequency band -- the
    pre-computed-feature alternative your PINN/RUL model can also use
    directly instead of the raw waveform."""
    spec = np.abs(np.fft.rfft(wave))
    freqs = np.fft.rfftfreq(len(wave), d=1 / fs)
    mask = (freqs >= band[0]) & (freqs <= band[1])
    spec_band = spec[mask]
    freqs_band = freqs[mask]
    bin_edges = np.linspace(band[0], band[1], n_bins + 1)
    feats = np.zeros(n_bins)
    for i in range(n_bins):
        sel = (freqs_band >= bin_edges[i]) & (freqs_band < bin_edges[i + 1])
        feats[i] = np.log1p(spec_band[sel].sum()) if sel.any() else 0.0
    return feats


def build_ae_dataset(n_per_class=40, out_dir="ae_synthetic"):
    os.makedirs(out_dir, exist_ok=True)
    rng = np.random.default_rng(123)
    rows = []
    for cls in ["healthy", "crack_initiation", "crack_growth"]:
        for i in range(n_per_class):
            wave, events = generate_waveform(condition=cls, rng=rng)
            fname = f"{cls}_{i:03d}.npy"
            np.save(os.path.join(out_dir, fname), wave)
            feats = fft_features(wave)
            row = {"file": fname, "label": cls, "n_events": len(events),
                   "max_amplitude": float(events.amplitude.max()) if len(events) else 0.0}
            row.update({f"fft_bin_{j}": feats[j] for j in range(len(feats))})
            rows.append(row)
    df = pd.DataFrame(rows)
    df.to_csv(os.path.join(out_dir, "ae_dataset_index.csv"), index=False)
    return df


if __name__ == "__main__":
    df = build_ae_dataset(n_per_class=40, out_dir="/mnt/user-data/outputs/ae_synthetic")
    print(df.groupby("label")[["n_events", "max_amplitude"]].mean())
    print(f"\nSaved {len(df)} waveform files + feature index to ae_synthetic/")
