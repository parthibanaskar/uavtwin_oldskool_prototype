# UAV MALE Digital Twin — SIH 2026
**Real-time predictive maintenance digital twin for a UAV aero piston engine.**

Architecture: React Dashboard ↔ Node.js GCS Gateway ↔ Python PINN/AI Edge Server ↔ C++/Pybind11 Sensor Sampler ↔ ROS 2 / PX4

---

## Project Structure
```
uavtwin/
├── src/                         # React frontend (Vite + TanStack)
│   └── lib/twin/
│       ├── physics.ts           # ISA, Woschni, Paris' Law, GPS Anti-spoof
│       ├── simulator.ts         # Real-time simulation tick (750ms cadence)
│       └── types.ts             # Telemetry types including physics payload
├── gcs-server/
│   └── server.js                # Express.js GCS API Gateway + WebSocket broker
├── edge-server/
│   ├── python/
│   │   ├── main.py              # Main edge AI server (PyTorch inference loop)
│   │   ├── train_physics_pinn.py# PINN training with Woschni + Paris Law residuals
│   │   ├── train_rul_pinn.py    # Baseline RUL PINN trainer
│   │   ├── train_yolo_landing.py# YOLOv8 fine-tuning on Semantic Drone Dataset
│   │   ├── data/
│   │   │   ├── generate_rtf_dataset.py        # Synthetic RTF dataset generator
│   │   │   └── synthetic_male_uav_engine_RTF.csv # Pre-generated training data
│   │   └── sensors/
│   │       ├── generate_ae_waveforms.py       # AE waveform generator (PK15I model)
│   │       └── ae_synthetic_samples/          # 120 synthetic AE sample files
│   └── cpp/
│       ├── sensor_sampler.cpp   # Pybind11 1MHz sensor buffering
│       └── CMakeLists.txt       # Build config for Pybind11 module
├── ros2_ws/
│   └── src/
│       └── ros2_engine_health_monitor/        # ROS 2 PX4 telemetry bridge node
├── SETUP.bat                    # ONE-CLICK: Install Python, PyTorch, train models
└── START.bat                    # ONE-CLICK: Launch all 3 services
```

---

## Quick Start (Windows)

### Step 1 — Setup (run ONCE as Administrator)
```
Double-click SETUP.bat and wait (~15 mins on first run)
```
This installs Python 3.11, Node.js, PyTorch, all Python packages, generates the synthetic dataset, and trains the Physics PINN model.

### Step 2 — Launch Everything
```
Double-click START.bat
```
This starts all 3 services and opens the dashboard at http://localhost:8080

---

## Services
| Service | Port | Tech |
|---|---|---|
| React Dashboard | 8080 | Vite + TanStack + Three.js |
| GCS API Gateway | 3001 | Node.js + Express + WebSocket |
| Edge AI Server | connects to 3001 | Python + PyTorch + OpenCV |

---

## AI Models
| Model | File | Purpose |
|---|---|---|
| Physics PINN | `physics_pinn.pt` | Degradation Index + Crack Size prediction |
| RUL Estimator | `rul_pinn.pt` | Remaining Useful Life prediction |
| YOLOv8 | `landing_zone_yolo/` | Safe landing zone detection |

---

## Hardware Deployment (Jetson Edge Server)
1. Clone this repo on a Jetson Orin running Ubuntu 22.04
2. Install ROS 2 Humble: https://docs.ros.org/en/humble/Installation/Ubuntu-Install-Debs.html
3. Build ROS 2 workspace: `cd ros2_ws && colcon build`
4. Compile C++ sensor sampler: `cd edge-server/cpp && cmake . && make`
5. Connect Pixhawk via USB-UART and start PX4 SITL bridge
6. Run `python edge-server/python/main.py`

---

## Key Physics Equations Implemented
- **ISA Atmosphere**: ρ(h) = ρ₀·(T/T₀)^(g/LR)
- **Breguet Aerodynamics**: CL, CD, L/D ratio, thrust required
- **Woschni Heat Transfer**: h = 3.26·D⁻⁰·²·p⁰·⁸·T⁻⁰·⁵⁵·w⁰·⁸
- **Otto Cycle Efficiency**: η_th = 1 - 1/CR^(γ-1)
- **Paris' Law Fatigue**: da/dN = C·(ΔK)^m, ΔK = Y·Δσ·√(πa)
- **RUL Estimation**: Analytical integration to critical crack size
- **GPS Anti-Spoofing**: Haversine distance cross-check vs INS

---

## Datasets
- **synthetic_male_uav_engine_RTF.csv**: Physics-grounded run-to-failure data for 20 synthetic engine units (~6000 rows), modeled on Rotax 914-class specs (bore 79.5mm, stroke 61mm, CR 9.0, 115hp @ 5800 RPM). Three fault modes: `bearing_wear`, `injector_drift`, `cooling_degradation`.
- **ae_synthetic_samples/**: 120 AE waveform samples (healthy / crack-initiation / crack-growth), calibrated to PK15I sensor resonant frequency (150 kHz).

---

## Tech Stack
- **C++, Pybind11**: 1 MHz sensor sampling, low-latency buffering
- **Express.js + Node.js**: GCS API Server & Authentication Gateway
- **PyTorch + MVEM**: PINN training with Woschni/Paris Law physics residuals
- **TensorRT (YOLO-v8) + OpenCV**: Landing zone detection
- **ROS 2 + PX4**: uXRCE-DDS bridge for flight controller diagnostics
- **React + Vite**: Real-time GCS Web Dashboard
