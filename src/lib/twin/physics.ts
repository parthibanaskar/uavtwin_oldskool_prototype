// --- Section 2: Atmosphere & Aero ---

export const ISA = {
  T0: 288.15, // K
  p0: 101325, // Pa
  L: 0.0065,  // K/m
  g: 9.80665, // m/s^2
  R: 287.05,  // J/(kg*K)
};

export function getAtmosphere(altitudeMeters: number) {
  const T = ISA.T0 - ISA.L * altitudeMeters;
  const p = ISA.p0 * Math.pow(T / ISA.T0, ISA.g / (ISA.L * ISA.R));
  const rho = p / (ISA.R * T);
  return { T, p, rho };
}

export const UAV_SPECS = {
  S: 12.0,      // m^2, wing area
  AR: 15.0,     // aspect ratio
  e: 0.85,      // Oswald efficiency
  Cd0: 0.025,   // Zero-lift drag
  W: 1000 * 9.81, // Weight in Newtons
  prop_eff: 0.8, // Propeller efficiency
};

export function getAeroDynamics(rho: number, V: number, weight = UAV_SPECS.W) {
  if (V < 1) V = 1; // avoid div by zero
  const q = 0.5 * rho * V * V;
  const Cl = weight / (q * UAV_SPECS.S);
  const Cd_induced = (Cl * Cl) / (Math.PI * UAV_SPECS.e * UAV_SPECS.AR);
  const Cd = UAV_SPECS.Cd0 + Cd_induced;
  const LD = Cl / Cd;
  const P_req = q * V * UAV_SPECS.S * Cd;
  return { Cl, Cd, LD, P_req };
}

// --- Section 3: Thermodynamics ---

export const ENGINE_SPECS = {
  bore: 0.084, // m
  stroke: 0.061, // m
  compression_ratio: 9.0,
  gamma: 1.35,
  Vd: 0.001352, // m^3 (1.3L displacement)
  QHV: 43.4e6, // J/kg (avgas lower heating value)
};

export function getThermodynamics(rpm: number, fuelFlowKgS: number, airFlowKgS: number) {
  const eta_th = 1 - 1 / Math.pow(ENGINE_SPECS.compression_ratio, ENGINE_SPECS.gamma - 1);
  const AFR = fuelFlowKgS > 0 ? airFlowKgS / fuelFlowKgS : 14.7;
  
  // Simplified power estimate based on ideal efficiency and mechanical efficiency
  const mech_eff = 0.85;
  const P_brake = fuelFlowKgS * ENGINE_SPECS.QHV * eta_th * mech_eff;
  
  const BSFC = P_brake > 0 ? (fuelFlowKgS / P_brake) * 3.6e6 : 0; // kg/kWh
  return { eta_th, AFR, P_brake, BSFC };
}

// Woschni heat transfer (simplified mean cycle)
export function getWoschniHeatTransfer(mean_p_kpa: number, mean_T_K: number, mean_gas_vel: number) {
  return 3.26 * Math.pow(ENGINE_SPECS.bore, -0.2) * 
         Math.pow(mean_p_kpa, 0.8) * 
         Math.pow(mean_T_K, -0.55) * 
         Math.pow(mean_gas_vel, 0.8);
}

// --- Section 5: Fatigue & RUL ---

export const FATIGUE_SPECS = {
  C: 1e-11,
  m: 2.5,
  Y: 1.12, // Geometry factor
  a_crit: 0.015, // 15mm critical crack length
};

export function integrateParisLaw(a: number, deltaSigma_MPa: number, cycles: number) {
  // da/dN = C * (Delta K)^m
  // Delta K = Y * DeltaSigma * sqrt(pi * a)
  
  // Numerical integration over N cycles
  let current_a = a;
  for(let i=0; i<cycles; i++) {
    const deltaK = FATIGUE_SPECS.Y * deltaSigma_MPa * Math.sqrt(Math.PI * current_a);
    const da = FATIGUE_SPECS.C * Math.pow(deltaK, FATIGUE_SPECS.m);
    current_a += da;
    if (current_a > FATIGUE_SPECS.a_crit) break;
  }
  return current_a;
}

export function estimateRUL(a: number, deltaSigma_MPa: number, rpm: number) {
  if (a >= FATIGUE_SPECS.a_crit || rpm <= 0) return 0;
  
  // Estimate cycles to failure analytically or numerically
  // N = (a_crit^(1-m/2) - a_initial^(1-m/2)) / (C * (Y * DeltaSigma * sqrt(pi))^m * (1-m/2))
  // We'll use the analytical integral
  
  const m2 = 1 - FATIGUE_SPECS.m / 2;
  const coeff = FATIGUE_SPECS.C * Math.pow(FATIGUE_SPECS.Y * deltaSigma_MPa * Math.sqrt(Math.PI), FATIGUE_SPECS.m);
  
  const cycles_remaining = (Math.pow(FATIGUE_SPECS.a_crit, m2) - Math.pow(a, m2)) / (coeff * m2);
  const cycles_per_sec = rpm / 60;
  return cycles_remaining / cycles_per_sec; // seconds
}

// --- Section 4: Sensor Fusion (Anti-spoofing) ---
export function checkGPSconsistency(gpsLat: number, gpsLon: number, insLat: number, insLon: number) {
  const R = 6371e3; // Earth radius
  const dLat = (gpsLat - insLat) * Math.PI / 180;
  const dLon = (gpsLon - insLon) * Math.PI / 180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(insLat*Math.PI/180)*Math.cos(gpsLat*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const dist = R * c; // meters

  // If distance divergence is > 3 sigma of GPS noise (approx 15m), flag it
  return { dist, spoofed: dist > 15 };
}
