/**
 * ESPACE DE VARIABLES — le « TENSEUR NOMMÉ » du flux fonctionnel.
 *
 * SSOT de la représentation bout-en-bout des variables : chaque variable de
 * chaque agent du flux (et du flux lui-même) est une entrée NOMMÉE d'un
 * tenseur à deux axes lisibles :
 *
 *      axe 1 : la VARIABLE (avec son rôle)   axe 2 : le SCÉNARIO
 *      T_ext, HR_ext, e, λ, R, q, SF…        saison × jour/nuit
 *
 * Les 4 RÔLES (taxonomie actée avec l'utilisateur) :
 *  - 'environnant'  : SUBIE — profil temporel issu de la recherche sourcée
 *                     des environnants (fluctuation saisonnière et jour/nuit).
 *  - 'compromis'    : LIBRE — résolue par l'OPTIMISEUR (e, λ, m″…) : une seule
 *                     valeur doit satisfaire TOUS les scénarios à la fois ;
 *                     c'est là qu'est le compromis.
 *  - 'etat'         : INTERMÉDIAIRE — calculée par les formules physiques.
 *  - 'performance'  : JUGÉE — comparée à la zone de conformité de
 *                     l'environnant utilisateur.
 *
 * Ce fichier ne rend rien : il CONSTRUIT le tenseur (fonction pure) à partir
 * du modèle MBSE (environnants sourcés) et des formules de simulators.ts.
 * La traduction UI (vues A graphe porté, B jauges bullet, C matrice) vit dans
 * components/system/VariablesView.tsx — principe de réduction de la dette de
 * compréhension.
 */
import type { ConformityRange, SystemComponent } from './types';
import {
  heatFlux,
  moistureBuffered,
  normalStress,
  safetyFactor,
  thermalDiffusivity,
  thermalResistance,
} from './simulators';

/* ------------------------------------------------------------------ */
/* Axes of the named tensor                                            */
/* ------------------------------------------------------------------ */

export type ScenarioId = 'hiver-jour' | 'hiver-nuit' | 'ete-jour' | 'ete-nuit';

export interface Scenario {
  id: ScenarioId;
  /** i18n key of the scenario label. */
  labelKey: string;
}

export const SCENARIOS: Scenario[] = [
  { id: 'hiver-jour', labelKey: 'scHiverJour' },
  { id: 'hiver-nuit', labelKey: 'scHiverNuit' },
  { id: 'ete-jour', labelKey: 'scEteJour' },
  { id: 'ete-nuit', labelKey: 'scEteNuit' },
];

export type VariableRole = 'environnant' | 'compromis' | 'etat' | 'performance';

export const ROLE_ORDER: VariableRole[] = ['environnant', 'compromis', 'etat', 'performance'];

/** Role colors — categorical palette VALIDATED (six checks, light & dark:
 *  lightness band, chroma floor, CVD ΔE≥8, normal-vision ΔE≥15, contrast).
 *  The role NAME is always written next to the chip: never color alone. */
export const ROLE_COLORS: Record<VariableRole, { light: string; dark: string }> = {
  environnant: { light: '#0284c7', dark: '#0284c7' },
  compromis: { light: '#7c3aed', dark: '#8b5cf6' },
  etat: { light: '#0d9488', dark: '#0d9488' },
  performance: { light: '#c2410c', dark: '#ea580c' },
};

export const ROLE_LABEL_KEYS: Record<VariableRole, string> = {
  environnant: 'roleEnvironnant',
  compromis: 'roleCompromis',
  etat: 'roleEtat',
  performance: 'rolePerformance',
};

/** One named entry of the tensor: a variable with one value PER SCENARIO. */
export interface NamedVariable {
  id: string;
  name: string;
  symbol: string;
  unit: string;
  role: VariableRole;
  /** value along the scenario axis (compromis vars are constant by design). */
  values: Record<ScenarioId, number>;
  /** ids of the variables this one is computed FROM (edges of view A). */
  dependsOn: string[];
  /** performance vars only: the user's conformity range it is judged against. */
  requirement?: ConformityRange;
  /** the formula that produces it (état/performance vars). */
  formula?: string;
}

export interface VariableSpace {
  scenarios: Scenario[];
  variables: NamedVariable[];
}

/* ------------------------------------------------------------------ */
/* Construction — pure function over the MBSE model                    */
/* ------------------------------------------------------------------ */

/** Compromis reference values (raw-earth brick) — the optimizer's free
 *  variables. ONE value must hold across every scenario: the compromise. */
const COMPROMIS = {
  e: 0.3, // wall thickness (m)
  lambda: 0.5, // thermal conductivity (W/m·K)
  mpp: 510, // surface mass (kg/m²) — acoustic mass law
};

/** Fixed material/context constants used by the formulas (not optimised). */
const CTX = {
  rho: 1700, // density (kg/m³)
  c: 1000, // heat capacity (J/kg·K)
  A: 0.09, // brick section (m²)
  sigmaR: 2e6, // compressive strength (Pa)
  MBV: 2, // moisture buffer value (g/m²·%RH)
  wallArea: 12, // buffering wall area (m²)
  freq: 500, // acoustic reference frequency (Hz)
  tIntWinter: 19, // comfort setpoint winter (°C)
  tIntSummer: 26, // comfort setpoint summer (°C)
};

const all = (v: number): Record<ScenarioId, number> => ({
  'hiver-jour': v,
  'hiver-nuit': v,
  'ete-jour': v,
  'ete-nuit': v,
});

const per = (hj: number, hn: number, ej: number, en: number): Record<ScenarioId, number> => ({
  'hiver-jour': hj,
  'hiver-nuit': hn,
  'ete-jour': ej,
  'ete-nuit': en,
});

const mapValues = (
  src: Record<ScenarioId, number>,
  f: (v: number, s: ScenarioId) => number
): Record<ScenarioId, number> => ({
  'hiver-jour': f(src['hiver-jour'], 'hiver-jour'),
  'hiver-nuit': f(src['hiver-nuit'], 'hiver-nuit'),
  'ete-jour': f(src['ete-jour'], 'ete-jour'),
  'ete-nuit': f(src['ete-nuit'], 'ete-nuit'),
});

const isWinter = (s: ScenarioId) => s.startsWith('hiver');

/**
 * Builds the named tensor from the designed system's environnants.
 * Returns null when no system has been designed yet.
 */
export function buildVariableSpace(components: SystemComponent[]): VariableSpace | null {
  const envs = components.filter((c) => c.kind === 'environment');
  const user = components.find((c) => c.kind === 'user');
  if (envs.length === 0 || !user) return null;

  const q = (re: RegExp, fallback: number): number => {
    for (const env of envs) {
      const found = env.quantities?.find((x) => re.test(x.name) || re.test(x.symbol));
      if (found) return found.value;
    }
    return fallback;
  };
  const req = (re: RegExp): ConformityRange | undefined => user.requirements?.find((r) => re.test(r.name));

  // ENVIRONNANT variables — seasonal & day/night profiles anchored on the
  // SOURCED extremes researched by the environnant agents (T_ext base winter
  // night, T_max summer day peak; the day/night amplitude reflects the sourced
  // « amplitude thermique jour/nuit marquée en été »).
  const tBase = q(/T_ext/, -7); // winter design temperature (night)
  const tMax = q(/T_max/, 32); // summer peak (day)
  const hrExt = q(/HR_ext/, 85);
  const fLoad = q(/^F$|Descente/, 45); // kN
  const lExt = q(/L_ext|Bruit/, 65); // dB(A)

  const tExt: NamedVariable = {
    id: 'T_ext',
    name: 'Température extérieure',
    symbol: 'T_ext',
    unit: '°C',
    role: 'environnant',
    values: per(tBase + 9, tBase, tMax, tMax - 14),
    dependsOn: [],
  };
  const hr: NamedVariable = {
    id: 'HR_ext',
    name: 'Humidité relative extérieure',
    symbol: 'HR_ext',
    unit: '%',
    role: 'environnant',
    values: per(hrExt, hrExt, 55, 70),
    dependsOn: [],
  };
  const F: NamedVariable = {
    id: 'F',
    name: 'Descente de charges',
    symbol: 'F',
    unit: 'kN',
    role: 'environnant',
    values: all(fLoad),
    dependsOn: [],
  };
  const lext: NamedVariable = {
    id: 'L_ext',
    name: 'Bruit routier en façade',
    symbol: 'L_ext',
    unit: 'dB(A)',
    role: 'environnant',
    values: per(lExt, lExt - 7, lExt, lExt - 7),
    dependsOn: [],
  };

  // COMPROMIS variables — constant across scenarios BY CONSTRUCTION: the
  // optimizer must find the single value that satisfies every scenario.
  const e: NamedVariable = {
    id: 'e',
    name: 'Épaisseur du mur',
    symbol: 'e',
    unit: 'm',
    role: 'compromis',
    values: all(COMPROMIS.e),
    dependsOn: [],
  };
  const lambda: NamedVariable = {
    id: 'lambda',
    name: 'Conductivité du matériau',
    symbol: 'λ',
    unit: 'W/m·K',
    role: 'compromis',
    values: all(COMPROMIS.lambda),
    dependsOn: [],
  };
  const mpp: NamedVariable = {
    id: 'mpp',
    name: 'Masse surfacique',
    symbol: 'm″',
    unit: 'kg/m²',
    role: 'compromis',
    values: all(COMPROMIS.mpp),
    dependsOn: [],
  };

  // ÉTAT variables — computed by the real physics of simulators.ts.
  const R: NamedVariable = {
    id: 'R',
    name: 'Résistance thermique',
    symbol: 'R',
    unit: 'm²K/W',
    role: 'etat',
    values: all(thermalResistance(COMPROMIS.e, COMPROMIS.lambda)),
    dependsOn: ['e', 'lambda'],
    formula: 'R = e / λ',
  };
  const alpha: NamedVariable = {
    id: 'alpha',
    name: 'Diffusivité thermique',
    symbol: 'α',
    unit: 'm²/s',
    role: 'etat',
    values: all(thermalDiffusivity(COMPROMIS.lambda, CTX.rho, CTX.c)),
    dependsOn: ['lambda'],
    formula: 'α = λ / (ρ·c)',
  };
  const sigma: NamedVariable = {
    id: 'sigma',
    name: 'Contrainte dans la brique',
    symbol: 'σ',
    unit: 'MPa',
    role: 'etat',
    values: mapValues(F.values, (f) => normalStress(f * 1000, CTX.A) / 1e6),
    dependsOn: ['F'],
    formula: 'σ = F / A',
  };
  const rAc: NamedVariable = {
    id: 'R_ac',
    name: 'Affaiblissement acoustique',
    symbol: 'R_ac',
    unit: 'dB',
    role: 'etat',
    values: all(20 * Math.log10(COMPROMIS.mpp * CTX.freq) - 47),
    dependsOn: ['mpp'],
    formula: 'R_ac = 20·log₁₀(m″·f) − 47',
  };

  // PERFORMANCE variables — judged against the USER's conformity zone.
  const dT = (t: number, s: ScenarioId) => Math.abs((isWinter(s) ? CTX.tIntWinter : CTX.tIntSummer) - t);
  const qWall: NamedVariable = {
    id: 'q',
    name: 'Flux de chaleur traversant',
    symbol: 'q',
    unit: 'W/m²',
    role: 'performance',
    values: mapValues(tExt.values, (t, s) => heatFlux(COMPROMIS.lambda, dT(t, s), COMPROMIS.e)),
    dependsOn: ['T_ext', 'R'],
    formula: 'q = λ·ΔT / e',
    requirement: req(/Flux de chaleur/),
  };
  const buffer: NamedVariable = {
    id: 'm_tampon',
    name: 'Capacité tampon d’humidité',
    symbol: 'm',
    unit: 'g/j',
    role: 'performance',
    values: mapValues(hr.values, (h) => moistureBuffered(CTX.MBV, Math.abs(h - 50), CTX.wallArea)),
    dependsOn: ['HR_ext'],
    formula: 'm = MBV·ΔHR·A',
    requirement: req(/tampon/i),
  };
  const SF: NamedVariable = {
    id: 'SF',
    name: 'Facteur de sécurité structurel',
    symbol: 'SF',
    unit: '—',
    role: 'performance',
    values: mapValues(sigma.values, (s) => safetyFactor(CTX.sigmaR, s * 1e6)),
    dependsOn: ['sigma'],
    formula: 'SF = σ_rupture / σ',
    requirement: req(/sécurité/i),
  };
  const lInt: NamedVariable = {
    id: 'L_int',
    name: 'Bruit résiduel intérieur',
    symbol: 'L_int',
    unit: 'dB(A)',
    role: 'performance',
    values: mapValues(lext.values, (l) => Math.max(0, l - (20 * Math.log10(COMPROMIS.mpp * CTX.freq) - 47))),
    dependsOn: ['L_ext', 'R_ac'],
    formula: 'L_int = max(0, L_ext − R_ac)',
    requirement: req(/[Bb]ruit/),
  };

  return {
    scenarios: SCENARIOS,
    variables: [tExt, hr, F, lext, e, lambda, mpp, R, alpha, sigma, rAc, qWall, buffer, SF, lInt],
  };
}

/** Is this performance value inside its conformity range? */
export const isConform = (v: NamedVariable, s: ScenarioId): boolean | undefined =>
  v.requirement ? v.values[s] >= v.requirement.min && v.values[s] <= v.requirement.max : undefined;

/** Human formatting of a physical value (shared by every quantitative view). */
export const fmtValue = (v: number): string =>
  Number.isInteger(v)
    ? v.toString()
    : Math.abs(v) >= 100
    ? v.toFixed(0)
    : Math.abs(v) >= 1
    ? v.toFixed(1)
    : v.toPrecision(3);
