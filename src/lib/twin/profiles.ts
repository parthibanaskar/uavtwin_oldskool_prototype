import type { FlightProfile, ParamKey, Scenario, Subsystem } from "./types";

export interface ParamSpec {
  label: string;
  unit: string;
  /** Absolute display/analysis bounds. */
  min: number;
  max: number;
  /** Direction that indicates degradation. */
  worseWhen: "high" | "low";
  /** Soft limit used for deviation scoring and RUL extrapolation. */
  limit: number;
  subsystem: Subsystem;
  decimals: number;
}

export const PARAM_SPECS: Record<ParamKey, ParamSpec> = {
  rpm: {
    label: "Engine RPM",
    unit: "rpm",
    min: 0,
    max: 9000,
    worseWhen: "high",
    limit: 8200,
    subsystem: "engine",
    decimals: 0,
  },
  egt: {
    label: "Exhaust Gas Temp",
    unit: "\u00b0C",
    min: 200,
    max: 950,
    worseWhen: "high",
    limit: 820,
    subsystem: "engine",
    decimals: 0,
  },
  vibration: {
    label: "Vibration RMS",
    unit: "mm/s",
    min: 0,
    max: 22,
    worseWhen: "high",
    limit: 11,
    subsystem: "vibration",
    decimals: 2,
  },
  oilPressure: {
    label: "Oil Pressure",
    unit: "bar",
    min: 0,
    max: 7,
    worseWhen: "low",
    limit: 2.4,
    subsystem: "lubrication",
    decimals: 2,
  },
  oilTemp: {
    label: "Oil Temperature",
    unit: "\u00b0C",
    min: 20,
    max: 170,
    worseWhen: "high",
    limit: 132,
    subsystem: "lubrication",
    decimals: 1,
  },
  fuelFlow: {
    label: "Fuel Flow",
    unit: "L/h",
    min: 0,
    max: 34,
    worseWhen: "low",
    limit: 6.5,
    subsystem: "fuel",
    decimals: 2,
  },
  busVoltage: {
    label: "Bus Voltage",
    unit: "V",
    min: 18,
    max: 30,
    worseWhen: "low",
    limit: 22.4,
    subsystem: "electrical",
    decimals: 2,
  },
  cht: {
    label: "Cylinder Head Temp",
    unit: "\u00b0C",
    min: 40,
    max: 300,
    worseWhen: "high",
    limit: 245,
    subsystem: "engine",
    decimals: 0,
  },
};

export interface ProfileSpec {
  label: string;
  description: string;
  nominal: Record<ParamKey, number>;
  noise: Record<ParamKey, number>;
  airspeed: number;
}

function makeProfile(
  label: string,
  description: string,
  airspeed: number,
  nominal: Record<ParamKey, number>,
): ProfileSpec {
  return {
    label,
    description,
    airspeed,
    nominal,
    noise: {
      rpm: 28,
      egt: 5.5,
      vibration: 0.16,
      oilPressure: 0.045,
      oilTemp: 0.7,
      fuelFlow: 0.16,
      busVoltage: 0.06,
      cht: 2.4,
    },
  };
}

export const FLIGHT_PROFILES: Record<FlightProfile, ProfileSpec> = {
  idle: makeProfile("Idle / Ground Run", "Engine warm, no thrust demand", 0, {
    rpm: 2400,
    egt: 430,
    vibration: 1.6,
    oilPressure: 3.1,
    oilTemp: 72,
    fuelFlow: 5.2,
    busVoltage: 27.6,
    cht: 128,
  }),
  takeoff: makeProfile("Takeoff / Climb", "Max continuous power, high thermal load", 32, {
    rpm: 7600,
    egt: 742,
    vibration: 4.4,
    oilPressure: 4.9,
    oilTemp: 112,
    fuelFlow: 26.5,
    busVoltage: 28.3,
    cht: 214,
  }),
  cruise: makeProfile("Cruise", "Steady-state endurance leg", 26, {
    rpm: 6100,
    egt: 646,
    vibration: 2.9,
    oilPressure: 4.3,
    oilTemp: 96,
    fuelFlow: 16.4,
    busVoltage: 28.1,
    cht: 182,
  }),
  loiter: makeProfile("Loiter / ISR Orbit", "Low-power orbit over target area", 19, {
    rpm: 4800,
    egt: 566,
    vibration: 2.3,
    oilPressure: 3.8,
    oilTemp: 88,
    fuelFlow: 11.2,
    busVoltage: 27.9,
    cht: 158,
  }),
  descent: makeProfile("Descent / Approach", "Reduced power, cooling airflow high", 22, {
    rpm: 3600,
    egt: 486,
    vibration: 2.0,
    oilPressure: 3.4,
    oilTemp: 80,
    fuelFlow: 7.6,
    busVoltage: 27.8,
    cht: 140,
  }),
};

export const HOTSPOTS: Record<string, { label: string; subsystem: Subsystem }> = {
  bearing: { label: "Main Bearing / Crank", subsystem: "vibration" },
  propeller: { label: "Propeller & Hub", subsystem: "vibration" },
  hotSection: { label: "Hot Section / Exhaust", subsystem: "engine" },
  oilSystem: { label: "Oil Pump & Gallery", subsystem: "lubrication" },
  fuelSystem: { label: "Fuel Pump & Lines", subsystem: "fuel" },
  electrical: { label: "Generator & Bus", subsystem: "electrical" },
  avionics: { label: "Nav / GNSS Bay", subsystem: "nav" },
  cylinder: { label: "Cylinder Block", subsystem: "engine" },
};

export const SCENARIOS: Scenario[] = [
  {
    key: "bearingWear",
    label: "Main bearing wear",
    subsystem: "vibration",
    severity: "critical",
    hotspot: "bearing",
    rampSeconds: 75,
    description: "Spalling on the main bearing race raises the BPFO band and oil temperature.",
  },
  {
    key: "propImbalance",
    label: "Propeller imbalance",
    subsystem: "vibration",
    severity: "warning",
    hotspot: "propeller",
    rampSeconds: 25,
    description: "Blade erosion or ice shedding drives a strong 1x rotational vibration peak.",
  },
  {
    key: "oilStarvation",
    label: "Oil starvation",
    subsystem: "lubrication",
    severity: "critical",
    hotspot: "oilSystem",
    rampSeconds: 45,
    description: "Oil pump wear or a gallery leak collapses pressure and spikes oil temperature.",
  },
  {
    key: "egtOvertemp",
    label: "Hot section overtemp",
    subsystem: "engine",
    severity: "critical",
    hotspot: "hotSection",
    rampSeconds: 40,
    description: "Lean mixture / hot section distress pushes EGT and CHT beyond limits.",
  },
  {
    key: "fuelPumpDegrade",
    label: "Fuel pump degradation",
    subsystem: "fuel",
    severity: "warning",
    hotspot: "fuelSystem",
    rampSeconds: 60,
    description: "Primary pump loses head pressure; fuel flow sags and RPM hunts.",
  },
  {
    key: "fuelBlockage",
    label: "Fuel line blockage",
    subsystem: "fuel",
    severity: "critical",
    hotspot: "fuelSystem",
    rampSeconds: 20,
    description: "Contamination restricts the primary line, starving the engine.",
  },
  {
    key: "sensorDrift",
    label: "EGT sensor drift",
    subsystem: "engine",
    severity: "advisory",
    hotspot: "hotSection",
    rampSeconds: 50,
    description: "Channel A thermocouple drifts while channel B stays true \u2014 sensor, not engine.",
  },
  {
    key: "vibSensorFail",
    label: "Vibration sensor failure",
    subsystem: "vibration",
    severity: "advisory",
    hotspot: "bearing",
    rampSeconds: 5,
    description: "Channel A accelerometer goes dead; redundancy voting must reject it.",
  },
  {
    key: "busSag",
    label: "Electrical bus sag",
    subsystem: "electrical",
    severity: "warning",
    hotspot: "electrical",
    rampSeconds: 35,
    description: "Generator field weakening drops bus voltage under load.",
  },
  {
    key: "gpsSpoof",
    label: "GPS spoofing",
    subsystem: "nav",
    severity: "critical",
    hotspot: "avionics",
    rampSeconds: 12,
    description: "Reported GNSS position walks away from the inertial solution.",
  },
  {
    key: "icing",
    label: "Induction icing load",
    subsystem: "engine",
    severity: "warning",
    hotspot: "cylinder",
    rampSeconds: 40,
    description: "Ice accretion raises drag and manifold restriction; RPM falls, CHT climbs.",
  },
  {
    key: "rulAdvisory",
    label: "RUL optimization advisory",
    subsystem: "engine",
    severity: "advisory",
    hotspot: "engine",
    rampSeconds: 1,
    description: "Manually triggers a prescriptive advisory to reduce throttle to preserve Remaining Useful Life.",
  },
];

export const SCENARIO_BY_KEY: Record<string, Scenario> = Object.fromEntries(
  SCENARIOS.map((s) => [s.key, s]),
);
