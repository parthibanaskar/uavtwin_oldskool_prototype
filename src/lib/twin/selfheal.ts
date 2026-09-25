import type { SelfHealAction } from "./types";

export interface HealPlan {
  action: string;
  detail: string;
  status: SelfHealAction["status"];
}

/** Deterministic mitigation playbook keyed by the diagnosed fault. */
export const HEAL_PLAYBOOK: Record<string, HealPlan[]> = {
  bearingWear: [
    {
      action: "Derate to 82% max continuous",
      detail: "Reduces bearing load and slows spall growth.",
      status: "recommended",
    },
    {
      action: "Raise vibration sampling to 4 Hz",
      detail: "Tighter trend resolution for the BPFO band.",
      status: "recommended",
    },
    {
      action: "Plan divert to nearest strip",
      detail: "Recommend landing within the computed remaining life.",
      status: "recommended",
    },
  ],
  propImbalance: [
    {
      action: "Avoid 5,900\u20136,300 rpm band",
      detail: "Governor limit set to skip the resonant band.",
      status: "recommended",
    },
    {
      action: "Hold current airspeed",
      detail: "Prevents further blade loading until inspection.",
      status: "monitoring",
    },
  ],
  oilStarvation: [
    {
      action: "Engage auxiliary oil pump",
      detail: "Restores gallery pressure using the backup pump.",
      status: "recommended",
    },
    {
      action: "Reduce power to loiter setting",
      detail: "Cuts heat rejection demand on the oil circuit.",
      status: "recommended",
    },
    {
      action: "Arm safe-landing sequence",
      detail: "Divert field selection opened for operator confirm.",
      status: "recommended",
    },
  ],
  egtOvertemp: [
    {
      action: "Enrich mixture 6%",
      detail: "Cools the hot section by moving off peak EGT.",
      status: "recommended",
    },
    {
      action: "Derate to 88% power",
      detail: "Brings turbine inlet temperature back inside limits.",
      status: "recommended",
    },
  ],
  fuelDelivery: [
    {
      action: "Switch to secondary fuel path",
      detail: "Isolates the degraded pump and restricted line.",
      status: "recommended",
    },
    {
      action: "Re-trim governor for new flow",
      detail: "Restores commanded RPM on the backup path.",
      status: "recommended",
    },
  ],
  busSag: [
    {
      action: "Shed non-essential loads",
      detail: "Payload heaters and downlink dropped to protect avionics.",
      status: "recommended",
    },
    {
      action: "Transfer to battery bus",
      detail: "Holds 24 V rail while generator output is degraded.",
      status: "monitoring",
    },
  ],
  gpsSpoof: [
    {
      action: "Reject GNSS, hold inertial + terrain fix",
      detail: "Navigation falls back to dead reckoning.",
      status: "recommended",
    },
    {
      action: "Freeze waypoint updates from GNSS",
      detail: "Prevents the spoofed track from steering the aircraft.",
      status: "recommended",
    },
    {
      action: "Report jam/spoof event to GCS",
      detail: "Signed entry written to the black box.",
      status: "recommended",
    },
  ],
  vibSensorFail: [
    {
      action: "Demote vibration channel A",
      detail: "Analytics now vote on channel B only.",
      status: "recommended",
    },
    {
      action: "Flag sensor for maintenance",
      detail: "No airframe action required in flight.",
      status: "monitoring",
    },
  ],
  icing: [
    {
      action: "Enable induction anti-ice",
      detail: "Bleed heat applied to the intake path.",
      status: "recommended",
    },
    {
      action: "Descend 400 m to warmer air",
      detail: "Exits the icing layer.",
      status: "recommended",
    },
  ],
};

export interface DivertSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  surface: string;
  lengthM: number;
}

export const DIVERT_SITES: DivertSite[] = [
  {
    id: "alpha",
    name: "Safdarjung Airport (VDSJ)",
    lat: 28.5836,
    lon: 77.2066,
    surface: "Asphalt",
    lengthM: 1378,
  },
  {
    id: "bravo",
    name: "Hindon AFS (VIDX)",
    lat: 28.7111,
    lon: 77.3621,
    surface: "Concrete",
    lengthM: 2743,
  },
  {
    id: "charlie",
    name: "Palam AFS (VIDP)",
    lat: 28.5562,
    lon: 77.1,
    surface: "Asphalt",
    lengthM: 3810,
  },
  {
    id: "delta",
    name: "Noida Intl (Jewar)",
    lat: 28.1996,
    lon: 77.567,
    surface: "Asphalt",
    lengthM: 3900,
  },
];

/** Haversine formula to calculate distance in km between two geo points */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Calculate bearing in degrees from true north */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  lat1 = (lat1 * Math.PI) / 180;
  lat2 = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/** Cruise ground speed in km/min used for reachability against RUL. */
const GROUND_SPEED_KM_PER_MIN = 1.35;

export function minutesToDistance(distanceKm: number) {
  return distanceKm / GROUND_SPEED_KM_PER_MIN;
}

export function isReachable(distanceKm: number, rulMinutes: number | null) {
  if (rulMinutes === null) return true;
  return minutesToDistance(distanceKm) < rulMinutes;
}
