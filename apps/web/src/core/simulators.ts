/**
 * Real, deterministic physics/algorithm computations behind the simulator
 * agents — this is what lets each agent be PROVEN to "give the right result".
 *
 * Every function is pure and unit-checked in tests/agent_methods.test.mjs
 * against a known reference case (value cross-checked with the SOTA source
 * linked in the agent's `method.sources`). Constants use CODATA / IAU values.
 */

// ---- Physical constants (SI) --------------------------------------------
export const G0 = 9.80665; // standard gravity (m/s²) — Isp → exhaust velocity
export const C = 299_792_458; // speed of light (m/s)
export const SOLAR_FLUX_1AU = 1361; // solar constant (W/m²), IAU/PMOD
export const GM_EARTH = 3.986004418e14; // Earth gravitational parameter (m³/s²)
export const OMEGA_EARTH = 7.292115e-5; // Earth sidereal rotation rate (rad/s)
export const R_EARTH = 6.378137e6; // Earth equatorial radius (m)

/** Effective exhaust velocity from specific impulse: ve = Isp · g0. */
export const exhaustVelocity = (ispSeconds: number): number => ispSeconds * G0;

/** Tsiolkovsky rocket equation: Δv = ve · ln(m0/mf). */
export const tsiolkovskyDeltaV = (ispSeconds: number, m0: number, mf: number): number =>
  exhaustVelocity(ispSeconds) * Math.log(m0 / mf);

/** Ion/nuclear thrust from mass flow: F = ṁ · ve. */
export const thrustFromMassFlow = (massFlowKgS: number, ispSeconds: number): number =>
  massFlowKgS * exhaustVelocity(ispSeconds);

/** Radiation pressure on a perfect reflector: P = 2·Φ/c. */
export const radiationPressure = (fluxWm2: number): number => (2 * fluxWm2) / C;

/** Force on a sail of area A under a reflected flux: F = P·A. */
export const sailForce = (fluxWm2: number, areaM2: number): number =>
  radiationPressure(fluxWm2) * areaM2;

/** Geostationary orbital radius: r = (GM/ω²)^(1/3). */
export const geostationaryRadius = (): number => Math.cbrt(GM_EARTH / OMEGA_EARTH ** 2);

/** Geostationary altitude above the equator (m). */
export const geostationaryAltitude = (): number => geostationaryRadius() - R_EARTH;

/** Beam-push force on a reflective sail: F = 2·P/c (P = beam power, W). */
export const beamForce = (beamPowerW: number): number => (2 * beamPowerW) / C;

/** Electrodynamic tether force: F = B·I·L (fields ⟂). */
export const tetherForce = (bTesla: number, currentA: number, lengthM: number): number =>
  bTesla * currentA * lengthM;

/** Charged-particle gyroradius in a magnetic shield: r = m·v/(q·B). */
export const gyroradius = (massKg: number, velMs: number, chargeC: number, bTesla: number): number =>
  (massKg * velMs) / (chargeC * bTesla);

/** Beer–Lambert shielding attenuation: I/I0 = exp(-Σ·x). */
export const shieldTransmission = (macroXsPerM: number, thicknessM: number): number =>
  Math.exp(-macroXsPerM * thicknessM);

/** ICRP effective dose: E = Σ wR · D_R (Sv). */
export const effectiveDose = (contributions: { wR: number; dGy: number }[]): number =>
  contributions.reduce((sum, c) => sum + c.wR * c.dGy, 0);

/* ---- Building-physics functions (MBSE function agents) ------------------ */

/** Fourier conduction heat flux through a wall: q = λ·ΔT/e (W/m²). */
export const heatFlux = (lambdaWmK: number, deltaTK: number, thicknessM: number): number =>
  (lambdaWmK * deltaTK) / thicknessM;

/** Thermal resistance of a layer: R = e/λ (m²·K/W). */
export const thermalResistance = (thicknessM: number, lambdaWmK: number): number =>
  thicknessM / lambdaWmK;

/** Thermal diffusivity: α = λ/(ρ·c) (m²/s) — drives thermal inertia. */
export const thermalDiffusivity = (lambdaWmK: number, rhoKgM3: number, cJkgK: number): number =>
  lambdaWmK / (rhoKgM3 * cJkgK);

/** Mechanical normal stress: σ = F/A (Pa). */
export const normalStress = (forceN: number, areaM2: number): number => forceN / areaM2;

/** Safety factor against rupture: SF = σ_rupture / σ (—). */
export const safetyFactor = (ruptureStrengthPa: number, appliedStressPa: number): number =>
  ruptureStrengthPa / appliedStressPa;

/** Moisture buffering over a RH cycle: m = MBV·ΔRH·A (g), MBV in g/(m²·%RH). */
export const moistureBuffered = (mbv: number, deltaRHpct: number, areaM2: number): number =>
  mbv * deltaRHpct * areaM2;

/**
 * Alcubierre warp: order-of-magnitude negative energy of the original bubble.
 * E ~ -(c⁴/G) · v · R · σ  (v in units of c). Returned as |E| in joules for
 * a rough magnitude only — the metric is theoretical/unproven.
 */
export const alcubierreEnergyMagnitude = (
  vOverC: number,
  bubbleRadiusM: number,
  wallThicknessM: number
): number => {
  const Ggrav = 6.674e-11;
  return (C ** 4 / Ggrav) * vOverC * bubbleRadiusM * (bubbleRadiusM / wallThicknessM);
};
