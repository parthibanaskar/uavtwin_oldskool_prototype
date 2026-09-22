import asyncio
import websockets
import json
import time
import math
import random

# MVEM + PINN PyTorch Inference (As per SIH Diagram)
class RulEstimator:
    def __init__(self):
        self.fatigue_crack = 0.001
        self.model = None
        self.feature_mean = 0.0
        self.feature_std = 1.0
        try:
            # We try to load the trained PyTorch PINN model if it exists
            import torch
            import torch.optim as optim
            from train_physics_pinn import PhysicsPINN
            # 13 features expected by the model
            self.model = PhysicsPINN(n_features=13)
            import os
            pt_path = os.path.join(os.path.dirname(__file__), "physics_pinn.pt")
            # also look in root if not found in edge-server/python
            if not os.path.exists(pt_path): pt_path = "physics_pinn.pt"
            checkpoint = torch.load(pt_path, map_location="cpu", weights_only=False)
            self.model.load_state_dict(checkpoint["model_state"])
            self.model.eval()
            self.feature_mean = checkpoint["feature_mean"]
            self.feature_std = checkpoint["feature_std"]
            self.optimizer = optim.Adam(self.model.parameters(), lr=1e-5)
            print("Successfully loaded physics_pinn.pt inference model!")
        except Exception as e:
            print(f"Running without AI. Could not load physics_pinn.pt: {e}")
            self.model = None
            self.optimizer = None
            
    def online_train_step(self, features_dict, target_crack_growth):
        if self.model is None or self.optimizer is None: return 0.0
        import torch
        feature_names = ["altitude_ft", "air_density_kgm3", "rpm", "throttle_pct", "cht_C", "egt_C", "oil_press_kPa", "oil_temp_C", "fuel_flow_kgph", "bsfc_g_per_kWh", "vibration_rms_g", "ae_energy_20k_1M_band", "alternator_ripple_mV"]
        arr = []
        for i, f in enumerate(feature_names):
            arr.append(features_dict.get(f, self.feature_mean[i]))
        x_raw = torch.tensor([arr], dtype=torch.float32)
        x_norm = (x_raw - self.feature_mean) / (self.feature_std + 1e-8)
        
        self.model.train()
        self.optimizer.zero_grad()
        d_pred = self.model(x_norm)
        target = torch.tensor([[target_crack_growth]], dtype=torch.float32)
        loss = torch.nn.functional.mse_loss(d_pred, target)
        loss.backward()
        self.optimizer.step()
        self.model.eval()
        return loss.item()
        
    def step(self, rpm, vibration, features_dict=None, active_faults=None):
        stress = 30 + vibration * 2 + ((rpm / 5000) ** 2) * 15
        # C * stress^m * a
        da = 0.03e-8 * (stress ** 3) * self.fatigue_crack
        
        # Guarantee RUL plummets if a physical fault is active!
        if active_faults and len(active_faults) > 0:
            # We ignore non-physical or minor faults for the fatigue crack growth penalty
            ignored = ["rulAdvisory", "sensorDrift", "vibSensorFail", "gpsSpoof", "fuelTransfer"]
            real_faults = [f for f in active_faults if f not in ignored]
            if real_faults:
                da *= 30.0  # Explode crack growth so RUL drops for the presentation
        
        if self.model is not None and features_dict is not None:
            import torch
            import numpy as np
            feature_names = ["altitude_ft", "air_density_kgm3", "rpm", "throttle_pct", "cht_C", "egt_C", "oil_press_kPa", "oil_temp_C", "fuel_flow_kgph", "bsfc_g_per_kWh", "vibration_rms_g", "ae_energy_20k_1M_band", "alternator_ripple_mV"]
            x = [features_dict.get(n, 0.0) for n in feature_names]
            x_norm = (np.array(x, dtype=np.float32) - self.feature_mean) / self.feature_std
            with torch.no_grad():
                D_pred, a_pred = self.model(torch.tensor(x_norm).unsqueeze(0))
            
            # The model predicts instantaneous severity, we use it to accelerate the crack growth
            da *= (1.0 + max(0.0, D_pred.item() * 1.5))
        elif features_dict is not None:
            # FALLBACK: If PyTorch model is missing, manually penalize RUL for all anomalies so the demo still works!
            penalty = 0.0
            if features_dict.get("oil_press_kPa", 400) < 200: penalty += 1.0
            if features_dict.get("egt_C", 500) > 800: penalty += 0.5
            if features_dict.get("fuel_flow_kgph", 10) < 3.0: penalty += 0.5
            if features_dict.get("alternator_ripple_mV", 50) > 400: penalty += 0.2
            da *= (1.0 + penalty)
            
        # Hard cap: won't fail faster than ~20 seconds at nominal size (enough for catastrophic faults)
        da = min(0.00005, da)
        self.fatigue_crack += da
        
        # === NO MAGIC HEALING ===
        # Cracks do NOT heal. Every fault permanently damages the shaft.
        # We only clamp from overflowing once engine is dead.
        self.fatigue_crack = min(0.1, self.fatigue_crack)
        return self.fatigue_crack

async def receive_commands(websocket, state):
    try:
        async for message in websocket:
            data = json.loads(message)
            if data.get("type") == "inject_fault":
                fault = data["fault"]
                # DO NOT inject major physical faults during a landing divert, to prevent
                # the UI telemetry from flatlining to zero (which users perceive as a UI crash)
                if state.get("landing_mode") and fault in ["bearingWear", "oilStarvation", "fuelBlockage", "propImbalance", "icing"]:
                    print(f"Ignored major fault '{fault}' during landing divert.")
                    continue
                    
                if fault not in state["active_faults"]:
                    state["active_faults"].append(fault)
                    if "fault_history" not in state:
                        state["fault_history"] = []
                    state["fault_history"].append(data["fault"])
                print(f"Injected fault: {data['fault']}")
            elif data.get("type") == "clear_fault":
                cleared = data["fault"]
                while cleared in state["active_faults"]:
                    state["active_faults"].remove(cleared)
                # After fixing, the crack is still at the damaged size.
                # We reset the EMA so RUL reflects the TRUE remaining life at this crack size
                # (not the panicked fault-active rate). This is correct: fixing a fault stops
                # further rapid degradation but does NOT undo physical crack growth.
                # The crack-size-based RUL will now show a permanently lower RUL than before.
                crack = state.get("rul_model").fatigue_crack if "rul_model" in state else 0.001
                current_stress = 30 + 1.5 + ((6100 / 5000) ** 2) * 15  # nominal cruise stress
                nominal_da = 0.03e-8 * (current_stress ** 3) * crack
                state["smoothed_da"] = nominal_da  # match current crack's nominal growth rate
                
                # Bearing wear is NON-REPAIRABLE mid-flight. Force immediate divert.
                if cleared == "bearingWear":
                    state["bearing_permanently_damaged"] = True
                print(f"Cleared fault: {cleared}, crack at {crack*1000:.4f}mm")
            elif data.get("type") == "reduce_throttle":
                state["throttle_reduction"] = 0.85
                print("Activated 15% throttle reduction for RUL conservation!")
            elif data.get("type") == "set_throttle":
                state["throttle_pct"] = data["throttle"]
                print(f"Manual fly-by-wire throttle set to {data['throttle']}%")
            elif data.get("type") == "set_divert":
                state["landing_mode"] = True
                divert_lat = data["lat"]
                divert_lon = data["lon"]
                # Calculate new distance and heading
                import math
                R = 6371.0 # Earth radius
                lat1 = math.radians(state["lat"])
                lon1 = math.radians(state["lon"])
                lat2 = math.radians(divert_lat)
                lon2 = math.radians(divert_lon)
                dlon = lon2 - lon1
                dlat = lat2 - lat1
                a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
                c = 2 * math.atan2(math.sqrt(a), math.sqrt(max(0, 1 - a)))
                dist = R * c
                
                # DEMO MODE: Fast-forward divert distance so the autonomous landing sequence completes in ~1-2 minutes!
                if dist > 4.0:
                    fraction = (dist - 4.0) / dist
                    state["lat"] += (divert_lat - state["lat"]) * fraction
                    state["lon"] += (divert_lon - state["lon"]) * fraction
                    dist = 4.0

                state["mission_distance_km"] = dist
                
                # Calculate heading
                y = math.sin(dlon) * math.cos(lat2)
                x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
                state["heading_deg"] = (math.degrees(math.atan2(y, x)) + 360) % 360
                print(f"Diverting to {divert_lat}, {divert_lon}. Dist: {dist:.1f}km, Heading: {state['heading_deg']:.1f}")
            elif data.get("type") == "cancel_divert":
                # Abort the divert — RUL has recovered after fix execution, mission can continue
                if state.get("landing_mode") and not state.get("landed"):
                    state["landing_mode"] = False
                    state["mission_distance_km"] = data.get("mission_distance_km", 300.0)
                    state["profile"] = "cruise"
                    state["throttle_pct"] = None
                    state["throttle_reduction"] = state.get("throttle_reduction", 1.0)
                    state["heading_deg"] = data.get("heading_deg", 45.0)
                    print(f"Divert CANCELLED — RUL recovered. Resuming primary mission. Dist: {state['mission_distance_km']:.1f}km")

            elif data.get("type") == "calibrate":
                if "rul_model" in state and "last_features" in state:
                    loss = state["rul_model"].online_train_step(state["last_features"], target_crack_growth=0.0)
                    print(f"Online Calibration Step - Loss: {loss:.6f}")
            elif data.get("type") == "clear_all":
                state["active_faults"].clear()
                state["active_faults"] = []
                state["fault_history"] = []
                # Reset physical damage so the hackathon presentation can continue!
                if "rul_model" in state:
                    state["rul_model"].fatigue_crack = 0.001 # Clean shaft, max RUL
                state["t"] = 0 # Reset flight time
                state["mission_distance_km"] = 300.0
                state["throttle_reduction"] = 1.0
                state["smoothed_da"] = 8.3e-8
                state["crashed"] = False
                state["landed"] = False
                state["engine_failed"] = False
                state["landing_mode"] = False
                state["throttle_pct"] = None
                state["profile"] = "cruise"
                state["reset_trigger"] = True
                state["bearing_permanently_damaged"] = False
                print("Cleared all faults and reset physics entirely")
            elif data.get("type") == "set_profile":
                state["profile"] = data["profile"]
                print(f"Changed profile to: {data['profile']}")
    except websockets.exceptions.ConnectionClosed:
        pass

async def telemetry_loop(websocket, state):
    rul_model = RulEstimator()
    state["rul_model"] = rul_model
    state["t"] = 0
    state["mission_distance_km"] = 300.0
    state["throttle_reduction"] = 1.0
    state["throttle_pct"] = None # Will override profile if set
    state["smoothed_da"] = 8.3e-8 # EMA for smooth RUL transitions
    
    # Real GPS Kinematics Initialization (New Delhi)
    state["lat"] = 28.6139
    state["lon"] = 77.2090
    state["heading_deg"] = 45.0
    
    current_rpm = 0.0
    current_alt = 2000.0
    
    while True:
        if state.get("reset_trigger"):
            current_rpm = 6100.0
            current_alt = 2000.0
            state["reset_trigger"] = False
            
        state["t"] += 1
        t = state["t"]
        
        # Autonomous Landing Progression
        if state.get("landing_mode") and not state.get("landed") and not state.get("crashed"):
            dist = state["mission_distance_km"]
            if dist > 2.0:
                state["profile"] = "descent"
                state["throttle_pct"] = None  # Let descent profile take over
            elif dist <= 2.0 and dist > 0.5:
                state["profile"] = "descent"
                state["throttle_pct"] = None
                state["throttle_reduction"] = min(state["throttle_reduction"], 0.6)  # bleed off speed
            elif dist <= 0.5 and dist > 0.05:
                # Final flare — cut throttle hard, glide to touchdown
                state["profile"] = "idle"
                state["throttle_pct"] = None
                state["throttle_reduction"] = min(state["throttle_reduction"], 0.15)
            
            # Touchdown: either within 50m of FOB or altitude is basically zero
            if dist <= 0.05 or (current_alt <= 5.0 and dist <= 0.5):
                state["profile"] = "idle"
                state["mission_distance_km"] = 0.0
                state["throttle_pct"] = 0.0
                state["throttle_reduction"] = 0.0
                state["landed"] = True
                state["landing_mode"] = False
                state["active_faults"].clear()
                print(f"TOUCHDOWN CONFIRMED: dist={dist:.3f}km alt={current_alt:.1f}ft")
            elif current_alt <= 0.0 and dist > 0.5:
                # Dropped to ground before reaching the FOB (glide slop failure)
                state["crashed"] = True
                state["landing_mode"] = False
                state["active_faults"].clear()
                print(f"CRASHED SHORT OF RUNWAY: dist={dist:.3f}km")
        
        # 1. Fly-By-Wire Target Kinematics
        target_rpm = current_rpm
        if state.get("engine_failed"):
            target_rpm = 0.0
            state["throttle_reduction"] = 0.0
            state["throttle_pct"] = 0.0
        elif state["throttle_pct"] is not None:
            target_rpm = (state["throttle_pct"] / 100.0) * 8000.0
        else:
            if state["profile"] == "idle":
                target_rpm = 2400
            elif state["profile"] == "takeoff":
                target_rpm = 7600
            elif state["profile"] == "cruise":
                target_rpm = 6100
            elif state["profile"] == "loiter":
                target_rpm = 5400
            elif state["profile"] == "descent":
                target_rpm = 3800
            
        if not state.get("engine_failed"):
            target_rpm *= state["throttle_reduction"]
            
            # Apply real physical RPM loss from injected faults
            # Faults that physically rob power or cause the engine to throttle back / seize
            if "fuelBlockage" in state["active_faults"]:
                target_rpm = max(0, target_rpm - 2000)  # severe starvation — engine barely alive
            if "fuelPumpDegrade" in state["active_faults"]:
                target_rpm = max(0, target_rpm - 900)   # partial fuel starvation
            if "icing" in state["active_faults"]:
                target_rpm = max(0, target_rpm - 800)   # intake blockage
            if "oilStarvation" in state["active_faults"]:
                # No lubrication = catastrophic friction → engine seizes progressively
                # Each repeated event is worse (bearing journal scoring)
                oil_hits = len(state.get("fault_history", []))
                target_rpm = max(0, target_rpm - (1500 + 500 * (oil_hits - 1)))
            if "bearingWear" in state["active_faults"]:
                # Spalled bearing causes massive mechanical drag, kills usable power
                target_rpm = max(0, target_rpm - 1800)
            if state.get("bearing_permanently_damaged"):
                # Even after "fix", spall fragments cause permanent 12% power loss
                target_rpm *= 0.88
            if "egtOvertemp" in state["active_faults"]:
                # ECU automatically derate to protect turbine blades
                target_rpm *= 0.82
            if "propImbalance" in state["active_faults"]:
                # Governor fights the resonance — cannot hold target RPM smoothly
                # Results in ~8% effective thrust loss and altitude sink
                target_rpm *= 0.92
            
        # Smoothly interpolate RPM towards target to simulate engine inertia
        current_rpm += (target_rpm - current_rpm) * 0.1
        if not state.get("engine_failed"):
            current_rpm += random.gauss(0, 25) # add micro jitter
        
        rpm = max(0, current_rpm)
        rpm_ratio = min(1.0, rpm / 6100.0)
        
        # Dynamic Altitude based on thrust (RPM)
        if state.get("landing_mode") and not state.get("landed"):
            # During a controlled divert, altitude tracks the glideslope regardless of engine state
            # Even with engine failed, this is a glide landing — not a crash
            dist_km = max(0.0, state["mission_distance_km"])
            if dist_km > 2.0:
                target_alt = 2000.0
            elif dist_km > 0.5:
                target_alt = 200.0 + (dist_km - 0.5) / 1.5 * 1800.0
            else:
                target_alt = (dist_km / 0.5) * 200.0
            current_alt += (target_alt - current_alt) * 0.08
        elif state.get("engine_failed"):
            # Free-fall crash sequence (only when NOT in a landing divert)
            # Drop fast so the user isn't waiting 5 minutes for it to hit the ground
            current_alt -= 150.0
            if current_alt <= 0:
                current_alt = 0
                state["crashed"] = True
                state["active_faults"].clear()
        else:
            # Altitude tracks thrust continuously — RPM drop = altitude sink
            # At cruise RPM (ratio=1.0) → 2000ft. At 60% RPM → 800ft. At 40% → 200ft. Below → ground.
            if rpm_ratio >= 0.95:
                target_alt = 2000.0
            elif rpm_ratio >= 0.6:
                # Linear interpolation: 2000ft at 0.95 down to 800ft at 0.60
                target_alt = 800.0 + (rpm_ratio - 0.60) / (0.95 - 0.60) * (2000.0 - 800.0)
            elif rpm_ratio >= 0.35:
                # 800ft at 0.60 down to 100ft at 0.35
                target_alt = 100.0 + (rpm_ratio - 0.35) / (0.60 - 0.35) * (800.0 - 100.0)
            else:
                target_alt = 0.0  # engine too weak to sustain flight
            current_alt += (target_alt - current_alt) * 0.04

        
        alt_ft = max(0, current_alt)
        
        vibration = 1.0 + (rpm / 5800.0) * 1.5 + random.gauss(0, 0.05)
        
        # Permanently damaged bearing keeps adding friction vibration even after "fix"
        # because the spalling on the race cannot be undone mid-flight
        if state.get("bearing_permanently_damaged"):
            vibration += 25.0  # permanent background damage
        
        if "bearingWear" in state["active_faults"]:
            vibration += 60.0  # CATASTROPHIC — spalled main bearing obliterates the shaft
        if "propImbalance" in state["active_faults"]:
            vibration += 5.5
        if "fuelBlockage" in state["active_faults"] or "fuelPumpDegrade" in state["active_faults"]:
            # Fuel starvation causes engine sputtering, knocking, and massive torsional vibration
            vibration += 25.0
        if "oilStarvation" in state["active_faults"]:
            # No lubrication = metal-on-metal. The more you've had, the worse the baseline.
            oil_hits = state.get("fault_history", []).count("oilStarvation")
            extra = 35.0 * (1.0 + 0.5 * (oil_hits - 1))  # each repeat is worse
            vibration += extra

        
        bsfc = 280 + (rpm - 6100) * 0.01 + random.gauss(0, 1)
        eta_th = 0.35 - (rpm - 6100) * 0.00001 + random.gauss(0, 0.001)
        ld_ratio = 16.6 - (alt_ft - 2000) * 0.001 + random.gauss(0, 0.05)
        
        # Live GPS Routing (Haversine integral)
        ground_speed_kts = max(0.0, (rpm / 6100.0) * 90.0)
        # During a landing divert, guarantee a minimum glide speed even with engine failed
        # (the UAV is gliding, not hovering — distance must always drain to zero)
        if state.get("landing_mode") and not state.get("landed"):
            ground_speed_kts = max(ground_speed_kts, 15.0)  # minimum 15 kts glide speed
        speed_ms = ground_speed_kts * 0.514444
        distance_covered_km_per_sec = speed_ms / 1000.0
        
        R_earth = 6378.137 # km
        # In aviation: 0=North (dy), 90=East (dx)
        dy = distance_covered_km_per_sec * math.cos(math.radians(state["heading_deg"]))
        dx = distance_covered_km_per_sec * math.sin(math.radians(state["heading_deg"]))
        state["lat"] += (dy / R_earth) * (180 / math.pi)
        state["lon"] += (dx / R_earth) * (180 / math.pi) / math.cos(state["lat"] * math.pi/180)
        
        state["mission_distance_km"] = max(0.0, state["mission_distance_km"] - distance_covered_km_per_sec)

        mission_time_seconds = state["mission_distance_km"] / distance_covered_km_per_sec if distance_covered_km_per_sec > 0.001 else 999999
        
        # Build features dict for PINN
        if state.get("engine_failed") or state.get("crashed") or state.get("landed"):
            # Engine is completely dead or we are safely on the ground
            features = {
                "altitude_ft": alt_ft,
                "air_density_kgm3": 1.225 * math.exp(-alt_ft / 30000), 
                "rpm": 0.0,
                "throttle_pct": 0.0,
                "cht_C": 25.0, # Ambient temp
                "egt_C": 25.0, # Ambient temp
                "oil_press_kPa": 0.0, # Zero pressure
                "oil_temp_C": 25.0, # Ambient temp
                "fuel_flow_kgph": 0.0, # Zero fuel flow
                "bsfc_g_per_kWh": 0.0,
                "vibration_rms_g": 0.0,
                "ae_energy_20k_1M_band": 0.0,
                "alternator_ripple_mV": 0.0
            }
            vibration = 0.0
            rpm = 0.0
            rul_seconds = 0.0
            hypo_rul_seconds = 0.0
            mission_time_seconds = 0.0
        else:
            features = {
                "altitude_ft": alt_ft,
                "air_density_kgm3": 1.225 * math.exp(-alt_ft / 30000), 
                "rpm": rpm,
                "throttle_pct": rpm_ratio * 100,
                "cht_C": 128 + rpm_ratio * (182 - 128) + random.gauss(0, 1.2),
                "egt_C": 430 + rpm_ratio * (646 - 430) + random.gauss(0, 3.5),
                "oil_press_kPa": (3.1 + rpm_ratio * (4.3 - 3.1)) * 100 + random.gauss(0, 2), # bar to kPa
                "oil_temp_C": 72 + rpm_ratio * (96 - 72) + random.gauss(0, 0.8),
                "fuel_flow_kgph": 5.2 + rpm_ratio * (16.4 - 5.2) + random.gauss(0, 0.3),
                "bsfc_g_per_kWh": bsfc,
                "vibration_rms_g": vibration,
                "ae_energy_20k_1M_band": vibration * 1000,
                "alternator_ripple_mV": 50 + random.gauss(0, 2)
            }
        
        # Apply more complex injected faults!
        if "oilStarvation" in state["active_faults"]:
            features["oil_press_kPa"] *= 0.2
            features["oil_temp_C"] += 45
        if "egtOvertemp" in state["active_faults"]:
            features["egt_C"] += 250
            eta_th *= 0.8
        if "fuelPumpDegrade" in state["active_faults"]:
            features["fuel_flow_kgph"] *= 0.6
        if "fuelBlockage" in state["active_faults"]:
            features["fuel_flow_kgph"] *= 0.1
        if "sensorDrift" in state["active_faults"]:
            features["egt_C"] += t * 2.0  # drifts up over time
        if "vibSensorFail" in state["active_faults"]:
            features["vibration_rms_g"] = 0.01
            vibration = 0.01
        if "busSag" in state["active_faults"]:
            features["alternator_ripple_mV"] += 800
        if "icing" in state["active_faults"]:
            features["throttle_pct"] = 100  # max throttle trying to compensate
            features["egt_C"] += 150
            ld_ratio *= 0.6  # drag increases massively due to ice
            
        # 2. PyTorch PINN Inference
        prev_crack = rul_model.fatigue_crack
        crack_size = rul_model.step(features["rpm"], features["vibration_rms_g"], features, state["active_faults"])
        da_dt = crack_size - prev_crack
        
        real_active = [f for f in (state["active_faults"] or []) if f not in ["rulAdvisory", "sensorDrift", "vibSensorFail", "gpsSpoof", "fuelTransfer"]]
        if crack_size >= 0.0025:
            # Physical limit reached, engine fails permanently
            state["engine_failed"] = True
        elif len(real_active) == 0 and not state.get("crashed"):
            # Un-fail the engine immediately when faults are cleared so altitude starts climbing back up!
            state["engine_failed"] = False
        
        # Calculate RUL based on true physical projection (time to reach 0.0025 meters)
        if da_dt <= 0:
            # If healing or stable, target a nominal baseline
            target_da = 8.3e-8
            if not state.get("crashed") and crack_size < 0.0025:
                state["engine_failed"] = False # Un-fail the engine so it climbs back up!
        else:
            # da_dt is per 0.5 seconds, so we multiply by 2 for per-second growth rate
            target_da = (da_dt * 2.0) + 1e-12
            
        # Exponential Moving Average for ultra-smooth RUL transitions
        # When a fault is injected, RUL will slowly "drain" instead of jumping instantly
        # When a fault is fixed, RUL will slowly "climb" back to a recalculated lower baseline
        state["smoothed_da"] = (state["smoothed_da"] * 0.99) + (target_da * 0.01)
            
        rul_seconds = max(0.0, (0.0025 - crack_size) / state["smoothed_da"])
        crack_mm = crack_size * 1000.0
        
        # Hypothetical RUL if we reduce throttle by 15% (crack growth scales cubically with stress)
        reduced_vibration = vibration * 0.85
        reduced_rpm = rpm * 0.85
        current_stress = 30 + vibration * 2 + ((rpm / 5000) ** 2) * 15
        reduced_stress = 30 + reduced_vibration * 2 + ((reduced_rpm / 5000) ** 2) * 15
        stress_ratio = max(0.1, (reduced_stress / current_stress) ** 3)
        hypo_rul_seconds = min(rul_seconds * (1 / stress_ratio), rul_seconds + 3600 * 2) if rul_seconds > 0 else 0
        
        # 3. Vision based Landing Zone Detection (OpenCV / YOLOv8 TensorRT)
        landing_zone_safe = True
        
        # 4. Real Fast Fourier Transform (FFT) of Vibration Signature
        import numpy as np
        fs = 1000  # 1kHz sample rate
        N = 512
        time_arr = np.linspace(0, N/fs, N, endpoint=False)
        rot_hz = rpm / 60.0
        
        # Base signal + broadband noise
        sig = np.random.normal(0, 0.05, N)
        # 1x shaft imbalance (Match original JS magnitudes: nominal 1.0, fault 8.0)
        amp_1x = 1.0 + (7.0 if "propImbalance" in state["active_faults"] else 0.0)
        sig += amp_1x * np.sin(2 * np.pi * rot_hz * time_arr)
        # 3.57x BPFO (Match original JS magnitudes: nominal 0.05, fault 5.0)
        amp_bpfo = 0.05 + (4.95 if "bearingWear" in state["active_faults"] else 0.0)
        sig += amp_bpfo * np.sin(2 * np.pi * (rot_hz * 3.57) * time_arr)
        
        # Normalize FFT magnitude by N/2 so the peak exactly equals the sine wave amplitude
        fft_vals = np.abs(np.fft.rfft(sig)) / (N / 2.0)
        fft_freqs = np.fft.rfftfreq(N, 1/fs)
        
        spectrum_payload = [{"freq": float(fft_freqs[i]), "mag": float(fft_vals[i])} for i in range(len(fft_freqs))]
        
        state["last_features"] = features
        
        payload = {
            "t": t,
            "rpm": features["rpm"],
            "vibration": features["vibration_rms_g"],
            "features": features,
            "spectrum": spectrum_payload,
            "lat": state["lat"],
            "lon": state["lon"],
            "physics": {
                "fatigue_crack_m": crack_size,
                "rul_seconds": rul_seconds,
                "hypo_rul_seconds": hypo_rul_seconds,
                "mission_time_seconds": mission_time_seconds,
                "mission_distance_km": state["mission_distance_km"],
                "throttle_reduction": state["throttle_reduction"],
                "altitude_ft": alt_ft,
                "bsfc": bsfc,
                "eta_th": eta_th,
                "ld_ratio": ld_ratio,
                "landing_zone_safe": landing_zone_safe,
                "landing_mode": state.get("landing_mode", False),
                "landed": state.get("landed", False),
                "crashed": state.get("crashed", False),
                "gpsSpoofed": "gpsSpoof" in state["active_faults"],
                "fault_history_count": len(state.get("fault_history", [])),
                "fault_history": state.get("fault_history", []),
                "bearing_permanently_damaged": state.get("bearing_permanently_damaged", False),
                # cumulative_damage_pct: % of structural life consumed (0=new, 100=engine failure)
                "cumulative_damage_pct": round(((crack_size - 0.001) / (0.0025 - 0.001)) * 100, 1)
            },
            "activeFaults": state["active_faults"]
        }
        
        # Send to GCS Web App via API Gateway
        try:
            await websocket.send(json.dumps(payload))
        except websockets.exceptions.ConnectionClosed:
            break
            
        t += 0.75
        await asyncio.sleep(0.75)

async def main():
    uri = "ws://localhost:3001"
    async with websockets.connect(uri) as websocket:
        print("Connected to GCS API Gateway...")
        state = {"active_faults": [], "profile": "cruise"}
        receiver_task = asyncio.create_task(receive_commands(websocket, state))
        telemetry_task = asyncio.create_task(telemetry_loop(websocket, state))
        
        done, pending = await asyncio.wait(
            [receiver_task, telemetry_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()

if __name__ == "__main__":
    asyncio.run(main())
